/**
 * Export API Routes
 * Provides data export functionality in multiple formats
 */

import express, { Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticate, AuthRequest } from '../middleware/auth';
import { ExportService } from '../services/exportService';
import { sendError } from '../types/responses';
import AuditLogger, { AuditAction, ResourceType } from '../services/auditLogger';

const router = express.Router();

/**
 * GET /api/export/servers?format=csv|json|pdf
 * Export servers list
 */
router.get(
  '/servers',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const format = (req.query.format as string) || 'csv';
    const filters = {
      status: req.query.status as string | undefined,
    };

    // Log audit event
    await AuditLogger.logFromRequest(
      req,
      AuditAction.SERVER_CREDENTIALS_VIEW,
      ResourceType.SERVER,
      undefined,
      { action: 'export', format }
    );

    switch (format.toLowerCase()) {
      case 'csv': {
        const csv = await ExportService.exportServersCSV(req.user!.id, filters);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=servers.csv');
        res.send(csv);
        break;
      }

      case 'json': {
        const data = await ExportService.exportServersJSON(req.user!.id, filters);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=servers.json');
        res.json(data);
        break;
      }

      case 'pdf': {
        const pdf = await ExportService.exportServersPDF(req.user!.id, filters);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=servers.pdf');
        res.send(pdf);
        break;
      }

      default:
        sendError(res, 'Invalid format. Use csv, json, or pdf', 400);
    }
  })
);

/**
 * GET /api/export/scans?format=csv|json&serverId=xxx
 * Export scans
 */
router.get(
  '/scans',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const format = (req.query.format as string) || 'csv';
    const filters = {
      serverId: req.query.serverId as string | undefined,
    };

    await AuditLogger.logFromRequest(
      req,
      AuditAction.SCAN_COMPLETE,
      ResourceType.SCAN,
      undefined,
      { action: 'export', format }
    );

    if (format.toLowerCase() === 'csv') {
      const csv = await ExportService.exportScansCSV(req.user!.id, filters);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=scans.csv');
      res.send(csv);
    } else if (format.toLowerCase() === 'json') {
      const scans = await ExportService['getScansForExport'](req.user!.id, filters);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=scans.json');
      res.json({ scans, exportDate: new Date().toISOString() });
    } else {
      sendError(res, 'Invalid format. Use csv or json', 400);
    }
  })
);

/**
 * GET /api/export/backups?format=csv|json&serverId=xxx
 * Export backups
 */
router.get(
  '/backups',
  authenticate,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const format = (req.query.format as string) || 'csv';
    const filters = {
      serverId: req.query.serverId as string | undefined,
    };

    await AuditLogger.logFromRequest(
      req,
      AuditAction.BACKUP_EXECUTE,
      ResourceType.BACKUP,
      undefined,
      { action: 'export', format }
    );

    if (format.toLowerCase() === 'csv') {
      const csv = await ExportService.exportBackupsCSV(req.user!.id, filters);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=backups.csv');
      res.send(csv);
    } else if (format.toLowerCase() === 'json') {
      const backups = await ExportService['getBackupsForExport'](req.user!.id, filters);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=backups.json');
      res.json({ backups, exportDate: new Date().toISOString() });
    } else {
      sendError(res, 'Invalid format. Use csv or json', 400);
    }
  })
);

export default router;
