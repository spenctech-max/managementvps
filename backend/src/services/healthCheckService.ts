/**
 * Health Check Service
 * Monitors system health including disk space, service status, and sends alerts
 */

import { Pool } from 'pg';
import { Client } from 'ssh2';
import { Logger } from 'winston';
import { decrypt } from '../utils/crypto';
import { notificationService } from './notificationService';

interface HealthCheckResult {
  serverId: string;
  serverName: string;
  isHealthy: boolean;
  checks: {
    diskSpace: DiskSpaceCheck[];
    connectivity: boolean;
    lastScanAge?: number; // hours since last scan
    lastBackupAge?: number; // hours since last backup
  };
  alerts: HealthAlert[];
}

interface DiskSpaceCheck {
  mountPoint: string;
  totalSizeGB: number;
  usedSizeGB: number;
  availableSizeGB: number;
  usagePercent: number;
  status: 'ok' | 'warning' | 'critical';
}

interface HealthAlert {
  type: 'disk_space_critical' | 'disk_space_warning' | 'service_health_degraded';
  severity: 'critical' | 'warning';
  message: string;
  metadata: Record<string, any>;
}

export class HealthCheckService {
  private pool: Pool;
  private logger: Logger;
  private readonly DISK_CRITICAL_THRESHOLD = 90; // 90% usage
  private readonly DISK_WARNING_THRESHOLD = 80; // 80% usage
  private readonly DISK_CRITICAL_FREE_GB = 10; // Less than 10GB free
  private readonly SSH_TIMEOUT = 10000; // 10 seconds

  constructor(pool: Pool, logger: Logger) {
    this.pool = pool;
    this.logger = logger;
  }

