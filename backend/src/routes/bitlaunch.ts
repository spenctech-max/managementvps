/**
 * Bitlaunch Routes
 * API endpoints for managing Bitlaunch API connection and viewing billing/metrics data
 */

import { Router, Response } from 'express';
import { bitlaunchService } from '../services/bitlaunchService';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { logger } from '../config/logger';
import { pool } from '../config/database';

const router = Router();

/**
 * @swagger
 * /api/bitlaunch/status:
 *   get:
 *     summary: Get Bitlaunch connection status
 *     description: Returns the connection status, last sync time, and any errors
 *     tags: [Bitlaunch]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Connection status retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/status',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const status = await bitlaunchService.getStatus();

      // Log audit event
      await pool.query(
        `INSERT INTO bitlaunch_audit (event_type, event_description, user_id)
         VALUES ($1, $2, $3)`,
        ['api_call', 'Status check', req.user?.id]
      );

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      logger.error('Failed to get Bitlaunch status', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        message: 'Failed to get Bitlaunch status',
      });
    }
  }
);

/**
 * @swagger
 * /api/bitlaunch/config:
 *   post:
 *     summary: Set Bitlaunch API key
 *     description: Configure Bitlaunch API key (admin only)
 *     tags: [Bitlaunch]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - apiKey
 *             properties:
 *               apiKey:
 *                 type: string
 *                 description: Bitlaunch API key
 *     responses:
 *       200:
 *         description: API key configured successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.post(
  '/config',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      // Check if user is admin
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
      }

      const { apiKey } = req.body;

      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'API key is required and must be a non-empty string',
        });
      }

      // Store the API key
      await bitlaunchService.setApiKey(apiKey.trim());

      // Log audit event
      await pool.query(
        `INSERT INTO bitlaunch_audit (event_type, event_description, user_id)
         VALUES ($1, $2, $3)`,
        ['api_key_update', 'API key configured', req.user.id]
      );

      res.json({
        success: true,
        message: 'API key configured successfully',
      });
    } catch (error) {
      logger.error('Failed to configure Bitlaunch API key', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        message: 'Failed to configure API key',
      });
    }
  }
);

/**
 * @swagger
 * /api/bitlaunch/test:
 *   post:
 *     summary: Test Bitlaunch API connection
 *     description: Verify that the configured API key works (admin only)
 *     tags: [Bitlaunch]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Connection test completed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.post(
  '/test',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      // Check if user is admin
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
      }

      const result = await bitlaunchService.testConnection();

      // Log audit event
      await pool.query(
        `INSERT INTO bitlaunch_audit (event_type, event_description, request_status, user_id)
         VALUES ($1, $2, $3, $4)`,
        ['connection_test', result.message, result.success ? 200 : 401, req.user.id]
      );

      if (result.success) {
        res.json({
          success: true,
          message: result.message,
        });
      } else {
        res.status(401).json({
          success: false,
          message: result.message,
        });
      }
    } catch (error) {
      logger.error('Failed to test Bitlaunch connection', { error, userId: req.user?.id });

      // Log audit event for error
      await pool.query(
        `INSERT INTO bitlaunch_audit (event_type, error_message, user_id)
         VALUES ($1, $2, $3)`,
        ['connection_test', (error as Error).message, req.user?.id]
      );

      res.status(500).json({
        success: false,
        message: 'Connection test failed',
      });
    }
  }
);

/**
 * @swagger
 * /api/bitlaunch/billing:
 *   get:
 *     summary: Get Bitlaunch billing information
 *     description: Retrieve current account balance and usage information
 *     tags: [Bitlaunch]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Billing information retrieved successfully
 *       401:
 *         description: Unauthorized
 *       503:
 *         description: Bitlaunch API unavailable
 */
router.get(
  '/billing',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const billing = await bitlaunchService.fetchBillingInfo();

      // Log audit event
      await pool.query(
        `INSERT INTO bitlaunch_audit (event_type, event_description, user_id)
         VALUES ($1, $2, $3)`,
        ['api_call', 'Billing data retrieved', req.user?.id]
      );

      res.json({
        success: true,
        data: billing,
      });
    } catch (error) {
      logger.error('Failed to fetch Bitlaunch billing info', { error, userId: req.user?.id });

      // Log audit event for error
      await pool.query(
        `INSERT INTO bitlaunch_audit (event_type, error_message, user_id)
         VALUES ($1, $2, $3)`,
        ['api_call', (error as Error).message, req.user?.id]
      );

      res.status(503).json({
        success: false,
        message: 'Failed to fetch billing information',
      });
    }
  }
);

