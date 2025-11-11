import { Pool } from 'pg';
import { Logger } from 'winston';
import { Client } from 'ssh2';
import { decrypt } from '../utils/crypto';
import { createWriteStream } from 'fs';
import { join } from 'path';

export interface BackupOptions {
  backup_type: 'full' | 'incremental' | 'differential';
  paths?: string[];
  exclusions?: string[];
  compression?: boolean;
  encryption?: boolean;
}

export class BackupService {
  private pool: Pool;
  private logger: Logger;

  constructor(pool: Pool, logger: Logger) {
    this.pool = pool;
    this.logger = logger;
  }

  /**
   * Execute a backup job
   */
  async executeBackup(serverId: string, backupId: string, options: BackupOptions): Promise<void> {
    const startTime = Date.now();

    try {
      // Update backup status to running
      await this.pool.query(
        `UPDATE backups SET status = 'running', started_at = NOW() WHERE id = $1`,
        [backupId]
      );

      // Get server details
      const serverResult = await this.pool.query(
        'SELECT * FROM servers WHERE id = $1',
        [serverId]
      );

      if (serverResult.rows.length === 0) {
        throw new Error('Server not found');
      }

      const server = serverResult.rows[0];

      // Execute backup based on type
      const backupResult = await this.performBackup(server, options);

      // Calculate duration
      const duration = Math.floor((Date.now() - startTime) / 1000);

      // Update backup status to completed
      await this.pool.query(
        `UPDATE backups
         SET status = 'completed',
             completed_at = NOW(),
             file_size = $1,
             file_path = $2
         WHERE id = $3`,
        [backupResult.size, backupResult.path, backupId]
      );

      this.logger.info('Backup completed successfully', {
        serverId,
        backupId,
        duration,
        size: backupResult.size,
      });
    } catch (error) {
      this.logger.error('Backup failed', {
        serverId,
        backupId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Update backup status to failed
      await this.pool.query(
        `UPDATE backups
         SET status = 'failed',
             completed_at = NOW(),
             error_message = $1
         WHERE id = $2`,
        [error instanceof Error ? error.message : 'Unknown error', backupId]
      );

      throw error;
    }
  }

  /**
   * Perform the actual backup
   */
  private async performBackup(
    server: any,
    options: BackupOptions
  ): Promise<{ path: string; size: number }> {
    return new Promise((resolve, reject) => {
      const ssh = new Client();
      const backupPath = join(
        process.cwd(),
        'backups',
        `${server.id}_${Date.now()}.tar.gz`
      );

      ssh.on('ready', () => {
        this.logger.info('SSH connection ready for backup', { serverId: server.id });

        // Determine paths to backup
        const paths = options.paths || ['/etc', '/home', '/var'];
        const excludePatterns = options.exclusions || [
          '/proc',
          '/sys',
          '/dev',
          '/tmp',
          '/run',
        ];

        // Build tar command
        const excludeArgs = excludePatterns.map((p) => `--exclude='${p}'`).join(' ');
        const pathsArgs = paths.join(' ');
        const command = `tar czf - ${excludeArgs} ${pathsArgs}`;

        this.logger.debug('Executing backup command', { command });

        ssh.exec(command, (err, stream) => {
          if (err) {
            ssh.end();
            reject(err);
            return;
          }

          // Create write stream for backup file
          const output = createWriteStream(backupPath);
          let totalSize = 0;

          stream.on('data', (data: Buffer) => {
            totalSize += data.length;
            output.write(data);
          });

          stream.on('close', (code: number) => {
            output.end();
            ssh.end();

            if (code === 0) {
              this.logger.info('Backup stream completed', {
                serverId: server.id,
                size: totalSize,
              });
              resolve({ path: backupPath, size: totalSize });
            } else {
              reject(new Error(`Backup command failed with code ${code}`));
            }
          });

          stream.on('error', (error: Error) => {
            output.end();
            ssh.end();
            reject(error);
          });

          stream.stderr.on('data', (data: Buffer) => {
            this.logger.warn('Backup stderr', {
              serverId: server.id,
              message: data.toString(),
            });
          });
        });
      });

      ssh.on('error', (err) => {
        this.logger.error('SSH connection error during backup', {
          serverId: server.id,
          error: err.message,
        });
        reject(err);
      });

      // Decrypt credentials and connect
      const credential = decrypt(server.credential);
      const config: any = {
        host: server.ip,
        port: server.port,
        username: server.username,
        readyTimeout: 30000,
      };

      if (server.auth_type === 'password') {
        config.password = credential;
      } else {
        config.privateKey = credential;
      }

      ssh.connect(config);
    });
  }

  /**
   * Restore a backup
   */
  async restoreBackup(
    serverId: string,
    _backupPath: string,
    targetPath: string = '/'
  ): Promise<void> {
    const serverResult = await this.pool.query(
      'SELECT * FROM servers WHERE id = $1',
      [serverId]
    );

    if (serverResult.rows.length === 0) {
      throw new Error('Server not found');
    }

    const server = serverResult.rows[0];

    return new Promise((resolve, reject) => {
      const ssh = new Client();

      ssh.on('ready', () => {
        this.logger.info('SSH connection ready for restore', { serverId: server.id });

        // Build restore command
        const command = `tar xzf - -C ${targetPath}`;

        ssh.exec(command, (err, stream) => {
          if (err) {
            ssh.end();
            reject(err);
            return;
          }

          // TODO: Stream backup file to remote server
          // For now, this is a placeholder for the restore logic

          stream.on('close', (code: number) => {
            ssh.end();
            if (code === 0) {
              this.logger.info('Restore completed', { serverId: server.id });
              resolve();
            } else {
              reject(new Error(`Restore command failed with code ${code}`));
            }
          });

          stream.on('error', (error: Error) => {
            ssh.end();
            reject(error);
          });
        });
      });

      ssh.on('error', (err) => {
        this.logger.error('SSH connection error during restore', {
          serverId: server.id,
          error: err.message,
        });
        reject(err);
      });

      // Decrypt credentials and connect
      const credential = decrypt(server.credential);
      const config: any = {
        host: server.ip,
        port: server.port,
        username: server.username,
        readyTimeout: 30000,
      };

      if (server.auth_type === 'password') {
        config.password = credential;
      } else {
        config.privateKey = credential;
      }

      ssh.connect(config);
    });
  }

  /**
   * Schedule periodic backups using node-cron
   */
  scheduleBackup(
    serverId: string,
    cronExpression: string,
    options: BackupOptions
  ): void {
    const cron = require('node-cron');

    cron.schedule(cronExpression, async () => {
      try {
        this.logger.info('Scheduled backup starting', { serverId, cronExpression });

        // Create backup record
        const result = await this.pool.query(
          `INSERT INTO backups (server_id, backup_type, status, options, created_at)
           VALUES ($1, $2, 'pending', $3, NOW())
           RETURNING id`,
          [serverId, options.backup_type, JSON.stringify(options)]
        );

        const backupId = result.rows[0].id;

        // Execute backup
        await this.executeBackup(serverId, backupId, options);
      } catch (error) {
        this.logger.error('Scheduled backup failed', {
          serverId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    this.logger.info('Backup schedule created', { serverId, cronExpression });
  }
}
