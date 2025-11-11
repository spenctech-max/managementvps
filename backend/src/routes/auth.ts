import { Router, Response } from 'express';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import { pool, withTransaction } from '../config/database';
import { logger } from '../config/logger';
import { validateRequest, registerSchema, loginSchema } from '@medicine-man/shared';
import { hashPassword, verifyPassword } from '../utils/crypto';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { authenticateToken, AuthRequest, requireAdmin } from '../middleware/auth';
import { redisClient } from '../config/redis';
import { TwoFactorAuthService } from '../services/twoFactorAuth';
import { rateLimiters } from '../middleware/rateLimiter';

const router = Router();

/**
 * SECURITY: Login rate limiter - prevent brute force attacks
 * More restrictive than global rate limiter
 * LEGACY: Kept for backward compatibility, but enhanced rate limiter is used
 */
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Maximum 5 login attempts per 15 minutes
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: (req, res) => {
    logger.warn('Login rate limit exceeded', {
      username: req.body?.username,
    });
    res.status(429).json({
      success: false,
      message: 'Too many login attempts. Please try again in 15 minutes.',
    });
  },
});

/**
 * SECURITY: Check if account is locked out
 */
async function checkAccountLockout(username: string): Promise<{ locked: boolean; remainingTime?: number }> {
  const lockKey = `login_locked:${username}`;
  const attemptsKey = `login_attempts:${username}`;

  // Check if account is locked
  const isLocked = await redisClient.get(lockKey);
  if (isLocked) {
    // Get TTL to calculate remaining time
    const ttl = await redisClient.ttl(lockKey);
    if (ttl > 0) {
      const remainingMinutes = Math.ceil(ttl / 60);
      return { locked: true, remainingTime: remainingMinutes };
    } else {
      // Lockout expired, clear it
      await redisClient.del(lockKey);
      await redisClient.del(attemptsKey);
    }
  }

  return { locked: false };
}

/**
 * SECURITY: Record failed login attempt and apply lockout if needed
 */
async function recordFailedLogin(username: string): Promise<{ locked: boolean; attempts: number }> {
  const attemptsKey = `login_attempts:${username}`;
  const lockKey = `login_locked:${username}`;

  // Get max attempts from env (default 5)
  const maxAttempts = parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5');
  // Get lockout duration from env in milliseconds (default 1800000ms = 30 minutes)
  const lockoutDurationMs = parseInt(process.env.LOGIN_LOCKOUT_DURATION || '1800000');
  const lockoutDurationSeconds = Math.floor(lockoutDurationMs / 1000);

  // Increment failed attempts
  const attempts = await redisClient.incr(attemptsKey);

  // Set expiration on first attempt (30 minutes window)
  if (attempts === 1) {
    await redisClient.expire(attemptsKey, 1800); // 30 minutes
  }

  // Lock account if max attempts reached
  if (attempts >= maxAttempts) {
    await redisClient.setEx(lockKey, lockoutDurationSeconds, 'locked');
    await redisClient.del(attemptsKey);

    logger.warn('Account locked due to failed login attempts', { username, attempts });

    return { locked: true, attempts };
  }

  return { locked: false, attempts };
}

/**
 * SECURITY: Clear failed login attempts on successful login
 */
