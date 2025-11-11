import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { hashPassword } from '../utils/crypto';

/**
 * Test data generators
 */

export function generateTestUser(overrides: Partial<any> = {}) {
  return {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    role: 'admin',
    is_active: true,
    created_at: new Date(),
    ...overrides,
  };
}

export function generateTestServer(overrides: Partial<any> = {}) {
  return {
    id: 'test-server-id',
    user_id: 'test-user-id',
    name: 'Test Server',
    ip: '192.168.1.100',
    port: 22,
    username: 'root',
    auth_type: 'password',
    credential: 'encrypted-credential',
    tags: ['test'],
    description: 'Test server',
    is_online: false,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

export function generateTestBackup(overrides: Partial<any> = {}) {
  return {
    id: 'test-backup-id',
    server_id: 'test-server-id',
    backup_type: 'full',
    status: 'completed',
    file_size: 1024000,
    started_at: new Date(),
    completed_at: new Date(),
    created_at: new Date(),
    ...overrides,
  };
}

export function generateTestScan(overrides: Partial<any> = {}) {
  return {
    id: 'test-scan-id',
    server_id: 'test-server-id',
    scan_type: 'full',
    status: 'completed',
    started_at: new Date(),
    completed_at: new Date(),
    scan_duration: 30,
    scan_summary: {
      services_count: 5,
      filesystems_count: 3,
      recommendations_count: 2,
    },
    created_at: new Date(),
    ...overrides,
  };
}

export function generateTestService(overrides: Partial<any> = {}) {
  return {
    id: 'test-service-id',
    scan_id: 'test-scan-id',
    service_name: 'nginx',
    service_type: 'systemd',
    status: 'running',
    port_bindings: ['80', '443'],
    config_paths: ['/etc/nginx'],
    data_paths: ['/var/www'],
    log_paths: ['/var/log/nginx'],
    service_details: { version: '1.20.0' },
    backup_priority: 8,
    backup_strategy: 'config_and_data',
    ...overrides,
  };
}

/**
 * JWT Token helpers
 */

interface TestUser {
  id: string;
  username: string;
  role: string;
}

export function generateValidToken(user: TestUser = generateTestUser()) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  );
}

export function generateExpiredToken(user: TestUser = generateTestUser()) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
    },
    process.env.JWT_SECRET!,
    { expiresIn: '-1h' }
  );
}

export function generateInvalidToken() {
  return 'invalid.token.value';
}

/**
 * Database helpers
 */

export async function createTestUser(pool: Pool, userData: Partial<TestUser> = {}) {
  const user = generateTestUser(userData);
  const hashedPassword = await hashPassword('Password123!');

  const result = await pool.query(
    `INSERT INTO users (id, username, email, password_hash, is_active, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [user.id, user.username, user.email, hashedPassword, user.is_active, user.created_at]
  );

  // Assign role
  await pool.query(
    `INSERT INTO user_roles (user_id, role, assigned_at)
     VALUES ($1, $2, NOW())`,
    [user.id, user.role]
  );

  return result.rows[0];
}

export async function createTestServer(pool: Pool, serverData: Record<string, unknown> = {}) {
  const server = generateTestServer(serverData);

  const result = await pool.query(
    `INSERT INTO servers (id, user_id, name, ip, port, username, auth_type, credential, tags, description, is_online, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      server.id,
      server.user_id,
      server.name,
      server.ip,
      server.port,
      server.username,
      server.auth_type,
      server.credential,
      server.tags,
      server.description,
      server.is_online,
      server.created_at,
      server.updated_at,
    ]
  );

  return result.rows[0];
}

export async function createTestBackup(pool: Pool, backupData: any = {}) {
  const backup = generateTestBackup(backupData);

  const result = await pool.query(
    `INSERT INTO backups (id, server_id, backup_type, status, file_size, started_at, completed_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      backup.id,
      backup.server_id,
      backup.backup_type,
      backup.status,
      backup.file_size,
      backup.started_at,
      backup.completed_at,
      backup.created_at,
    ]
  );

  return result.rows[0];
}

export async function cleanupTestData(pool: Pool) {
  // Clean up in correct order due to foreign key constraints
  await pool.query('DELETE FROM user_activity_logs WHERE user_id LIKE $1', ['test-%']);
  await pool.query('DELETE FROM backups WHERE server_id LIKE $1', ['test-%']);
  await pool.query('DELETE FROM detected_services WHERE scan_id LIKE $1', ['test-%']);
  await pool.query('DELETE FROM detected_filesystems WHERE scan_id LIKE $1', ['test-%']);
  await pool.query('DELETE FROM backup_recommendations WHERE scan_id LIKE $1', ['test-%']);
  await pool.query('DELETE FROM server_scans WHERE server_id LIKE $1', ['test-%']);
  await pool.query('DELETE FROM servers WHERE user_id LIKE $1', ['test-%']);
  await pool.query('DELETE FROM user_roles WHERE user_id LIKE $1', ['test-%']);
  await pool.query('DELETE FROM users WHERE id LIKE $1', ['test-%']);
}

/**
 * Mock SSH Client helper
 */

export function createMockSSHClient(behavior: 'success' | 'failure' | 'timeout' = 'success') {
  const mockClient = {
    on: jest.fn((event, callback) => {
      if (behavior === 'success' && event === 'ready') {
        setTimeout(() => callback(), 10);
      } else if (behavior === 'failure' && event === 'error') {
        setTimeout(() => callback(new Error('SSH connection failed')), 10);
      } else if (behavior === 'timeout') {
        // Don't call any callbacks to simulate timeout
      }
      return mockClient;
    }),
    connect: jest.fn(),
    end: jest.fn(),
    destroy: jest.fn(),
    exec: jest.fn((command, callback) => {
      const mockStream = {
        on: jest.fn((event, handler) => {
          if (event === 'data' && behavior === 'success') {
            setTimeout(() => handler(Buffer.from('command output')), 10);
          } else if (event === 'close') {
            setTimeout(() => handler(behavior === 'success' ? 0 : 1), 20);
          }
          return mockStream;
        }),
        stderr: {
          on: jest.fn((event, handler) => {
            if (event === 'data' && behavior === 'failure') {
              setTimeout(() => handler(Buffer.from('error output')), 10);
            }
            return mockStream.stderr;
          }),
        },
      };
      callback(null, mockStream);
    }),
  };

  return mockClient;
}

/**
 * Wait helper for async operations
 */

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
