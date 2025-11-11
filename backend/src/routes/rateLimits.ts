/**
 * Rate Limit Management Routes
 *
 * Admin endpoints for managing rate limits and IP blocking
 */

import { Router, Response } from 'express';
import { authenticateToken, AuthRequest, requireAdmin } from '../middleware/auth';
import { asyncHandler, AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import {
  getRateLimitStats,
  resetRateLimit,
  getGlobalRateLimitStats,
  RateLimitTier,
} from '../middleware/rateLimiter';
import { ipBlockingService } from '../services/ipBlockingService';

const router = Router();

/**
 * All routes require authentication and admin role
 */
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/admin/rate-limits/stats
 * Get global rate limit statistics
 *
 * @swagger
 * /api/admin/rate-limits/stats:
 *   get:
 *     summary: Get global rate limit statistics
 *     tags: [Admin, Rate Limits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rate limit statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get(
  '/stats',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    logger.info('Get rate limit stats requested', { userId: req.user?.id });

    const stats = await getGlobalRateLimitStats();
    const ipStats = await ipBlockingService.getStats();

    res.status(200).json({
      success: true,
      message: 'Rate limit statistics retrieved successfully',
      data: {
        rateLimits: stats,
        ipBlocking: ipStats,
        timestamp: new Date().toISOString(),
      },
    });
  })
);

