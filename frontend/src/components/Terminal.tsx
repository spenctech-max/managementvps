import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { useAuth } from '../contexts/AuthContext';
import { X, Maximize2, Minimize2, RefreshCw } from 'lucide-react';
import 'xterm/css/xterm.css';

interface TerminalProps {
  serverId: string;
  serverName: string;
  onClose: () => void;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

export default function Terminal({ serverId, serverName, onClose }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const { token } = useAuth();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting'>('connecting');
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const connectWebSocket = useCallback(() => {
    if (!xtermRef.current || !token) return;

    const xterm = xtermRef.current;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;
      setReconnectAttempts(0);
      xterm.writeln('\x1b[1;32m✓ Connected to server\x1b[0m\r\n');

      // Request terminal session
      ws.send(JSON.stringify({
        type: 'terminal:start',
        serverId: serverId,
      }));
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'terminal:data') {
          xterm.write(data.data);
        } else if (data.type === 'terminal:error') {
          xterm.writeln(`\x1b[1;31m✗ Error: ${data.message}\x1b[0m\r\n`);
        } else if (data.type === 'connected') {
          xterm.writeln(`\x1b[1;36m${data.message}\x1b[0m\r\n`);
        } else if (data.type === 'terminal:closed') {
          xterm.writeln(`\x1b[1;33m⚠ ${data.message}\x1b[0m\r\n`);
        }
      } catch (error) {
        // Raw terminal data
        xterm.write(event.data);
      }
    };

    ws.onerror = () => {
      setConnectionStatus('error');
      xterm.writeln('\x1b[1;31m✗ WebSocket connection error\x1b[0m\r\n');
    };

    ws.onclose = (event) => {
      if (!shouldReconnectRef.current) {
        setConnectionStatus('disconnected');
        xterm.writeln('\x1b[1;33m⚠ Connection closed\x1b[0m\r\n');
        return;
      }

      // Attempt reconnection
      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttemptsRef.current++;
        setReconnectAttempts(reconnectAttemptsRef.current);
        setConnectionStatus('reconnecting');

        const delay = Math.min(
          INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1),
          MAX_RECONNECT_DELAY
        );

        xterm.writeln(
          `\x1b[1;33m⚠ Connection lost. Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...\x1b[0m\r\n`
        );

        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, delay);
      } else {
        setConnectionStatus('error');
        xterm.writeln(
          `\x1b[1;31m✗ Connection failed after ${MAX_RECONNECT_ATTEMPTS} attempts. Click reconnect to try again.\x1b[0m\r\n`
        );
      }
    };

    // Handle terminal input
    const handleData = (data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'terminal:input',
          data: data,
        }));
      }
    };

    xterm.onData(handleData);
  }, [serverId, token]);

  const handleManualReconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    reconnectAttemptsRef.current = 0;
    setReconnectAttempts(0);
    setConnectionStatus('connecting');

    if (wsRef.current) {
      wsRef.current.close();
    }

    connectWebSocket();
  }, [connectWebSocket]);

  useEffect(() => {
    if (!terminalRef.current || !token) return;

    // Create terminal instance
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e293b',
        foreground: '#e2e8f0',
        cursor: '#60a5fa',
        cursorAccent: '#1e293b',
        selectionBackground: '#334155',
        black: '#0f172a',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#cbd5e1',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#f1f5f9',
      },
      rows: 24,
      cols: 80,
    });

    // Add fit addon
    const fitAddon = new FitAddon();
    xterm.loadAddon(fitAddon);

    // Mount terminal
    xterm.open(terminalRef.current);
    fitAddon.fit();

    // Store refs
    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    // Connect to WebSocket
    shouldReconnectRef.current = true;
    connectWebSocket();

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'terminal:resize',
          rows: xterm.rows,
          cols: xterm.cols,
        }));
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      window.removeEventListener('resize', handleResize);
      if (wsRef.current) {
        wsRef.current.close();
      }
      xterm.dispose();
    };
  }, [serverId, token, connectWebSocket]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      fitAddonRef.current?.fit();
    }, 100);
  };

  return (
    <div className={`${
      isFullscreen
        ? 'fixed inset-0 z-50 bg-slate-950'
        : 'relative'
    }`}>
      {/* Terminal Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className={`h-2 w-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-400' :
            connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
            connectionStatus === 'reconnecting' ? 'bg-orange-400 animate-pulse' :
            connectionStatus === 'error' ? 'bg-red-400' :
            'bg-slate-600'
          }`} />
          <span className="text-sm font-medium text-white">{serverName}</span>
          <span className="text-xs text-slate-400">
            {connectionStatus === 'connected' ? 'Connected' :
             connectionStatus === 'connecting' ? 'Connecting...' :
             connectionStatus === 'reconnecting' ? `Reconnecting... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})` :
             connectionStatus === 'error' ? 'Connection Failed' :
             'Disconnected'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {(connectionStatus === 'error' || connectionStatus === 'disconnected') && (
            <button
              onClick={handleManualReconnect}
              className="text-slate-400 hover:text-white p-1"
              title="Reconnect"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="text-slate-400 hover:text-white p-1"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
            title="Close terminal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div className={`bg-slate-900 ${
        isFullscreen ? 'h-[calc(100vh-40px)]' : 'h-96'
      }`}>
        <div ref={terminalRef} className="h-full p-2" />
      </div>

      {/* Terminal Footer */}
      <div className="bg-slate-900 border-t border-slate-800 px-4 py-2">
        <p className="text-xs text-slate-500">
          Press <kbd className="px-1 py-0.5 bg-slate-800 rounded">Ctrl+C</kbd> to interrupt
          • <kbd className="px-1 py-0.5 bg-slate-800 rounded">Ctrl+D</kbd> to disconnect
        </p>
      </div>
    </div>
  );
}
