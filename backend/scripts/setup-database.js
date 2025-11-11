#!/usr/bin/env node

/**
 * Database Setup Script
 *
 * This script:
 * 1. Connects to PostgreSQL using credentials from .env
 * 2. Creates the database if it doesn't exist
 * 3. Runs the initial schema migration
 * 4. Tests the connection
 * 5. Prints a success message
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Configuration from environment variables
const dbConfig = {
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
};

const dbName = process.env.DB_NAME || 'medicine_man';
const migrationFilePath = path.join(__dirname, '..', 'migrations', '001_initial_schema.sql');

/**
 * Create database if it doesn't exist
 */
async function createDatabase() {
  const client = new Client(dbConfig);

  try {
    console.log('Connecting to PostgreSQL server...');
    await client.connect();
    console.log('✓ Connected to PostgreSQL server');

    // Check if database exists
    const result = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (result.rows.length > 0) {
      console.log(`✓ Database "${dbName}" already exists`);
    } else {
      console.log(`Creating database "${dbName}"...`);
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`✓ Database "${dbName}" created successfully`);
    }

    await client.end();
  } catch (error) {
    console.error('Error creating database:', error.message);
    throw error;
  }
}

/**
 * Run initial schema migration
 */
async function runMigration() {
  // Create connection to the target database
  const client = new Client({
    ...dbConfig,
    database: dbName,
  });

  try {
    console.log('Reading migration file...');

    if (!fs.existsSync(migrationFilePath)) {
      throw new Error(`Migration file not found: ${migrationFilePath}`);
    }

    const migrationSQL = fs.readFileSync(migrationFilePath, 'utf-8');
    console.log('✓ Migration file loaded');

    console.log('Connecting to database...');
    await client.connect();
    console.log(`✓ Connected to database "${dbName}"`);

    console.log('Running migration...');
    await client.query(migrationSQL);
    console.log('✓ Schema migration completed successfully');

    await client.end();
  } catch (error) {
    console.error('Error running migration:', error.message);
    throw error;
  }
}

/**
 * Test the database connection
 */
async function testConnection() {
  const client = new Client({
    ...dbConfig,
    database: dbName,
  });

  try {
    console.log('Testing database connection...');
    await client.connect();

    const result = await client.query('SELECT NOW()');
    const timestamp = result.rows[0].now;
    console.log(`✓ Connection test successful - Server time: ${timestamp}`);

    // Query table count
    const tableResult = await client.query(
      `SELECT COUNT(*) FROM information_schema.tables
       WHERE table_schema = 'public'`
    );
    const tableCount = tableResult.rows[0].count;
    console.log(`✓ Database contains ${tableCount} tables`);

    await client.end();
  } catch (error) {
    console.error('Error testing connection:', error.message);
    throw error;
  }
}

/**
 * Main setup function
 */
async function setupDatabase() {
  console.log('================================');
  console.log('Medicine Man Database Setup');
  console.log('================================\n');

  try {
    // Validate environment variables
    if (!process.env.DB_PASSWORD) {
      throw new Error('DB_PASSWORD environment variable is not set. Please check your .env file.');
    }

    // Step 1: Create database
    await createDatabase();
    console.log();

    // Step 2: Run migration
    await runMigration();
    console.log();

    // Step 3: Test connection
    await testConnection();
    console.log();

    // Success message
    console.log('================================');
    console.log('✓ Database setup completed successfully!');
    console.log('================================');
    console.log('\nNext steps:');
    console.log('1. Review the database schema in PostgreSQL');
    console.log('2. Create an initial admin user');
    console.log('3. Start the backend server with: npm run dev');
    process.exit(0);
  } catch (error) {
    console.error('\n================================');
    console.error('✗ Database setup failed');
    console.error('================================');
    console.error(`Error: ${error.message}`);
    console.error('\nTroubleshooting:');
    console.error('1. Ensure PostgreSQL is running');
    console.error('2. Check that .env file exists and contains correct credentials');
    console.error('3. Verify DB_USER has CREATE DATABASE permissions');
    console.error('4. Check database host and port settings');
    process.exit(1);
  }
}

// Run setup
setupDatabase();
