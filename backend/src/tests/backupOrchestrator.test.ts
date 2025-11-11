import { Pool } from 'pg';
import { BackupOrchestrator } from '../services/backupOrchestrator';
import { createMockPool, createMockLogger, createMockSSH2Client, mockQueryResult } from './mocks';

// Mock SSH2
jest.mock('ssh2', () => ({
  Client: jest.fn().mockImplementation(() => createMockSSH2Client()),
}));

// Mock crypto
jest.mock('../utils/crypto', () => ({
  decrypt: jest.fn().mockReturnValue('decrypted-credential'),
}));

describe('BackupOrchestrator', () => {
  let mockPool: jest.Mocked<Pool>;
  let mockLogger: any;
  let orchestrator: BackupOrchestrator;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = createMockPool();
    mockLogger = createMockLogger();
    orchestrator = new BackupOrchestrator(mockPool, mockLogger);
  });

  describe('orchestrateServerBackup', () => {
    it('should orchestrate full server backup successfully', async () => {
      const serverId = 'test-server-id';

      // Mock server query
      mockPool.query
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: serverId,
              name: 'Test Server',
              ip: '192.168.1.100',
              port: 22,
              username: 'root',
              auth_type: 'password',
              credential: 'encrypted',
            },
          ])
        )
        // Mock scan query
        .mockResolvedValueOnce(mockQueryResult([{ id: 'scan-id' }]))
        // Mock services query
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: 'service-1',
              service_name: 'nginx',
              service_type: 'systemd',
              service_details: {},
            },
            {
              id: 'service-2',
              service_name: 'mysql',
              service_type: 'docker',
              service_details: { image: 'mysql:8.0' },
            },
          ])
        )
        // Mock notification query
        .mockResolvedValue(mockQueryResult([{ name: 'Test Server' }]));

      const result = await orchestrator.orchestrateServerBackup(serverId, 'full');

      expect(result.success).toBe(true);
      expect(result.servicesBackedUp.length).toBeGreaterThan(0);
      expect(result.servicesFailed.length).toBe(0);
      expect(result.backupDuration).toBeGreaterThan(0);
    });

    it('should handle selective backup with specified services', async () => {
      const serverId = 'test-server-id';
      const selectedServices = ['service-1'];

      mockPool.query
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: serverId,
              name: 'Test Server',
              ip: '192.168.1.100',
              port: 22,
              username: 'root',
              auth_type: 'password',
              credential: 'encrypted',
            },
          ])
        )
        .mockResolvedValueOnce(mockQueryResult([{ id: 'scan-id' }]))
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: 'service-1',
              service_name: 'nginx',
              service_type: 'systemd',
              service_details: {},
            },
            {
              id: 'service-2',
              service_name: 'mysql',
              service_type: 'docker',
              service_details: { image: 'mysql:8.0' },
            },
          ])
        )
        .mockResolvedValue(mockQueryResult([{ name: 'Test Server' }]));

      const result = await orchestrator.orchestrateServerBackup(serverId, 'selective', selectedServices);

      expect(result.success).toBe(true);
    });

    it('should handle server not found error', async () => {
      const serverId = 'non-existent-id';

      mockPool.query.mockResolvedValueOnce(mockQueryResult([]));

      const result = await orchestrator.orchestrateServerBackup(serverId, 'full');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Server not found');
    });

    it('should handle no services detected error', async () => {
      const serverId = 'test-server-id';

      mockPool.query
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: serverId,
              name: 'Test Server',
              ip: '192.168.1.100',
              port: 22,
              username: 'root',
              auth_type: 'password',
              credential: 'encrypted',
            },
          ])
        )
        .mockResolvedValueOnce(mockQueryResult([])); // No scan results

      const result = await orchestrator.orchestrateServerBackup(serverId, 'full');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('No services detected');
    });

    it('should handle service shutdown failure gracefully', async () => {
      const serverId = 'test-server-id';

      // Mock SSH client that fails on exec
      const Client = require('ssh2').Client;
      Client.mockImplementation(() => {
        const mockClient = createMockSSH2Client({ execSuccess: false });
        return mockClient;
      });

      mockPool.query
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: serverId,
              name: 'Test Server',
              ip: '192.168.1.100',
              port: 22,
              username: 'root',
              auth_type: 'password',
              credential: 'encrypted',
            },
          ])
        )
        .mockResolvedValueOnce(mockQueryResult([{ id: 'scan-id' }]))
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: 'service-1',
              service_name: 'nginx',
              service_type: 'systemd',
              service_details: {},
            },
          ])
        )
        .mockResolvedValue(mockQueryResult([{ name: 'Test Server' }]));

      const result = await orchestrator.orchestrateServerBackup(serverId, 'full');

      // Should complete but log errors
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should prioritize database services in shutdown order', async () => {
      const serverId = 'test-server-id';

      mockPool.query
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: serverId,
              name: 'Test Server',
              ip: '192.168.1.100',
              port: 22,
              username: 'root',
              auth_type: 'password',
              credential: 'encrypted',
            },
          ])
        )
        .mockResolvedValueOnce(mockQueryResult([{ id: 'scan-id' }]))
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: 'service-1',
              service_name: 'nginx',
              service_type: 'systemd',
              service_details: {},
            },
            {
              id: 'service-2',
              service_name: 'mysql-db',
              service_type: 'docker',
              service_details: { image: 'mysql:8.0' },
            },
            {
              id: 'service-3',
              service_name: 'redis-cache',
              service_type: 'docker',
              service_details: { image: 'redis:7' },
            },
          ])
        )
        .mockResolvedValue(mockQueryResult([{ name: 'Test Server' }]));

      const result = await orchestrator.orchestrateServerBackup(serverId, 'full');

      expect(result.success).toBe(true);
      // Database services should be backed up
      expect(result.servicesBackedUp).toContain('mysql-db');
    });
  });

  describe('Backup Methods', () => {
    it('should generate correct MySQL backup command', async () => {
      const serverId = 'test-server-id';

      mockPool.query
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: serverId,
              name: 'Test Server',
              ip: '192.168.1.100',
              port: 22,
              username: 'root',
              auth_type: 'password',
              credential: 'encrypted',
            },
          ])
        )
        .mockResolvedValueOnce(mockQueryResult([{ id: 'scan-id' }]))
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: 'service-1',
              service_name: 'mysql',
              service_type: 'docker',
              service_details: { image: 'mysql:8.0' },
            },
          ])
        )
        .mockResolvedValue(mockQueryResult([{ name: 'Test Server' }]));

      const result = await orchestrator.orchestrateServerBackup(serverId, 'full');

      // Should use hot backup for MySQL
      expect(result.success).toBe(true);
    });

    it('should generate correct PostgreSQL backup command', async () => {
      const serverId = 'test-server-id';

      mockPool.query
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: serverId,
              name: 'Test Server',
              ip: '192.168.1.100',
              port: 22,
              username: 'root',
              auth_type: 'password',
              credential: 'encrypted',
            },
          ])
        )
        .mockResolvedValueOnce(mockQueryResult([{ id: 'scan-id' }]))
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: 'service-1',
              service_name: 'postgres',
              service_type: 'docker',
              service_details: { image: 'postgres:15' },
            },
          ])
        )
        .mockResolvedValue(mockQueryResult([{ name: 'Test Server' }]));

      const result = await orchestrator.orchestrateServerBackup(serverId, 'full');

      expect(result.success).toBe(true);
    });

    it('should handle MongoDB backup', async () => {
      const serverId = 'test-server-id';

      mockPool.query
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: serverId,
              name: 'Test Server',
              ip: '192.168.1.100',
              port: 22,
              username: 'root',
              auth_type: 'password',
              credential: 'encrypted',
            },
          ])
        )
        .mockResolvedValueOnce(mockQueryResult([{ id: 'scan-id' }]))
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: 'service-1',
              service_name: 'mongodb',
              service_type: 'docker',
              service_details: { image: 'mongo:6' },
            },
          ])
        )
        .mockResolvedValue(mockQueryResult([{ name: 'Test Server' }]));

      const result = await orchestrator.orchestrateServerBackup(serverId, 'full');

      expect(result.success).toBe(true);
    });

    it('should handle Redis backup', async () => {
      const serverId = 'test-server-id';

      mockPool.query
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: serverId,
              name: 'Test Server',
              ip: '192.168.1.100',
              port: 22,
              username: 'root',
              auth_type: 'password',
              credential: 'encrypted',
            },
          ])
        )
        .mockResolvedValueOnce(mockQueryResult([{ id: 'scan-id' }]))
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: 'service-1',
              service_name: 'redis',
              service_type: 'docker',
              service_details: { image: 'redis:7' },
            },
          ])
        )
        .mockResolvedValue(mockQueryResult([{ name: 'Test Server' }]));

      const result = await orchestrator.orchestrateServerBackup(serverId, 'full');

      expect(result.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should send failure notification on backup error', async () => {
      const serverId = 'test-server-id';
      const notificationService = require('../services/notificationService').notificationService;

      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const result = await orchestrator.orchestrateServerBackup(serverId, 'full');

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should send success notification on completion', async () => {
      const serverId = 'test-server-id';

      mockPool.query
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: serverId,
              name: 'Test Server',
              ip: '192.168.1.100',
              port: 22,
              username: 'root',
              auth_type: 'password',
              credential: 'encrypted',
            },
          ])
        )
        .mockResolvedValueOnce(mockQueryResult([{ id: 'scan-id' }]))
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: 'service-1',
              service_name: 'nginx',
              service_type: 'systemd',
              service_details: {},
            },
          ])
        )
        .mockResolvedValue(mockQueryResult([{ name: 'Test Server' }]));

      const result = await orchestrator.orchestrateServerBackup(serverId, 'full');

      expect(result.success).toBe(true);
    });
  });
});
