/**
 * SSH Key Rotation Service
 * Handles SSH key generation, rotation, and management
 */

import { Client as SSHClient } from 'ssh2';
import { pool } from '../config/database';
import { logger } from '../config/logger';
import AuditLogger, { AuditAction, ResourceType } from './auditLogger';
import { encrypt } from '../utils/crypto';
import * as crypto from 'crypto';

/**
 * SSH Key Rotation Service
 */
export class SSHKeyRotationService {
  /**
   * Generate a new SSH key pair
   */
  static generateKeyPair(): { privateKey: string; publicKey: string } {
    const { generateKeyPairSync } = crypto;

    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 4096,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    return { privateKey, publicKey };
  }

  /**
   * Rotate SSH keys for a server
   */
  static async rotateKeys(
    serverId: string,
    userId: string,
    gracePeriodHours: number = 24
  ): Promise<{
    success: boolean;
    newPublicKey: string;
    message: string;
  }> {
    try {
      // Get current server details
      const serverResult = await pool.query(
        'SELECT * FROM servers WHERE id = $1',
        [serverId]
      );

      if (serverResult.rows.length === 0) {
        throw new Error('Server not found');
      }

      const server = serverResult.rows[0];

      // Only rotate if using key-based authentication
      if (server.auth_method !== 'key') {
        return {
          success: false,
          newPublicKey: '',
          message: 'Server does not use key-based authentication',
        };
      }

      // Generate new key pair
      const { privateKey, publicKey } = this.generateKeyPair();

      // Encrypt the new private key
      const encryptedPrivateKey = encrypt(privateKey);

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + gracePeriodHours);

      // Update database - move current key to previous, set new key
      await pool.query(
        `UPDATE servers
        SET
          previous_private_key = private_key,
          previous_public_key = public_key,
          private_key = $1,
          public_key = $2,
          key_rotation_date = NOW(),
          key_expires_at = $3,
          key_rotation_required = false,
          updated_at = NOW()
        WHERE id = $4`,
        [encryptedPrivateKey, publicKey, expiresAt, serverId]
      );

      // Log audit event
      await AuditLogger.log({
        userId,
        action: AuditAction.SSH_KEY_ROTATE,
        resourceType: ResourceType.SSH_KEY,
        resourceId: serverId,
        details: {
          serverName: server.name,
          gracePeriodHours,
          expiresAt: expiresAt.toISOString(),
        },
        status: 'success',
      });

      logger.info('SSH keys rotated successfully', {
        serverId,
        userId,
        gracePeriodHours,
      });

      return {
        success: true,
        newPublicKey: publicKey,
        message: `Keys rotated successfully. Previous keys valid until ${expiresAt.toISOString()}`,
      };
    } catch (error) {
      logger.error('SSH key rotation failed', {
        serverId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      await AuditLogger.log({
        userId,
        action: AuditAction.SSH_KEY_ROTATE,
        resourceType: ResourceType.SSH_KEY,
        resourceId: serverId,
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Cleanup expired previous keys
   */
  static async cleanupExpiredKeys(): Promise<number> {
    try {
      const result = await pool.query(
        `UPDATE servers
        SET
          previous_private_key = NULL,
          previous_public_key = NULL
        WHERE
          key_expires_at IS NOT NULL
          AND key_expires_at < NOW()
          AND previous_private_key IS NOT NULL`,
        []
      );

      const count = result.rowCount || 0;

      if (count > 0) {
        logger.info(`Cleaned up ${count} expired previous SSH keys`);
      }

      return count;
    } catch (error) {
      logger.error('Failed to cleanup expired keys', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return 0;
    }
  }

  /**
   * Get servers that need key rotation
   */
  static async getServersNeedingRotation(): Promise<any[]> {
    const result = await pool.query(
      `SELECT
        id,
        name,
        hostname,
        key_rotation_date,
        key_expires_at,
        key_rotation_required
      FROM servers
      WHERE
        auth_method = 'key'
        AND (
          key_rotation_required = true
          OR key_rotation_date IS NULL
          OR key_rotation_date < NOW() - INTERVAL '90 days'
        )
      ORDER BY key_rotation_date ASC NULLS FIRST`
    );

    return result.rows;
  }

  /**
   * Mark server as requiring key rotation
   */
  static async markForRotation(serverId: string, userId: string): Promise<void> {
    await pool.query(
      'UPDATE servers SET key_rotation_required = true WHERE id = $1',
      [serverId]
    );

    await AuditLogger.log({
      userId,
      action: AuditAction.SSH_KEY_ROTATE,
      resourceType: ResourceType.SERVER,
      resourceId: serverId,
      details: {
        action: 'marked_for_rotation',
      },
    });
  }
}

export default SSHKeyRotationService;
