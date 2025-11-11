#!/usr/bin/env ts-node
/**
 * Medicine Man - First-Time Setup Wizard
 * Interactive configuration wizard for production deployment
 *
 * This wizard:
 * - Generates secure random secrets
 * - Creates .env files for backend and root
 * - Configures database connection
 * - Sets up CORS origin
 * - Optionally configures notifications
 *
 * Usage: npm run setup:wizard
 */

import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generatePassword(length: number = 32): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  const values = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    password += charset[values[i] % charset.length];
  }
  return password;
}

interface Config {
  // Database
  dbPassword: string;
  dbUser: string;
  dbName: string;

  // Redis
  redisPassword: string;

  // Security
  jwtSecret: string;
  sessionSecret: string;
  encryptionKey: string;

  // Network
  corsOrigin: string;
  serverIp: string;
  frontendPort: string;

  // Unraid
  puid: string;
  pgid: string;

  // Optional
  enableNotifications: boolean;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPass?: string;
  smtpFrom?: string;
  slackWebhook?: string;
}

async function runWizard(): Promise<Config> {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  Medicine Man - First-Time Setup Wizard                   ║');
  console.log('║  Production Configuration Generator                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('This wizard will generate secure configuration files for your');
  console.log('Medicine Man installation. All secrets will be randomly generated.\n');

  const config: Partial<Config> = {};

  // Network Configuration
  console.log('═══ Network Configuration ═══\n');

  const serverIp = await question('Server IP address (e.g., 192.168.4.21): ');
  config.serverIp = serverIp || '192.168.4.21';

  const frontendPort = await question('Frontend port (default: 8091): ');
  config.frontendPort = frontendPort || '8091';

  const hasDomain = await question('Do you have a custom domain? (yes/no): ');
  if (hasDomain.toLowerCase() === 'yes' || hasDomain.toLowerCase() === 'y') {
    const domain = await question('Enter your domain (e.g., https://medicine-man.example.com): ');
    config.corsOrigin = domain;
  } else {
    config.corsOrigin = `http://${config.serverIp}:${config.frontendPort}`;
  }

  // Unraid Configuration
  console.log('\n═══ Unraid Configuration ═══\n');
  console.log('For Unraid, use PUID=99 and PGID=100 (nobody:users)');
  console.log('For other systems, use your user/group IDs\n');

  const puid = await question('PUID (default: 99): ');
  config.puid = puid || '99';

  const pgid = await question('PGID (default: 100): ');
  config.pgid = pgid || '100';

  // Database Configuration
  console.log('\n═══ Database Configuration ═══\n');
  console.log('Generating secure database credentials...\n');

  const dbUser = await question('Database user (default: medicine_user): ');
  config.dbUser = dbUser || 'medicine_user';

  const dbName = await question('Database name (default: medicine_man): ');
  config.dbName = dbName || 'medicine_man';

  config.dbPassword = generatePassword();
  console.log(`✓ Generated database password: ${config.dbPassword.substring(0, 8)}... (saved to .env)`);

  // Redis Configuration
  console.log('\n═══ Redis Configuration ═══\n');
  console.log('Generating secure Redis credentials...\n');

  config.redisPassword = generatePassword();
  console.log(`✓ Generated Redis password: ${config.redisPassword.substring(0, 8)}... (saved to .env)`);

  // Security Secrets
  console.log('\n═══ Security Secrets ═══\n');
  console.log('Generating cryptographic secrets (64 hex characters each)...\n');

  config.jwtSecret = generateSecret();
  console.log(`✓ Generated JWT secret: ${config.jwtSecret.substring(0, 16)}...`);

  config.sessionSecret = generateSecret();
  console.log(`✓ Generated session secret: ${config.sessionSecret.substring(0, 16)}...`);

  config.encryptionKey = generateSecret();
  console.log(`✓ Generated encryption key: ${config.encryptionKey.substring(0, 16)}...`);

  // Optional: Notifications
  console.log('\n═══ Notifications (Optional) ═══\n');

  const setupNotifications = await question('Configure email notifications? (yes/no): ');
  config.enableNotifications = setupNotifications.toLowerCase() === 'yes' || setupNotifications.toLowerCase() === 'y';

  if (config.enableNotifications) {
    console.log('\nEmail Notification Setup:');
    console.log('For Gmail, use smtp.gmail.com:587 and create an App Password');
    console.log('https://myaccount.google.com/apppasswords\n');

    config.smtpHost = await question('SMTP host (e.g., smtp.gmail.com): ');
    config.smtpPort = await question('SMTP port (default: 587): ') || '587';
    config.smtpUser = await question('SMTP username (email address): ');
    config.smtpPass = await question('SMTP password (or app password): ');
    config.smtpFrom = await question('From address (default: noreply@medicine-man.local): ') || 'noreply@medicine-man.local';

    const setupSlack = await question('\nConfigure Slack notifications? (yes/no): ');
    if (setupSlack.toLowerCase() === 'yes' || setupSlack.toLowerCase() === 'y') {
      console.log('\nCreate a Slack webhook at: https://api.slack.com/messaging/webhooks\n');
      config.slackWebhook = await question('Slack webhook URL: ');
    }
  }

  return config as Config;
}

function createRootEnv(config: Config): string {
  return `# Medicine Man - Root Environment Configuration
# Generated: ${new Date().toISOString()}

# Database Credentials
DB_USER=${config.dbUser}
DB_PASSWORD=${config.dbPassword}
DB_NAME=${config.dbName}

# Redis Credentials
REDIS_PASSWORD=${config.redisPassword}

# Unraid User/Group IDs
PUID=${config.puid}
PGID=${config.pgid}
`;
}

function createBackendEnv(config: Config): string {
  const notificationsConfig = config.enableNotifications ? `
# Notifications
NOTIFICATIONS_ENABLED=true
SMTP_HOST=${config.smtpHost}
SMTP_PORT=${config.smtpPort}
SMTP_SECURE=false
SMTP_USER=${config.smtpUser}
SMTP_PASS=${config.smtpPass}
SMTP_FROM=${config.smtpFrom}
SMTP_FROM_NAME=Medicine Man
${config.slackWebhook ? `SLACK_WEBHOOK_URL=${config.slackWebhook}\nSLACK_CHANNEL=#alerts\nSLACK_USERNAME=Medicine Man` : ''}
` : `
# Notifications (disabled)
NOTIFICATIONS_ENABLED=false
`;

  return `# Medicine Man - Backend Environment Configuration
# Generated: ${new Date().toISOString()}
#
# ⚠️  SECURITY WARNING ⚠️
# This file contains sensitive credentials. Do not commit to version control.
# Keep this file secure and backed up safely.

# ═══════════════════════════════════════════════════════════
# Server Configuration
# ═══════════════════════════════════════════════════════════
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# ═══════════════════════════════════════════════════════════
# Database Configuration (Internal Docker Network)
# ═══════════════════════════════════════════════════════════
DB_HOST=postgres
DB_PORT=5432
DB_NAME=${config.dbName}
DB_USER=${config.dbUser}
DB_PASSWORD=${config.dbPassword}

# DATABASE_URL for migrations (node-pg-migrate)
DATABASE_URL=postgresql://${config.dbUser}:${config.dbPassword}@postgres:5432/${config.dbName}

# ═══════════════════════════════════════════════════════════
# Redis Configuration (Internal Docker Network)
# ═══════════════════════════════════════════════════════════
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${config.redisPassword}

# ═══════════════════════════════════════════════════════════
# Security Secrets (CRITICAL - Keep These Safe!)
# ═══════════════════════════════════════════════════════════
# JWT_SECRET: Used for signing JWT tokens (64 hex characters)
JWT_SECRET=${config.jwtSecret}

# SESSION_SECRET: Used for session encryption (64 hex characters)
SESSION_SECRET=${config.sessionSecret}

# ENCRYPTION_KEY: Used for data encryption (64 hex characters)
# This encrypts SSH credentials and other sensitive data
ENCRYPTION_KEY=${config.encryptionKey}

# JWT Token Expiry
JWT_EXPIRES_IN=24h

# ═══════════════════════════════════════════════════════════
# CORS Configuration
# ═══════════════════════════════════════════════════════════
CORS_ORIGIN=${config.corsOrigin}

# ═══════════════════════════════════════════════════════════
# Rate Limiting
# ═══════════════════════════════════════════════════════════
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# ═══════════════════════════════════════════════════════════
# Logging Configuration
# ═══════════════════════════════════════════════════════════
LOG_LEVEL=info
LOG_IP=false
LOG_USER_AGENT=false

# ═══════════════════════════════════════════════════════════
# Cache Configuration
# ═══════════════════════════════════════════════════════════
CACHE_ENABLED=true
CACHE_DEFAULT_TTL=300

# ═══════════════════════════════════════════════════════════
# Authentication Configuration
# ═══════════════════════════════════════════════════════════
MAX_LOGIN_ATTEMPTS=5
LOGIN_LOCKOUT_DURATION=1800000
SESSION_TIMEOUT=3600000

# ═══════════════════════════════════════════════════════════
# WebSocket Configuration
# ═══════════════════════════════════════════════════════════
WS_IDLE_TIMEOUT=600000

# ═══════════════════════════════════════════════════════════
# HTTPS/SSL Configuration
# ═══════════════════════════════════════════════════════════
# Set to true if behind Cloudflare or reverse proxy with SSL
REQUIRE_HTTPS=false
${notificationsConfig}
# ═══════════════════════════════════════════════════════════
# End of Configuration
# ═══════════════════════════════════════════════════════════
`;
}

async function saveConfiguration(config: Config) {
  console.log('\n═══ Saving Configuration ═══\n');

  // Determine paths
  // Detect if running in Docker (src folder exists at /app/src) vs local dev
  const isDocker = fs.existsSync('/app/src');
  const rootDir = isDocker ? '/' : path.resolve(__dirname, '../../../..');
  const backendDir = isDocker ? '/app' : path.resolve(__dirname, '../../..');

  const rootEnvPath = path.join(rootDir, '.env');
  const backendEnvPath = path.join(backendDir, '.env');

  // Create .env files
  const rootEnv = createRootEnv(config);
  const backendEnv = createBackendEnv(config);

  // Write files
  fs.writeFileSync(rootEnvPath, rootEnv, 'utf8');
  console.log(`✓ Created: ${rootEnvPath}`);

  fs.writeFileSync(backendEnvPath, backendEnv, 'utf8');
  console.log(`✓ Created: ${backendEnvPath}`);

  // Create .env.backup with timestamp (skip in Docker - files are on host anyway)
  if (!isDocker) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(rootDir, `.env.backup.${timestamp}`), rootEnv, 'utf8');
    fs.writeFileSync(path.join(backendDir, `.env.backup.${timestamp}`), backendEnv, 'utf8');
    console.log(`✓ Created backups with timestamp: ${timestamp}`);
  } else {
    console.log(`ℹ Skipping backups in Docker (files are mounted from host)`);
  }

  // Save summary (skip in Docker - not writable)
  if (!isDocker) {
    const summaryPath = path.join(rootDir, 'SETUP-SUMMARY.txt');
  const summary = `Medicine Man Setup Summary
Generated: ${new Date().toISOString()}

Server Configuration:
  - IP Address: ${config.serverIp}
  - Frontend Port: ${config.frontendPort}
  - CORS Origin: ${config.corsOrigin}

Database:
  - User: ${config.dbUser}
  - Database: ${config.dbName}
  - Password: ${config.dbPassword}

Redis:
  - Password: ${config.redisPassword}

Security Secrets:
  - JWT Secret: ${config.jwtSecret}
  - Session Secret: ${config.sessionSecret}
  - Encryption Key: ${config.encryptionKey}

Unraid:
  - PUID: ${config.puid}
  - PGID: ${config.pgid}

Notifications:
  - Enabled: ${config.enableNotifications}
${config.smtpHost ? `  - SMTP Host: ${config.smtpHost}:${config.smtpPort}\n  - SMTP User: ${config.smtpUser}` : ''}
${config.slackWebhook ? `  - Slack Webhook: Configured` : ''}

⚠️  IMPORTANT: Keep this file secure! It contains all your credentials.
⚠️  Store this in a safe location (password manager, encrypted backup).

Next Steps:
1. Start services: docker compose up -d
2. Run migrations: docker compose exec backend npm run migrate
3. Create users: docker compose exec backend npm run setup:users
4. Access at: ${config.corsOrigin}
`;

  fs.writeFileSync(summaryPath, summary, 'utf8');
  console.log(`✓ Created setup summary: ${summaryPath}`);
}

async function main() {
  try {
    // Check if .env already exists
    const backendEnvPath = path.resolve(__dirname, '../../..', '.env');
    if (fs.existsSync(backendEnvPath)) {
      console.log('\n⚠️  Warning: Configuration files already exist!\n');
      const overwrite = await question('Do you want to overwrite them? (yes/no): ');
      if (overwrite.toLowerCase() !== 'yes' && overwrite.toLowerCase() !== 'y') {
        console.log('\nSetup cancelled. Existing configuration preserved.');
        rl.close();
        process.exit(0);
      }
    }

    // Run wizard
    const config = await runWizard();

    // Confirm
    console.log('\n═══ Configuration Summary ═══\n');
    console.log(`Server IP: ${config.serverIp}:${config.frontendPort}`);
    console.log(`CORS Origin: ${config.corsOrigin}`);
    console.log(`Database: ${config.dbUser}@${config.dbName}`);
    console.log(`Notifications: ${config.enableNotifications ? 'Enabled' : 'Disabled'}`);
    console.log(`Unraid UID:GID: ${config.puid}:${config.pgid}`);
    console.log('');

    const confirm = await question('Save this configuration? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('\nSetup cancelled.');
      rl.close();
      process.exit(0);
    }

    // Save
    await saveConfiguration(config);

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║  ✓ Setup Complete!                                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');

    console.log('Configuration files created:');
    console.log('  ✓ .env (root)');
    console.log('  ✓ backend/.env');
    console.log('  ✓ SETUP-SUMMARY.txt (keep this safe!)\n');

    console.log('Next steps:');
    console.log('  1. docker compose build');
    console.log('  2. docker compose up -d');
    console.log('  3. docker compose exec backend npm run migrate');
    console.log('  4. docker compose exec backend npm run setup:users');
    console.log(`  5. Access: ${config.corsOrigin}\n`);

    console.log('⚠️  IMPORTANT: Backup SETUP-SUMMARY.txt to a secure location!\n');

  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
}
