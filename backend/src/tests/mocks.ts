import { Pool, PoolClient } from 'pg';
import { Client as SSHClient } from 'ssh2';

/**
 * Mock Pool for database testing
 */
export function createMockPool(): jest.Mocked<Pool> {
  const mockClient: jest.Mocked<Partial<PoolClient>> = {
    query: jest.fn(),
    release: jest.fn(),
  };

  const mockPool = {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(mockClient),
    end: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
  } as unknown as jest.Mocked<Pool>;

  return mockPool;
}

/**
 * Mock successful database query result
 */
export function mockQueryResult(rows: any[] = [], rowCount?: number) {
  return {
    rows,
    rowCount: rowCount ?? rows.length,
    command: 'SELECT',
    oid: 0,
    fields: [],
  };
}

/**
 * Mock Redis Client
 */
export function createMockRedisClient() {
  return {
    get: jest.fn(),
    set: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    ttl: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
  };
}

/**
 * Mock SSH2 Client
 */
export function createMockSSH2Client(options: {
  connectSuccess?: boolean;
  execSuccess?: boolean;
  execOutput?: string;
  execError?: string;
} = {}): jest.Mocked<Partial<SSHClient>> {
  const {
    connectSuccess = true,
    execSuccess = true,
    execOutput = 'command output',
    execError = 'command error',
  } = options;

  const mockStream = {
    on: jest.fn((event, handler) => {
      if (event === 'data') {
        setTimeout(() => handler(Buffer.from(execOutput)), 10);
      } else if (event === 'close') {
        setTimeout(() => handler(execSuccess ? 0 : 1), 20);
      }
      return mockStream;
    }),
    stderr: {
      on: jest.fn((event, handler) => {
        if (event === 'data' && !execSuccess) {
          setTimeout(() => handler(Buffer.from(execError)), 10);
        }
        return mockStream.stderr;
      }),
    },
  };

  const mockClient = {
    on: jest.fn((event, callback) => {
      if (connectSuccess && event === 'ready') {
        setTimeout(() => callback(), 10);
      } else if (!connectSuccess && event === 'error') {
        setTimeout(() => callback(new Error('Connection failed')), 10);
      }
      return mockClient;
    }),
    connect: jest.fn(),
    end: jest.fn(),
    destroy: jest.fn(),
    exec: jest.fn((command, callback) => {
      callback(null, mockStream);
    }),
  } as unknown as jest.Mocked<Partial<SSHClient>>;

  return mockClient;
}

/**
 * Mock Logger
 */
export function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

/**
 * Mock Notification Service
 */
export function createMockNotificationService() {
  return {
    send: jest.fn().mockResolvedValue(true),
  };
}

/**
 * Mock Express Request
 */
export function createMockRequest(overrides: Partial<any> = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    session: {},
    ip: '127.0.0.1',
    ...overrides,
  };
}

/**
 * Mock Express Response
 */
export function createMockResponse() {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res;
}

/**
 * Mock Express Next Function
 */
export function createMockNext() {
  return jest.fn();
}

/**
 * Mock Backup Service
 */
export function createMockBackupService() {
  return {
    executeBackup: jest.fn().mockResolvedValue({
      success: true,
      backupId: 'test-backup-id',
      size: 1024000,
    }),
  };
}

/**
 * Mock Scanner Service
 */
export function createMockScanner() {
  return {
    scanServer: jest.fn().mockResolvedValue('test-scan-id'),
  };
}

/**
 * Mock Backup Orchestrator
 */
export function createMockBackupOrchestrator() {
  return {
    orchestrateServerBackup: jest.fn().mockResolvedValue({
      success: true,
      servicesBackedUp: ['nginx', 'mysql'],
      servicesFailed: [],
      backupDuration: 30000,
      backupSize: 1024000,
      errors: [],
    }),
  };
}

/**
 * Mock Two Factor Auth Service
 */
export function createMockTwoFactorAuthService() {
  return {
    generateSecret: jest.fn().mockResolvedValue({
      secret: 'test-secret',
      qrCodeUrl: 'data:image/png;base64,test',
      backupCodes: ['code1', 'code2', 'code3'],
    }),
    verifyToken: jest.fn().mockReturnValue(true),
    verifyBackupCode: jest.fn().mockResolvedValue({
      valid: true,
      remainingCodes: ['code2', 'code3'],
    }),
    hashBackupCodes: jest.fn().mockResolvedValue(['hashed1', 'hashed2', 'hashed3']),
    regenerateBackupCodes: jest.fn().mockResolvedValue({
      codes: ['new1', 'new2', 'new3'],
      hashedCodes: ['hashed-new1', 'hashed-new2', 'hashed-new3'],
    }),
  };
}
