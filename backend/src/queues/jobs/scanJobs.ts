/**
 * Scan Job Handlers
 * Defines scan job types and their processing logic
 */

import { Job } from 'bullmq';
import { Pool } from 'pg';
import { Logger } from 'winston';
import { BackupScanner } from '../../services/scanner';

/**
 * Scan job data interface
 */
export interface ScanJobData {
  serverId: string;
  scanId: string;
  userId: string;
  scanType: 'full' | 'quick' | 'custom';
  options?: {
    paths?: string[];
    checkDiskSpace?: boolean;
    checkServices?: boolean;
    checkPackages?: boolean;
  };
}

/**
 * Scan job result interface
 */
export interface ScanJobResult {
  scanId: string;
  serverId: string;
  status: 'completed' | 'failed';
  duration: number;
  summary?: any;
  error?: string;
}

/**
 * Scan Job Handler
 */
export class ScanJobHandler {
  private pool: Pool;
  private logger: Logger;
  private scanner: BackupScanner;

  constructor(pool: Pool, logger: Logger) {
    this.pool = pool;
    this.logger = logger;
    this.scanner = new BackupScanner(pool, logger);
  }

  /**
   * Process scan job
   */
  async process(job: Job<ScanJobData>): Promise<ScanJobResult> {
    const { serverId, scanId, userId, scanType } = job.data;
    const startTime = Date.now();

    this.logger.info('Processing scan job', {
      jobId: job.id,
      scanId,
      serverId,
      userId,
      scanType,
    });

    try {
      // Update job progress
      await job.updateProgress(10);

      // Verify server exists
      const serverResult = await this.pool.query(
        'SELECT id, name FROM servers WHERE id = $1',
        [serverId]
      );

      if (serverResult.rows.length === 0) {
        throw new Error('Server not found');
      }

      const server = serverResult.rows[0];
      await job.updateProgress(20);

      // Store job ID in scan record
      await this.pool.query(
        'UPDATE server_scans SET scan_summary = scan_summary || $1 WHERE id = $2',
        [JSON.stringify({ jobId: job.id }), scanId]
      );

      await job.updateProgress(30);

      this.logger.info('Starting real SSH scan via BackupScanner', {
        serverId,
        scanId,
        scanType,
      });

      // Perform the REAL scan using BackupScanner service
      // The scanner will:
      // 1. Update scan status to 'running'
      // 2. Connect via SSH to the remote server
      // 3. Detect services (Docker, databases, web servers, etc.)
      // 4. Scan filesystems and disk usage
      // 5. Generate backup recommendations
      // 6. Store all results in database
      // 7. Update scan status to 'completed' or 'failed'

      // Map scanType to scanner's expected format
      let scannerType = scanType;
      if (scanType === 'custom') {
        // For custom scans, default to 'full' - the scanner supports: 'full', 'quick', 'services', 'filesystems'
        scannerType = 'full';
      }

      await job.updateProgress(50);

      // Call the REAL scanner - this does everything
      // Pass the existing scanId so the scanner doesn't create a duplicate record
      const resultScanId = await this.scanner.scanServer(serverId, scannerType, scanId);

      await job.updateProgress(90);

      // Get the scan summary that was already stored by the scanner
      const scanResult = await this.pool.query(
        'SELECT status, scan_duration, scan_summary FROM server_scans WHERE id = $1',
        [scanId]
      );

      const scanRecord = scanResult.rows[0];
      const duration = scanRecord?.scan_duration || Math.floor((Date.now() - startTime) / 1000);
      const summary = scanRecord?.scan_summary || {};

      await job.updateProgress(100);

      const result: ScanJobResult = {
        scanId,
        serverId,
        status: 'completed',
        duration,
        summary,
      };

      this.logger.info('Scan job completed with real scanner', {
        jobId: job.id,
        scanId,
        serverId,
        duration,
        summary,
      });

      return result;
    } catch (error) {
      const duration = Math.floor((Date.now() - startTime) / 1000);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.error('Scan job failed', {
        jobId: job.id,
        scanId,
        serverId,
        error: errorMessage,
      });

      // Scanner already updated the scan status to 'failed'
      // Just log and re-throw for BullMQ retry logic

      const result: ScanJobResult = {
        scanId,
        serverId,
        status: 'failed',
        duration,
        error: errorMessage,
      };

      // Re-throw to let BullMQ handle retries
      throw error;
    }
  }

  /**
   * Handle job failure after all retries
   */
  async onFailed(job: Job<ScanJobData>, error: Error): Promise<void> {
    const { scanId, serverId } = job.data;

    this.logger.error('Scan job failed permanently', {
      jobId: job.id,
      scanId,
      serverId,
      error: error.message,
      attemptsMade: job.attemptsMade,
    });

    // Update scan record
    await this.pool.query(
      `UPDATE server_scans
       SET status = 'failed',
           error_message = $1,
           completed_at = NOW()
       WHERE id = $2`,
      [error.message, scanId]
    );
  }

  /**
   * Handle job completion
   */
  async onCompleted(job: Job<ScanJobData>, result: ScanJobResult): Promise<void> {
    this.logger.info('Scan job completed successfully', {
      jobId: job.id,
      scanId: result.scanId,
      serverId: result.serverId,
      duration: result.duration,
    });

    // Additional cleanup or notifications can be added here
  }
}

export default ScanJobHandler;
