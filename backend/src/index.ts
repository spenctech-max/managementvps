import dotenv from 'dotenv';
dotenv.config();

// Import env first to trigger Zod validation at startup
import { env } from './config/env';

import express, { Application, Request, Response } from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import RedisStore from 'connect-redis';
import jwt from 'jsonwebtoken';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { metricsHandler, metricsMiddleware, initializeMetrics } from './services/prometheusMetrics';

// Config imports
import { logger, requestLogger } from './config/logger';
import { testDatabaseConnection, testDatabaseConnectionWithRetry, closeDatabasePool, pool } from './config/database';
import { redisClient, connectRedis, disconnectRedis } from './config/redis';

// Service imports
import { TerminalSession } from './services/terminal';
import BackupScheduler from './services/backupScheduler';
import { healthCheckService } from './services/healthCheckService';
import { bitlaunchService } from './services/bitlaunchService';
import cron from 'node-cron';

// Queue imports
import { QueueManager } from './queues/queueManager';
import backupWorker, { closeBackupWorker } from './queues/workers/backupWorker';
import scanWorker, { closeScanWorker } from './queues/workers/scanWorker';

// Middleware imports
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';

// Route imports
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import scanRoutes from './routes/scans';
import serverRoutes from './routes/servers';
import backupRoutes from './routes/backups';
import backupSchedulesRoutes from './routes/backupSchedules';
import backupRestoreRoutes from './routes/backupRestore';
import metricsRoutes from './routes/metrics';
import auditRoutes from './routes/audit';
import exportRoutes from './routes/export';
import jobRoutes from './routes/jobs';
import notificationRoutes from './routes/notifications';
import bitlaunchRoutes from './routes/bitlaunch';

/**
 * Application configuration
 * All values from validated environment
 */
const PORT = env.PORT;
const NODE_ENV = env.NODE_ENV;
const SESSION_SECRET = env.SESSION_SECRET;
const SESSION_TIMEOUT = 3600000; // 1 hour

/**
 * Create Express application
 */
const app: Application = express();

/**
 * Rate limiter configuration
 * General limiter for most API endpoints
 */
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  validate: { trustProxy: false }, // Bypass trust proxy validation
  skip: (req) => {
    // Skip rate limiting for auth endpoints
    return req.path.includes('/auth/');
  },
  handler: (req, res) => {
    // SECURITY: No IP logging for anonymity
    logger.warn('Rate limit exceeded', {
      requestId: req.id,
      path: req.path,
    });
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.',
    });
  },
});

/**
 * Rate limiter for authentication endpoints (more lenient)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 requests per 15 minutes for auth endpoints
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false }, // Bypass trust proxy validation
  handler: (req, res) => {
    logger.warn('Auth rate limit exceeded', {
      requestId: req.id,
      path: req.path,
    });
    res.status(429).json({
      success: false,
      message: 'Too many requests, please try again later.',
    });
  },
});

/**
 * CORS configuration
 */
const corsOptions = {
  origin: env.CORS_ORIGIN,
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

/**
 * Setup middleware in correct order
 */

// Trust proxy for rate limiting and correct IP detection behind nginx
app.set('trust proxy', true);

// Security middleware
app.use(helmet());
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression());

// Rate limiting
app.use('/api', limiter);

// Request ID tracking (must be before request logger)
app.use(requestIdMiddleware);

// Prometheus metrics middleware
app.use(metricsMiddleware);

// Request logging
app.use(requestLogger);

// Session configuration with Redis store
// SECURITY: Reduced session timeout to 1 hour, secure session ID regeneration
app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    name: 'sessionId',
    cookie: {
      secure: NODE_ENV === 'production', // Use secure cookies in production
      httpOnly: true,
      maxAge: SESSION_TIMEOUT, // SECURITY: Configurable session timeout (default: 1 hour)
      sameSite: 'lax',
    },
    // SECURITY: Regenerate session ID on login to prevent session fixation
    rolling: true, // Reset maxAge on every request
  })
);

/**
 * Health check endpoint (no authentication required)
 */
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: NODE_ENV,
  });
});

/**
 * Mount API routes
 */
