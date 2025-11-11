import crypto from 'crypto';

/**
 * Generate Encryption Key
 *
 * This script generates a random 32-byte encryption key in hexadecimal format.
 * The key is suitable for use with AES-256 encryption or other cryptographic purposes.
 *
 * Usage: npm run generate:key
 */

function generateEncryptionKey(): string {
  const key = crypto.randomBytes(32).toString('hex');
  return key;
}

function main(): void {
  try {
    const encryptionKey = generateEncryptionKey();

    console.log('========================================');
    console.log('Encryption Key Generated');
    console.log('========================================');
    console.log('');
    console.log('Copy the key below and add it to your .env file:');
    console.log('');
    console.log('ENCRYPTION_KEY=' + encryptionKey);
    console.log('');
    console.log('========================================');
    console.log('');
    console.log('Note: Keep this key secure and never commit it to version control.');
  } catch (error) {
    console.error('Error generating encryption key:', error);
    process.exit(1);
  }
}

main();
