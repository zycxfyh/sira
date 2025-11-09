const crypto = require("node:crypto");
const db = require("../../db");

// AI Cache Policy
// Intelligent caching for AI requests based on content and parameters
module.exports = (params, config) => {
  const logger = config.logger || console;

  // Configuration validation
  const validationErrors = validateCacheConfiguration(params);
  if (validationErrors.length > 0) {
    const error = new Error(
      `AI Cache configuration validation failed: ${validationErrors.join(", ")}`,
    );
    logger.error(error.message);
    throw error;
  }

  // Use Redis for distributed caching (supports cluster deployments)
  const redisPrefix = "ai-cache:";

  // Cache configuration with defaults
  const cacheConfig = Object.assign(
    {
      ttl: 300, // 5 minutes default
      maxSize: 10000, // Maximum cache entries
      compressionEnabled: true,
      varyByHeaders: [],
      strategy: "lru", // lru, lfu, ttl
      cleanupInterval: 60000, // Cleanup every minute
    },
    params,
  );

  async function aiCache(req, res, next) {
    // Redis handles TTL automatically, no manual cleanup needed

    // Only cache GET and POST requests
    if (!["GET", "POST"].includes(req.method)) {
      return next();
    }

    // Generate cache key
    const cacheKey = generateCacheKey(req);

    try {
      // Check cache
      const cachedResponse = await getCachedResponse(cacheKey);
      if (cachedResponse) {
        // Return cached response
        res.set({
          "x-cache-status": "HIT",
          "x-cache-key": cacheKey,
          "x-cached-at": cachedResponse.cachedAt,
        });

        logger.debug("Cache hit", {
          cacheKey,
          age: Date.now() - cachedResponse.cachedAt,
        });
        return res.status(cachedResponse.statusCode).json(cachedResponse.body);
      }
    } catch (error) {
      logger.warn("Cache check failed, proceeding without cache", {
        error: error.message,
      });
    }

    // Cache miss - intercept response
    res.set("x-cache-status", "MISS");

    const originalJson = res.json;
    const originalStatus = res.status;

    let _responseBody;
    let statusCode = 200;

    // Override res.status to capture status code
    res.status = function (code) {
      statusCode = code;
      return originalStatus.call(this, code);
    };

    // Override res.json to capture and cache response
    res.json = function (body) {
      // Only cache successful responses
      if (statusCode >= 200 && statusCode < 300) {
        // Cache asynchronously without blocking response
        setCachedResponse(cacheKey, {
          body,
          statusCode,
          headers: res.getHeaders(),
          cachedAt: Date.now(),
        }).catch((error) => {
          logger.warn("Failed to cache response", {
            cacheKey,
            error: error.message,
          });
        });
      }

      // Call original json method
      return originalJson.call(this, body);
    };

    next();
  }

  // Generate cache key based on request content
  function generateCacheKey(req) {
    try {
      const keyComponents = {
        method: req.method,
        url: req.url,
        body: req.body,
        headers: {},
      };

      // Include relevant headers for cache variation
      cacheConfig.varyByHeaders.forEach((header) => {
        if (req.headers[header]) {
          keyComponents.headers[header] = req.headers[header];
        }
      });

      // For AI requests, normalize the content for better cache hits
      if (req.body && typeof req.body === "object") {
        keyComponents.body = normalizeRequestBody(req.body);
      }

      // Generate hash
      const keyString = JSON.stringify(
        keyComponents,
        Object.keys(keyComponents).sort(),
      );
      const hash = crypto.createHash("sha256").update(keyString).digest("hex");

      return `ai-cache:${hash.substring(0, 16)}`; // Use first 16 chars for readability
    } catch (error) {
      logger.warn("Failed to generate cache key, using fallback", error);
      // Fallback cache key
      return `ai-cache:fallback:${Date.now()}:${Math.random()}`;
    }
  }

  // Normalize request body for consistent caching
  function normalizeRequestBody(body) {
    if (!body || typeof body !== "object") {
      return body;
    }

    const normalized = { ...body };

    // For chat completions, normalize messages while preserving content
    if (normalized.messages && Array.isArray(normalized.messages)) {
      normalized.messages = normalized.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        // Include other properties that affect the response
        name: msg.name,
        function_call: msg.function_call,
      }));
    }

    // Sort object keys for consistency
    return sortObjectKeys(normalized);
  }

  // Sort object keys recursively for consistent hashing
  function sortObjectKeys(obj) {
    if (obj === null || typeof obj !== "object" || obj instanceof Date) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sortObjectKeys);
    }

    const sorted = {};
    Object.keys(obj)
      .sort()
      .forEach((key) => {
        sorted[key] = sortObjectKeys(obj[key]);
      });

    return sorted;
  }

  // Get cached response from Redis
  async function getCachedResponse(key) {
    try {
      const redisKey = redisPrefix + key;
      const cachedData = await db.get(redisKey);

      if (!cachedData) {
        return null;
      }

      const cached = JSON.parse(cachedData);
      logger.debug("Cache hit", { key, age: Date.now() - cached.cachedAt });
      return cached;
    } catch (error) {
      logger.warn("Failed to get cached response from Redis", {
        key,
        error: error.message,
      });
      return null;
    }
  }

  // Set cached response in Redis
  async function setCachedResponse(key, response) {
    try {
      const redisKey = redisPrefix + key;
      const serializedResponse = JSON.stringify(response);

      // Set with TTL and check size limit
      await db.setex(redisKey, cacheConfig.ttl, serializedResponse);

      // Check cache size limit (approximate)
      const cacheSize = await db.dbsize();
      if (cacheSize > cacheConfig.maxSize) {
        // Remove some old entries (Redis LRU will handle this, but we can help)
        logger.debug(
          "Cache size limit reached, Redis LRU will handle cleanup",
          {
            size: cacheSize,
            maxSize: cacheConfig.maxSize,
          },
        );
      }

      logger.debug("Response cached in Redis", { key });
    } catch (error) {
      logger.warn("Failed to cache response in Redis", {
        key,
        error: error.message,
      });
    }
  }

  return aiCache;
};

