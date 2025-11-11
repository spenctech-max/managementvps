import { Pool } from 'pg';
import { Client } from 'ssh2';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from 'winston';
import { decrypt } from '../utils/crypto';
import { validateAndSanitizeCommand, quoteShellArg } from '../utils/commandSanitizer';
import { notificationService } from './notificationService';

export interface ScanResult {
  scanId: string;
  services: DetectedService[];
  filesystems: DetectedFilesystem[];
  recommendations: BackupRecommendation[];
}

export interface DetectedService {
  service_name: string;
  service_type: string;
  status: string;
  process_id?: number;
  port_bindings: string[];
  config_paths: string[];
  data_paths: string[];
  log_paths: string[];
  service_details: Record<string, any>;
  backup_priority: number;
  backup_strategy: string;
}

export interface DetectedFilesystem {
  mount_point: string;
  device_name?: string;
  filesystem_type: string;
  total_size: number;
  used_size: number;
  available_size: number;
  usage_percentage: number;
  is_system_drive: boolean;
  contains_data: boolean;
  backup_recommended: boolean;
  backup_priority: number;
  estimated_backup_size: number;
  exclusion_patterns: string[];
}

export interface BackupRecommendation {
  recommendation_type: string;
  priority: string;
  title: string;
  description: string;
  backup_paths: string[];
  exclusion_patterns: string[];
  estimated_size: number;
  backup_frequency: string;
  retention_period: string;
  backup_method: string;
  implementation_notes?: string;
}

export class BackupScanner {
  private pool: Pool;
  private logger: Logger;
  private readonly COMMAND_TIMEOUT = 30000; // 30 seconds

  constructor(pool: Pool, logger: Logger) {
    this.pool = pool;
    this.logger = logger;
  }