async function clearFailedLogins(username: string): Promise<void> {
  const attemptsKey = `login_attempts:${username}`;
  const lockKey = `login_locked:${username}`;
  await redisClient.del(attemptsKey);
  await redisClient.del(lockKey);
}

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user (Admin only)
 *     description: Creates a new user account. Requires admin authentication. Use /api/users endpoint for user creation instead.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: newuser
 *               email:
 *                 type: string
 *                 format: email
 *                 example: newuser@example.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePass123!
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         token:
 *                           type: string
 *                         user:
 *                           $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Conflict - Username or email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/register',
  authenticateToken,
  requireAdmin,
  validateRequest(registerSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { username, email, password } = req.validatedData;

    logger.info('User registration attempt', { username, email });

    // SECURITY: Use transaction to ensure atomic operation and prevent race conditions
    const result = await withTransaction(async (client) => {
      // SECURITY: Lock the users table to prevent race condition in first-user admin assignment
      await client.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');

      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE username = $1 OR email = $2',
        [username, email]
      );

      if (existingUser.rows.length > 0) {
        throw new AppError('Username or email already exists', 409);
      }

      // When admin creates user, use viewer role by default
      const userRole = 'viewer';

      // Hash password
      const hashedPassword = await hashPassword(password);

      // Create user
      const userResult = await client.query(
        `INSERT INTO users (username, email, password_hash, is_active, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         RETURNING id, username, email, is_active, created_at`,
        [username, email, hashedPassword, true]
      );

      const user = userResult.rows[0];

      // Assign role to user in user_roles table
      await client.query(
        `INSERT INTO user_roles (user_id, role, assigned_at)
         VALUES ($1, $2, NOW())`,
        [user.id, userRole]
      );

      logger.info('User registered successfully', {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: userRole,
      });

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          is_active: user.is_active,
          role: userRole,
        },
      };
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: result.user.id,
        username: result.user.username,
        role: result.user.role,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user: result.user,
      },
    });
  })
);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login with username and password
 *     description: Authenticates a user and returns a JWT token. Rate limited to 5 attempts per 15 minutes. Account locks after 5 failed attempts.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Login successful or 2FA required
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - $ref: '#/components/schemas/LoginResponse'
 *                 - $ref: '#/components/schemas/TwoFactorRequiredResponse'
 *       401:
 *         description: Unauthorized - Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Account inactive
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many requests - Rate limit exceeded or account locked
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/login',
  rateLimiters.public, // SECURITY: Apply enhanced rate limiter for public endpoints
  validateRequest(loginSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { username, password } = req.validatedData;

    logger.info('User login attempt', { username });

    // SECURITY: Check if account is locked out
    const lockoutStatus = await checkAccountLockout(username);
    if (lockoutStatus.locked) {
      logger.warn('Login attempt on locked account', { username });
      throw new AppError(
        'Too many failed attempts. Please try again later.',
        429
      );
    }

    // Find user by username
    const userResult = await pool.query(
      `SELECT u.id, u.username, u.email, u.password_hash, u.is_active, u.created_at, u.twofa_enabled, ur.role
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       WHERE u.username = $1`,
      [username]
    );

    if (userResult.rows.length === 0) {
      logger.warn('Login attempt with non-existent username', { username });
      // SECURITY: Record failed attempt even for non-existent users to prevent enumeration
      await recordFailedLogin(username);
      throw new AppError('Invalid username or password', 401);
    }

    const user = userResult.rows[0];

    // Check if user is active
    if (!user.is_active) {
      logger.warn('Login attempt by inactive user', { userId: user.id, username });
      throw new AppError('User account is inactive', 403);
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      logger.warn('Login attempt with invalid password', { userId: user.id, username });

      // SECURITY: Record failed login attempt
      const failedAttempt = await recordFailedLogin(username);

      if (failedAttempt.locked) {
        throw new AppError(
          'Too many failed attempts. Please try again later.',
          429
        );
      }

      throw new AppError('Invalid username or password', 401);
    }

    // SECURITY: Clear any failed login attempts on successful login
    await clearFailedLogins(username);

    // Determine user role (default to viewer if not found)
    const userRole = user.role || 'viewer';

    // Check if 2FA is enabled for this user
    if (user.twofa_enabled) {
      logger.info('User login successful - 2FA required', {
        userId: user.id,
        username: user.username,
      });

      // Return response indicating 2FA is required
      res.status(200).json({
        success: true,
        message: 'Password verified. Please provide your 2FA code.',
        data: {
          requires2FA: true,
          userId: user.id,
        },
      });
      return;
    }

    logger.info('User login successful', {
      userId: user.id,
      username: user.username,
      role: userRole,
    });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: userRole,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    // SECURITY: Regenerate session ID to prevent session fixation
    if (req.session) {
      await new Promise<void>((resolve, reject) => {
        req.session.regenerate((err) => {
          if (err) {
            logger.error('Session regeneration failed', { error: err.message });
            reject(err);
          } else {
            // Set user data in the new session
            req.session.userId = user.id;
            req.session.username = user.username;
            resolve();
          }
        });
      });
    }

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          is_active: user.is_active,
          role: userRole,
        },
      },
    });
  })
);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     description: Returns the profile of the currently authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user:
 *                           $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - Authentication required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/me',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }

    logger.info('Get current user', { userId: req.user.id });

    // Fetch fresh user data from database
    const userResult = await pool.query(
      `SELECT u.id, u.username, u.email, u.is_active, u.created_at, u.updated_at, ur.role
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      logger.warn('Requested user not found', { userId: req.user.id });
      throw new AppError('User not found', 404);
    }

    const user = userResult.rows[0];
    const userRole = user.role || 'viewer';

    res.status(200).json({
      success: true,
      message: 'Current user retrieved successfully',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          is_active: user.is_active,
          role: userRole,
          created_at: user.created_at,
          updated_at: user.updated_at,
        },
      },
    });
  })
);

/**
 * POST /api/auth/request-password-reset
 * Request a password reset token
 * SECURITY: Rate limited to prevent abuse
 */
const resetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Maximum 3 requests per 15 minutes
  skipSuccessfulRequests: false,
  handler: (req, res) => {
    logger.warn('Password reset request rate limit exceeded', {
      email: req.body?.email,
    });
    res.status(429).json({
      success: false,
      message: 'Too many password reset requests. Please try again later.',
    });
  },
});

/**
 * @swagger
 * /api/auth/request-password-reset:
 *   post:
 *     summary: Request password reset token
 *     description: Generates a password reset token. Rate limited to 3 requests per 15 minutes.
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *                 example: admin
 *     responses:
 *       200:
 *         description: Reset token generated (response same even if user doesn't exist to prevent enumeration)
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         resetToken:
 *                           type: string
 *                         expiresAt:
 *                           type: string
 *                           format: date-time
 *       400:
 *         description: Bad request - Username required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many requests - Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/request-password-reset',
  rateLimiters.public, // Use enhanced rate limiter
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { username } = req.body;

    if (!username) {
      throw new AppError('Username is required', 400);
    }

    logger.info('Password reset requested', { username });

    // Find user
    const userResult = await pool.query(
      'SELECT id, username, email, is_active FROM users WHERE username = $1',
      [username]
    );

    // Always return success to prevent user enumeration
    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
      logger.warn('Password reset requested for non-existent or inactive user', { username });
      res.status(200).json({
        success: true,
        message: 'If the username exists, a password reset token has been generated. Please contact your administrator.',
      });
      return;
    }

    const user = userResult.rows[0];

    // Generate reset token (32 bytes hex = 64 characters)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour from now

    // Store reset token in database
    await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, resetTokenExpires, user.id]
    );

    logger.info('Password reset token generated', {
      userId: user.id,
      username: user.username,
      resetToken, // In production, you might not want to log this
    });

    res.status(200).json({
      success: true,
      message: 'Password reset token generated. Please contact your administrator with your username to receive the token.',
      data: {
        resetToken, // In production, this would be sent via email instead
        expiresAt: resetTokenExpires,
      },
    });
  })
);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password with token
 *     description: Resets user password using a valid reset token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resetToken
 *               - newPassword
 *             properties:
 *               resetToken:
 *                 type: string
 *                 description: Password reset token received from request-password-reset
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: New password (min 8 chars, must contain uppercase, lowercase, and number)
 *                 example: NewSecurePass123!
 *     responses:
 *       200:
 *         description: Password reset successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Bad request - Invalid or expired token, or password requirements not met
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/reset-password',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      throw new AppError('Reset token and new password are required', 400);
    }

    // Validate password strength
    if (newPassword.length < 8) {
      throw new AppError('Password must be at least 8 characters long', 400);
    }
    if (!/[A-Z]/.test(newPassword)) {
      throw new AppError('Password must contain at least one uppercase letter', 400);
    }
    if (!/[a-z]/.test(newPassword)) {
      throw new AppError('Password must contain at least one lowercase letter', 400);
    }
    if (!/[0-9]/.test(newPassword)) {
      throw new AppError('Password must contain at least one number', 400);
    }

    logger.info('Password reset attempt', { resetToken: resetToken.substring(0, 8) + '...' });

    // Find user with valid reset token
    const userResult = await pool.query(
      'SELECT id, username, email FROM users WHERE reset_token = $1 AND reset_token_expires > NOW() AND is_active = true',
      [resetToken]
    );

    if (userResult.rows.length === 0) {
      logger.warn('Invalid or expired reset token used');
      throw new AppError('Invalid or expired reset token', 400);
    }

    const user = userResult.rows[0];

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and clear reset token
    await pool.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hashedPassword, user.id]
    );

    logger.info('Password reset successful', {
      userId: user.id,
      username: user.username,
    });

    res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.',
    });
  })
);

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change password (authenticated users)
 *     description: Change password for currently authenticated user. Requires current password verification.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 description: New password (min 8 chars, must contain uppercase, lowercase, and number)
 *                 example: NewSecurePass123!
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Bad request - Password requirements not met
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid current password or not authenticated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/change-password',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new AppError('Current password and new password are required', 400);
    }

    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      throw new AppError('Password must be at least 8 characters long', 400);
    }
    if (!/[A-Z]/.test(newPassword)) {
      throw new AppError('Password must contain at least one uppercase letter', 400);
    }
    if (!/[a-z]/.test(newPassword)) {
      throw new AppError('Password must contain at least one lowercase letter', 400);
    }
    if (!/[0-9]/.test(newPassword)) {
      throw new AppError('Password must contain at least one number', 400);
    }

    logger.info('Password change attempt', { userId: req.user.id });

    // Get user's current password hash
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = userResult.rows[0];

    // Verify current password
    const isPasswordValid = await verifyPassword(currentPassword, user.password_hash);

    if (!isPasswordValid) {
      logger.warn('Password change failed - invalid current password', { userId: req.user.id });
      throw new AppError('Current password is incorrect', 401);
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    logger.info('Password changed successfully', { userId: req.user.id });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  })
);

/**
 * @swagger
 * /api/auth/2fa/status:
 *   get:
 *     summary: Get 2FA status
 *     description: Returns 2FA configuration status for the authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         enabled:
 *                           type: boolean
 *                           example: true
 *                         enabledAt:
 *                           type: string
 *                           format: date-time
 *                         backupCodesRemaining:
 *                           type: integer
 *                           example: 8
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  '/2fa/status',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }

    const userResult = await pool.query(
      'SELECT twofa_enabled, twofa_enabled_at, twofa_backup_codes FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = userResult.rows[0];
    const backupCodesCount = user.twofa_backup_codes ? user.twofa_backup_codes.length : 0;

    res.status(200).json({
      success: true,
      message: '2FA status retrieved successfully',
      data: {
        enabled: user.twofa_enabled || false,
        enabledAt: user.twofa_enabled_at,
        backupCodesRemaining: backupCodesCount,
      },
    });
  })
);

/**
 * @swagger
 * /api/auth/2fa/setup:
 *   post:
 *     summary: Setup 2FA
 *     description: Generates a new 2FA secret and QR code for the authenticated user
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 2FA setup completed - scan QR code and verify to enable
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         secret:
 *                           type: string
 *                           description: 2FA secret for manual entry
 *                         qrCodeUrl:
 *                           type: string
 *                           description: QR code data URL
 *                         backupCodes:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: One-time backup codes
 *       400:
 *         description: 2FA already enabled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/2fa/setup',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }

    logger.info('2FA setup initiated', { userId: req.user.id });

    // Check if 2FA is already enabled
    const userResult = await pool.query(
      'SELECT twofa_enabled FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    if (userResult.rows[0].twofa_enabled) {
      throw new AppError('2FA is already enabled. Please disable it first to set up again.', 400);
    }

    // Generate 2FA secret and QR code
    const { secret, qrCodeUrl, backupCodes } = await TwoFactorAuthService.generateSecret(
      req.user.username
    );

    // Hash backup codes for storage
    const hashedBackupCodes = await TwoFactorAuthService.hashBackupCodes(backupCodes);

    // Store secret temporarily (not enabled yet) with backup codes
    await pool.query(
      'UPDATE users SET twofa_secret = $1, twofa_backup_codes = $2 WHERE id = $3',
      [secret, hashedBackupCodes, req.user.id]
    );

    logger.info('2FA setup completed', { userId: req.user.id });

    res.status(200).json({
      success: true,
      message: '2FA setup completed. Please scan the QR code and verify with a code to enable 2FA.',
      data: {
        secret, // Include for manual entry if QR code fails
        qrCodeUrl,
        backupCodes, // Return plaintext codes for user to save
      },
    });
  })
);

/**
 * @swagger
 * /api/auth/2fa/enable:
 *   post:
 *     summary: Enable 2FA
 *     description: Enables 2FA after verifying a token from the authenticator app
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: 6-digit TOTP code from authenticator app
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: 2FA enabled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Invalid token or 2FA not set up
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/2fa/enable',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { token } = req.body;

    if (!token) {
      throw new AppError('2FA token is required', 400);
    }

    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }

    logger.info('2FA enable attempt', { userId: req.user.id });

    // Get user's 2FA secret
    const userResult = await pool.query(
      'SELECT twofa_secret, twofa_enabled FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = userResult.rows[0];

    if (user.twofa_enabled) {
      throw new AppError('2FA is already enabled', 400);
    }

    if (!user.twofa_secret) {
      throw new AppError('2FA setup not completed. Please run /2fa/setup first.', 400);
    }

    // Verify token
    const isValid = TwoFactorAuthService.verifyToken(token, user.twofa_secret);

    if (!isValid) {
      logger.warn('Invalid 2FA token during enable', { userId: req.user.id });
      throw new AppError('Invalid 2FA token', 400);
    }

    // Enable 2FA
    await pool.query(
      'UPDATE users SET twofa_enabled = true, twofa_enabled_at = NOW() WHERE id = $1',
      [req.user.id]
    );

    logger.info('2FA enabled successfully', { userId: req.user.id });

    res.status(200).json({
      success: true,
      message: '2FA enabled successfully',
    });
  })
);

/**
 * @swagger
 * /api/auth/2fa/disable:
 *   post:
 *     summary: Disable 2FA
 *     description: Disables 2FA for the authenticated user. Requires password confirmation.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's current password for confirmation
 *     responses:
 *       200:
 *         description: 2FA disabled successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: 2FA not enabled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized or invalid password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/2fa/disable',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { password } = req.body;

    if (!password) {
      throw new AppError('Password is required to disable 2FA', 400);
    }

    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }

    logger.info('2FA disable attempt', { userId: req.user.id });

    // Get user data
    const userResult = await pool.query(
      'SELECT password_hash, twofa_enabled FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = userResult.rows[0];

    if (!user.twofa_enabled) {
      throw new AppError('2FA is not enabled', 400);
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      logger.warn('Invalid password during 2FA disable', { userId: req.user.id });
      throw new AppError('Invalid password', 401);
    }

    // Disable 2FA and clear secret and backup codes
    await pool.query(
      'UPDATE users SET twofa_enabled = false, twofa_secret = NULL, twofa_backup_codes = NULL, twofa_enabled_at = NULL WHERE id = $1',
      [req.user.id]
    );

    logger.info('2FA disabled successfully', { userId: req.user.id });

    res.status(200).json({
      success: true,
      message: '2FA disabled successfully',
    });
  })
);

/**
 * @swagger
 * /api/auth/2fa/verify:
 *   post:
 *     summary: Verify 2FA token during login
 *     description: Completes the login process by verifying 2FA token or backup code
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - token
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: User ID from initial login response
 *               token:
 *                 type: string
 *                 description: 6-digit TOTP code or backup code
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: 2FA verification successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Invalid verification request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid 2FA token or backup code
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/2fa/verify',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId, token } = req.body;

    if (!userId || !token) {
      throw new AppError('User ID and token are required', 400);
    }

    logger.info('2FA verification attempt', { userId });

    // Get user's 2FA configuration
    const userResult = await pool.query(
      `SELECT u.id, u.username, u.email, u.twofa_secret, u.twofa_backup_codes, u.is_active, ur.role
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       WHERE u.id = $1 AND u.twofa_enabled = true`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('Invalid 2FA verification request', 400);
    }

    const user = userResult.rows[0];

    // Try verifying as TOTP token first
    const isValidToken = TwoFactorAuthService.verifyToken(token, user.twofa_secret);

    if (isValidToken) {
      logger.info('2FA token verified successfully', { userId });
    } else {
      // Try verifying as backup code
      const backupCodes = user.twofa_backup_codes || [];
      const { valid, remainingCodes } = await TwoFactorAuthService.verifyBackupCode(token, backupCodes);

      if (valid) {
        // Update remaining backup codes
        await pool.query(
          'UPDATE users SET twofa_backup_codes = $1 WHERE id = $2',
          [remainingCodes, user.id]
        );

        logger.info('2FA backup code used', { userId, remainingCodesCount: remainingCodes.length });

        // Warn if running low on backup codes
        if (remainingCodes.length <= 2) {
          logger.warn('User running low on backup codes', { userId, remainingCodesCount: remainingCodes.length });
        }
      } else {
        logger.warn('Invalid 2FA token/backup code', { userId });
        throw new AppError('Invalid 2FA token or backup code', 401);
      }
    }

    // Generate JWT token
    const userRole = user.role || 'viewer';
    const jwtToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: userRole,
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      message: '2FA verification successful',
      data: {
        token: jwtToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          is_active: user.is_active,
          role: userRole,
        },
      },
    });
  })
);

/**
 * @swagger
 * /api/auth/2fa/regenerate-backup-codes:
 *   post:
 *     summary: Regenerate 2FA backup codes
 *     description: Generates new backup codes, invalidating all previous codes. Requires password confirmation.
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 format: password
 *                 description: User's current password for confirmation
 *     responses:
 *       200:
 *         description: Backup codes regenerated successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         backupCodes:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: New backup codes (save these securely)
 *       400:
 *         description: 2FA not enabled
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized or invalid password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  '/2fa/regenerate-backup-codes',
  authenticateToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { password } = req.body;

    if (!password) {
      throw new AppError('Password is required to regenerate backup codes', 400);
    }

    if (!req.user) {
      throw new AppError('User not authenticated', 401);
    }

    logger.info('Backup codes regeneration attempt', { userId: req.user.id });

    // Get user data
    const userResult = await pool.query(
      'SELECT password_hash, twofa_enabled FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = userResult.rows[0];

    if (!user.twofa_enabled) {
      throw new AppError('2FA is not enabled', 400);
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);

    if (!isPasswordValid) {
      logger.warn('Invalid password during backup codes regeneration', { userId: req.user.id });
      throw new AppError('Invalid password', 401);
    }

    // Generate new backup codes
    const { codes, hashedCodes } = await TwoFactorAuthService.regenerateBackupCodes();

    // Update database
    await pool.query(
      'UPDATE users SET twofa_backup_codes = $1 WHERE id = $2',
      [hashedCodes, req.user.id]
    );

    logger.info('Backup codes regenerated successfully', { userId: req.user.id });

    res.status(200).json({
      success: true,
      message: 'Backup codes regenerated successfully. Please save these new codes securely.',
      data: {
        backupCodes: codes,
      },
    });
  })
);

export default router;