// Configuration validation function
function validateCacheConfiguration(params) {
  const errors = [];

  if (!params) {
    errors.push("Configuration object is required");
    return errors;
  }

  // Validate TTL
  if (params.ttl !== undefined) {
    if (
      typeof params.ttl !== "number" ||
      params.ttl < 10 ||
      params.ttl > 86400
    ) {
      errors.push("ttl must be a number between 10 and 86400 seconds");
    }
  }

  // Validate maxSize
  if (params.maxSize !== undefined) {
    if (
      typeof params.maxSize !== "number" ||
      params.maxSize < 100 ||
      params.maxSize > 100000
    ) {
      errors.push("maxSize must be a number between 100 and 100000 entries");
    }
  }

  // Validate strategy
  if (params.strategy !== undefined) {
    const validStrategies = ["lru", "lfu", "ttl", "random"];
    if (!validStrategies.includes(params.strategy)) {
      errors.push(`strategy must be one of: ${validStrategies.join(", ")}`);
    }
  }

  // Validate cleanup interval
  if (params.cleanupInterval !== undefined) {
    if (
      typeof params.cleanupInterval !== "number" ||
      params.cleanupInterval < 10000 ||
      params.cleanupInterval > 3600000
    ) {
      errors.push(
        "cleanupInterval must be a number between 10000 and 3600000 milliseconds",
      );
    }
  }

  // Validate varyByHeaders
  if (params.varyByHeaders !== undefined) {
    if (!Array.isArray(params.varyByHeaders)) {
      errors.push("varyByHeaders must be an array of header names");
    } else {
      params.varyByHeaders.forEach((header) => {
        if (typeof header !== "string") {
          errors.push("varyByHeaders must contain only string values");
        }
      });
    }
  }

  return errors;
}