/**
 * @swagger
 * /api/bitlaunch/metrics:
 *   get:
 *     summary: Get Bitlaunch performance metrics
 *     description: Retrieve server metrics including uptime, CPU, memory, and network usage
 *     tags: [Bitlaunch]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Performance metrics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       503:
 *         description: Bitlaunch API unavailable
 */
router.get(
  '/metrics',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const metrics = await bitlaunchService.fetchPerformanceMetrics();

      // Log audit event
      await pool.query(
        `INSERT INTO bitlaunch_audit (event_type, event_description, user_id)
         VALUES ($1, $2, $3)`,
        ['api_call', 'Metrics data retrieved', req.user?.id]
      );

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('Failed to fetch Bitlaunch metrics', { error, userId: req.user?.id });

      // Log audit event for error
      await pool.query(
        `INSERT INTO bitlaunch_audit (event_type, error_message, user_id)
         VALUES ($1, $2, $3)`,
        ['api_call', (error as Error).message, req.user?.id]
      );

      res.status(503).json({
        success: false,
        message: 'Failed to fetch performance metrics',
      });
    }
  }
);

/**
 * @swagger
 * /api/bitlaunch/servers:
 *   get:
 *     summary: Get list of BitLaunch servers
 *     description: Retrieve list of all servers from BitLaunch account
 *     tags: [Bitlaunch]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Servers retrieved successfully
 *       401:
 *         description: Unauthorized
 *       503:
 *         description: Bitlaunch API unavailable
 */
router.get(
  '/servers',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      const servers = await bitlaunchService.fetchServers();

      // Log audit event
      await pool.query(
        `INSERT INTO bitlaunch_audit (event_type, event_description, user_id)
         VALUES ($1, $2, $3)`,
        ['api_call', 'Servers list retrieved', req.user?.id]
      );

      res.json({
        success: true,
        data: servers,
      });
    } catch (error) {
      logger.error('Failed to fetch Bitlaunch servers', { error, userId: req.user?.id });

      // Log audit event for error
      await pool.query(
        `INSERT INTO bitlaunch_audit (event_type, error_message, user_id)
         VALUES ($1, $2, $3)`,
        ['api_call', (error as Error).message, req.user?.id]
      );

      res.status(503).json({
        success: false,
        message: 'Failed to fetch servers',
      });
    }
  }
);

/**
 * @swagger
 * /api/bitlaunch/sync:
 *   post:
 *     summary: Manually trigger Bitlaunch data sync
 *     description: Manually synchronize Bitlaunch data (admin only)
 *     tags: [Bitlaunch]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sync completed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 *       503:
 *         description: Bitlaunch API unavailable
 */
router.post(
  '/sync',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      // Check if user is admin
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
      }

      const result = await bitlaunchService.syncAllData();

      if (result) {
        // Log successful sync
        await pool.query(
          `INSERT INTO bitlaunch_audit (event_type, event_description, user_id)
           VALUES ($1, $2, $3)`,
          ['sync_success', 'Manual sync completed', req.user.id]
        );

        res.json({
          success: true,
          message: 'Data synchronized successfully',
          data: result,
        });
      } else {
        // Log sync failure
        await pool.query(
          `INSERT INTO bitlaunch_audit (event_type, error_message, user_id)
           VALUES ($1, $2, $3)`,
          ['sync_failure', 'Sync in progress or API not configured', req.user.id]
        );

        res.status(503).json({
          success: false,
          message: 'Failed to sync data. Ensure API key is configured.',
        });
      }
    } catch (error) {
      logger.error('Failed to sync Bitlaunch data', { error, userId: req.user?.id });

      // Log audit event for error
      await pool.query(
        `INSERT INTO bitlaunch_audit (event_type, error_message, user_id)
         VALUES ($1, $2, $3)`,
        ['sync_failure', (error as Error).message, req.user?.id]
      );

      res.status(500).json({
        success: false,
        message: 'Sync failed',
      });
    }
  }
);

/**
 * @swagger
 * /api/bitlaunch/config:
 *   delete:
 *     summary: Remove Bitlaunch API key
 *     description: Disconnect Bitlaunch integration by removing API key (admin only)
 *     tags: [Bitlaunch]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: API key removed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin only
 */
router.delete(
  '/config',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    try {
      // Check if user is admin
      if (req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Admin access required',
        });
      }

      await bitlaunchService.clearApiKey();

      // Log audit event
      await pool.query(
        `INSERT INTO bitlaunch_audit (event_type, event_description, user_id)
         VALUES ($1, $2, $3)`,
        ['api_key_removed', 'API key removed', req.user.id]
      );

      res.json({
        success: true,
        message: 'Bitlaunch integration removed',
      });
    } catch (error) {
      logger.error('Failed to remove Bitlaunch API key', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        message: 'Failed to remove API key',
      });
    }
  }
);

export default router;