// Auth routes with custom limiter (more lenient than general limiter)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/scans', scanRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/backup-schedules', backupSchedulesRoutes);
app.use('/api/backups', backupRestoreRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/bitlaunch', bitlaunchRoutes);

/**
 * Swagger API Documentation
 */
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * Prometheus Metrics Endpoint
 */
app.get('/metrics', metricsHandler);

/**
 * API root endpoint
 */
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Medicine Man API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      users: '/api/users',
      scans: '/api/scans',
      servers: '/api/servers',
    },
  });
});

/**
 * 404 handler - must be after all routes
 */
app.use(notFoundHandler);

/**
 * Global error handler - MUST be last
 */
app.use(errorHandler);

/**
 * Create HTTP server
 */
const server = http.createServer(app);

/**
 * WebSocket server for terminal functionality
 * SECURITY: Authentication required, rate limiting enabled
 */
const wss = new WebSocketServer({
  server,
  path: '/ws',
  // SECURITY: Verify origin to prevent CSRF
  verifyClient: (info: { origin: string; req: any }) => {
    const origin = info.origin;
    const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';

    // Log for debugging
    logger.info('WebSocket connection attempt', { origin, allowedOrigin });

    // Allow same-origin or configured origin
    if (!origin) {
      // Some browsers/proxies don't send origin for same-site WebSocket upgrades
      logger.info('WebSocket connection allowed (no origin header)');
      return true;
    }

    const isAllowed = origin === allowedOrigin;
    if (!isAllowed) {
      logger.warn('WebSocket connection rejected', { origin, allowedOrigin });
    }
    return isAllowed;
  },
});

// SECURITY: WebSocket rate limiting - track connection attempts by token hash
const wsConnectionAttempts = new Map<string, { count: number; resetTime: number }>();
const WS_RATE_LIMIT_WINDOW = 60000; // 1 minute
const WS_RATE_LIMIT_MAX = 10; // Max 10 connections per minute per user

/**
 * Check WebSocket rate limit for a given identifier
 */
function checkWsRateLimit(identifier: string): boolean {
  const now = Date.now();
  const record = wsConnectionAttempts.get(identifier);

  if (!record || now > record.resetTime) {
    // Reset or create new record
    wsConnectionAttempts.set(identifier, {
      count: 1,
      resetTime: now + WS_RATE_LIMIT_WINDOW,
    });
    return true;
  }

  if (record.count >= WS_RATE_LIMIT_MAX) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Cleanup expired rate limit records periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [identifier, record] of wsConnectionAttempts.entries()) {
    if (now > record.resetTime) {
      wsConnectionAttempts.delete(identifier);
    }
  }
}, WS_RATE_LIMIT_WINDOW);

