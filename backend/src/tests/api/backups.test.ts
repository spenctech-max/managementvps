import request from 'supertest';
import express, { Application } from 'express';
import { Pool } from 'pg';
import backupsRouter from '../../routes/backups';
import { createMockPool, mockQueryResult } from '../mocks';
import { generateValidToken, generateTestUser, generateTestBackup, generateTestServer } from '../helpers';

// Mock dependencies
jest.mock('../../config/database', () => ({
  pool: createMockPool(),
}));

describe('Backups API', () => {
  let app: Application;
  let mockPool: jest.Mocked<Pool>;
  let authToken: string;
  let testUser: any;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/backups', backupsRouter);

    testUser = generateTestUser();
    authToken = generateValidToken(testUser);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = require('../../config/database').pool;
  });

  describe('GET /api/backups', () => {
    it('should list all backups for authenticated user', async () => {
      const backups = [
        {
          ...generateTestBackup({ id: 'backup-1' }),
          server_name: 'Server 1',
          server_ip: '192.168.1.100',
          duration: 300,
        },
        {
          ...generateTestBackup({ id: 'backup-2' }),
          server_name: 'Server 2',
          server_ip: '192.168.1.101',
          duration: 450,
        },
      ];

      mockPool.query.mockResolvedValue(mockQueryResult(backups));

      const response = await request(app)
        .get('/api/backups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.count).toBe(2);
      expect(response.body.data[0].id).toBe('backup-1');
      expect(response.body.data[0].server_name).toBe('Server 1');
    });

    it('should return empty array when user has no backups', async () => {
      mockPool.query.mockResolvedValue(mockQueryResult([]));

      const response = await request(app)
        .get('/api/backups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.count).toBe(0);
    });

    it('should limit results to 50 backups', async () => {
      const backups = Array.from({ length: 60 }, (_, i) => ({
        ...generateTestBackup({ id: `backup-${i}` }),
        server_name: `Server ${i}`,
        server_ip: '192.168.1.100',
        duration: 300,
      }));

      mockPool.query.mockResolvedValue(mockQueryResult(backups.slice(0, 50)));

      const response = await request(app)
        .get('/api/backups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(50);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 50'),
        expect.any(Array)
      );
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/backups');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should include server information in response', async () => {
      const backups = [
        {
          ...generateTestBackup(),
          server_name: 'Production Server',
          server_ip: '192.168.1.100',
          duration: 300,
        },
      ];

      mockPool.query.mockResolvedValue(mockQueryResult(backups));

      const response = await request(app)
        .get('/api/backups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data[0].server_name).toBe('Production Server');
      expect(response.body.data[0].server_ip).toBe('192.168.1.100');
    });
  });

  describe('GET /api/backups/servers/:id/backups', () => {
    it('should list all backups for a specific server', async () => {
      const serverId = 'test-server-id';
      const server = generateTestServer({ id: serverId });
      const backups = [
        {
          ...generateTestBackup({ id: 'backup-1', server_id: serverId }),
          server_name: server.name,
          server_ip: server.ip,
          duration: 300,
        },
        {
          ...generateTestBackup({ id: 'backup-2', server_id: serverId }),
          server_name: server.name,
          server_ip: server.ip,
          duration: 450,
        },
      ];

      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([{ id: serverId }]))
        .mockResolvedValueOnce(mockQueryResult(backups));

      const response = await request(app)
        .get(`/api/backups/servers/${serverId}/backups`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].server_id).toBe(serverId);
      expect(response.body.data[1].server_id).toBe(serverId);
    });

    it('should return 404 for non-existent server', async () => {
      mockPool.query.mockResolvedValue(mockQueryResult([]));

      const response = await request(app)
        .get('/api/backups/servers/non-existent-id/backups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should not allow accessing another users server backups', async () => {
      mockPool.query.mockResolvedValue(mockQueryResult([]));

      const response = await request(app)
        .get('/api/backups/servers/other-user-server-id/backups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should return empty array when server has no backups', async () => {
      const serverId = 'test-server-id';

      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([{ id: serverId }]))
        .mockResolvedValueOnce(mockQueryResult([]));

      const response = await request(app)
        .get(`/api/backups/servers/${serverId}/backups`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(0);
    });

    it('should order backups by created_at DESC', async () => {
      const serverId = 'test-server-id';
      const oldDate = new Date('2024-01-01');
      const newDate = new Date('2024-01-15');

      const backups = [
        {
          ...generateTestBackup({ id: 'backup-new', server_id: serverId, created_at: newDate }),
          server_name: 'Server',
          server_ip: '192.168.1.100',
          duration: 300,
        },
        {
          ...generateTestBackup({ id: 'backup-old', server_id: serverId, created_at: oldDate }),
          server_name: 'Server',
          server_ip: '192.168.1.100',
          duration: 300,
        },
      ];

      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([{ id: serverId }]))
        .mockResolvedValueOnce(mockQueryResult(backups));

      const response = await request(app)
        .get(`/api/backups/servers/${serverId}/backups`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data[0].id).toBe('backup-new');
      expect(response.body.data[1].id).toBe('backup-old');
    });
  });

  describe('Backup Status Filtering', () => {
    it('should include backups with all statuses', async () => {
      const backups = [
        {
          ...generateTestBackup({ id: 'backup-1', status: 'completed' }),
          server_name: 'Server',
          server_ip: '192.168.1.100',
          duration: 300,
        },
        {
          ...generateTestBackup({ id: 'backup-2', status: 'failed' }),
          server_name: 'Server',
          server_ip: '192.168.1.100',
          duration: 150,
        },
        {
          ...generateTestBackup({ id: 'backup-3', status: 'pending' }),
          server_name: 'Server',
          server_ip: '192.168.1.100',
          duration: null,
        },
      ];

      mockPool.query.mockResolvedValue(mockQueryResult(backups));

      const response = await request(app)
        .get('/api/backups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);

      const statuses = response.body.data.map((b: any) => b.status);
      expect(statuses).toContain('completed');
      expect(statuses).toContain('failed');
      expect(statuses).toContain('pending');
    });
  });

  describe('Backup Size and Duration', () => {
    it('should include backup size in bytes', async () => {
      const backups = [
        {
          ...generateTestBackup({ file_size: 1024000 }),
          server_name: 'Server',
          server_ip: '192.168.1.100',
          duration: 300,
        },
      ];

      mockPool.query.mockResolvedValue(mockQueryResult(backups));

      const response = await request(app)
        .get('/api/backups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data[0].size).toBe(1024000);
    });

    it('should calculate duration from started_at and completed_at', async () => {
      const backups = [
        {
          ...generateTestBackup(),
          server_name: 'Server',
          server_ip: '192.168.1.100',
          duration: 450,
        },
      ];

      mockPool.query.mockResolvedValue(mockQueryResult(backups));

      const response = await request(app)
        .get('/api/backups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data[0].duration).toBe(450);
    });
  });

  describe('Backup Type Filtering', () => {
    it('should include backups of all types', async () => {
      const backups = [
        {
          ...generateTestBackup({ id: 'backup-1', backup_type: 'full' }),
          server_name: 'Server',
          server_ip: '192.168.1.100',
          duration: 300,
        },
        {
          ...generateTestBackup({ id: 'backup-2', backup_type: 'incremental' }),
          server_name: 'Server',
          server_ip: '192.168.1.100',
          duration: 150,
        },
        {
          ...generateTestBackup({ id: 'backup-3', backup_type: 'differential' }),
          server_name: 'Server',
          server_ip: '192.168.1.100',
          duration: 200,
        },
      ];

      mockPool.query.mockResolvedValue(mockQueryResult(backups));

      const response = await request(app)
        .get('/api/backups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(3);

      const types = response.body.data.map((b: any) => b.backup_type);
      expect(types).toContain('full');
      expect(types).toContain('incremental');
      expect(types).toContain('differential');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/backups')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
    });
  });
});
