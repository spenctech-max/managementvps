/**
 * Audit Logs API Routes
 * Provides access to audit trail for administrators
 */

import express, { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AuditLogger, AuditAction, ResourceType } from '../services/auditLogger';
import { sendSuccess, sendPaginated } from '../types/responses';
import { ForbiddenError } from '../errors';
import { validate, paginationSchema } from '../utils/validators';
import { z } from 'zod';

const router = express.Router();

/**
 * Query schema for audit logs
 */
const auditQuerySchema = paginationSchema.extend({
  userId: z.string().uuid().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  resourceType: z.nativeEnum(ResourceType).optional(),
  resourceId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  status: z.enum(['success', 'failure', 'partial']).optional(),
});

/**
 * GET /api/audit
 * Query audit logs with filters
 * Requires: Admin role
 */
router.get(
  '/',
  authenticate,
  validate(auditQuerySchema, 'query'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required to view audit logs');
    }

    const filters = {
      userId: req.query.userId as string | undefined,
      action: req.query.action as AuditAction | undefined,
      resourceType: req.query.resourceType as ResourceType | undefined,
      resourceId: req.query.resourceId as string | undefined,
      startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
      endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
      status: req.query.status as string | undefined,
      page: parseInt(req.query.page as string, 10) || 1,
      limit: parseInt(req.query.limit as string, 10) || 50,
    };

    const { logs, total } = await AuditLogger.query(filters);

    sendPaginated(
      res,
      logs,
      {
        page: filters.page,
        limit: filters.limit,
        total,
      },
      'Audit logs retrieved successfully'
    );
  })
);

/**
 * GET /api/audit/statistics
 * Get audit log statistics
 * Requires: Admin role
 */
router.get(
  '/statistics',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    const userId = req.query.userId as string | undefined;
    const stats = await AuditLogger.getStatistics(userId);

    sendSuccess(res, stats, 'Audit statistics retrieved successfully');
  })
);

/**
 * GET /api/audit/user/:userId
 * Get audit logs for a specific user
 * Requires: Admin role or own user ID
 */
router.get(
  '/user/:userId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { userId } = req.params;

    // Check permissions
    if (req.user?.role !== 'admin' && req.user?.id !== userId) {
      throw new ForbiddenError('You can only view your own audit logs');
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const { logs, total } = await AuditLogger.query({
      userId,
      page,
      limit,
    });

    sendPaginated(
      res,
      logs,
      {
        page,
        limit,
        total,
      },
      'User audit logs retrieved successfully'
    );
  })
);

/**
 * GET /api/audit/resource/:resourceType/:resourceId
 * Get audit logs for a specific resource
 * Requires: Admin role
 */
router.get(
  '/resource/:resourceType/:resourceId',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      throw new ForbiddenError('Admin access required');
    }

    const { resourceType, resourceId } = req.params;
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 50;

    const { logs, total } = await AuditLogger.query({
      resourceType: resourceType as ResourceType,
      resourceId,
      page,
      limit,
    });

    sendPaginated(
      res,
      logs,
      {
        page,
        limit,
        total,
      },
      'Resource audit logs retrieved successfully'
    );
  })
);

export default router;
