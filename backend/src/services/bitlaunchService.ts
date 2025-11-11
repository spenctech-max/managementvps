/**
 * Bitlaunch Service
 * Handles API communication with Bitlaunch for billing and performance metrics
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { pool } from '../config/database';
import { redisClient } from '../config/redis';
import { logger } from '../config/logger';
import crypto from 'crypto';

const BITLAUNCH_API_BASE = 'https://app.bitlaunch.io/api';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 16;

export interface BillingInfo {
  accountBalance: number;
  currencyCode: string;
  currentMonthUsage: number;
  currentMonthEstimatedCost: number;
  lastUpdated: string;
}

export interface PerformanceMetrics {
  serverCount: number;
  totalUptime: number;
  avgCpuUsage: number;
  avgMemoryUsage: number;
  avgNetworkTraffic: number;
  lastUpdated: string;
}

export interface BitlaunchStatus {
  isConnected: boolean;
  apiKeySet: boolean;
  lastSyncTime: string | null;
  lastError: string | null;
  syncInProgress: boolean;
}

interface CachedData {
  billing: BillingInfo | null;
  metrics: PerformanceMetrics | null;
  syncTime: number;
}

export class BitlaunchService {
  private apiClient: AxiosInstance | null = null;
  private cacheData: CachedData | null = null;
  private cacheTTL = 5 * 60 * 1000; // 5 minutes
  private cacheExpiry = 0;
  private syncInProgress = false;

  /**
   * Initialize the Bitlaunch API client with stored API key
   */
  async initializeClient(): Promise<boolean> {
    try {
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        logger.debug('Bitlaunch API key not configured');
        return false;
      }

      this.apiClient = axios.create({
        baseURL: BITLAUNCH_API_BASE,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      return true;
    } catch (error) {
      logger.error('Failed to initialize Bitlaunch client', { error });
      return false;
    }
  }

  /**
   * Store API key encrypted in database
   */
  async setApiKey(apiKey: string): Promise<void> {
    try {
      const encryptedKey = this.encryptApiKey(apiKey);

      await pool.query(
        `INSERT INTO bitlaunch_settings (setting_key, setting_value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (setting_key) DO UPDATE
         SET setting_value = $2, updated_at = NOW()`,
        ['api_key', encryptedKey]
      );

      // Reinitialize client with new key
      await this.initializeClient();
      logger.info('Bitlaunch API key updated successfully');
    } catch (error) {
      logger.error('Failed to store Bitlaunch API key', { error });
      throw error;
    }
  }

  /**
   * Retrieve and decrypt API key from database
   */
  private async getApiKey(): Promise<string | null> {
    try {
      const result = await pool.query(
        'SELECT setting_value FROM bitlaunch_settings WHERE setting_key = $1',
        ['api_key']
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.decryptApiKey(result.rows[0].setting_value);
    } catch (error) {
      logger.error('Failed to retrieve Bitlaunch API key', { error });
      return null;
    }
  }

  /**
   * Encrypt API key
   */
  private encryptApiKey(apiKey: string): string {
    try {
      const salt = crypto.randomBytes(SALT_LENGTH);
      const encryptionKey = crypto.pbkdf2Sync(process.env.ENCRYPTION_KEY || '', salt, 100000, 32, 'sha256');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, encryptionKey, iv);

      let encrypted = cipher.update(apiKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();
      return `${salt.toString('hex')}:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    } catch (error) {
      logger.error('Failed to encrypt API key', { error });
      throw error;
    }
  }

  /**
   * Decrypt API key
   */
  private decryptApiKey(encryptedData: string): string {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 4) {
        throw new Error('Invalid encrypted data format');
      }

      const [saltHex, ivHex, authTagHex, encrypted] = parts;
      const salt = Buffer.from(saltHex, 'hex');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const encryptionKey = crypto.pbkdf2Sync(process.env.ENCRYPTION_KEY || '', salt, 100000, 32, 'sha256');
      const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, encryptionKey, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt API key', { error });
      throw error;
    }
  }

  /**
   * Test Bitlaunch API connection
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const initialized = await this.initializeClient();
      if (!initialized) {
        return { success: false, message: 'API key not configured' };
      }

      if (!this.apiClient) {
        return { success: false, message: 'API client not initialized' };
      }

      // Test with a simple API call
      await this.apiClient.get('/user');
      return { success: true, message: 'Connection successful' };
    } catch (error) {
      const axiosError = error as AxiosError;
      let message = 'Connection failed';

      if (axiosError.response?.status === 401) {
        message = 'Invalid API key';
      } else if (axiosError.code === 'ECONNREFUSED') {
        message = 'Failed to connect to Bitlaunch API';
      }

      logger.warn('Bitlaunch connection test failed', { error: message });
      return { success: false, message };
    }
  }

  /**
   * Fetch billing information from Bitlaunch
   */
  async fetchBillingInfo(): Promise<BillingInfo> {
    try {
      // Check cache first
      if (this.isCacheValid() && this.cacheData?.billing) {
        return this.cacheData.billing;
      }

      // Check Redis cache
      const cachedBilling = await this.getCachedBillingFromRedis();
      if (cachedBilling) {
        return cachedBilling;
      }

      const initialized = await this.initializeClient();
      if (!initialized || !this.apiClient) {
        throw new Error('Bitlaunch API not configured');
      }

      const response = await this.apiClient.get('/user');
      const billingInfo: BillingInfo = {
        accountBalance: parseFloat(response.data.balance) || 0,
        currencyCode: response.data.currency || 'USD',
        currentMonthUsage: parseFloat(response.data.monthly_usage) || 0,
        currentMonthEstimatedCost: parseFloat(response.data.monthly_cost) || 0,
        lastUpdated: new Date().toISOString(),
      };

      // Cache in Redis
      await this.cacheBillingToRedis(billingInfo);

      // Update in-memory cache
      if (!this.cacheData) {
        this.cacheData = { billing: null, metrics: null, syncTime: 0 };
      }
      this.cacheData.billing = billingInfo;
      this.cacheData.syncTime = Date.now();

      return billingInfo;
    } catch (error) {
      logger.error('Failed to fetch Bitlaunch billing info', { error });
      throw error;
    }
  }

  /**
   * Fetch performance metrics from Bitlaunch
   */
  async fetchPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      // Check cache first
      if (this.isCacheValid() && this.cacheData?.metrics) {
        return this.cacheData.metrics;
      }

      // Check Redis cache
      const cachedMetrics = await this.getCachedMetricsFromRedis();
      if (cachedMetrics) {
        return cachedMetrics;
      }

      const initialized = await this.initializeClient();
      if (!initialized || !this.apiClient) {
        throw new Error('Bitlaunch API not configured');
      }

      const serversResponse = await this.apiClient.get('/servers');
      const servers = serversResponse.data.data || [];

      // Calculate aggregate metrics
      let totalUptime = 0;
      let totalCpuUsage = 0;
      let totalMemoryUsage = 0;
      let totalNetworkTraffic = 0;
      let metricCount = 0;

      for (const server of servers) {
        if (server.uptime) totalUptime += parseFloat(server.uptime);
        if (server.cpu_usage) totalCpuUsage += parseFloat(server.cpu_usage);
        if (server.memory_usage) totalMemoryUsage += parseFloat(server.memory_usage);
        if (server.bandwidth_usage) totalNetworkTraffic += parseFloat(server.bandwidth_usage);
        metricCount++;
      }

      const metricsInfo: PerformanceMetrics = {
        serverCount: servers.length,
        totalUptime: metricCount > 0 ? totalUptime / metricCount : 0,
        avgCpuUsage: metricCount > 0 ? totalCpuUsage / metricCount : 0,
        avgMemoryUsage: metricCount > 0 ? totalMemoryUsage / metricCount : 0,
        avgNetworkTraffic: totalNetworkTraffic,
        lastUpdated: new Date().toISOString(),
      };

      // Cache in Redis
      await this.cacheMetricsToRedis(metricsInfo);

      // Update in-memory cache
      if (!this.cacheData) {
        this.cacheData = { billing: null, metrics: null, syncTime: 0 };
      }
      this.cacheData.metrics = metricsInfo;
      this.cacheData.syncTime = Date.now();

      return metricsInfo;
    } catch (error) {
      logger.error('Failed to fetch Bitlaunch performance metrics', { error });
      throw error;
    }
  }

  /**
   * Sync all Bitlaunch data
   */
  async syncAllData(): Promise<{ billing: BillingInfo; metrics: PerformanceMetrics } | null> {
    try {
      if (this.syncInProgress) {
        logger.debug('Bitlaunch sync already in progress');
        return null;
      }

      this.syncInProgress = true;

      const [billing, metrics] = await Promise.all([
        this.fetchBillingInfo(),
        this.fetchPerformanceMetrics(),
      ]);

      // Store sync time in database
      await pool.query(
        `INSERT INTO bitlaunch_settings (setting_key, setting_value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (setting_key) DO UPDATE
         SET setting_value = $2, updated_at = NOW()`,
        ['last_sync', new Date().toISOString()]
      );

      logger.info('Bitlaunch data synced successfully');
      return { billing, metrics };
    } catch (error) {
      logger.error('Failed to sync Bitlaunch data', { error });

      // Store error message
      await pool.query(
        `INSERT INTO bitlaunch_settings (setting_key, setting_value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (setting_key) DO UPDATE
         SET setting_value = $2, updated_at = NOW()`,
        ['last_error', (error as Error).message]
      );

      return null;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Get connection status
   */
  async getStatus(): Promise<BitlaunchStatus> {
    try {
      const result = await pool.query(
        `SELECT setting_key, setting_value FROM bitlaunch_settings
         WHERE setting_key IN ('api_key', 'last_sync', 'last_error')`
      );

      const settings = result.rows.reduce(
        (acc, row) => {
          acc[row.setting_key] = row.setting_value;
          return acc;
        },
        {} as Record<string, string>
      );

      return {
        isConnected: !!settings.api_key && !settings.last_error,
        apiKeySet: !!settings.api_key,
        lastSyncTime: settings.last_sync || null,
        lastError: settings.last_error || null,
        syncInProgress: this.syncInProgress,
      };
    } catch (error) {
      logger.error('Failed to get Bitlaunch status', { error });
      return {
        isConnected: false,
        apiKeySet: false,
        lastSyncTime: null,
        lastError: (error as Error).message,
        syncInProgress: false,
      };
    }
  }

  /**
   * Clear API key
   */
  async clearApiKey(): Promise<void> {
    try {
      await pool.query('DELETE FROM bitlaunch_settings WHERE setting_key = $1', ['api_key']);
      this.apiClient = null;
      logger.info('Bitlaunch API key cleared');
    } catch (error) {
      logger.error('Failed to clear Bitlaunch API key', { error });
      throw error;
    }
  }

  /**
   * Fetch list of servers from BitLaunch
   */
  async fetchServers(): Promise<any[]> {
    try {
      const initialized = await this.initializeClient();
      if (!initialized || !this.apiClient) {
        throw new Error('Bitlaunch API not configured');
      }

      const response = await this.apiClient.get('/servers');

      // API returns array directly, not nested in data property
      const servers = Array.isArray(response.data) ? response.data : [];

      return servers.map((server: any) => ({
        id: server.id,
        name: server.name,
        ipv4: server.ipv4,
        ipv6: server.ipv6,
        status: server.status,
        size: server.sizeDescription || server.size,
        region: server.region,
        image: server.imageDescription || server.image,
        diskGB: server.diskGB,
        rate: server.rate,
        created: server.created,
        bandwidthUsed: server.bandwidthUsed,
        backupsEnabled: server.backupsEnabled,
      }));
    } catch (error) {
      logger.error('Failed to fetch Bitlaunch servers', { error });
      throw error;
    }
  }

  /**
   * Check if in-memory cache is still valid
   */
  private isCacheValid(): boolean {
    return this.cacheData !== null && Date.now() - this.cacheData.syncTime < this.cacheTTL;
  }

  /**
   * Cache billing info in Redis
   */
  private async cacheBillingToRedis(billing: BillingInfo): Promise<void> {
    try {
      await redisClient.setEx(
        'bitlaunch:billing',
        Math.ceil(this.cacheTTL / 1000),
        JSON.stringify(billing)
      );
    } catch (error) {
      logger.error('Failed to cache billing info in Redis', { error });
    }
  }

  /**
   * Get cached billing info from Redis
   */
  private async getCachedBillingFromRedis(): Promise<BillingInfo | null> {
    try {
      const cached = await redisClient.get('bitlaunch:billing');
      if (cached) {
        return JSON.parse(cached) as BillingInfo;
      }
    } catch (error) {
      logger.error('Failed to get cached billing info from Redis', { error });
    }
    return null;
  }

  /**
   * Cache metrics in Redis
   */
  private async cacheMetricsToRedis(metrics: PerformanceMetrics): Promise<void> {
    try {
      await redisClient.setEx(
        'bitlaunch:metrics',
        Math.ceil(this.cacheTTL / 1000),
        JSON.stringify(metrics)
      );
    } catch (error) {
      logger.error('Failed to cache metrics in Redis', { error });
    }
  }

  /**
   * Get cached metrics from Redis
   */
  private async getCachedMetricsFromRedis(): Promise<PerformanceMetrics | null> {
    try {
      const cached = await redisClient.get('bitlaunch:metrics');
      if (cached) {
        return JSON.parse(cached) as PerformanceMetrics;
      }
    } catch (error) {
      logger.error('Failed to get cached metrics from Redis', { error });
    }
    return null;
  }
}

// Singleton instance
export const bitlaunchService = new BitlaunchService();
