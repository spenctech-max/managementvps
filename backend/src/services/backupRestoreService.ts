import { Pool } from 'pg';
import { Client } from 'ssh2';
import { Logger } from 'winston';
import { decrypt } from '../utils/crypto';
import { existsSync, createReadStream } from 'fs';
import { stat } from 'fs/promises';

/**
 * Options for restore operation
 */
export interface RestoreOptions {
  restoreType: 'full' | 'selective';
  selectedServices?: string[];
  verifyIntegrity?: boolean;
  createRollbackPoint?: boolean;
  skipHealthChecks?: boolean;
}

/**
 * Service configuration for restore
 */
interface ServiceRestoreConfig {
  serviceId: string;
  serviceName: string;
  serviceType: string;
  restoreCommand?: string;
  healthCheck?: string;
  dependencies: string[];
}

/**
 * Result of restore operation
 */
export interface RestoreResult {
  success: boolean;
  restoreJobId: string;
  servicesRestored: string[];
  servicesFailed: string[];
  restoreDuration: number;
  errors: string[];
  rolledBack: boolean;
}

/**
 * Backup Restore Service
 * Handles complete restore workflow including verification, rollback, and progress tracking
 */
export class BackupRestoreService {
  private pool: Pool;
  private logger: Logger;
  private readonly RESTORE_TIMEOUT = 600000; // 10 minutes
  private readonly HEALTH_CHECK_TIMEOUT = 60000; // 1 minute

  constructor(pool: Pool, logger: Logger) {
    this.pool = pool;
    this.logger = logger;
  }

