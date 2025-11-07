const { createClient } = require('redis');
const crypto = require('crypto');
const config = require('../../config/default');
const logger = require('../utils/logger');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      this.client = createClient({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password || undefined,
      });

      this.client.on('error', (err) => {
        logger.error('Redis connection error', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Connected to Redis');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to connect to Redis', error);
      throw error;
    }
  }

  async disconnect() {
    if (this.client && this.isConnected) {
      await this.client.disconnect();
      this.isConnected = false;
      logger.info('Disconnected from Redis');
    }
  }

  /**
   * Generate cache key based on request body
   * @param {Object} requestBody - The request body
   * @returns {string} - Cache key
   */
  generateKey(requestBody) {
    // Normalize the request to create consistent keys
    const normalized = {
      model: requestBody.model,
      messages: requestBody.messages?.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      temperature: requestBody.temperature || 1,
      max_tokens: requestBody.max_tokens,
      top_p: requestBody.top_p,
      frequency_penalty: requestBody.frequency_penalty,
      presence_penalty: requestBody.presence_penalty
    };

    // Create hash of normalized request
    const hash = crypto.createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');

    return `cache:${requestBody.model}:${hash}`;
  }

  /**
   * Get cached response
   * @param {string} key - Cache key
   * @returns {Object|null} - Cached response or null
   */
  async get(key) {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping cache get');
      return null;
    }

    try {
      const cached = await this.client.get(key);
      if (cached) {
        logger.debug('Cache hit', { key });
        return JSON.parse(cached);
      }
      return null;
    } catch (error) {
      logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  /**
   * Set cache response
   * @param {string} key - Cache key
   * @param {Object} value - Response to cache
   * @param {number} ttl - Time to live in seconds
   */
  async set(key, value, ttl = config.redis.ttl.default) {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping cache set');
      return;
    }

    try {
      await this.client.setEx(key, ttl, JSON.stringify(value));
      logger.debug('Cache set', { key, ttl });
    } catch (error) {
      logger.error('Cache set error', { key, error: error.message });
    }
  }

  /**
   * Delete cache entry
   * @param {string} key - Cache key
   */
  async delete(key) {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping cache delete');
      return;
    }

    try {
      await this.client.del(key);
      logger.debug('Cache deleted', { key });
    } catch (error) {
      logger.error('Cache delete error', { key, error: error.message });
    }
  }

  /**
   * Clear all cache entries with a pattern
   * @param {string} pattern - Pattern to match (e.g., "cache:*")
   */
  async clearPattern(pattern) {
    if (!this.isConnected) {
      logger.warn('Redis not connected, skipping cache clear');
      return;
    }

    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        logger.info(`Cleared ${keys.length} cache entries with pattern: ${pattern}`);
      }
    } catch (error) {
      logger.error('Cache clear error', { pattern, error: error.message });
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} - Cache statistics
   */
  async getStats() {
    if (!this.isConnected) {
      return { connected: false };
    }

    try {
      const info = await this.client.info();
      const cacheKeys = await this.client.keys('cache:*');

      return {
        connected: true,
        totalKeys: cacheKeys.length,
        info: info.split('\n').reduce((acc, line) => {
          const [key, value] = line.split(':');
          if (key && value) {
            acc[key] = value;
          }
          return acc;
        }, {})
      };
    } catch (error) {
      logger.error('Cache stats error', error);
      return { connected: false, error: error.message };
    }
  }
}

// Create singleton instance
const cacheService = new CacheService();

module.exports = cacheService;
