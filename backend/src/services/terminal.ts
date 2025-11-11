import { Client } from 'ssh2';
import { Logger } from 'winston';
import { Pool } from 'pg';
import { decrypt } from '../utils/crypto';

export class TerminalSession {
  private ssh: Client | null = null;
  private stream: any = null;
  private logger: Logger;
  private pool: Pool;
  private serverId: string;
  private userId: string;

  constructor(
    logger: Logger,
    pool: Pool,
    serverId: string,
    userId: string
  ) {
    this.logger = logger;
    this.pool = pool;
    this.serverId = serverId;
    this.userId = userId;
  }

  async connect(
    onData: (data: string) => void,
    onClose: () => void,
    onError: (error: Error) => void
  ): Promise<void> {
    try {
      // Get server details from database
      const serverResult = await this.pool.query(
        'SELECT * FROM servers WHERE id = $1 AND user_id = $2',
        [this.serverId, this.userId]
      );

      if (serverResult.rows.length === 0) {
        throw new Error('Server not found or access denied');
      }

      const server = serverResult.rows[0];

      // Decrypt credentials
      const credential = decrypt(server.credential);

      // Log credential access
      await this.pool.query(
        `INSERT INTO user_activity_logs (user_id, action, resource_type, resource_id, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [this.userId, 'CREDENTIAL_ACCESS', 'server', this.serverId, JSON.stringify({ action: 'terminal_access' })]
      );

      // Create SSH connection
      this.ssh = new Client();

      this.ssh.on('ready', () => {
        this.logger.info('SSH connection ready', { serverId: this.serverId, userId: this.userId });

        this.ssh!.shell({ term: 'xterm-256color' }, (err, stream) => {
          if (err) {
            onError(err);
            return;
          }

          this.stream = stream;

          stream.on('data', (data: Buffer) => {
            onData(data.toString('utf-8'));
          });

          stream.on('close', () => {
            this.logger.info('Terminal stream closed', { serverId: this.serverId });
            onClose();
          });

          stream.stderr.on('data', (data: Buffer) => {
            onData(data.toString('utf-8'));
          });
        });
      });

      this.ssh.on('error', (err) => {
        this.logger.error('SSH connection error', {
          serverId: this.serverId,
          error: err.message,
        });
        onError(err);
      });

      this.ssh.on('close', () => {
        this.logger.info('SSH connection closed', { serverId: this.serverId });
        onClose();
      });

      // Connect
      const config: any = {
        host: server.ip,
        port: server.port,
        username: server.username,
        readyTimeout: 10000,
      };

      if (server.auth_type === 'password') {
        config.password = credential;
      } else {
        config.privateKey = credential;
      }

      this.ssh.connect(config);
    } catch (error) {
      this.logger.error('Failed to start terminal session', {
        serverId: this.serverId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  write(data: string): void {
    if (this.stream) {
      this.stream.write(data);
    }
  }

  resize(rows: number, cols: number): void {
    if (this.stream) {
      this.stream.setWindow(rows, cols);
    }
  }

  close(): void {
    if (this.stream) {
      this.stream.end();
    }
    if (this.ssh) {
      this.ssh.end();
    }
    this.ssh = null;
    this.stream = null;
  }
}
