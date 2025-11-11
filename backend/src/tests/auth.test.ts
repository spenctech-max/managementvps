import request from 'supertest';
import express, { Application } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import authRouter from '../routes/auth';
import { hashPassword, verifyPassword } from '../utils/crypto';
import { createMockPool, mockQueryResult } from './mocks';
import { generateValidToken, generateTestUser } from './helpers';

// Mock dependencies
jest.mock('../config/database', () => ({
  pool: createMockPool(),
  withTransaction: jest.fn((callback) => callback(createMockPool())),
}));

jest.mock('../utils/crypto');

describe('Auth Routes', () => {
  let app: Application;
  let mockPool: jest.Mocked<Pool>;
  let mockRedisClient: any;

  beforeAll(() => {
    // Create Express app
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockPool = require('../config/database').pool;
    mockRedisClient = require('../config/redis').redisClient;

    // Setup default mock implementations
    (hashPassword as jest.Mock).mockResolvedValue('hashed-password');
    (verifyPassword as jest.Mock).mockResolvedValue(true);
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const testUser = generateTestUser();

      mockRedisClient.get.mockResolvedValue(null);
      mockPool.query.mockResolvedValue(
        mockQueryResult([
          {
            id: testUser.id,
            username: testUser.username,
            email: testUser.email,
            password_hash: 'hashed-password',
            is_active: true,
            twofa_enabled: false,
            role: testUser.role,
          },
        ])
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'Password123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user).toMatchObject({
        id: testUser.id,
        username: testUser.username,
        email: testUser.email,
      });

      // Verify JWT token
      const decoded = jwt.verify(response.body.data.token, process.env.JWT_SECRET!) as any;
      expect(decoded.id).toBe(testUser.id);
      expect(decoded.username).toBe(testUser.username);
    });

    it('should fail login with invalid username', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockPool.query.mockResolvedValue(mockQueryResult([]));
      mockRedisClient.incr.mockResolvedValue(1);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'Password123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid username or password');
    });

    it('should fail login with invalid password', async () => {
      const testUser = generateTestUser();

      mockRedisClient.get.mockResolvedValue(null);
      mockPool.query.mockResolvedValue(
        mockQueryResult([
          {
            id: testUser.id,
            username: testUser.username,
            password_hash: 'hashed-password',
            is_active: true,
            role: testUser.role,
          },
        ])
      );
      (verifyPassword as jest.Mock).mockResolvedValue(false);
      mockRedisClient.incr.mockResolvedValue(1);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'WrongPassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(mockRedisClient.incr).toHaveBeenCalled();
    });

    it('should lock account after max failed attempts', async () => {
      const testUser = generateTestUser();

      mockRedisClient.get.mockResolvedValue(null);
      mockPool.query.mockResolvedValue(
        mockQueryResult([
          {
            id: testUser.id,
            username: testUser.username,
            password_hash: 'hashed-password',
            is_active: true,
            role: testUser.role,
          },
        ])
      );
      (verifyPassword as jest.Mock).mockResolvedValue(false);
      mockRedisClient.incr.mockResolvedValue(5); // Max attempts reached

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'WrongPassword',
        });

      expect(response.status).toBe(429);
      expect(response.body.message).toContain('Too many failed attempts');
      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });

    it('should require 2FA when enabled', async () => {
      const testUser = generateTestUser();

      mockRedisClient.get.mockResolvedValue(null);
      mockPool.query.mockResolvedValue(
        mockQueryResult([
          {
            id: testUser.id,
            username: testUser.username,
            password_hash: 'hashed-password',
            is_active: true,
            twofa_enabled: true,
            role: testUser.role,
          },
        ])
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'Password123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.data.requires2FA).toBe(true);
      expect(response.body.data.userId).toBe(testUser.id);
      expect(response.body.data.token).toBeUndefined();
    });

    it('should reject login for inactive user', async () => {
      const testUser = generateTestUser({ is_active: false });

      mockRedisClient.get.mockResolvedValue(null);
      mockPool.query.mockResolvedValue(
        mockQueryResult([
          {
            id: testUser.id,
            username: testUser.username,
            password_hash: 'hashed-password',
            is_active: false,
            role: testUser.role,
          },
        ])
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'Password123!',
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('inactive');
    });

    it('should reject login for locked account', async () => {
      mockRedisClient.get.mockResolvedValue('locked');
      mockRedisClient.ttl.mockResolvedValue(1800);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'testuser',
          password: 'Password123!',
        });

      expect(response.status).toBe(429);
      expect(response.body.message).toContain('Too many failed attempts');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const testUser = generateTestUser();
      const token = generateValidToken(testUser);

      mockPool.query.mockResolvedValue(mockQueryResult([testUser]));

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toMatchObject({
        id: testUser.id,
        username: testUser.username,
        email: testUser.email,
      });
    });

    it('should reject request without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access token required');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('Invalid or expired token');
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('should change password successfully', async () => {
      const testUser = generateTestUser();
      const token = generateValidToken(testUser);

      mockPool.query
        .mockResolvedValueOnce(mockQueryResult([{ password_hash: 'old-hashed-password' }]))
        .mockResolvedValueOnce(mockQueryResult([]));

      (verifyPassword as jest.Mock).mockResolvedValue(true);
      (hashPassword as jest.Mock).mockResolvedValue('new-hashed-password');

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(verifyPassword).toHaveBeenCalledWith('OldPassword123!', 'old-hashed-password');
      expect(hashPassword).toHaveBeenCalledWith('NewPassword123!');
    });

    it('should reject password change with wrong current password', async () => {
      const testUser = generateTestUser();
      const token = generateValidToken(testUser);

      mockPool.query.mockResolvedValue(mockQueryResult([{ password_hash: 'hashed-password' }]));
      (verifyPassword as jest.Mock).mockResolvedValue(false);

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'WrongPassword',
          newPassword: 'NewPassword123!',
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Current password is incorrect');
    });

    it('should validate new password strength', async () => {
      const testUser = generateTestUser();
      const token = generateValidToken(testUser);

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'weak',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('at least 8 characters');
    });
  });

  describe('POST /api/auth/2fa/verify', () => {
    it('should verify 2FA token and return JWT', async () => {
      const testUser = generateTestUser();

      mockPool.query.mockResolvedValue(
        mockQueryResult([
          {
            ...testUser,
            twofa_secret: 'test-secret',
            twofa_backup_codes: [],
          },
        ])
      );

      const TwoFactorAuthService = require('../services/twoFactorAuth').TwoFactorAuthService;
      TwoFactorAuthService.verifyToken = jest.fn().mockReturnValue(true);

      const response = await request(app)
        .post('/api/auth/2fa/verify')
        .send({
          userId: testUser.id,
          token: '123456',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user).toMatchObject({
        id: testUser.id,
        username: testUser.username,
      });
    });

    it('should reject invalid 2FA token', async () => {
      const testUser = generateTestUser();

      mockPool.query.mockResolvedValue(
        mockQueryResult([
          {
            ...testUser,
            twofa_secret: 'test-secret',
            twofa_backup_codes: [],
          },
        ])
      );

      const TwoFactorAuthService = require('../services/twoFactorAuth').TwoFactorAuthService;
      TwoFactorAuthService.verifyToken = jest.fn().mockReturnValue(false);
      TwoFactorAuthService.verifyBackupCode = jest.fn().mockResolvedValue({ valid: false });

      const response = await request(app)
        .post('/api/auth/2fa/verify')
        .send({
          userId: testUser.id,
          token: 'invalid',
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Invalid 2FA token');
    });
  });
});
