/**
 * Script to create initial user accounts for Medicine Man
 *
 * This script creates the following users:
 * 1. Admin - admin role
 * 2. Kaos - admin role
 * 3. zeus - user role
 * 4. marlon - user role
 * 5. s3rpant - user role
 *
 * Usage: npm run setup-users
 * or: ts-node src/scripts/create-initial-users.ts
 */

import { pool } from '../config/database';
import { hashPassword } from '../utils/crypto';
import { logger } from '../config/logger';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

interface UserConfig {
  username: string;
  email: string;
  role: 'admin' | 'user';
  password: string;
}

async function createUser(config: UserConfig) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if user already exists
    const existingUser = await client.query(
      'SELECT id, username FROM users WHERE username = $1',
      [config.username]
    );

    if (existingUser.rows.length > 0) {
      console.log(`⚠️  User '${config.username}' already exists. Skipping...`);
      await client.query('ROLLBACK');
      return;
    }

    // Hash password
    const hashedPassword = await hashPassword(config.password);

    // Create user
    const userResult = await client.query(
      `INSERT INTO users (username, email, password_hash, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, username, email, is_active`,
      [config.username, config.email, hashedPassword, true]
    );

    const user = userResult.rows[0];

    // Create user role
    await client.query(
      `INSERT INTO user_roles (user_id, role, created_at, assigned_at)
       VALUES ($1, $2, NOW(), NOW())`,
      [user.id, config.role]
    );

    await client.query('COMMIT');

    console.log(`✅ Created user '${config.username}' with role '${config.role}'`);
    logger.info('User created via setup script', {
      userId: user.id,
      username: user.username,
      role: config.role,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error(`❌ Error creating user '${config.username}':`, error.message);
    logger.error('Error creating user via setup script', {
      username: config.username,
      error: error.message,
    });
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║   Medicine Man - Initial User Setup Script   ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  console.log('This script will create 5 user accounts:');
  console.log('  1. Admin (admin role)');
  console.log('  2. Kaos (admin role)');
  console.log('  3. zeus (user role)');
  console.log('  4. marlon (user role)');
  console.log('  5. s3rpant (user role)\n');

  const proceed = await question('Do you want to proceed? (yes/no): ');
  if (proceed.toLowerCase() !== 'yes' && proceed.toLowerCase() !== 'y') {
    console.log('Setup cancelled.');
    rl.close();
    process.exit(0);
  }

  console.log('\n📝 Please set passwords for each user:\n');

  // Define users
  const users: UserConfig[] = [
    {
      username: 'Admin',
      email: 'admin@medicineman.local',
      role: 'admin',
      password: '',
    },
    {
      username: 'Kaos',
      email: 'kaos@medicineman.local',
      role: 'admin',
      password: '',
    },
    {
      username: 'zeus',
      email: 'zeus@medicineman.local',
      role: 'user',
      password: '',
    },
    {
      username: 'marlon',
      email: 'marlon@medicineman.local',
      role: 'user',
      password: '',
    },
    {
      username: 's3rpant',
      email: 's3rpant@medicineman.local',
      role: 'user',
      password: '',
    },
  ];

  // Get passwords for each user
  for (const user of users) {
    let passwordValid = false;
    while (!passwordValid) {
      const password = await question(`Enter password for ${user.username} (${user.role}): `);

      // Validate password
      if (password.length < 8) {
        console.log('❌ Password must be at least 8 characters long. Try again.\n');
        continue;
      }
      if (!/[A-Z]/.test(password)) {
        console.log('❌ Password must contain at least one uppercase letter. Try again.\n');
        continue;
      }
      if (!/[a-z]/.test(password)) {
        console.log('❌ Password must contain at least one lowercase letter. Try again.\n');
        continue;
      }
      if (!/[0-9]/.test(password)) {
        console.log('❌ Password must contain at least one number. Try again.\n');
        continue;
      }

      const confirmPassword = await question(`Confirm password for ${user.username}: `);
      if (password !== confirmPassword) {
        console.log('❌ Passwords do not match. Try again.\n');
        continue;
      }

      user.password = password;
      passwordValid = true;
      console.log('✅ Password set successfully.\n');
    }
  }

  console.log('\n🚀 Creating users...\n');

  // Create all users
  for (const user of users) {
    try {
      await createUser(user);
    } catch (error) {
      console.error(`Failed to create user ${user.username}`);
      // Continue with other users even if one fails
    }
  }

  console.log('\n✅ User setup complete!\n');
  console.log('You can now login with any of the created users.\n');

  rl.close();
  await pool.end();
  process.exit(0);
}

// Run the script
main().catch((error) => {
  console.error('Script failed:', error);
  rl.close();
  pool.end().then(() => {
    process.exit(1);
  });
});