  /**
   * Perform health check on a specific server
   */
  async checkServer(serverId: string): Promise<HealthCheckResult> {
    try {
      // Get server details
      const serverResult = await this.pool.query(
        'SELECT id, name, ip, port, username, auth_type, credential FROM servers WHERE id = $1',
        [serverId]
      );

      if (serverResult.rows.length === 0) {
        throw new Error('Server not found');
      }

      const server = serverResult.rows[0];
      const result: HealthCheckResult = {
        serverId: server.id,
        serverName: server.name,
        isHealthy: true,
        checks: {
          diskSpace: [],
          connectivity: false,
        },
        alerts: [],
      };

      // Check connectivity and disk space
      try {
        const diskSpaceChecks = await this.checkDiskSpace(server);
        result.checks.diskSpace = diskSpaceChecks;
        result.checks.connectivity = true;

        // Evaluate disk space and generate alerts
        diskSpaceChecks.forEach((check) => {
          if (check.status === 'critical') {
            result.isHealthy = false;
            result.alerts.push({
              type: 'disk_space_critical',
              severity: 'critical',
              message: `Critical disk space on ${check.mountPoint}: ${check.usagePercent.toFixed(1)}% used, ${check.availableSizeGB.toFixed(1)}GB free`,
              metadata: {
                mount_point: check.mountPoint,
                disk_usage_percent: check.usagePercent,
                free_space_gb: check.availableSizeGB,
              },
            });
          } else if (check.status === 'warning') {
            result.alerts.push({
              type: 'disk_space_warning',
              severity: 'warning',
              message: `Low disk space on ${check.mountPoint}: ${check.usagePercent.toFixed(1)}% used, ${check.availableSizeGB.toFixed(1)}GB free`,
              metadata: {
                mount_point: check.mountPoint,
                disk_usage_percent: check.usagePercent,
                free_space_gb: check.availableSizeGB,
              },
            });
          }
        });
      } catch (error) {
        result.checks.connectivity = false;
        result.isHealthy = false;
        this.logger.error('Failed to check disk space', {
          serverId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }

      // Check last scan age
      try {
        const lastScan = await this.pool.query(
          `SELECT started_at FROM server_scans
           WHERE server_id = $1 AND status = 'completed'
           ORDER BY started_at DESC LIMIT 1`,
          [serverId]
        );

        if (lastScan.rows.length > 0) {
          const hoursSinceLastScan = (Date.now() - new Date(lastScan.rows[0].started_at).getTime()) / 3600000;
          result.checks.lastScanAge = hoursSinceLastScan;
        }
      } catch (error) {
        this.logger.error('Failed to check last scan age', { serverId, error });
      }

      // Check last backup age
      try {
        const lastBackup = await this.pool.query(
          `SELECT started_at FROM backups
           WHERE server_id = $1 AND status = 'completed'
           ORDER BY started_at DESC LIMIT 1`,
          [serverId]
        );

        if (lastBackup.rows.length > 0) {
          const hoursSinceLastBackup = (Date.now() - new Date(lastBackup.rows[0].started_at).getTime()) / 3600000;
          result.checks.lastBackupAge = hoursSinceLastBackup;
        }
      } catch (error) {
        this.logger.error('Failed to check last backup age', { serverId, error });
      }

      return result;
    } catch (error) {
      this.logger.error('Health check failed', {
        serverId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Check disk space on server
   */
  private async checkDiskSpace(server: any): Promise<DiskSpaceCheck[]> {
    const credential = decrypt(server.credential);

    return new Promise((resolve, reject) => {
      const conn = new Client();
      const checks: DiskSpaceCheck[] = [];

      conn.on('ready', () => {
        // Use df command to get disk space information
        conn.exec('df -BG --output=target,size,used,avail,pcent | tail -n +2', (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }

          let output = '';

          stream.on('data', (data: Buffer) => {
            output += data.toString();
          });

          stream.on('close', () => {
            conn.end();

            // Parse df output
            const lines = output.trim().split('\n');
            lines.forEach((line) => {
              const parts = line.trim().split(/\s+/);
              if (parts.length >= 5) {
                const mountPoint = parts[0];
                const totalSize = parseInt(parts[1].replace('G', ''));
                const usedSize = parseInt(parts[2].replace('G', ''));
                const availableSize = parseInt(parts[3].replace('G', ''));
                const usagePercent = parseInt(parts[4].replace('%', ''));

                // Determine status
                let status: 'ok' | 'warning' | 'critical' = 'ok';
                if (usagePercent >= this.DISK_CRITICAL_THRESHOLD || availableSize < this.DISK_CRITICAL_FREE_GB) {
                  status = 'critical';
                } else if (usagePercent >= this.DISK_WARNING_THRESHOLD) {
                  status = 'warning';
                }

                checks.push({
                  mountPoint,
                  totalSizeGB: totalSize,
                  usedSizeGB: usedSize,
                  availableSizeGB: availableSize,
                  usagePercent,
                  status,
                });
              }
            });

            resolve(checks);
          });

          stream.stderr.on('data', (data: Buffer) => {
            this.logger.error('Disk space check stderr', { data: data.toString() });
          });
        });
      });

      conn.on('error', (err) => {
        reject(err);
      });

      // Connect
      const connectionConfig: any = {
        host: server.ip,
        port: server.port,
        username: server.username,
        readyTimeout: this.SSH_TIMEOUT,
      };

      if (server.auth_type === 'password') {
        connectionConfig.password = credential;
      } else {
        connectionConfig.privateKey = credential;
      }

      conn.connect(connectionConfig);
    });
  }

  /**
   * Check all active servers and send notifications for issues
   */
  async checkAllServers(): Promise<void> {
    try {
      this.logger.info('Starting health check for all servers');

      const serversResult = await this.pool.query(
        'SELECT id FROM servers WHERE is_online = true'
      );

      const servers = serversResult.rows;
      this.logger.info(`Checking health of ${servers.length} servers`);

      for (const server of servers) {
        try {
          const result = await this.checkServer(server.id);

          // Send notifications for alerts
          for (const alert of result.alerts) {
            try {
              await notificationService.send({
                type: alert.type,
                metadata: {
                  server_id: result.serverId,
                  server_name: result.serverName,
                  ...alert.metadata,
                },
              });
            } catch (notifError) {
              this.logger.error('Failed to send health alert notification', {
                serverId: server.id,
                alertType: alert.type,
                error: notifError,
              });
            }
          }

          // Update server online status
          await this.pool.query(
            'UPDATE servers SET is_online = $1, last_check = NOW() WHERE id = $2',
            [result.checks.connectivity, server.id]
          );
        } catch (error) {
          this.logger.error('Failed to check server health', {
            serverId: server.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          // Mark server as offline
          await this.pool.query(
            'UPDATE servers SET is_online = false, last_check = NOW() WHERE id = $1',
            [server.id]
          );
        }
      }

      this.logger.info('Health check completed for all servers');
    } catch (error) {
      this.logger.error('Failed to check all servers', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get health status for dashboard
   */
  async getHealthSummary(): Promise<{
    totalServers: number;
    healthyServers: number;
    unhealthyServers: number;
    criticalAlerts: number;
    warningAlerts: number;
  }> {
    try {
      const totalResult = await this.pool.query('SELECT COUNT(*) FROM servers');
      const healthyResult = await this.pool.query(
        'SELECT COUNT(*) FROM servers WHERE is_online = true'
      );

      // Get recent critical alerts from notification history
      const criticalAlertsResult = await this.pool.query(
        `SELECT COUNT(*) FROM notification_history
         WHERE severity = 'critical'
         AND created_at > NOW() - INTERVAL '24 hours'`
      );

      const warningAlertsResult = await this.pool.query(
        `SELECT COUNT(*) FROM notification_history
         WHERE severity = 'warning'
         AND created_at > NOW() - INTERVAL '24 hours'`
      );

      const totalServers = parseInt(totalResult.rows[0].count);
      const healthyServers = parseInt(healthyResult.rows[0].count);

      return {
        totalServers,
        healthyServers,
        unhealthyServers: totalServers - healthyServers,
        criticalAlerts: parseInt(criticalAlertsResult.rows[0].count),
        warningAlerts: parseInt(warningAlertsResult.rows[0].count),
      };
    } catch (error) {
      this.logger.error('Failed to get health summary', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const healthCheckService = new HealthCheckService(
  require('../config/database').pool,
  require('../config/logger').logger
);
