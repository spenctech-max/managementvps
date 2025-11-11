import { Pool } from 'pg';
import { Client } from 'ssh2';
import { Logger } from 'winston';
import { decrypt } from '../utils/crypto';
import { notificationService } from './notificationService';

interface ServiceBackupConfig {
  serviceId: string;
  serviceName: string;
  serviceType: string;
  backupMethod: 'hot' | 'cold';
  shutdownRequired: boolean;
  dependencies: string[];
  healthCheck?: string;
  backupCommand?: string;
}

interface BackupOrchestrationResult {
  success: boolean;
  servicesBackedUp: string[];
  servicesFailed: string[];
  backupDuration: number;
  backupSize: number;
  errors: string[];
}

export class BackupOrchestrator {
  private pool: Pool;
  private logger: Logger;
  private readonly GRACEFUL_SHUTDOWN_TIMEOUT = 30000; // 30 seconds
  private readonly STARTUP_WAIT_TIMEOUT = 60000; // 60 seconds

  constructor(pool: Pool, logger: Logger) {
    this.pool = pool;
    this.logger = logger;
  }

  /**
   * Orchestrate a complete backup workflow for a server
   * Includes service discovery, dependency resolution, graceful shutdown, backup, and restart
   */
  async orchestrateServerBackup(
    serverId: string,
    backupType: 'full' | 'selective',
    selectedServices?: string[]
  ): Promise<BackupOrchestrationResult> {
    const startTime = Date.now();
    const result: BackupOrchestrationResult = {
      success: false,
      servicesBackedUp: [],
      servicesFailed: [],
      backupDuration: 0,
      backupSize: 0,
      errors: [],
    };

    try {
      // 1. Get server details
      const serverResult = await this.pool.query(
        'SELECT * FROM servers WHERE id = $1',
        [serverId]
      );

      if (serverResult.rows.length === 0) {
        throw new Error('Server not found');
      }

      const server = serverResult.rows[0];

      // 2. Get detected services from latest scan
      const services = await this.getDetectedServices(serverId);

      if (services.length === 0) {
        throw new Error('No services detected. Please run a scan first.');
      }

      // 3. Build backup configuration for each service
      const backupConfigs = await this.buildBackupConfigs(services);

      // 4. Filter services if selective backup
      const servicesToBackup = backupType === 'selective' && selectedServices
        ? backupConfigs.filter(config => selectedServices.includes(config.serviceId))
        : backupConfigs;

      // 5. Resolve dependencies and determine shutdown order
      const shutdownOrder = this.resolveDependencies(servicesToBackup);

      this.logger.info('Backup orchestration started', {
        serverId,
        serverName: server.name,
        servicesCount: servicesToBackup.length,
        shutdownOrder: shutdownOrder.map(s => s.serviceName),
      });

      // 6. Execute backup workflow
      const backupResult = await this.executeBackupWorkflow(
        server,
        servicesToBackup,
        shutdownOrder
      );

      result.servicesBackedUp = backupResult.successful;
      result.servicesFailed = backupResult.failed;
      result.backupSize = backupResult.totalSize;
      result.errors = backupResult.errors;
      result.success = backupResult.failed.length === 0;

    } catch (error) {
      this.logger.error('Backup orchestration failed', {
        serverId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');

      // Send failure notification
      try {
        const server = await this.pool.query('SELECT name FROM servers WHERE id = $1', [serverId]);
        await notificationService.send({
          type: 'backup_failure',
          metadata: {
            server_id: serverId,
            server_name: server.rows[0]?.name || 'Unknown',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            retry_count: 0,
          },
        });
      } catch (notifError) {
        this.logger.error('Failed to send backup failure notification', { error: notifError });
      }
    }

    result.backupDuration = Date.now() - startTime;

    // Send success notification if backup completed successfully
    if (result.success && result.servicesBackedUp.length > 0) {
      try {
        const server = await this.pool.query('SELECT name FROM servers WHERE id = $1', [serverId]);
        await notificationService.send({
          type: 'backup_success',
          metadata: {
            server_id: serverId,
            server_name: server.rows[0]?.name || 'Unknown',
            backup_size_mb: Math.round(result.backupSize / 1024 / 1024),
            duration_minutes: Math.round(result.backupDuration / 60000),
          },
        });
      } catch (notifError) {
        this.logger.error('Failed to send backup success notification', { error: notifError });
      }
    }

    return result;
  }

  /**
   * Get detected services from the latest scan
   */
  private async getDetectedServices(serverId: string): Promise<any[]> {
    const scanResult = await this.pool.query(
      `SELECT id FROM server_scans
       WHERE server_id = $1 AND status = 'completed'
       ORDER BY started_at DESC LIMIT 1`,
      [serverId]
    );

    if (scanResult.rows.length === 0) {
      return [];
    }

    const scanId = scanResult.rows[0].id;

    const servicesResult = await this.pool.query(
      `SELECT * FROM detected_services
       WHERE scan_id = $1
       ORDER BY backup_priority DESC`,
      [scanId]
    );

    return servicesResult.rows;
  }

  /**
   * Build backup configurations for each service
   */
  private async buildBackupConfigs(services: any[]): Promise<ServiceBackupConfig[]> {
    const configs: ServiceBackupConfig[] = [];

    for (const service of services) {
      const config: ServiceBackupConfig = {
        serviceId: service.id,
        serviceName: service.service_name,
        serviceType: service.service_type,
        backupMethod: 'cold',
        shutdownRequired: true,
        dependencies: [],
        healthCheck: undefined,
        backupCommand: undefined,
      };

      // Determine backup method based on service type and name
      if (service.service_type === 'docker') {
        const image = service.service_details?.image || '';

        // Database containers - hot backup preferred
        if (image.includes('mysql') || image.includes('mariadb')) {
          config.backupMethod = 'hot';
          config.shutdownRequired = false;
          config.backupCommand = this.getMySQLBackupCommand(service);
          config.healthCheck = `docker exec ${service.service_name} mysqladmin ping -h localhost`;
        } else if (image.includes('postgres')) {
          config.backupMethod = 'hot';
          config.shutdownRequired = false;
          config.backupCommand = this.getPostgreSQLBackupCommand(service);
          config.healthCheck = `docker exec ${service.service_name} pg_isready`;
        } else if (image.includes('mongo')) {
          config.backupMethod = 'hot';
          config.shutdownRequired = false;
          config.backupCommand = this.getMongoDBBackupCommand(service);
          config.healthCheck = `docker exec ${service.service_name} mongo --eval "db.adminCommand('ping')"`;
        } else if (image.includes('redis')) {
          config.backupMethod = 'hot';
          config.shutdownRequired = false;
          config.backupCommand = `docker exec ${service.service_name} redis-cli SAVE`;
        } else {
          // Regular containers - cold backup (stop, backup volumes, restart)
          config.backupCommand = this.getDockerVolumeBackupCommand(service);
          config.healthCheck = `docker inspect -f '{{.State.Running}}' ${service.service_name}`;
        }
      } else if (service.service_type === 'systemd') {
        // Systemd services
        if (service.service_name.includes('mysql')) {
          config.backupMethod = 'hot';
          config.shutdownRequired = false;
          config.backupCommand = 'mysqldump --all-databases --single-transaction > /backup/mysql_$(date +%Y%m%d_%H%M%S).sql';
        } else if (service.service_name.includes('postgresql') || service.service_name.includes('postgres')) {
          config.backupMethod = 'hot';
          config.shutdownRequired = false;
          config.backupCommand = 'sudo -u postgres pg_dumpall > /backup/postgresql_$(date +%Y%m%d_%H%M%S).sql';
        } else {
          // Other systemd services - backup config and data
          config.backupCommand = this.getSystemdBackupCommand(service);
        }
      }

      configs.push(config);
    }

    return configs;
  }

  /**
   * Resolve service dependencies and determine shutdown order
   */
  private resolveDependencies(configs: ServiceBackupConfig[]): ServiceBackupConfig[] {
    // Simple dependency resolution - reverse priority order
    // Higher priority services (databases) are shut down last and started first
    const withDependencies = [...configs];

    // Sort by priority (databases last to stop, first to start)
    return withDependencies.sort((a, b) => {
      const priorityA = this.getServicePriority(a);
      const priorityB = this.getServicePriority(b);
      return priorityA - priorityB; // Lower priority stops first
    });
  }

  /**
   * Get service priority for shutdown order
   */
  private getServicePriority(config: ServiceBackupConfig): number {
    // Databases have highest priority (stop last, start first)
    if (config.serviceName.includes('mysql') ||
        config.serviceName.includes('postgres') ||
        config.serviceName.includes('mongo') ||
        config.serviceName.includes('redis')) {
      return 100;
    }

    // Web servers have medium priority
    if (config.serviceName.includes('nginx') ||
        config.serviceName.includes('apache') ||
        config.serviceName.includes('httpd')) {
      return 50;
    }

    // Everything else
    return 10;
  }

  /**
   * Execute the complete backup workflow
   */
  private async executeBackupWorkflow(
    server: any,
    configs: ServiceBackupConfig[],
    shutdownOrder: ServiceBackupConfig[]
  ): Promise<{ successful: string[], failed: string[], totalSize: number, errors: string[] }> {
    const result = {
      successful: [] as string[],
      failed: [] as string[],
      totalSize: 0,
      errors: [] as string[],
    };

    const conn = await this.connectSSH(server);

    try {
      // 1. Stop services that require shutdown (in order)
      const servicesToStop = shutdownOrder.filter(c => c.shutdownRequired);
      for (const config of servicesToStop) {
        try {
          await this.stopService(conn, config);
          this.logger.info('Service stopped', { service: config.serviceName });
        } catch (error) {
          result.errors.push(`Failed to stop ${config.serviceName}: ${error}`);
          result.failed.push(config.serviceName);
        }
      }

      // 2. Backup all services (can be parallel for independent services)
      for (const config of configs) {
        try {
          if (config.backupCommand) {
            const backupSize = await this.executeBackup(conn, config);
            result.totalSize += backupSize;
            result.successful.push(config.serviceName);
            this.logger.info('Service backed up', {
              service: config.serviceName,
              size: backupSize,
              method: config.backupMethod
            });
          }
        } catch (error) {
          result.errors.push(`Failed to backup ${config.serviceName}: ${error}`);
          result.failed.push(config.serviceName);
        }
      }

      // 3. Restart services in reverse order (databases first)
      const servicesToRestart = [...servicesToStop].reverse();
      for (const config of servicesToRestart) {
        try {
          await this.startService(conn, config);

          // Verify service health
          if (config.healthCheck) {
            await this.waitForHealthCheck(conn, config);
          }

          this.logger.info('Service restarted', { service: config.serviceName });
        } catch (error) {
          result.errors.push(`Failed to restart ${config.serviceName}: ${error}`);
          // Don't add to failed list if backup succeeded
        }
      }

    } finally {
      conn.end();
    }

    return result;
  }

  /**
   * Stop a service gracefully
   */
  private async stopService(conn: Client, config: ServiceBackupConfig): Promise<void> {
    let stopCommand = '';

    if (config.serviceType === 'docker') {
      stopCommand = `docker stop --time=${this.GRACEFUL_SHUTDOWN_TIMEOUT / 1000} ${config.serviceName}`;
    } else if (config.serviceType === 'systemd') {
      stopCommand = `sudo systemctl stop ${config.serviceName}`;
    }

    await this.executeCommand(conn, stopCommand);
  }

  /**
   * Start a service
   */
  private async startService(conn: Client, config: ServiceBackupConfig): Promise<void> {
    let startCommand = '';

    if (config.serviceType === 'docker') {
      startCommand = `docker start ${config.serviceName}`;
    } else if (config.serviceType === 'systemd') {
      startCommand = `sudo systemctl start ${config.serviceName}`;
    }

    await this.executeCommand(conn, startCommand);
  }

  /**
   * Execute backup command and return size
   */
  private async executeBackup(conn: Client, config: ServiceBackupConfig): Promise<number> {
    if (!config.backupCommand) {
      return 0;
    }

    await this.executeCommand(conn, config.backupCommand);

    // Get backup size (simplified - would need to parse actual backup location)
    return 0;
  }

  /**
   * Wait for service health check to pass
   */
  private async waitForHealthCheck(conn: Client, config: ServiceBackupConfig): Promise<void> {
    if (!config.healthCheck) {
      return;
    }

    const maxAttempts = 12; // 60 seconds total (12 * 5s)
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        await this.executeCommand(conn, config.healthCheck);
        return; // Health check passed
      } catch (error) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5s between attempts
      }
    }