  /**
   * Orchestrate a complete restore workflow
   */
  async orchestrateRestore(
    backupId: string,
    userId: string,
    options: RestoreOptions
  ): Promise<RestoreResult> {
    const startTime = Date.now();
    let restoreJobId: string | null = null;
    let conn: Client | null = null;

    const result: RestoreResult = {
      success: false,
      restoreJobId: '',
      servicesRestored: [],
      servicesFailed: [],
      restoreDuration: 0,
      errors: [],
      rolledBack: false,
    };

    try {
      // Step 1: Validate backup exists and get details
      this.logger.info('Starting restore operation', { backupId, userId, options });
      const backup = await this.validateBackup(backupId, userId);

      if (!backup) {
        throw new Error('Backup not found or access denied');
      }

      if (backup.status !== 'completed') {
        throw new Error(`Backup is not in completed state. Current status: ${backup.status}`);
      }

      // Step 2: Create restore job
      restoreJobId = await this.createRestoreJob(backupId, backup.server_id, userId, options);
      result.restoreJobId = restoreJobId;

      await this.updateRestoreJobStatus(restoreJobId, 'preparing', 'Preparing restore operation');

      // Step 3: Verify backup integrity if requested
      if (options.verifyIntegrity !== false) {
        await this.updateRestoreJobStatus(restoreJobId, 'verifying', 'Verifying backup integrity');
        await this.logRestoreStep(restoreJobId, 'verify_integrity', 'started', 'Verifying backup file integrity');

        const isValid = await this.verifyBackupIntegrity(backup);

        if (!isValid) {
          await this.logRestoreStep(restoreJobId, 'verify_integrity', 'failed', 'Backup integrity check failed');
          throw new Error('Backup integrity verification failed. Backup may be corrupted.');
        }

        await this.logRestoreStep(restoreJobId, 'verify_integrity', 'completed', 'Backup integrity verified successfully');
      }

      // Step 4: Get server details and connect
      const server = await this.getServerDetails(backup.server_id);
      conn = await this.connectSSH(server);

      // Step 5: Get services to restore
      const services = await this.getServicesToRestore(backupId, options);

      if (services.length === 0) {
        throw new Error('No services found to restore');
      }

      // Update restore job with services list
      await this.pool.query(
        'UPDATE restore_jobs SET services_to_restore = $1 WHERE id = $2',
        [services.map(s => s.serviceName), restoreJobId]
      );

      // Step 6: Create rollback point if requested
      let rollbackPath: string | null = null;
      if (options.createRollbackPoint !== false) {
        await this.updateRestoreJobStatus(restoreJobId, 'preparing', 'Creating rollback point');
        await this.logRestoreStep(restoreJobId, 'create_rollback', 'started', 'Creating pre-restore snapshot');

        rollbackPath = await this.createRollbackPoint(conn, server, services);

        if (rollbackPath) {
          await this.pool.query(
            'UPDATE restore_jobs SET rollback_path = $1 WHERE id = $2',
            [rollbackPath, restoreJobId]
          );
          await this.logRestoreStep(restoreJobId, 'create_rollback', 'completed', `Rollback point created: ${rollbackPath}`);
        }
      }

      // Step 7: Stop services
      await this.updateRestoreJobStatus(restoreJobId, 'stopping_services', 'Stopping services for restore');
      await this.logRestoreStep(restoreJobId, 'stop_services', 'started', 'Stopping affected services');

      const stoppedServices = await this.stopServices(conn, services);

      await this.logRestoreStep(
        restoreJobId,
        'stop_services',
        'completed',
        `Stopped ${stoppedServices.length} services`,
        { stoppedServices }
      );

      // Step 8: Execute restore
      await this.updateRestoreJobStatus(restoreJobId, 'restoring', 'Restoring backup data');
      await this.logRestoreStep(restoreJobId, 'restore_data', 'started', 'Restoring backup data to server');

      const restoreResults = await this.executeRestore(conn, backup, services, restoreJobId);

      result.servicesRestored = restoreResults.successful;
      result.servicesFailed = restoreResults.failed;
      result.errors = restoreResults.errors;

      await this.logRestoreStep(
        restoreJobId,
        'restore_data',
        restoreResults.failed.length === 0 ? 'completed' : 'failed',
        `Restored ${restoreResults.successful.length} services, ${restoreResults.failed.length} failed`,
        { successful: restoreResults.successful, failed: restoreResults.failed }
      );

      // Step 9: Restart services
      await this.updateRestoreJobStatus(restoreJobId, 'restarting_services', 'Restarting services');
      await this.logRestoreStep(restoreJobId, 'restart_services', 'started', 'Restarting services');

      const restartedServices = await this.restartServices(conn, services, options.skipHealthChecks !== true);

      await this.logRestoreStep(
        restoreJobId,
        'restart_services',
        'completed',
        `Restarted ${restartedServices.length} services`,
        { restartedServices }
      );

      // Step 10: Check if restore was successful
      if (restoreResults.failed.length > 0) {
        // Partial failure - attempt rollback if available
        if (rollbackPath && options.createRollbackPoint !== false) {
          this.logger.warn('Restore had failures, attempting rollback', {
            restoreJobId,
            failed: restoreResults.failed
          });

          await this.updateRestoreJobStatus(restoreJobId, 'failed', 'Restore failed, performing rollback');
          await this.performRollback(conn, server, rollbackPath, services, restoreJobId);

          result.rolledBack = true;
          throw new Error(`Restore failed for services: ${restoreResults.failed.join(', ')}. System rolled back to previous state.`);
        } else {
          throw new Error(`Restore partially failed for services: ${restoreResults.failed.join(', ')}`);
        }
      }

      // Success
      await this.updateRestoreJobStatus(restoreJobId, 'completed', 'Restore completed successfully', 100);
      result.success = true;

      this.logger.info('Restore completed successfully', {
        restoreJobId,
        backupId,
        servicesRestored: result.servicesRestored.length,
        duration: Date.now() - startTime,
      });

    } catch (error) {
      this.logger.error('Restore failed', {
        restoreJobId,
        backupId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (restoreJobId) {
        await this.updateRestoreJobStatus(
          restoreJobId,
          result.rolledBack ? 'rolled_back' : 'failed',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }

      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      if (conn) {
        conn.end();
      }
    }

    result.restoreDuration = Date.now() - startTime;
    return result;
  }

  /**
   * Validate backup exists and user has access
   */
  private async validateBackup(backupId: string, userId: string): Promise<any> {
    const result = await this.pool.query(
      `SELECT b.*, s.user_id
       FROM backups b
       INNER JOIN servers s ON b.server_id = s.id
       WHERE b.id = $1 AND s.user_id = $2`,
      [backupId, userId]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Verify backup file integrity
   */
  private async verifyBackupIntegrity(backup: any): Promise<boolean> {
    try {
      const filePath = backup.file_path;

      if (!filePath) {
        this.logger.warn('No file path in backup record', { backupId: backup.id });
        return false;
      }

      // Check if file exists
      if (!existsSync(filePath)) {
        this.logger.error('Backup file not found', { backupId: backup.id, filePath });
        return false;
      }

      // Check file size matches
      const stats = await stat(filePath);
      const actualSize = stats.size;
      const expectedSize = backup.file_size;

      if (expectedSize && actualSize !== expectedSize) {
        this.logger.error('Backup file size mismatch', {
          backupId: backup.id,
          expectedSize,
          actualSize,
        });
        return false;
      }

      // Verify file is readable (basic check - could add checksum verification here)
      const testRead = createReadStream(filePath, { start: 0, end: 1024 });

      return new Promise((resolve) => {
        testRead.on('data', () => {
          testRead.close();
          resolve(true);
        });

        testRead.on('error', (err) => {
          this.logger.error('Backup file read error', {
            backupId: backup.id,
            error: err.message,
          });
          resolve(false);
        });
      });

    } catch (error) {
      this.logger.error('Backup integrity verification failed', {
        backupId: backup.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Create restore job record
   */
  private async createRestoreJob(
    backupId: string,
    serverId: string,
    userId: string,
    options: RestoreOptions
  ): Promise<string> {
    const result = await this.pool.query(
      `INSERT INTO restore_jobs
       (backup_id, server_id, user_id, restore_type, status, current_step, metadata)
       VALUES ($1, $2, $3, $4, 'pending', 'Initializing', $5)
       RETURNING id`,
      [backupId, serverId, userId, options.restoreType, JSON.stringify(options)]
    );

    return result.rows[0].id;
  }

  /**
   * Update restore job status
   */
  private async updateRestoreJobStatus(
    restoreJobId: string,
    status: string,
    currentStep?: string,
    progressPercentage?: number
  ): Promise<void> {
    const updates: string[] = ['status = $2'];
    const values: any[] = [restoreJobId, status];
    let paramIndex = 3;

    if (currentStep) {
      updates.push(`current_step = $${paramIndex++}`);
      values.push(currentStep);
    }

    if (progressPercentage !== undefined) {
      updates.push(`progress_percentage = $${paramIndex++}`);
      values.push(progressPercentage);
    }

    if (status === 'completed' || status === 'failed' || status === 'rolled_back') {
      updates.push('completed_at = NOW()');
    }

    await this.pool.query(
      `UPDATE restore_jobs SET ${updates.join(', ')} WHERE id = $1`,
      values
    );
  }

  /**
   * Log a restore step to audit log
   */
  private async logRestoreStep(
    restoreJobId: string,
    stepName: string,
    status: 'started' | 'completed' | 'failed' | 'skipped',
    message?: string,
    details?: any
  ): Promise<void> {
    // Get current step number
    const countResult = await this.pool.query(
      'SELECT COUNT(*) as count FROM restore_audit_logs WHERE restore_job_id = $1',
      [restoreJobId]
    );
    const stepNumber = parseInt(countResult.rows[0].count, 10) + 1;

    await this.pool.query(
      `INSERT INTO restore_audit_logs
       (restore_job_id, step_number, step_name, status, message, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [restoreJobId, stepNumber, stepName, status, message, details ? JSON.stringify(details) : null]
    );

    // Update completed_at and duration for completed/failed steps
    if (status === 'completed' || status === 'failed') {
      await this.pool.query(
        `UPDATE restore_audit_logs
         SET completed_at = NOW(),
             duration_ms = EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
         WHERE restore_job_id = $1 AND step_number = $2`,
        [restoreJobId, stepNumber]
      );
    }
  }

  /**
   * Get server details
   */
  private async getServerDetails(serverId: string): Promise<any> {
    const result = await this.pool.query(
      'SELECT * FROM servers WHERE id = $1',
      [serverId]
    );

    if (result.rows.length === 0) {
      throw new Error('Server not found');
    }

    return result.rows[0];
  }

  /**
   * Get services to restore based on backup and options
   */
  private async getServicesToRestore(
    backupId: string,
    options: RestoreOptions
  ): Promise<ServiceRestoreConfig[]> {
    // Get backup metadata which should contain service information
    const backupResult = await this.pool.query(
      'SELECT metadata, server_id FROM backups WHERE id = $1',
      [backupId]
    );

    if (backupResult.rows.length === 0) {
      throw new Error('Backup not found');
    }

    const backup = backupResult.rows[0];
    const metadata = backup.metadata || {};

    // Get detected services from latest scan
    const servicesResult = await this.pool.query(
      `SELECT ds.*
       FROM detected_services ds
       INNER JOIN server_scans ss ON ds.scan_id = ss.id
       WHERE ss.server_id = $1 AND ss.status = 'completed'
       ORDER BY ss.started_at DESC
       LIMIT 100`,
      [backup.server_id]
    );

    const allServices = servicesResult.rows;

    // Filter services if selective restore
    let servicesToRestore = allServices;
    if (options.restoreType === 'selective' && options.selectedServices) {
      servicesToRestore = allServices.filter(s =>
        options.selectedServices!.includes(s.id) ||
        options.selectedServices!.includes(s.service_name)
      );
    }

    // Build restore configurations
    return servicesToRestore.map(service => ({
      serviceId: service.id,
      serviceName: service.service_name,
      serviceType: service.service_type,
      restoreCommand: this.getRestoreCommand(service),
      healthCheck: this.getHealthCheckCommand(service),
      dependencies: [],
    }));
  }

  /**
   * Get restore command for a service
   */
  private getRestoreCommand(service: any): string {
    const serviceName = service.service_name;
    const serviceType = service.service_type;

    if (serviceType === 'docker') {
      const image = service.service_details?.image || '';

      if (image.includes('mysql') || image.includes('mariadb')) {
        return `gunzip -c /restore/${serviceName}_*.sql.gz | docker exec -i ${serviceName} mysql`;
      } else if (image.includes('postgres')) {
        return `gunzip -c /restore/${serviceName}_*.sql.gz | docker exec -i ${serviceName} psql -U postgres`;
      } else if (image.includes('mongo')) {
        return `docker exec ${serviceName} mongorestore --archive=/restore/${serviceName}_*.archive --gzip`;
      } else {
        // Generic volume restore
        return `docker run --rm --volumes-from ${serviceName} -v /restore:/restore alpine sh -c "cd /data && tar xzf /restore/${serviceName}_*.tar.gz"`;
      }
    } else if (serviceType === 'systemd') {
      // Extract to original locations
      return `tar xzf /restore/${serviceName}_*.tar.gz -C /`;
    }

    return '';
  }

  /**
   * Get health check command for a service
   */
  private getHealthCheckCommand(service: any): string {
    const serviceName = service.service_name;
    const serviceType = service.service_type;

    if (serviceType === 'docker') {
      const image = service.service_details?.image || '';

      if (image.includes('mysql') || image.includes('mariadb')) {
        return `docker exec ${serviceName} mysqladmin ping -h localhost`;
      } else if (image.includes('postgres')) {
        return `docker exec ${serviceName} pg_isready`;
      } else if (image.includes('mongo')) {
        return `docker exec ${serviceName} mongo --eval "db.adminCommand('ping')"`;
      } else if (image.includes('redis')) {
        return `docker exec ${serviceName} redis-cli ping`;
      } else {
        return `docker inspect -f '{{.State.Running}}' ${serviceName}`;
      }
    } else if (serviceType === 'systemd') {
      return `systemctl is-active ${serviceName}`;
    }

    return '';
  }

  /**
   * Create rollback point (snapshot current state)
   */
  private async createRollbackPoint(
    conn: Client,
    server: any,
    services: ServiceRestoreConfig[]
  ): Promise<string | null> {
    try {
      const timestamp = Date.now();
      const rollbackPath = `/backup/rollback_${timestamp}.tar.gz`;

      // Create backup of current service data
      const servicePaths = services.map(s => {
        if (s.serviceType === 'docker') {
          return `docker run --rm --volumes-from ${s.serviceName} -v /backup:/backup alpine tar czf /backup/rollback_${s.serviceName}_${timestamp}.tar.gz /data 2>/dev/null || true`;
        }
        return '';
      }).filter(cmd => cmd !== '');

      // Execute backup commands
      for (const cmd of servicePaths) {
        await this.executeCommand(conn, cmd);
      }

      // Combine into single rollback archive
      await this.executeCommand(
        conn,
        `cd /backup && tar czf ${rollbackPath} rollback_*_${timestamp}.tar.gz 2>/dev/null || true`
      );

      this.logger.info('Rollback point created', { rollbackPath, servicesCount: services.length });

      return rollbackPath;
    } catch (error) {
      this.logger.error('Failed to create rollback point', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Stop services for restore
   */
  private async stopServices(conn: Client, services: ServiceRestoreConfig[]): Promise<string[]> {
    const stoppedServices: string[] = [];

    // Sort by priority (reverse order - dependent services first)
    const sortedServices = [...services].reverse();

    for (const service of sortedServices) {
      try {
        let stopCommand = '';

        if (service.serviceType === 'docker') {
          stopCommand = `docker stop ${service.serviceName}`;
        } else if (service.serviceType === 'systemd') {
          stopCommand = `sudo systemctl stop ${service.serviceName}`;
        }

        if (stopCommand) {
          await this.executeCommand(conn, stopCommand);
          stoppedServices.push(service.serviceName);
          this.logger.info('Service stopped', { serviceName: service.serviceName });
        }
      } catch (error) {
        this.logger.warn('Failed to stop service', {
          serviceName: service.serviceName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue with other services
      }
    }

    return stoppedServices;
  }

  /**
   * Execute restore operation
   */
  private async executeRestore(
    conn: Client,
    backup: any,
    services: ServiceRestoreConfig[],
    restoreJobId: string
  ): Promise<{ successful: string[], failed: string[], errors: string[] }> {
    const result = {
      successful: [] as string[],
      failed: [] as string[],
      errors: [] as string[],
    };

    const backupPath = backup.file_path;

    // First, upload/extract backup to restore location
    try {
      await this.executeCommand(conn, 'mkdir -p /restore');

      // Extract backup archive to /restore directory
      await this.executeCommand(conn, `tar xzf ${backupPath} -C /restore 2>/dev/null || true`);

      this.logger.info('Backup extracted to restore directory');
    } catch (error) {
      const errorMsg = `Failed to extract backup: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.errors.push(errorMsg);
      this.logger.error(errorMsg);
      return result;
    }

    // Restore each service
    for (const service of services) {
      try {
        if (service.restoreCommand) {
          await this.executeCommand(conn, service.restoreCommand);
          result.successful.push(service.serviceName);

          // Update job progress
          await this.pool.query(
            'UPDATE restore_jobs SET services_restored = array_append(services_restored, $1) WHERE id = $2',
            [service.serviceName, restoreJobId]
          );

          this.logger.info('Service restored', { serviceName: service.serviceName });
        }
      } catch (error) {
        const errorMsg = `Failed to restore ${service.serviceName}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.failed.push(service.serviceName);
        result.errors.push(errorMsg);

        // Update job progress
        await this.pool.query(
          'UPDATE restore_jobs SET services_failed = array_append(services_failed, $1) WHERE id = $2',
          [service.serviceName, restoreJobId]
        );

        this.logger.error(errorMsg);
      }
    }

    // Cleanup restore directory
    try {
      await this.executeCommand(conn, 'rm -rf /restore');
    } catch (error) {
      this.logger.warn('Failed to cleanup restore directory', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return result;
  }

  /**
   * Restart services after restore
   */
  private async restartServices(
    conn: Client,
    services: ServiceRestoreConfig[],
    performHealthChecks: boolean
  ): Promise<string[]> {
    const restartedServices: string[] = [];

    // Sort by priority (normal order - databases first)
    const sortedServices = [...services];

    for (const service of sortedServices) {
      try {
        let startCommand = '';

        if (service.serviceType === 'docker') {
          startCommand = `docker start ${service.serviceName}`;
        } else if (service.serviceType === 'systemd') {
          startCommand = `sudo systemctl start ${service.serviceName}`;
        }

        if (startCommand) {
          await this.executeCommand(conn, startCommand);
          restartedServices.push(service.serviceName);

          this.logger.info('Service started', { serviceName: service.serviceName });

          // Perform health check if enabled
          if (performHealthChecks && service.healthCheck) {
            await this.waitForHealthCheck(conn, service);
          }
        }
      } catch (error) {
        this.logger.error('Failed to restart service', {
          serviceName: service.serviceName,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue with other services
      }
    }

    return restartedServices;
  }

  /**
   * Wait for service health check to pass
   */
  private async waitForHealthCheck(conn: Client, service: ServiceRestoreConfig): Promise<void> {
    if (!service.healthCheck) {
      return;
    }

    const maxAttempts = 12; // 60 seconds total (12 * 5s)
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        await this.executeCommand(conn, service.healthCheck);
        this.logger.info('Service health check passed', { serviceName: service.serviceName });
        return;
      } catch (error) {
        attempts++;
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s between attempts
        }
      }
    }

    throw new Error(`Health check timeout for ${service.serviceName}`);
  }

  /**
   * Perform rollback to previous state
   */
  private async performRollback(
    conn: Client,
    server: any,
    rollbackPath: string,
    services: ServiceRestoreConfig[],
    restoreJobId: string
  ): Promise<void> {
    try {
      this.logger.info('Starting rollback', { rollbackPath, restoreJobId });

      await this.logRestoreStep(restoreJobId, 'rollback', 'started', 'Rolling back to previous state');

      // Stop services
      await this.stopServices(conn, services);

      // Extract rollback archive
      await this.executeCommand(conn, `mkdir -p /restore`);
      await this.executeCommand(conn, `tar xzf ${rollbackPath} -C /restore`);

      // Restore individual service rollback points
      for (const service of services) {
        try {
          if (service.serviceType === 'docker') {
            await this.executeCommand(
              conn,
              `docker run --rm --volumes-from ${service.serviceName} -v /restore:/restore alpine sh -c "cd /data && tar xzf /restore/rollback_${service.serviceName}_*.tar.gz"`
            );
          }
        } catch (error) {
          this.logger.error('Failed to rollback service', {
            serviceName: service.serviceName,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      // Restart services
      await this.restartServices(conn, services, false);

      // Cleanup
      await this.executeCommand(conn, 'rm -rf /restore');
      await this.executeCommand(conn, `rm -f ${rollbackPath}`);

      await this.logRestoreStep(restoreJobId, 'rollback', 'completed', 'Rollback completed successfully');

      this.logger.info('Rollback completed', { restoreJobId });
    } catch (error) {
      this.logger.error('Rollback failed', {
        restoreJobId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await this.logRestoreStep(
        restoreJobId,
        'rollback',
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      );

      throw error;
    }
  }

  /**
   * Connect to server via SSH
   */
  private async connectSSH(server: any): Promise<Client> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      const credential = decrypt(server.credential);

      conn.on('ready', () => {
        this.logger.info('SSH connection ready for restore', { serverId: server.id });
        resolve(conn);
      });

      conn.on('error', (err: Error) => {
        this.logger.error('SSH connection error', {
          serverId: server.id,
          error: err.message,
        });
        reject(err);
      });

      const config: any = {
        host: server.ip,
        port: server.port,
        username: server.username,
        readyTimeout: 30000,
      };

      if (server.auth_type === 'key') {
        config.privateKey = credential;
      } else {
        config.password = credential;
      }

      conn.connect(config);
    });
  }

  /**
   * Execute command via SSH
   */
  private executeCommand(conn: Client, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      conn.exec(command, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        let output = '';
        let errorOutput = '';

        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });

        stream.on('close', (code: number) => {
          if (code !== 0) {
            reject(new Error(`Command failed (exit ${code}): ${errorOutput || output}`));
          } else {
            resolve(output);
          }
        });
      });
    });
  }

  /**
   * Get restore job status
   */
  async getRestoreJobStatus(restoreJobId: string, userId: string): Promise<any> {
    const result = await this.pool.query(
      `SELECT rj.*,
              b.backup_type,
              s.name as server_name,
              s.ip as server_ip
       FROM restore_jobs rj
       INNER JOIN backups b ON rj.backup_id = b.id
       INNER JOIN servers s ON rj.server_id = s.id
       WHERE rj.id = $1 AND s.user_id = $2`,
      [restoreJobId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const job = result.rows[0];

    // Get audit logs
    const logsResult = await this.pool.query(
      `SELECT * FROM restore_audit_logs
       WHERE restore_job_id = $1
       ORDER BY step_number ASC`,
      [restoreJobId]
    );

    job.audit_logs = logsResult.rows;

    return job;
  }

  /**
   * List restore jobs for a user
   */
  async listRestoreJobs(userId: string, limit: number = 50): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT rj.*,
              b.backup_type,
              s.name as server_name,
              s.ip as server_ip
       FROM restore_jobs rj
       INNER JOIN backups b ON rj.backup_id = b.id
       INNER JOIN servers s ON rj.server_id = s.id
       WHERE s.user_id = $1
       ORDER BY rj.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }
}
