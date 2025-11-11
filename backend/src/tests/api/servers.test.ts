import request from 'supertest';
import express, { Application } from 'express';
import { Pool } from 'pg';
import serversRouter from '../../routes/servers';
import { createMockPool, mockQueryResult } from '../mocks';
import { generateValidToken, generateTestUser, generateTestServer } from '../helpers';

// Mock dependencies
jest.mock('../../config/database', () => ({
  pool: createMockPool(),
}));

jest.mock('../../utils/crypto', () => ({
  encrypt: jest.fn().mockReturnValue('encrypted-credential'),
  decrypt: jest.fn().mockReturnValue('decrypted-credential'),
}));

jest.mock('ssh2', () => ({
  Client: jest.fn().mockImplementation(() => ({
    on: jest.fn(function (this: any, event, callback) {
      if (event === 'ready') {
        setTimeout(() => callback(), 10);
      }
      return this;
    }),
    connect: jest.fn(),
    end: jest.fn(),
  })),
}));

describe('Servers API', () => {
  let app: Application;
  let mockPool: jest.Mocked<Pool>;
  let authToken: string;
  let testUser: any;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/servers', serversRouter);

    testUser = generateTestUser();
    authToken = generateValidToken(testUser);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = require('../../config/database').pool;
  });

  describe('GET /api/servers', () => {
    it('should list all servers for authenticated user', async () => {
      const servers = [
        generateTestServer({ id: 'server-1', name: 'Server 1' }),
        generateTestServer({ id: 'server-2', name: 'Server 2' }),
      ];

      mockPool.query.mockResolvedValue(mockQueryResult(servers));

      const response = await request(app)
        .get('/api/servers')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.count).toBe(2);
      expect(response.body.data[0].name).toBe('Server 1');
      expect(response.body.data[1].name).toBe('Server 2');
    });

    it('should return empty array when user has no servers', async () => {
      mockPool.query.mockResolvedValue(mockQueryResult([]));

      const response = await request(app)
        .get('/api/servers')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(0);
      expect(response.body.count).toBe(0);
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/api/servers');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/servers', () => {
    it('should create a new server successfully', async () => {
      const newServer = {
        name: 'New Server',
        ip: '192.168.1.100',
        port: 22,
        username: 'root',
        auth_type: 'password',
        credential: 'test-password',
        tags: ['production'],
        description: 'Production server',
      };

      const createdServer = generateTestServer(newServer);

      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([createdServer]))
        .mockResolvedValueOnce(mockQueryResult([]));

      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newServer);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(newServer.name);
      expect(response.body.data.ip).toBe(newServer.ip);

      // Verify activity log was created
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_activity_logs'),
        expect.any(Array)
      );
    });

    it('should validate required fields', async () => {
      const invalidServer = {
        name: 'Server',
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidServer);

      expect(response.status).toBe(400);
    });

    it('should validate IP address format', async () => {
      const invalidServer = {
        name: 'Server',
        ip: 'invalid-ip',
        port: 22,
        username: 'root',
        auth_type: 'password',
        credential: 'password',
      };

      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidServer);

      expect(response.status).toBe(400);
    });

    it('should validate port number range', async () => {
      const invalidServer = {
        name: 'Server',
        ip: '192.168.1.100',
        port: 70000, // Invalid port
        username: 'root',
        auth_type: 'password',
        credential: 'password',
      };

      const response = await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidServer);

      expect(response.status).toBe(400);
    });

    it('should encrypt credentials before storage', async () => {
      const newServer = {
        name: 'Server',
        ip: '192.168.1.100',
        port: 22,
        username: 'root',
        auth_type: 'password',
        credential: 'plain-password',
      };

      const encrypt = require('../../utils/crypto').encrypt;
      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([generateTestServer(newServer)]))
        .mockResolvedValueOnce(mockQueryResult([]));

      await request(app)
        .post('/api/servers')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newServer);

      expect(encrypt).toHaveBeenCalledWith('plain-password');
    });
  });

  describe('POST /api/servers/:id/test', () => {
    it('should test SSH connection successfully', async () => {
      const server = generateTestServer();

      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([server]))
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(mockQueryResult([]));

      const response = await request(app)
        .post(`/api/servers/${server.id}/test`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isOnline).toBe(true);

      // Verify server status was updated
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE servers SET is_online'),
        expect.any(Array)
      );
    });

    it('should handle connection failure', async () => {
      const server = generateTestServer();

      // Mock SSH connection failure
      const Client = require('ssh2').Client;
      Client.mockImplementation(() => ({
        on: jest.fn(function (this: any, event, callback) {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Connection refused')), 10);
          }
          return this;
        }),
        connect: jest.fn(),
        end: jest.fn(),
      }));

      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([server]))
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(mockQueryResult([]));

      const response = await request(app)
        .post(`/api/servers/${server.id}/test`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('failed');
    });

    it('should return 404 for non-existent server', async () => {
      mockPool.query.mockResolvedValue(mockQueryResult([]));

      const response = await request(app)
        .post('/api/servers/non-existent-id/test')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should log credential access for audit', async () => {
      const server = generateTestServer();

      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([server]))
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(mockQueryResult([]));

      await request(app)
        .post(`/api/servers/${server.id}/test`)
        .set('Authorization', `Bearer ${authToken}`);

      // Verify credential access was logged
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_activity_logs'),
        expect.arrayContaining([testUser.id, 'CREDENTIAL_ACCESS', 'server', server.id, expect.any(String)])
      );
    });
  });

  describe('DELETE /api/servers/:id', () => {
    it('should delete server successfully', async () => {
      const server = generateTestServer();

      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([server]))
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(mockQueryResult([]));

      const response = await request(app)
        .delete(`/api/servers/${server.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.serverId).toBe(server.id);

      // Verify server was deleted
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM servers'),
        [server.id]
      );

      // Verify activity was logged
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO user_activity_logs'),
        expect.any(Array)
      );
    });

    it('should return 404 for non-existent server', async () => {
      mockPool.query.mockResolvedValue(mockQueryResult([]));

      const response = await request(app)
        .delete('/api/servers/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should not allow deleting another users server', async () => {
      mockPool.query.mockResolvedValue(mockQueryResult([]));

      const response = await request(app)
        .delete('/api/servers/other-user-server-id')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/servers/:id/backup', () => {
    it('should start backup successfully', async () => {
      const server = generateTestServer({ is_online: true });

      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([server]))
        .mockResolvedValueOnce(
          mockQueryResult([
            {
              id: 'backup-id',
              server_id: server.id,
              backup_type: 'full',
              status: 'pending',
              started_at: new Date(),
            },
          ])
        )
        .mockResolvedValueOnce(mockQueryResult([]));

      const response = await request(app)
        .post(`/api/servers/${server.id}/backup`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          backup_type: 'full',
        });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.data.backupId).toBeDefined();
      expect(response.body.data.status).toBe('pending');
    });

    it('should reject backup for offline server', async () => {
      const server = generateTestServer({ is_online: false });

      mockPool.query.mockResolvedValue(mockQueryResult([server]));

      const response = await request(app)
        .post(`/api/servers/${server.id}/backup`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          backup_type: 'full',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('not online');
    });
  });

  describe('POST /api/servers/:id/scan', () => {
    it('should start server scan successfully', async () => {
      const server = generateTestServer();

      mockPool.query.mockResolvedValue(mockQueryResult([server]));

      const response = await request(app)
        .post(`/api/servers/${server.id}/scan`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scan_type: 'full',
        });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.data.serverId).toBe(server.id);
      expect(response.body.data.scanType).toBe('full');
    });

    it('should return 404 for non-existent server', async () => {
      mockPool.query.mockResolvedValue(mockQueryResult([]));

      const response = await request(app)
        .post('/api/servers/non-existent-id/scan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          scan_type: 'full',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/servers/:id/scans', () => {
    it('should list all scans for a server', async () => {
      const server = generateTestServer();
      const scans = [
        {
          id: 'scan-1',
          server_id: server.id,
          scan_type: 'full',
          status: 'completed',
          started_at: new Date(),
          completed_at: new Date(),
          scan_duration: 30,
          scan_summary: { services_count: 5 },
        },
        {
          id: 'scan-2',
          server_id: server.id,
          scan_type: 'services',
          status: 'completed',
          started_at: new Date(),
          completed_at: new Date(),
          scan_duration: 15,
          scan_summary: { services_count: 5 },
        },
      ];

      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([server]))
        .mockResolvedValueOnce(mockQueryResult(scans));

      const response = await request(app)
        .get(`/api/servers/${server.id}/scans`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.scans).toHaveLength(2);
      expect(response.body.data.server.id).toBe(server.id);
    });
  });
});