    throw new Error(`Health check timeout for ${config.serviceName}`);
  }

  /**
   * Generate MySQL backup command
   */
  private getMySQLBackupCommand(service: any): string {
    const containerName = service.service_name;
    const timestamp = '$(date +%Y%m%d_%H%M%S)';
    return `docker exec ${containerName} mysqldump --all-databases --single-transaction | gzip > /backup/${containerName}_${timestamp}.sql.gz`;
  }

  /**
   * Generate PostgreSQL backup command
   */
  private getPostgreSQLBackupCommand(service: any): string {
    const containerName = service.service_name;
    const timestamp = '$(date +%Y%m%d_%H%M%S)';
    return `docker exec ${containerName} pg_dumpall -U postgres | gzip > /backup/${containerName}_${timestamp}.sql.gz`;
  }

  /**
   * Generate MongoDB backup command
   */
  private getMongoDBBackupCommand(service: any): string {
    const containerName = service.service_name;
    const timestamp = '$(date +%Y%m%d_%H%M%S)';
    return `docker exec ${containerName} mongodump --archive=/backup/${containerName}_${timestamp}.archive --gzip`;
  }

  /**
   * Generate Docker volume backup command
   */
  private getDockerVolumeBackupCommand(service: any): string {
    const containerName = service.service_name;
    const timestamp = '$(date +%Y%m%d_%H%M%S)';
    // Backup mounted volumes
    return `docker run --rm --volumes-from ${containerName} -v /backup:/backup alpine tar czf /backup/${containerName}_${timestamp}.tar.gz /data`;
  }

  /**
   * Generate systemd service backup command
   */
  private getSystemdBackupCommand(service: any): string {
    const serviceName = service.service_name;
    const timestamp = '$(date +%Y%m%d_%H%M%S)';

    // Backup config and data paths
    const paths = [
      ...(service.config_paths || []),
      ...(service.data_paths || []),
    ].filter((path: string) => path && path !== '').join(' ');

    if (paths) {
      return `tar czf /backup/${serviceName}_${timestamp}.tar.gz ${paths}`;
    }

    return `echo "No paths to backup for ${serviceName}"`;
  }

  /**
   * Connect to server via SSH
   */
  private async connectSSH(server: any): Promise<Client> {
    return new Promise((resolve, reject) => {
      const conn = new Client();
      const credential = decrypt(server.credential);

      conn.on('ready', () => {
        resolve(conn);
      });

      conn.on('error', (err: Error) => {
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
}
