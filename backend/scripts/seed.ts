/**
 * Development Seeds Script
 * Populates the database with test data for development and testing
 *
 * Usage: npm run seed
 */

import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../src/config/database';
import { logger } from '../src/config/logger';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

interface User {
  id: string;
  username: string;
  role: string;
}

interface Server {
  id: string;
  name: string;
  userId: string;
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

async function clearDatabase() {
  logger.info('Clearing existing data...');

  // Delete in reverse order of dependencies
  await pool.query('DELETE FROM audit_logs');
  await pool.query('DELETE FROM backup_schedules');
  await pool.query('DELETE FROM backup_recommendations');
  await pool.query('DELETE FROM detected_filesystems');
  await pool.query('DELETE FROM detected_services');
  await pool.query('DELETE FROM server_scans');
  await pool.query('DELETE FROM backups');
  await pool.query('DELETE FROM servers');
  await pool.query('DELETE FROM users');

  logger.info('Database cleared');
}

async function seedUsers(): Promise<User[]> {
  logger.info('Seeding users...');

  const users = [
    { username: 'admin', email: 'admin@example.com', password: 'admin123', role: 'admin' },
    { username: 'user1', email: 'user1@example.com', password: 'user123', role: 'user' },
    { username: 'user2', email: 'user2@example.com', password: 'user123', role: 'user' },
    { username: 'viewer', email: 'viewer@example.com', password: 'viewer123', role: 'viewer' },
  ];

  const createdUsers: User[] = [];

  for (const user of users) {
    const passwordHash = await bcrypt.hash(user.password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, role`,
      [user.username, user.email, passwordHash, user.role]
    );
    createdUsers.push(result.rows[0]);
    logger.info(`Created user: ${user.username} (${user.role})`);
  }

  return createdUsers;
}

async function seedServers(users: User[]): Promise<Server[]> {
  logger.info('Seeding servers...');

  const servers = [
    {
      name: 'Web Server 01',
      hostname: '192.168.1.10',
      port: 22,
      username: 'root',
      description: 'Production web server running Nginx',
      userId: users[0].id, // admin
    },
    {
      name: 'Database Server',
      hostname: '192.168.1.20',
      port: 22,
      username: 'ubuntu',
      description: 'PostgreSQL database server',
      userId: users[0].id, // admin
    },
    {
      name: 'App Server 01',
      hostname: '192.168.1.30',
      port: 22,
      username: 'deploy',
      description: 'Node.js application server',
      userId: users[1].id, // user1
    },
    {
      name: 'Cache Server',
      hostname: '192.168.1.40',
      port: 22,
      username: 'redis',
      description: 'Redis cache server',
      userId: users[1].id, // user1
    },
  ];

  const createdServers: Server[] = [];

  for (const server of servers) {
    const privateKey = `-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEAtest${Math.random()}\n-----END RSA PRIVATE KEY-----`;
    const publicKey = `ssh-rsa AAAAB3NzaC1yc2EAAAAtest${Math.random()} test@example.com`;

    const encryptedPrivateKey = encrypt(privateKey);

    const result = await pool.query(
      `INSERT INTO servers (name, hostname, port, username, description, private_key, public_key, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, user_id`,
      [
        server.name,
        server.hostname,
        server.port,
        server.username,
        server.description,
        encryptedPrivateKey,
        publicKey,
        server.userId,
      ]
    );
    createdServers.push(result.rows[0]);
    logger.info(`Created server: ${server.name}`);
  }

  return createdServers;
}

async function seedScans(servers: Server[]) {
  logger.info('Seeding server scans...');

  for (const server of servers) {
    // Create 2-3 scans per server
    const scanCount = Math.floor(Math.random() * 2) + 2;

    for (let i = 0; i < scanCount; i++) {
      const startedAt = new Date(Date.now() - (i + 1) * 86400000); // 1, 2, 3 days ago
      const completedAt = new Date(startedAt.getTime() + 30000); // 30 seconds later

      const scanResult = await pool.query(
        `INSERT INTO server_scans (
          server_id, scan_type, status, started_at, completed_at,
          scan_duration, scan_summary
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id`,
        [
          server.id,
          i === 0 ? 'full' : 'quick',
          'completed',
          startedAt,
          completedAt,
          30,
          JSON.stringify({
            servicesFound: Math.floor(Math.random() * 10) + 5,
            filesystemsScanned: 3,
            totalBackupSize: `${Math.floor(Math.random() * 500) + 100}GB`,
          }),
        ]
      );

      const scanId = scanResult.rows[0].id;

      // Add detected services
      const services = [
        { name: 'nginx', type: 'web_server', port: 80 },
        { name: 'postgresql', type: 'database', port: 5432 },
        { name: 'redis', type: 'cache', port: 6379 },
        { name: 'node', type: 'application', port: 3000 },
      ];

      for (const service of services.slice(0, Math.floor(Math.random() * 3) + 2)) {
        await pool.query(
          `INSERT INTO detected_services (
            scan_id, service_name, service_type, status, port_bindings,
            config_paths, data_paths, backup_priority, backup_strategy
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            scanId,
            service.name,
            service.type,
            'running',
            JSON.stringify([service.port]),
            JSON.stringify([`/etc/${service.name}`]),
            JSON.stringify([`/var/lib/${service.name}`]),
            Math.floor(Math.random() * 5) + 5,
            'incremental',
          ]
        );
      }

      // Add detected filesystems
      const filesystems = [
        { mountPoint: '/', size: 100 * 1024 * 1024 * 1024 },
        { mountPoint: '/var', size: 200 * 1024 * 1024 * 1024 },
        { mountPoint: '/home', size: 500 * 1024 * 1024 * 1024 },
      ];

      for (const fs of filesystems) {
        const usedSize = Math.floor(fs.size * (Math.random() * 0.5 + 0.2));
        await pool.query(
          `INSERT INTO detected_filesystems (
            scan_id, mount_point, device_name, filesystem_type,
            total_size, used_size, available_size, usage_percentage,
            is_system_drive, contains_data, backup_recommended, backup_priority
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            scanId,
            fs.mountPoint,
            `/dev/sda${filesystems.indexOf(fs) + 1}`,
            'ext4',
            fs.size,
            usedSize,
            fs.size - usedSize,
            Math.floor((usedSize / fs.size) * 100),
            fs.mountPoint === '/',
            fs.mountPoint !== '/',
            fs.mountPoint !== '/',
            fs.mountPoint === '/' ? 5 : 7,
          ]
        );
      }

      logger.info(`Created scan for server: ${server.name} (${i + 1}/${scanCount})`);
    }
  }
}

async function seedBackups(servers: Server[]) {
  logger.info('Seeding backups...');

  for (const server of servers) {
    const backupCount = Math.floor(Math.random() * 5) + 3;

    for (let i = 0; i < backupCount; i++) {
      const startedAt = new Date(Date.now() - (i + 1) * 43200000); // Every 12 hours
      const completedAt = new Date(startedAt.getTime() + Math.random() * 600000); // 0-10 minutes
      const fileSize = Math.floor(Math.random() * 10000000000) + 1000000000; // 1-10GB

      await pool.query(
        `INSERT INTO backups (
          server_id, source_path, destination_path, compression, encryption,
          status, started_at, completed_at, backup_duration, file_size, file_hash
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          server.id,
          '/var/www',
          `/backups/${server.name.replace(/\s+/g, '-').toLowerCase()}/${startedAt.toISOString().split('T')[0]}`,
          i % 2 === 0 ? 'gzip' : 'bzip2',
          i % 3 === 0,
          'completed',
          startedAt,
          completedAt,
          Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000),
          fileSize,
          crypto.randomBytes(32).toString('hex'),
        ]
      );
    }

    logger.info(`Created ${backupCount} backups for server: ${server.name}`);
  }
}

async function seedBackupSchedules(servers: Server[], users: User[]) {
  logger.info('Seeding backup schedules...');

  const schedules = [
    {
      serverId: servers[0].id,
      userId: users[0].id,
      scheduleType: 'daily',
      hour: 2,
      sourcePath: '/var/www/html',
      destinationPath: '/backups/www',
      compression: 'gzip',
    },
    {
      serverId: servers[1].id,
      userId: users[0].id,
      scheduleType: 'weekly',
      hour: 3,
      dayOfWeek: 0, // Sunday
      sourcePath: '/var/lib/postgresql',
      destinationPath: '/backups/database',
      compression: 'bzip2',
    },
    {
      serverId: servers[2]?.id,
      userId: users[1]?.id,
      scheduleType: 'monthly',
      hour: 1,
      dayOfMonth: 1,
      sourcePath: '/home/deploy/app',
      destinationPath: '/backups/app',
      compression: 'gzip',
    },
  ];

  for (const schedule of schedules) {
    if (!schedule.serverId || !schedule.userId) continue;

    const nextRun = new Date();
    nextRun.setHours(schedule.hour, 0, 0, 0);
    if (nextRun < new Date()) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    await pool.query(
      `INSERT INTO backup_schedules (
        server_id, user_id, schedule_type, hour, day_of_week, day_of_month,
        source_path, destination_path, compression, encryption, enabled, next_run
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        schedule.serverId,
        schedule.userId,
        schedule.scheduleType,
        schedule.hour,
        schedule.dayOfWeek || null,
        schedule.dayOfMonth || null,
        schedule.sourcePath,
        schedule.destinationPath,
        schedule.compression,
        true,
        true,
        nextRun,
      ]
    );

    logger.info(`Created ${schedule.scheduleType} backup schedule`);
  }
}

async function seedAuditLogs(users: User[], servers: Server[]) {
  logger.info('Seeding audit logs...');

  const actions = [
    'USER_LOGIN',
    'SERVER_CREATE',
    'SERVER_UPDATE',
    'BACKUP_EXECUTE',
    'SCAN_INITIATED',
    'BACKUP_SCHEDULE_CREATE',
  ];

  for (let i = 0; i < 20; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const action = actions[Math.floor(Math.random() * actions.length)];
    const server = servers[Math.floor(Math.random() * servers.length)];

    await pool.query(
      `INSERT INTO audit_logs (
        user_id, action, resource_type, resource_id, details,
        ip_address, user_agent, status, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        user.id,
        action,
        action.includes('SERVER') ? 'SERVER' : action.includes('BACKUP') ? 'BACKUP' : 'USER',
        server.id,
        JSON.stringify({ action: action.toLowerCase().replace('_', ' ') }),
        `192.168.1.${Math.floor(Math.random() * 255)}`,
        'Mozilla/5.0 (compatible; SeedScript/1.0)',
        'success',
        new Date(Date.now() - Math.random() * 7 * 86400000), // Random time in last 7 days
      ]
    );
  }

  logger.info('Created 20 audit log entries');
}

async function main() {
  try {
    logger.info('Starting database seeding...');

    // Test database connection
    await pool.query('SELECT 1');
    logger.info('Database connection successful');

    // Clear existing data
    await clearDatabase();

    // Seed data
    const users = await seedUsers();
    const servers = await seedServers(users);
    await seedScans(servers);
    await seedBackups(servers);
    await seedBackupSchedules(servers, users);
    await seedAuditLogs(users, servers);

    logger.info('✓ Database seeding completed successfully!');
    logger.info('\nTest credentials:');
    logger.info('  Admin:  admin / admin123');
    logger.info('  User:   user1 / user123');
    logger.info('  Viewer: viewer / viewer123');

  } catch (error) {
    logger.error('Seeding failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

main();