wss.on('connection', (ws: WebSocket, req) => {
  // SECURITY: Extract and verify JWT token from query parameters during connection handshake
  const url = new URL(req.url!, `http://${req.headers.host}`);
  const token = url.searchParams.get('token');

  if (!token) {
    ws.close(1008, 'Authentication required');
    logger.warn('WebSocket connection rejected: No token provided');
    return;
  }

  try {
    // Verify JWT token
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET not configured');
    }

    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      username: string;
      role: string;
    };

    // SECURITY: Check rate limit before allowing connection
    if (!checkWsRateLimit(decoded.id)) {
      logger.warn('WebSocket rate limit exceeded', { userId: decoded.id });
      ws.close(1008, 'Rate limit exceeded');
      return;
    }

    // Store user info on WebSocket for later use
    (ws as any).userId = decoded.id;
    (ws as any).username = decoded.username;
    (ws as any).role = decoded.role;

    logger.info('WebSocket client connected', { username: decoded.username, userId: decoded.id });

    // PERFORMANCE: Idle timeout - close connection after 30 minutes of inactivity
    let idleTimeout: NodeJS.Timeout | null = null;
    const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

    const resetIdleTimeout = () => {
      if (idleTimeout) {
        clearTimeout(idleTimeout);
      }
      idleTimeout = setTimeout(() => {
        logger.info('WebSocket connection idle timeout', { userId: decoded.id });
        ws.close(1000, 'Connection idle timeout');
      }, IDLE_TIMEOUT_MS);
    };

    // Start idle timeout
    resetIdleTimeout();

    // Send welcome message
    ws.send(JSON.stringify({
      success: true,
      type: 'connected',
      message: 'WebSocket connection established',
      user: {
        id: decoded.id,
        username: decoded.username,
        role: decoded.role,
      },
    }));

    // Terminal session storage
    let terminalSession: TerminalSession | null = null;

    // Handle incoming messages
    ws.on('message', async (message: Buffer) => {
      try {
        // Reset idle timeout on any message
        resetIdleTimeout();

        const data = JSON.parse(message.toString());

        // SECURITY: Validate message structure
        if (!data || typeof data !== 'object' || !data.type) {
          logger.warn('Invalid WebSocket message format', { userId: decoded.id });
          ws.send(JSON.stringify({
            success: false,
            type: 'error',
            message: 'Invalid message format',
          }));
          return;
        }

        logger.debug('WebSocket message received', {
          userId: decoded.id,
          messageType: data.type,
        });

        // Handle terminal messages
        if (data.type === 'terminal:start') {
          // SECURITY: Validate serverId
          if (!data.serverId || typeof data.serverId !== 'string') {
            logger.warn('Invalid serverId in terminal:start', { userId: decoded.id });
            ws.send(JSON.stringify({
              type: 'terminal:error',
              message: 'Invalid server ID',
            }));
            return;
          }

          // Start new terminal session
          if (terminalSession) {
            terminalSession.close();
          }

          terminalSession = new TerminalSession(
            logger,
            pool,
            data.serverId,
            decoded.id
          );

          await terminalSession.connect(
            (termData: string) => {
              // Send terminal data to client
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'terminal:data',
                  data: termData,
                }));
              }
            },
            () => {
              // Terminal closed
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'terminal:closed',
                  message: 'Terminal session ended',
                }));
              }
              terminalSession = null;
            },
            (error: Error) => {
              // Terminal error
              logger.error('Terminal session error', {
                error: error.message,
                userId: decoded.id,
                serverId: data.serverId,
              });
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  type: 'terminal:error',
                  message: error.message,
                }));
              }
              terminalSession = null;
            }
          );

        } else if (data.type === 'terminal:input') {
          // Forward input to terminal
          if (terminalSession) {
            if (!data.data) {
              logger.warn('Empty terminal input', { userId: decoded.id });
              return;
            }
            terminalSession.write(data.data);
          } else {
            logger.warn('No active terminal session for input', { userId: decoded.id });
          }

        } else if (data.type === 'terminal:resize') {
          // Resize terminal
          if (terminalSession) {
            if (typeof data.rows !== 'number' || typeof data.cols !== 'number') {
              logger.warn('Invalid terminal resize dimensions', { userId: decoded.id });
              return;
            }
            terminalSession.resize(data.rows, data.cols);
          } else {
            logger.warn('No active terminal session for resize', { userId: decoded.id });
          }

        } else {
          // Unknown message type
          logger.warn('Unknown WebSocket message type', {
            userId: decoded.id,
            messageType: data.type,
          });
          ws.send(JSON.stringify({
            success: false,
            type: 'error',
            message: 'Unknown message type',
          }));
        }
      } catch (error) {
        logger.error('WebSocket message error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          userId: decoded.id,
        });

        // Only send error if connection is still open
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(JSON.stringify({
              type: 'error',
              message: error instanceof Error ? error.message : 'Internal server error',
            }));
          } catch (sendError) {
            logger.error('Failed to send error message to client', {
              error: sendError instanceof Error ? sendError.message : 'Unknown error',
              userId: decoded.id,
            });
          }
        }
      }
    });

    ws.on('close', () => {
      logger.info('WebSocket client disconnected', {
        userId: decoded.id,
        username: decoded.username,
      });

      // Clear idle timeout
      if (idleTimeout) {
        clearTimeout(idleTimeout);
        idleTimeout = null;
      }

      // Clean up terminal session
      if (terminalSession) {
        try {
          terminalSession.close();
        } catch (error) {
          logger.error('Error closing terminal session', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: decoded.id,
          });
        }
        terminalSession = null;
      }
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error', {
        error: error.message,
        userId: decoded.id,
        username: decoded.username,
      });
    });
  } catch (error) {
    ws.close(1008, 'Invalid token');
    logger.warn('WebSocket connection rejected: Invalid token', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return;
  }
});

