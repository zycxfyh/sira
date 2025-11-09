// AI Rate Limit Policy
// Advanced rate limiting based on AI model token consumption and user quotas
// Redis-backed implementation for cluster compatibility

const db = require("../../db");

// Default rate limit handler
function defaultHandler(_req, res, windowMs = 900000) {
  res.status(429).json({
    error: "Too Many Requests",
    message: "Rate limit exceeded. Please try again later.",
    retryAfter: Math.ceil(windowMs / 1000),
  });
}

// Default limit reached handler
function defaultOnLimitReached(key, req) {
  const logger = req.logger || console;
  logger.warn(`Rate limit exceeded for key: ${key}`, {
    ip: req.ip,
    userId: req.user?.id,
    userAgent: req.get("User-Agent"),
    url: req.url,
  });
}

module.exports = (params, config) => {
  const logger = config.logger || console;

  // Rate limit configuration
  const rateConfig = {
    windowMs: params.windowMs || 15 * 60 * 1000, // 15 minutes
    maxRequests: params.maxRequests || 100,
    maxTokens: params.maxTokens || 10000, // Maximum tokens per window
    skipSuccessfulRequests: params.skipSuccessfulRequests || false,
    skipFailedRequests: params.skipFailedRequests || false,
    keyGenerator: params.keyGenerator || ((req) => req.user?.id || req.ip),
    handler: params.handler || defaultHandler,
    onLimitReached: params.onLimitReached || defaultOnLimitReached,
  };

  // Token estimation for different models
  const tokenEstimates = {
    // Chat models (rough estimates per request)
    "gpt-4": { base: 100, perMessage: 25, perToken: 1 },
    "gpt-4-turbo": { base: 80, perMessage: 20, perToken: 1 },
    "gpt-3.5-turbo": { base: 50, perMessage: 15, perToken: 1 },
    "claude-3-opus": { base: 120, perMessage: 30, perToken: 1 },
    "claude-3-sonnet": { base: 80, perMessage: 20, perToken: 1 },
    "claude-3-haiku": { base: 40, perMessage: 10, perToken: 1 },

    // Embedding models (per input token)
    "text-embedding-ada-002": { perToken: 0.1 },
    "text-embedding-3-small": { perToken: 0.1 },
    "text-embedding-3-large": { perToken: 0.1 },
  };

  async function aiRateLimit(req, res, next) {
    const key = rateConfig.keyGenerator(req);

    if (!key) {
      logger.warn("Rate limit: No key generated for request");
      return next();
    }

    try {
      const now = Date.now();
      const { windowMs } = rateConfig;

      // Redis keys for this user/key
      const requestKey = `ratelimit:requests:${key}`;
      const tokenKey = `ratelimit:tokens:${key}`;
      const resetKey = `ratelimit:reset:${key}`;

      // Get current values from Redis
      const [requests, tokens, resetTime] = await Promise.all([
        db.get(requestKey),
        db.get(tokenKey),
        db.get(resetKey),
      ]);

      let currentRequests = parseInt(requests, 10) || 0;
      let currentTokens = parseInt(tokens, 10) || 0;
      let currentResetTime = parseInt(resetTime, 10) || 0;

      // Check if window has expired
      if (now > currentResetTime) {
        // Reset counters
        currentRequests = 0;
        currentTokens = 0;
        currentResetTime = now + windowMs;

        // Set new reset time
        await db.setex(resetKey, Math.ceil(windowMs / 1000), currentResetTime);
        await db.setex(requestKey, Math.ceil(windowMs / 1000), 0);
        await db.setex(tokenKey, Math.ceil(windowMs / 1000), 0);
      }

      // Estimate tokens for this request
      const estimatedTokens = estimateTokens(req);

      // Check limits
      const requestsExceeded = currentRequests >= rateConfig.maxRequests;
      const tokensExceeded =
        currentTokens + estimatedTokens > rateConfig.maxTokens;

      if (requestsExceeded || tokensExceeded) {
        // Call limit reached handler
        rateConfig.onLimitReached(key, req);

        return rateConfig.handler(req, res, rateConfig.windowMs);
      }

      // Increment request counter atomically
      await db.incr(requestKey);

      // Add response interceptor to track actual token usage
      const originalJson = res.json;
      res.json = async function (data) {
        try {
          // Track actual token usage from response
          if (data?.usage) {
            const actualTokens = data.usage.total_tokens || estimatedTokens;
            await db.incrby(tokenKey, actualTokens);

            // Get updated values for headers
            const [finalRequests, finalTokens] = await Promise.all([
              db.get(requestKey),
              db.get(tokenKey),
            ]);

            // Add rate limit headers
            res.set({
              "x-ratelimit-limit-requests": rateConfig.maxRequests,
              "x-ratelimit-remaining-requests": Math.max(
                0,
                rateConfig.maxRequests - parseInt(finalRequests, 10),
              ),
              "x-ratelimit-limit-tokens": rateConfig.maxTokens,
              "x-ratelimit-remaining-tokens": Math.max(
                0,
                rateConfig.maxTokens - parseInt(finalTokens, 10),
              ),
              "x-ratelimit-reset": new Date(currentResetTime).toISOString(),
            });
          }
        } catch (error) {
          logger.warn("Failed to update token usage in Redis:", error.message);
        }

        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error("Rate limit error:", error.message);
      // On Redis error, allow request to proceed (fail open)
      next();
    }
  }

  // Estimate tokens for a request
  function estimateTokens(req) {
    try {
      const { body } = req;
      if (!body || !body.model) return 50; // Default estimate

      const model = body.model.toLowerCase();
      const messages = body.messages || [];
      let estimate = 0;

      if (tokenEstimates[model]) {
        const modelConfig = tokenEstimates[model];
        estimate = modelConfig.base || 0;

        if (modelConfig.perMessage) {
          estimate += messages.length * modelConfig.perMessage;
        }

        // Add tokens for message content (rough estimate)
        messages.forEach((msg) => {
          if (msg.content) {
            const contentTokens = Math.ceil(msg.content.length / 4); // Rough: 1 token per 4 chars
            estimate += contentTokens * (modelConfig.perToken || 1);
          }
        });
      }

      return Math.max(estimate, 10); // Minimum 10 tokens
    } catch (error) {
      logger.warn("Token estimation error:", error.message);
      return 50; // Default fallback
    }
  }

  // Expose rate limit stats for monitoring (Redis-backed)
  config.rateLimitStats = {
    getStats: async () => {
      try {
        return {
          config: rateConfig,
          note: "Redis-backed rate limiting - stats collection limited",
        };
      } catch (error) {
        logger.error("Failed to get rate limit stats:", error.message);
        return { error: error.message };
      }
    },
    getKeyStats: async (key) => {
      try {
        const requestKey = `ratelimit:requests:${key}`;
        const tokenKey = `ratelimit:tokens:${key}`;
        const resetKey = `ratelimit:reset:${key}`;

        const [requests, tokens, resetTime] = await Promise.all([
          db.get(requestKey),
          db.get(tokenKey),
          db.get(resetKey),
        ]);

        return {
          requests: parseInt(requests, 10) || 0,
          tokens: parseInt(tokens, 10) || 0,
          resetTime: parseInt(resetTime, 10) || 0,
        };
      } catch (error) {
        logger.error(`Failed to get key stats for ${key}:`, error.message);
        return { error: error.message };
      }
    },
    resetKey: async (key) => {
      try {
        const requestKey = `ratelimit:requests:${key}`;
        const tokenKey = `ratelimit:tokens:${key}`;
        const resetKey = `ratelimit:reset:${key}`;

        await Promise.all([
          db.del(requestKey),
          db.del(tokenKey),
          db.del(resetKey),
        ]);

        return true;
      } catch (error) {
        logger.error(`Failed to reset key ${key}:`, error.message);
        return false;
      }
    },
  };

  return aiRateLimit;
};