/**
 * GET /api/admin/rate-limits/user/:identifier
 * Get rate limit status for a specific user or IP
 *
 * @swagger
 * /api/admin/rate-limits/user/{identifier}:
 *   get:
 *     summary: Get rate limit status for user or IP
 *     tags: [Admin, Rate Limits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *         description: User identifier (user:id or ip:address)
 *     responses:
 *       200:
 *         description: Rate limit status retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get(
  '/user/:identifier',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { identifier } = req.params;

    logger.info('Get user rate limit status', {
      userId: req.user?.id,
      identifier,
    });

    const stats = await getRateLimitStats(identifier);

    res.status(200).json({
      success: true,
      message: 'Rate limit status retrieved successfully',
      data: {
        identifier,
        limits: stats,
        timestamp: new Date().toISOString(),
      },
    });
  })
);

/**
 * DELETE /api/admin/rate-limits/user/:identifier
 * Reset rate limits for a specific user or IP
 *
 * @swagger
 * /api/admin/rate-limits/user/{identifier}:
 *   delete:
 *     summary: Reset rate limits for user or IP
 *     tags: [Admin, Rate Limits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: identifier
 *         required: true
 *         schema:
 *           type: string
 *         description: User identifier (user:id or ip:address)
 *       - in: query
 *         name: tier
 *         schema:
 *           type: string
 *           enum: [public, read, write, heavy, admin]
 *         description: Optional tier to reset (resets all if not specified)
 *     responses:
 *       200:
 *         description: Rate limits reset successfully
 *       400:
 *         description: Invalid tier specified
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.delete(
  '/user/:identifier',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { identifier } = req.params;
    const { tier } = req.query;

    // Validate tier if provided
    if (tier && !Object.values(RateLimitTier).includes(tier as RateLimitTier)) {
      throw new AppError('Invalid rate limit tier', 400);
    }

    logger.info('Reset user rate limits', {
      userId: req.user?.id,
      identifier,
      tier: tier || 'all',
    });

    await resetRateLimit(identifier, tier as RateLimitTier | undefined);

    res.status(200).json({
      success: true,
      message: 'Rate limits reset successfully',
      data: {
        identifier,
        tier: tier || 'all',
      },
    });
  })
);

/**
 * POST /api/admin/rate-limits/block-ip
 * Block an IP address
 *
 * @swagger
 * /api/admin/rate-limits/block-ip:
 *   post:
 *     summary: Block an IP address
 *     tags: [Admin, Rate Limits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ip
 *               - reason
 *             properties:
 *               ip:
 *                 type: string
 *                 description: IP address to block
 *               reason:
 *                 type: string
 *                 description: Reason for blocking
 *               duration:
 *                 type: number
 *                 description: Block duration in seconds (0 for permanent)
 *     responses:
 *       200:
 *         description: IP blocked successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post(
  '/block-ip',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { ip, reason, duration } = req.body;

    if (!ip || !reason) {
      throw new AppError('IP address and reason are required', 400);
    }

    // Validate IP format (basic validation)
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (!ipRegex.test(ip)) {
      throw new AppError('Invalid IP address format', 400);
    }

    const blockDuration = duration !== undefined ? parseInt(duration, 10) : 3600;

    if (isNaN(blockDuration) || blockDuration < 0) {
      throw new AppError('Invalid duration', 400);
    }

    logger.warn('Admin blocking IP', {
      userId: req.user?.id,
      ip,
      reason,
      duration: blockDuration,
    });

    await ipBlockingService.blockIp(ip, reason, blockDuration, req.user?.id);

    res.status(200).json({
      success: true,
      message: 'IP blocked successfully',
      data: {
        ip,
        reason,
        duration: blockDuration > 0 ? `${blockDuration}s` : 'permanent',
        blockedBy: req.user?.username,
      },
    });
  })
);

/**
 * DELETE /api/admin/rate-limits/unblock-ip/:ip
 * Unblock an IP address
 *
 * @swagger
 * /api/admin/rate-limits/unblock-ip/{ip}:
 *   delete:
 *     summary: Unblock an IP address
 *     tags: [Admin, Rate Limits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ip
 *         required: true
 *         schema:
 *           type: string
 *         description: IP address to unblock
 *     responses:
 *       200:
 *         description: IP unblocked successfully
 *       404:
 *         description: IP not blocked
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.delete(
  '/unblock-ip/:ip',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { ip } = req.params;

    logger.info('Admin unblocking IP', {
      userId: req.user?.id,
      ip,
    });

    const unblocked = await ipBlockingService.unblockIp(ip);

    if (!unblocked) {
      throw new AppError('IP not blocked', 404);
    }

    res.status(200).json({
      success: true,
      message: 'IP unblocked successfully',
      data: {
        ip,
        unblockedBy: req.user?.username,
      },
    });
  })
);

/**
 * GET /api/admin/rate-limits/blocked-ips
 * Get list of blocked IP addresses
 *
 * @swagger
 * /api/admin/rate-limits/blocked-ips:
 *   get:
 *     summary: Get list of blocked IP addresses
 *     tags: [Admin, Rate Limits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Blocked IPs retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get(
  '/blocked-ips',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    logger.info('Get blocked IPs requested', { userId: req.user?.id });

    const blockedIps = await ipBlockingService.getBlockedIps();

    res.status(200).json({
      success: true,
      message: 'Blocked IPs retrieved successfully',
      data: {
        blockedIps,
        count: blockedIps.length,
      },
    });
  })
);

/**
 * GET /api/admin/rate-limits/blocked-ips/:ip
 * Get information about a specific blocked IP
 *
 * @swagger
 * /api/admin/rate-limits/blocked-ips/{ip}:
 *   get:
 *     summary: Get information about a blocked IP
 *     tags: [Admin, Rate Limits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ip
 *         required: true
 *         schema:
 *           type: string
 *         description: IP address
 *     responses:
 *       200:
 *         description: Block information retrieved successfully
 *       404:
 *         description: IP not blocked
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get(
  '/blocked-ips/:ip',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { ip } = req.params;

    logger.info('Get blocked IP info', {
      userId: req.user?.id,
      ip,
    });

    const blockInfo = await ipBlockingService.getBlockInfo(ip);

    if (!blockInfo) {
      throw new AppError('IP not blocked', 404);
    }

    res.status(200).json({
      success: true,
      message: 'Block information retrieved successfully',
      data: blockInfo,
    });
  })
);

/**
 * POST /api/admin/rate-limits/whitelist-ip
 * Add an IP to whitelist
 *
 * @swagger
 * /api/admin/rate-limits/whitelist-ip:
 *   post:
 *     summary: Add an IP to whitelist
 *     tags: [Admin, Rate Limits]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ip
 *               - reason
 *             properties:
 *               ip:
 *                 type: string
 *                 description: IP address to whitelist
 *               reason:
 *                 type: string
 *                 description: Reason for whitelisting
 *     responses:
 *       200:
 *         description: IP whitelisted successfully
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post(
  '/whitelist-ip',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { ip, reason } = req.body;

    if (!ip || !reason) {
      throw new AppError('IP address and reason are required', 400);
    }

    // Validate IP format
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$|^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (!ipRegex.test(ip)) {
      throw new AppError('Invalid IP address format', 400);
    }

    logger.info('Admin whitelisting IP', {
      userId: req.user?.id,
      ip,
      reason,
    });

    await ipBlockingService.whitelistIp(ip, reason, req.user?.id || 'admin');

    res.status(200).json({
      success: true,
      message: 'IP whitelisted successfully',
      data: {
        ip,
        reason,
        addedBy: req.user?.username,
      },
    });
  })
);

/**
 * DELETE /api/admin/rate-limits/whitelist-ip/:ip
 * Remove an IP from whitelist
 *
 * @swagger
 * /api/admin/rate-limits/whitelist-ip/{ip}:
 *   delete:
 *     summary: Remove an IP from whitelist
 *     tags: [Admin, Rate Limits]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ip
 *         required: true
 *         schema:
 *           type: string
 *         description: IP address to remove from whitelist
 *     responses:
 *       200:
 *         description: IP removed from whitelist successfully
 *       404:
 *         description: IP not whitelisted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.delete(
  '/whitelist-ip/:ip',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { ip } = req.params;

    logger.info('Admin removing IP from whitelist', {
      userId: req.user?.id,
      ip,
    });

    const removed = await ipBlockingService.removeFromWhitelist(ip);

    if (!removed) {
      throw new AppError('IP not whitelisted', 404);
    }

    res.status(200).json({
      success: true,
      message: 'IP removed from whitelist successfully',
      data: {
        ip,
        removedBy: req.user?.username,
      },
    });
  })
);

/**
 * GET /api/admin/rate-limits/whitelisted-ips
 * Get list of whitelisted IP addresses
 *
 * @swagger
 * /api/admin/rate-limits/whitelisted-ips:
 *   get:
 *     summary: Get list of whitelisted IP addresses
 *     tags: [Admin, Rate Limits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Whitelisted IPs retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get(
  '/whitelisted-ips',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    logger.info('Get whitelisted IPs requested', { userId: req.user?.id });

    const whitelistedIps = await ipBlockingService.getWhitelistedIps();

    res.status(200).json({
      success: true,
      message: 'Whitelisted IPs retrieved successfully',
      data: {
        whitelistedIps,
        count: whitelistedIps.length,
      },
    });
  })
);

/**
 * POST /api/admin/rate-limits/clear-all-blocks
 * Clear all IP blocks (emergency use only)
 *
 * @swagger
 * /api/admin/rate-limits/clear-all-blocks:
 *   post:
 *     summary: Clear all IP blocks
 *     tags: [Admin, Rate Limits]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All blocks cleared successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post(
  '/clear-all-blocks',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    logger.warn('Admin clearing all IP blocks', {
      userId: req.user?.id,
    });

    const count = await ipBlockingService.clearAllBlocks();

    res.status(200).json({
      success: true,
      message: 'All IP blocks cleared successfully',
      data: {
        count,
        clearedBy: req.user?.username,
      },
    });
  })
);

export default router;