wss.on('error', (error) => {
  logger.error('WebSocket server error', {
    error: error.message,
  });
});

/**
 * Graceful shutdown handler
 */
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress...');
    return;
  }

  isShuttingDown = true;
  logger.info(`${signal} signal received: closing server gracefully`);

  // Close HTTP server (stop accepting new connections)
  server.close(async () => {
    logger.info('HTTP server closed');

    try {
      // Close WebSocket connections
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.close(1000, 'Server shutting down');
        }
      });
      logger.info('WebSocket connections closed');

      // Close WebSocket server
      wss.close(() => {
        logger.info('WebSocket server closed');
      });

      // Stop backup scheduler
      BackupScheduler.stopAll();
      logger.info('Backup scheduler stopped');

      // Close queue workers
      await closeBackupWorker();
      await closeScanWorker();
      logger.info('Queue workers closed');

      // Close queue manager
      await QueueManager.closeAll();
      logger.info('Queue manager closed');

      // Close database pool
      await closeDatabasePool();

      // Disconnect from Redis
      await disconnectRedis();

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      process.exit(1);
    }
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

/**
 * Register shutdown handlers
 */
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

/**
 * Unhandled rejection handler
 */
process.on('unhandledRejection', (reason: any, _promise: Promise<any>) => {
  logger.error('Unhandled Promise Rejection', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

/**
 * Uncaught exception handler
 */
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
  });

  // Exit the process after logging
  process.exit(1);
});

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  try {
    logger.info('Starting Medicine Man server...');
    logger.info(`Environment: ${NODE_ENV}`);
    logger.info(`Port: ${PORT}`);

    // Connect to Redis
    logger.info('Connecting to Redis...');
    await connectRedis();
    logger.info('Redis connected successfully');

    // Test database connection with retry logic (for Docker startup)
    logger.info('Testing database connection with retry...');
    const dbConnected = await testDatabaseConnectionWithRetry();

    if (!dbConnected) {
      throw new Error('Failed to connect to database after retries');
    }

    // Initialize Prometheus metrics
    initializeMetrics();

    // Initialize queue manager
    logger.info('Initializing queue manager...');
    await QueueManager.initialize();
    logger.info('Queue manager initialized successfully');

    // Workers are automatically started on import
    logger.info('Queue workers started successfully');

    // Start backup scheduler
    logger.info('Starting backup scheduler...');
    await BackupScheduler.start();
    logger.info('Backup scheduler started successfully');

    // Start health check scheduler (runs every hour)
    logger.info('Starting health check scheduler...');
    cron.schedule('0 * * * *', async () => {
      logger.info('Running scheduled health check for all servers');
      try {
        await healthCheckService.checkAllServers();
      } catch (error) {
        logger.error('Scheduled health check failed', { error });
      }
    });
    logger.info('Health check scheduler started (runs hourly)');

    // Start Bitlaunch sync scheduler (runs every 5 minutes if API key is configured)
    logger.info('Starting Bitlaunch sync scheduler...');
    cron.schedule('*/5 * * * *', async () => {
      try {
        const status = await bitlaunchService.getStatus();
        if (status.apiKeySet && !status.syncInProgress) {
          logger.debug('Running scheduled Bitlaunch data sync');
          await bitlaunchService.syncAllData();
        }
      } catch (error) {
        logger.error('Scheduled Bitlaunch sync failed', { error });
      }
    });
    logger.info('Bitlaunch sync scheduler started (runs every 5 minutes)');

    // Start HTTP server
    server.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      logger.info(`Health check available at http://localhost:${PORT}/health`);
      logger.info(`API available at http://localhost:${PORT}/api`);
      logger.info(`WebSocket available at ws://localhost:${PORT}/ws`);
      logger.info('Server started successfully');
    });

    // Handle server errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
      } else {
        logger.error('Server error', {
          error: error.message,
          code: error.code,
        });
      }
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Cleanup and exit
    try {
      await closeDatabasePool();
      await disconnectRedis();
    } catch (cleanupError) {
      logger.error('Error during cleanup', {
        error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error',
      });
    }

    process.exit(1);
  }
}

/**
 * Initialize the application
 */
startServer();

export { app, server, wss };
