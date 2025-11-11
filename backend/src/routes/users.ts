import { Router } from 'express';
import { Response } from 'express';
import { AuthRequest, authenticateToken, requireAdmin } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { validateRequest, validateUuidParam, createUserSchema, updateUserSchema } from '@medicine-man/shared';
import { parsePaginationParams, buildPaginationQuery, buildPaginatedResponse } from '../utils/pagination';
import { hashPassword } from '../utils/crypto';
import { pool } from '../config/database';
import { logger } from '../config/logger';

const router = Router();

/**
 * GET /api/users
 * List all users with roles and pagination
 * Requires: Admin access
 * Query params: page (default: 1), limit (default: 20, max: 100)
 */
router.get(
  '/',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Parse pagination parameters
    const paginationParams = parsePaginationParams(req.query);
    const { limit, offset } = buildPaginationQuery(paginationParams);

    const query = `
      SELECT
        u.id,
        u.username,
        u.email,
        u.is_active,
        u.created_at,
        u.updated_at,
        ur.role,
        COUNT(*) OVER() as total_count
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      ORDER BY u.created_at DESC
      LIMIT $1 OFFSET $2
    `;

    const result = await pool.query(query, [limit, offset]);

    // Extract total count from first row (or 0 if no rows)
    const totalCount = result.rows.length > 0 ? parseInt(result.rows[0].total_count, 10) : 0;

    // Remove total_count from data
    const users = result.rows.map(row => {
      const { total_count, ...userData } = row;
      return userData;
    });

    // Build paginated response
    const paginatedData = buildPaginatedResponse(users, paginationParams, totalCount);

    logger.info('Listed all users', {
      userCount: users.length,
      page: paginationParams.page,
      limit: paginationParams.limit,
      totalCount,
      adminId: req.user?.id,
    });

    return res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: paginatedData,
    });
  })
);

/**
 * POST /api/users
 * Create new user
 * Requires: Admin access, valid createUserSchema
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  validateRequest(createUserSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { username, email, password, role } = req.validatedData;

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      throw new AppError('Username or email already exists', 409);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Start transaction for user and role creation
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create user
      const userResult = await client.query(
        `INSERT INTO users (username, email, password_hash, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         RETURNING id, username, email, is_active, created_at, updated_at`,
        [username, email, hashedPassword, true]
      );

      const newUser = userResult.rows[0];

      // Create user role
      await client.query(
        `INSERT INTO user_roles (user_id, role, created_at, assigned_at)
         VALUES ($1, $2, NOW(), NOW())`,
        [newUser.id, role]
      );

      await client.query('COMMIT');

      logger.info('User created successfully', {
        userId: newUser.id,
        username: newUser.username,
        role,
        createdBy: req.user?.id,
      });

      return res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          is_active: newUser.is_active,
          role,
          created_at: newUser.created_at,
          updated_at: newUser.updated_at,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  })
);

/**
 * PATCH /api/users/:id
 * Update user
 * Requires: Admin access, valid updateUserSchema, valid UUID
 */
router.patch(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateUuidParam('id'),
  validateRequest(updateUserSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { is_active, role } = req.validatedData;

    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, username, email FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    // User exists, proceed with update
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    // Build dynamic update query
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    if (!updates.length && !role) {
      throw new AppError('No valid fields to update', 400);
    }

    // Update user
    if (updates.length) {
      updates.push(`updated_at = NOW()`);
      const updateQuery = `
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, username, email, is_active, created_at, updated_at
      `;
      values.push(id);

      await pool.query(updateQuery, values);
    }

    // Update role if provided
    if (role) {
      const existingRole = await pool.query(
        'SELECT id FROM user_roles WHERE user_id = $1',
        [id]
      );

      if (existingRole.rows.length > 0) {
        await pool.query(
          `UPDATE user_roles
           SET role = $1, assigned_at = NOW()
           WHERE user_id = $2`,
          [role, id]
        );
      } else {
        await pool.query(
          `INSERT INTO user_roles (user_id, role, created_at, assigned_at)
           VALUES ($1, $2, NOW(), NOW())`,
          [id, role]
        );
      }
    }

    // Fetch updated user with role
    const updatedUserResult = await pool.query(
      `SELECT
        u.id,
        u.username,
        u.email,
        u.is_active,
        u.created_at,
        u.updated_at,
        ur.role
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       WHERE u.id = $1`,
      [id]
    );

    const updatedUser = updatedUserResult.rows[0];

    logger.info('User updated successfully', {
      userId: id,
      username: updatedUser.username,
      updatedFields: Object.keys({ is_active, role }).filter(
        (key) => ({ is_active, role } as Record<string, any>)[key] !== undefined
      ),
      updatedBy: req.user?.id,
    });

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
    });
  })
);

/**
 * DELETE /api/users/:id
 * Delete user
 * Requires: Admin access, valid UUID, cannot delete yourself
 */
router.delete(
  '/:id',
  authenticateToken,
  requireAdmin,
  validateUuidParam('id'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const adminId = req.user?.id;

    // Cannot delete yourself
    if (id === adminId) {
      throw new AppError('You cannot delete your own account', 403);
    }

    // Check if user exists
    const userResult = await pool.query(
      'SELECT id, username FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      throw new AppError('User not found', 404);
    }

    const user = userResult.rows[0];

    // Start transaction for user and role deletion
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete user roles
      await client.query(
        'DELETE FROM user_roles WHERE user_id = $1',
        [id]
      );

      // Delete user
      await client.query(
        'DELETE FROM users WHERE id = $1',
        [id]
      );

      await client.query('COMMIT');

      logger.info('User deleted successfully', {
        userId: id,
        username: user.username,
        deletedBy: adminId,
      });

      return res.status(200).json({
        success: true,
        message: 'User deleted successfully',
        data: {
          id: user.id,
          username: user.username,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  })
);

export default router;
