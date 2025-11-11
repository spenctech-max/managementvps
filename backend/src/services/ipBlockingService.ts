/**
 * IP Blocking Service
 *
 * Features:
 * - Auto-block IPs after violation threshold
 * - Manual block/unblock via API
 * - IP whitelist support
 * - Configurable block duration
 * - Redis-backed storage
 * - Block reason tracking
 */

import { redisClient } from '../config/redis';
import { logger } from '../config/logger';

/**
 * IP block information
 */
export interface IpBlockInfo {
  ip: string;
  reason: string;
  blockedAt: Date;
  expiresAt: Date | null;
  blockedBy?: string; // User ID who blocked (for manual blocks)
}

/**
 * IP whitelist entry
 */
export interface IpWhitelistEntry {
  ip: string;
  reason: string;
  addedAt: Date;
  addedBy: string; // User ID who added
}

/**
 * IP Blocking Service
 */
class IpBlockingService {
  private readonly BLOCK_KEY_PREFIX = 'ip:blocked';
  private readonly WHITELIST_KEY_PREFIX = 'ip:whitelist';
  private readonly BLOCK_INFO_KEY_PREFIX = 'ip:block:info';
  private readonly DEFAULT_BLOCK_DURATION = 3600; // 1 hour in seconds

  /**
   * Check if an IP is blocked
   */
  async isIpBlocked(ip: string): Promise<boolean> {
    try {
      const key = `${this.BLOCK_KEY_PREFIX}:${ip}`;
      const exists = await redisClient.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Error checking IP block status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip,
      });
      // On error, don't block (fail open)
      return false;
    }
  }

  /**
   * Check if an IP is whitelisted
   */
  async isIpWhitelisted(ip: string): Promise<boolean> {
    try {
      const key = `${this.WHITELIST_KEY_PREFIX}:${ip}`;
      const exists = await redisClient.exists(key);
      return exists === 1;
    } catch (error) {
      logger.error('Error checking IP whitelist status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip,
      });
      return false;
    }
  }

  /**
   * Block an IP address
   * @param ip IP address to block
   * @param reason Reason for blocking
   * @param duration Duration in seconds (0 for permanent)
   * @param blockedBy User ID who initiated the block (optional)
   */
  async blockIp(
    ip: string,
    reason: string,
    duration: number = this.DEFAULT_BLOCK_DURATION,
    blockedBy?: string
  ): Promise<void> {
    try {
      const blockKey = `${this.BLOCK_KEY_PREFIX}:${ip}`;
      const infoKey = `${this.BLOCK_INFO_KEY_PREFIX}:${ip}`;

      const blockInfo: IpBlockInfo = {
        ip,
        reason,
        blockedAt: new Date(),
        expiresAt: duration > 0 ? new Date(Date.now() + duration * 1000) : null,
        blockedBy,
      };

      // Set block marker
      if (duration > 0) {
        await redisClient.setEx(blockKey, duration, '1');
        await redisClient.setEx(infoKey, duration, JSON.stringify(blockInfo));
      } else {
        // Permanent block
        await redisClient.set(blockKey, '1');
        await redisClient.set(infoKey, JSON.stringify(blockInfo));
      }

      logger.warn('IP blocked', {
        ip,
        reason,
        duration: duration > 0 ? `${duration}s` : 'permanent',
        blockedBy,
      });
    } catch (error) {
      logger.error('Error blocking IP', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip,
        reason,
      });
      throw error;
    }
  }

  /**
   * Unblock an IP address
   * @param ip IP address to unblock
   */
  async unblockIp(ip: string): Promise<boolean> {
    try {
      const blockKey = `${this.BLOCK_KEY_PREFIX}:${ip}`;
      const infoKey = `${this.BLOCK_INFO_KEY_PREFIX}:${ip}`;

      const deleted = await redisClient.del([blockKey, infoKey]);

      if (deleted > 0) {
        logger.info('IP unblocked', { ip });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error unblocking IP', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip,
      });
      throw error;
    }
  }

  /**
   * Get block information for an IP
   */
  async getBlockInfo(ip: string): Promise<IpBlockInfo | null> {
    try {
      const infoKey = `${this.BLOCK_INFO_KEY_PREFIX}:${ip}`;
      const info = await redisClient.get(infoKey);

      if (!info) {
        return null;
      }

      return JSON.parse(info);
    } catch (error) {
      logger.error('Error getting IP block info', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip,
      });
      return null;
    }
  }

  /**
   * Get all blocked IPs
   */
  async getBlockedIps(): Promise<IpBlockInfo[]> {
    try {
      const pattern = `${this.BLOCK_KEY_PREFIX}:*`;
      const keys = await redisClient.keys(pattern);

      const blockedIps: IpBlockInfo[] = [];

      for (const key of keys) {
        const ip = key.replace(`${this.BLOCK_KEY_PREFIX}:`, '');
        const info = await this.getBlockInfo(ip);

        if (info) {
          // Get TTL to update expiration if needed
          const ttl = await redisClient.ttl(key);
          if (ttl > 0) {
            info.expiresAt = new Date(Date.now() + ttl * 1000);
          }

          blockedIps.push(info);
        } else {
          // If no info available, create basic info
          blockedIps.push({
            ip,
            reason: 'Unknown',
            blockedAt: new Date(),
            expiresAt: null,
          });
        }
      }

      // Sort by blocked date (most recent first)
      blockedIps.sort((a, b) => b.blockedAt.getTime() - a.blockedAt.getTime());

      return blockedIps;
    } catch (error) {
      logger.error('Error getting blocked IPs', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Add an IP to whitelist
   * @param ip IP address to whitelist
   * @param reason Reason for whitelisting
   * @param addedBy User ID who added to whitelist
   */
  async whitelistIp(ip: string, reason: string, addedBy: string): Promise<void> {
    try {
      const key = `${this.WHITELIST_KEY_PREFIX}:${ip}`;

      const entry: IpWhitelistEntry = {
        ip,
        reason,
        addedAt: new Date(),
        addedBy,
      };

      // Whitelist entries are permanent
      await redisClient.set(key, JSON.stringify(entry));

      // Remove from blocked list if present
      await this.unblockIp(ip);

      logger.info('IP whitelisted', { ip, reason, addedBy });
    } catch (error) {
      logger.error('Error whitelisting IP', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip,
        reason,
      });
      throw error;
    }
  }

  /**
   * Remove an IP from whitelist
   * @param ip IP address to remove from whitelist
   */
  async removeFromWhitelist(ip: string): Promise<boolean> {
    try {
      const key = `${this.WHITELIST_KEY_PREFIX}:${ip}`;
      const deleted = await redisClient.del(key);

      if (deleted > 0) {
        logger.info('IP removed from whitelist', { ip });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error removing IP from whitelist', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip,
      });
      throw error;
    }
  }

  /**
   * Get whitelist information for an IP
   */
  async getWhitelistInfo(ip: string): Promise<IpWhitelistEntry | null> {
    try {
      const key = `${this.WHITELIST_KEY_PREFIX}:${ip}`;
      const info = await redisClient.get(key);

      if (!info) {
        return null;
      }

      return JSON.parse(info);
    } catch (error) {
      logger.error('Error getting IP whitelist info', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip,
      });
      return null;
    }
  }

  /**
   * Get all whitelisted IPs
   */
  async getWhitelistedIps(): Promise<IpWhitelistEntry[]> {
    try {
      const pattern = `${this.WHITELIST_KEY_PREFIX}:*`;
      const keys = await redisClient.keys(pattern);

      const whitelistedIps: IpWhitelistEntry[] = [];

      for (const key of keys) {
        const ip = key.replace(`${this.WHITELIST_KEY_PREFIX}:`, '');
        const info = await this.getWhitelistInfo(ip);

        if (info) {
          whitelistedIps.push(info);
        }
      }

      // Sort by added date (most recent first)
      whitelistedIps.sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime());

      return whitelistedIps;
    } catch (error) {
      logger.error('Error getting whitelisted IPs', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Clear all blocks (emergency use only)
   */
  async clearAllBlocks(): Promise<number> {
    try {
      const blockPattern = `${this.BLOCK_KEY_PREFIX}:*`;
      const infoPattern = `${this.BLOCK_INFO_KEY_PREFIX}:*`;

      const blockKeys = await redisClient.keys(blockPattern);
      const infoKeys = await redisClient.keys(infoPattern);

      const allKeys = [...blockKeys, ...infoKeys];

      if (allKeys.length === 0) {
        return 0;
      }

      const deleted = await redisClient.del(allKeys);

      logger.warn('All IP blocks cleared', { count: deleted });

      return deleted;
    } catch (error) {
      logger.error('Error clearing all blocks', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Get IP blocking statistics
   */
  async getStats(): Promise<{
    totalBlocked: number;
    totalWhitelisted: number;
    permanentBlocks: number;
    temporaryBlocks: number;
  }> {
    try {
      const blockedIps = await this.getBlockedIps();
      const whitelistedIps = await this.getWhitelistedIps();

      const permanentBlocks = blockedIps.filter(ip => ip.expiresAt === null).length;
      const temporaryBlocks = blockedIps.filter(ip => ip.expiresAt !== null).length;

      return {
        totalBlocked: blockedIps.length,
        totalWhitelisted: whitelistedIps.length,
        permanentBlocks,
        temporaryBlocks,
      };
    } catch (error) {
      logger.error('Error getting IP blocking stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

// Export singleton instance
export const ipBlockingService = new IpBlockingService();