  async scanServer(serverId: string, scanType: string = 'full', existingScanId?: string): Promise<string> {
    const scanId = existingScanId || uuidv4();

    try {
      if (!existingScanId) {
        // Create scan record only if one wasn't already created
        await this.pool.query(
          `INSERT INTO server_scans (id, server_id, scan_type, status, started_at)
           VALUES ($1, $2, $3, 'running', NOW())`,
          [scanId, serverId, scanType]
        );
      } else {
        // Update existing scan record to 'running' status
        await this.pool.query(
          `UPDATE server_scans SET status = 'running', started_at = NOW() WHERE id = $1`,
          [scanId]
        );
      }

      // Get server details
      const serverResult = await this.pool.query(
        'SELECT * FROM servers WHERE id = $1',
        [serverId]
      );

      if (serverResult.rows.length === 0) {
        throw new Error('Server not found');
      }

      const server = serverResult.rows[0];
      const startTime = Date.now();

      // Perform the actual scan
      const scanResult = await this.performScan(server, scanType);
      const duration = Math.floor((Date.now() - startTime) / 1000);

      // Store scan results
      await this.storeScanResults(scanId, scanResult);

      // Update scan status
      await this.pool.query(
        `UPDATE server_scans
         SET status = $1, completed_at = NOW(), scan_duration = $2, scan_summary = $3
         WHERE id = $4`,
        ['completed', duration, JSON.stringify(this.createScanSummary(scanResult)), scanId]
      );

      this.logger.info(`Scan completed for server ${server.name}: ${scanId}`);
      return scanId;
    } catch (error) {
      this.logger.error(`Scan failed for server ${serverId}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await this.pool.query(
        `UPDATE server_scans
         SET status = $1, completed_at = NOW(), error_message = $2
         WHERE id = $3`,
        ['failed', error instanceof Error ? error.message : 'Unknown error', scanId]
      );

      // Send failure notification
      try {
        const server = await this.pool.query('SELECT name FROM servers WHERE id = $1', [serverId]);
        await notificationService.send({
          type: 'scan_failure',
          metadata: {
            server_id: serverId,
            server_name: server.rows[0]?.name || 'Unknown',
            scan_id: scanId,
            scan_type: scanType,
            error_message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      } catch (notifError) {
        this.logger.error('Failed to send scan failure notification', { error: notifError });
      }

      throw error;
    }
  }

  private async performScan(server: any, scanType: string): Promise<ScanResult> {
    const credential = decrypt(server.credential);

    return new Promise((resolve, reject) => {
      const conn = new Client();
      let timeout: NodeJS.Timeout;

      const cleanup = () => {
        if (timeout) clearTimeout(timeout);
        conn.destroy();
      };

      // Set overall timeout
      timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Scan timeout exceeded'));
      }, this.COMMAND_TIMEOUT * 3); // Allow 90 seconds total

      conn.on('ready', async () => {
        try {
          const services = await this.scanServices(conn, scanType);
          const filesystems = await this.scanFilesystems(conn, scanType);
          const recommendations = this.generateRecommendations(services, filesystems);

          cleanup();

          resolve({
            scanId: '',
            services,
            filesystems,
            recommendations,
          });
        } catch (error) {
          cleanup();
          reject(error);
        }
      });

      conn.on('error', (err: Error) => {
        cleanup();
        reject(err);
      });

      const config: any = {
        host: server.ip,
        port: server.port,
        username: server.username,
        readyTimeout: this.COMMAND_TIMEOUT,
      };

      if (server.auth_type === 'key') {
        config.privateKey = credential;
      } else {
        config.password = credential;
      }

      conn.connect(config);
    });
  }

  private async scanServices(conn: Client, scanType: string): Promise<DetectedService[]> {
    const services: DetectedService[] = [];

    try {
      // Scan systemd services
      if (scanType === 'full' || scanType === 'services') {
        try {
          const systemdServices = await this.scanSystemdServices(conn);
          services.push(...systemdServices);
        } catch (error) {
          this.logger.warn('Systemd scan failed (may not be available)');
        }
      }

      // Scan Docker containers
      try {
        const dockerServices = await this.scanDockerServices(conn);
        services.push(...dockerServices);
      } catch (error) {
        // Docker not installed - skip
      }

      // Scan database services
      try {
        const databaseServices = await this.scanDatabaseServices(conn);
        services.push(...databaseServices);
      } catch (error) {
        // No databases - skip
      }
    } catch (error) {
      this.logger.error('Service scan error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return services;
  }

  private async scanSystemdServices(conn: Client): Promise<DetectedService[]> {
    const services: DetectedService[] = [];

    try {
      const output = await this.executeCommand(
        conn,
        'systemctl list-units --type=service --state=running --no-pager --no-legend'
      );

      const lines = output.trim().split('\n').filter(line => line.trim());

      for (const line of lines) {
        const match = line.match(/^(\S+\.service)\s+\S+\s+\S+\s+(\S+)/);
        if (match) {
          const unitName = match[1];
          const serviceName = unitName.replace('.service', '');
          const status = match[2];

          // Detect version for the service
          const version = await this.detectServiceVersion(conn, serviceName, 'systemd');

          const service: DetectedService = {
            service_name: serviceName,
            service_type: 'systemd',
            status: status === 'running' ? 'running' : 'stopped',
            port_bindings: [],
            config_paths: [
              `/etc/systemd/system/${unitName}`,
              `/lib/systemd/system/${unitName}`,
            ],
            data_paths: [],
            log_paths: [`/var/log/${serviceName}.log`],
            service_details: {
              unit_file: unitName,
              version: version,
              update_available: false
            },
            backup_priority: this.determineServicePriority(serviceName),
            backup_strategy: this.determineBackupStrategy(serviceName),
          };

          services.push(service);
        }
      }
    } catch (error) {
      throw error;
    }

    return services;
  }

  private async scanDockerServices(conn: Client): Promise<DetectedService[]> {
    const services: DetectedService[] = [];

    try {
      await this.executeCommand(conn, 'which docker');

      const output = await this.executeCommand(
        conn,
        'docker ps --format "{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}"'
      );

      const lines = output.trim().split('\n').filter(line => line.trim());

      for (const line of lines) {
        const parts = line.split('|');
        if (parts.length >= 3) {
          const [containerName, image, status, ports = ''] = parts;

          // Extract version from image tag
          const imageVersion = this.extractDockerVersion(image);

          const service: DetectedService = {
            service_name: containerName,
            service_type: 'docker',
            status: status.toLowerCase().includes('up') ? 'running' : 'stopped',
            port_bindings: this.parseDockerPorts(ports),
            config_paths: ['/var/lib/docker/containers'],
            data_paths: ['/var/lib/docker/volumes'],
            log_paths: [`/var/lib/docker/containers/${containerName}`],
            service_details: {
              image,
              status,
              ports,
              version: imageVersion,
              update_available: false
            },
            backup_priority: this.determineDockerPriority(image),
            backup_strategy: 'docker_backup',
          };

          services.push(service);
        }
      }
    } catch (error) {
      throw error;
    }

    return services;
  }

  private async scanDatabaseServices(conn: Client): Promise<DetectedService[]> {
    const services: DetectedService[] = [];

    // MySQL
    try {
      await this.executeCommand(conn, 'which mysql');
      services.push({
        service_name: 'mysql',
        service_type: 'database',
        status: 'detected',
        port_bindings: ['3306'],
        config_paths: ['/etc/mysql/', '/etc/my.cnf'],
        data_paths: ['/var/lib/mysql'],
        log_paths: ['/var/log/mysql/'],
        service_details: { database_type: 'mysql' },
        backup_priority: 9,
        backup_strategy: 'database_dump',
      });
    } catch (error) {
      // MySQL not found
    }

    // PostgreSQL
    try {
      await this.executeCommand(conn, 'which psql');
      services.push({
        service_name: 'postgresql',
        service_type: 'database',
        status: 'detected',
        port_bindings: ['5432'],
        config_paths: ['/etc/postgresql/', '/var/lib/pgsql/data/'],
        data_paths: ['/var/lib/postgresql/'],
        log_paths: ['/var/log/postgresql/'],
        service_details: { database_type: 'postgresql' },
        backup_priority: 9,
        backup_strategy: 'database_dump',
      });
    } catch (error) {
      // PostgreSQL not found
    }

    return services;
  }

  private async scanFilesystems(conn: Client, _scanType: string): Promise<DetectedFilesystem[]> {
    const filesystems: DetectedFilesystem[] = [];

    try {
      const output = await this.executeCommand(
        conn,
        'df --output=source,fstype,size,used,avail,pcent,target | tail -n +2'
      );

      const lines = output.trim().split('\n').filter(line => line.trim());

      for (const line of lines) {
        if (line.includes('tmpfs') || line.includes('devtmpfs')) continue;

        const parts = line.trim().split(/\s+/);
        if (parts.length >= 7) {
          const [device, fstype, sizeStr, usedStr, availStr, usageStr, mountPoint] = parts;

          const size = this.parseSize(sizeStr);
          const used = this.parseSize(usedStr);
          const available = this.parseSize(availStr);
          const usage = parseFloat(usageStr.replace('%', ''));

          const filesystem: DetectedFilesystem = {
            mount_point: mountPoint,
            device_name: device,
            filesystem_type: fstype,
            total_size: size,
            used_size: used,
            available_size: available,
            usage_percentage: usage,
            is_system_drive: this.isSystemDrive(mountPoint),
            contains_data: this.containsData(mountPoint),
            backup_recommended: this.shouldBackup(mountPoint, usage),
            backup_priority: this.determineFilesystemPriority(mountPoint),
            estimated_backup_size: this.estimateBackupSize(used, mountPoint),
            exclusion_patterns: this.getExclusionPatterns(mountPoint),
          };

          filesystems.push(filesystem);
        }
      }
    } catch (error) {
      this.logger.error('Filesystem scan error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return filesystems;
  }

  private generateRecommendations(
    services: DetectedService[],
    filesystems: DetectedFilesystem[]
  ): BackupRecommendation[] {
    const recommendations: BackupRecommendation[] = [];

    // Critical service recommendations
    const criticalServices = services.filter(s => s.backup_priority >= 8);
    for (const service of criticalServices) {
      recommendations.push({
        recommendation_type: 'service',
        priority: 'critical',
        title: `Backup ${service.service_name} Service`,
        description: `Critical service detected: ${service.service_name}. Regular backups recommended.`,
        backup_paths: [...service.config_paths, ...service.data_paths],
        exclusion_patterns: ['*.log', '*.tmp'],
        estimated_size: 100 * 1024 * 1024,
        backup_frequency: 'daily',
        retention_period: '30d',
        backup_method: service.backup_strategy,
        implementation_notes: `Service type: ${service.service_type}, Status: ${service.status}`,
      });
    }

    // Database recommendations
    const databases = services.filter(s => s.service_type === 'database');
    for (const db of databases) {
      recommendations.push({
        recommendation_type: 'database',
        priority: 'critical',
        title: `Database Backup: ${db.service_name}`,
        description: `Database service requires specialized backup using dump utilities.`,
        backup_paths: db.data_paths,
        exclusion_patterns: [],
        estimated_size: 500 * 1024 * 1024,
        backup_frequency: 'daily',
        retention_period: '90d',
        backup_method: 'database_dump',
        implementation_notes: `Use ${db.service_name === 'mysql' ? 'mysqldump' : 'pg_dumpall'} for consistent backups`,
      });
    }

    // Filesystem recommendations
    const criticalFilesystems = filesystems.filter(
      fs => fs.backup_recommended && fs.backup_priority >= 7
    );
    for (const fs of criticalFilesystems) {
      recommendations.push({
        recommendation_type: 'filesystem',
        priority: fs.backup_priority >= 8 ? 'critical' : 'high',
        title: `Backup ${fs.mount_point}`,
        description: `Important filesystem with ${fs.usage_percentage}% usage detected.`,
        backup_paths: [fs.mount_point],
        exclusion_patterns: fs.exclusion_patterns,
        estimated_size: fs.estimated_backup_size,
        backup_frequency: fs.usage_percentage > 80 ? 'daily' : 'weekly',
        retention_period: '30d',
        backup_method: 'tar_archive',
        implementation_notes: `Filesystem: ${fs.filesystem_type}, Device: ${fs.device_name}`,
      });
    }

    return recommendations;
  }

  private async storeScanResults(scanId: string, result: ScanResult): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Store services
      for (const service of result.services) {
        await client.query(
          `INSERT INTO detected_services (
            scan_id, service_name, service_type, status, process_id,
            port_bindings, config_paths, data_paths, log_paths,
            service_details, backup_priority, backup_strategy
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            scanId,
            service.service_name,
            service.service_type,
            service.status,
            service.process_id,
            service.port_bindings,
            service.config_paths,
            service.data_paths,
            service.log_paths,
            JSON.stringify(service.service_details),
            service.backup_priority,
            service.backup_strategy,
          ]
        );
      }

      // Store filesystems
      for (const fs of result.filesystems) {
        await client.query(
          `INSERT INTO detected_filesystems (
            scan_id, mount_point, device_name, filesystem_type,
            total_size, used_size, available_size, usage_percentage,
            is_system_drive, contains_data, backup_recommended,
            backup_priority, estimated_backup_size, exclusion_patterns
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            scanId,
            fs.mount_point,
            fs.device_name,
            fs.filesystem_type,
            fs.total_size,
            fs.used_size,
            fs.available_size,
            fs.usage_percentage,
            fs.is_system_drive,
            fs.contains_data,
            fs.backup_recommended,
            fs.backup_priority,
            fs.estimated_backup_size,
            fs.exclusion_patterns,
          ]
        );
      }

      // Store recommendations
      for (const rec of result.recommendations) {
        await client.query(
          `INSERT INTO backup_recommendations (
            scan_id, recommendation_type, priority, title, description,
            backup_paths, exclusion_patterns, estimated_size,
            backup_frequency, retention_period, backup_method, implementation_notes
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            scanId,
            rec.recommendation_type,
            rec.priority,
            rec.title,
            rec.description,
            rec.backup_paths,
            rec.exclusion_patterns,
            rec.estimated_size,
            rec.backup_frequency,
            rec.retention_period,
            rec.backup_method,
            rec.implementation_notes,
          ]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Utility methods
  private executeCommand(conn: Client, command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Validate and sanitize command before execution
      try {
        validateAndSanitizeCommand(command);
      } catch (error) {
        reject(error);
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout: ${command}`));
      }, this.COMMAND_TIMEOUT);

      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeout);
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
          clearTimeout(timeout);
          if (code !== 0) {
            reject(new Error(`Command failed (exit ${code}): ${errorOutput || output}`));
          } else {
            resolve(output);
          }
        });

        stream.on('error', (err: Error) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    });
  }

  private determineServicePriority(serviceName: string): number {
    const highPriority = ['mysql', 'postgresql', 'mongodb', 'redis', 'nginx', 'apache2', 'httpd', 'ssh', 'sshd', 'docker'];
    const mediumPriority = ['postfix', 'dovecot', 'bind9', 'cron', 'rsyslog', 'fail2ban', 'ufw'];

    if (highPriority.some(service => serviceName.includes(service))) return 8;
    if (mediumPriority.some(service => serviceName.includes(service))) return 6;
    return 4;
  }

  private determineDockerPriority(image: string): number {
    const highPriority = ['mysql', 'postgres', 'mongodb', 'redis', 'nginx', 'apache', 'traefik', 'gitlab', 'jenkins', 'nextcloud'];
    return highPriority.some(img => image.toLowerCase().includes(img)) ? 8 : 6;
  }

  private determineBackupStrategy(serviceName: string): string {
    if (['mysql', 'postgresql', 'mongodb'].some(db => serviceName.includes(db))) return 'database_dump';
    if (['nginx', 'apache2', 'httpd'].some(web => serviceName.includes(web))) return 'web_server';
    if (serviceName.includes('docker')) return 'docker_backup';
    return 'config_and_data';
  }

  private parseDockerPorts(ports: string): string[] {
    const portList: string[] = [];
    const portRegex = /(\d+)\/(tcp|udp)/g;
    let match;

    while ((match = portRegex.exec(ports)) !== null) {
      portList.push(match[1]);
    }

    return portList;
  }

  private extractDockerVersion(image: string): string {
    // Extract version from image tag (e.g., nginx:1.21 -> 1.21)
    const parts = image.split(':');
    if (parts.length > 1) {
      const tag = parts[1];
      // Return the tag unless it's 'latest'
      return tag === 'latest' ? 'latest' : tag;
    }
    return 'latest';
  }

  private async detectServiceVersion(conn: Client, serviceName: string, serviceType: string): Promise<string> {
    try {
      let versionCommand = '';

      // Systemd services - try to detect version based on service name
      if (serviceType === 'systemd') {
        if (serviceName.includes('nginx')) {
          versionCommand = 'nginx -v 2>&1 | grep -oP "nginx/\\K[0-9.]+"';
        } else if (serviceName.includes('apache') || serviceName.includes('httpd')) {
          versionCommand = 'apache2 -v 2>&1 | grep -oP "Apache/\\K[0-9.]+" || httpd -v 2>&1 | grep -oP "Apache/\\K[0-9.]+"';
        } else if (serviceName.includes('mysql')) {
          versionCommand = 'mysql --version 2>&1 | grep -oP "Distrib \\K[0-9.]+"';
        } else if (serviceName.includes('postgresql') || serviceName.includes('postgres')) {
          versionCommand = 'psql --version 2>&1 | grep -oP "\\d+\\.\\d+"';
        } else if (serviceName.includes('redis')) {
          versionCommand = 'redis-server --version 2>&1 | grep -oP "v=\\K[0-9.]+"';
        } else if (serviceName.includes('docker')) {
          versionCommand = 'docker --version 2>&1 | grep -oP "Docker version \\K[0-9.]+"';
        }
      }

      if (versionCommand) {
        const version = await this.executeCommand(conn, versionCommand);
        return version.trim() || 'unknown';
      }

      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  private parseSize(sizeStr: string): number {
    const units: Record<string, number> = {
      K: 1024,
      M: 1024 * 1024,
      G: 1024 * 1024 * 1024,
      T: 1024 * 1024 * 1024 * 1024,
      k: 1024,
      m: 1024 * 1024,
      g: 1024 * 1024 * 1024,
      t: 1024 * 1024 * 1024 * 1024,
    };

    const match = sizeStr.match(/^(\d+(?:\.\d+)?)([KMGT]?)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2];

    return Math.floor(value * (units[unit] || 1));
  }

  private isSystemDrive(mountPoint: string): boolean {
    return ['/', '/boot', '/var', '/usr', '/etc'].includes(mountPoint);
  }

  private containsData(mountPoint: string): boolean {
    return ['/home', '/var/www', '/opt', '/srv', '/data'].some(path =>
      mountPoint.startsWith(path)
    );
  }

  private shouldBackup(mountPoint: string, usage: number): boolean {
    if (['/tmp', '/proc', '/sys', '/dev'].some(path => mountPoint.startsWith(path))) return false;
    if (['/home', '/var/www', '/opt', '/srv', '/data', '/etc'].some(path => mountPoint.startsWith(path))) return true;
    if (mountPoint === '/' && usage > 20) return true;
    return false;
  }

  private determineFilesystemPriority(mountPoint: string): number {
    if (['/home', '/var/www', '/data', '/srv'].some(path => mountPoint.startsWith(path))) return 9;
    if (['/etc', '/opt'].some(path => mountPoint.startsWith(path))) return 8;
    if (mountPoint === '/') return 7;
    return 5;
  }

  private estimateBackupSize(usedSize: number, mountPoint: string): number {
    let compressionRatio = 0.6;

    if (['/var/log', '/tmp'].some(path => mountPoint.startsWith(path))) compressionRatio = 0.8;
    else if (['/var/www', '/home'].some(path => mountPoint.startsWith(path))) compressionRatio = 0.7;

    return Math.floor(usedSize * compressionRatio);
  }

  private getExclusionPatterns(mountPoint: string): string[] {
    const base = ['*.log', '*.tmp', '*.cache', '*.pid', '*.lock', 'lost+found', 'node_modules', '.git'];

    const specific: Record<string, string[]> = {
      '/': [...base, 'proc/*', 'sys/*', 'dev/*', 'tmp/*', 'run/*'],
      '/var': [...base, 'var/cache/*', 'var/tmp/*', 'var/log/*'],
      '/home': [...base, '.cache/*', '.tmp/*', 'Downloads/*'],
    };

    for (const path in specific) {
      if (mountPoint.startsWith(path)) return specific[path];
    }

    return base;
  }

  private createScanSummary(result: ScanResult): Record<string, any> {
    return {
      services_count: result.services.length,
      filesystems_count: result.filesystems.length,
      recommendations_count: result.recommendations.length,
      critical_services: result.services.filter(s => s.backup_priority >= 8).length,
      critical_recommendations: result.recommendations.filter(r => r.priority === 'critical').length,
      total_estimated_size: result.recommendations.reduce((sum, r) => sum + r.estimated_size, 0),
    };
  }
}
