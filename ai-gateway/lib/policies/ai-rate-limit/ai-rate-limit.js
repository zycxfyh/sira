// AI Rate Limit Policy
// Advanced rate limiting based on AI model token consumption and user quotas

// Rate limit store (in production, use Redis)
const rateLimitStore = new Map()

module.exports = function (params, config) {
  const logger = config.logger || console

  // Rate limit configuration
  const rateConfig = {
    windowMs: params.windowMs || 15 * 60 * 1000, // 15 minutes
    maxRequests: params.maxRequests || 100,
    maxTokens: params.maxTokens || 10000, // Maximum tokens per window
    skipSuccessfulRequests: params.skipSuccessfulRequests || false,
    skipFailedRequests: params.skipFailedRequests || false,
    keyGenerator: params.keyGenerator || ((req) => req.user?.id || req.ip),
    handler: params.handler || defaultHandler,
    onLimitReached: params.onLimitReached || defaultOnLimitReached
  }

  // Token estimation for different models
  const tokenEstimates = {
    // Chat models (rough estimates per request)
    'gpt-4': { base: 100, perMessage: 25, perToken: 1 },
    'gpt-4-turbo': { base: 80, perMessage: 20, perToken: 1 },
    'gpt-3.5-turbo': { base: 50, perMessage: 15, perToken: 1 },
    'claude-3-opus': { base: 120, perMessage: 30, perToken: 1 },
    'claude-3-sonnet': { base: 80, perMessage: 20, perToken: 1 },
    'claude-3-haiku': { base: 40, perMessage: 10, perToken: 1 },

    // Embedding models (per input token)
    'text-embedding-ada-002': { perToken: 0.1 },
    'text-embedding-3-small': { perToken: 0.1 },
    'text-embedding-3-large': { perToken: 0.1 }
  }

  function aiRateLimit (req, res, next) {
    const key = rateConfig.keyGenerator(req)

    if (!key) {
      logger.warn('Rate limit: No key generated for request')
      return next()
    }

    const now = Date.now()
    const windowStart = now - rateConfig.windowMs

    // Get or create rate limit record
    let record = rateLimitStore.get(key)
    if (!record) {
      record = {
        requests: 0,
        tokens: 0,
        resetTime: now + rateConfig.windowMs,
        windowStart: now
      }
      rateLimitStore.set(key, record)
    }

    // Reset if window has expired
    if (now > record.resetTime) {
      record.requests = 0
      record.tokens = 0
      record.resetTime = now + rateConfig.windowMs
      record.windowStart = now
    }

    // Estimate tokens for this request
    const estimatedTokens = estimateTokens(req)

    // Check limits
    const requestsExceeded = record.requests >= rateConfig.maxRequests
    const tokensExceeded = record.tokens + estimatedTokens > rateConfig.maxTokens

    if (requestsExceeded || tokensExceeded) {
      // Call limit reached handler
      rateConfig.onLimitReached(req, res, next, {
        key,
        requests: record.requests,
        tokens: record.tokens,
        estimatedTokens,
        resetTime: record.resetTime,
        exceeded: {
          requests: requestsExceeded,
          tokens: tokensExceeded
        }
      })

      return rateConfig.handler(req, res, next, {
        key,
        requests: record.requests,
        tokens: record.tokens,
        resetTime: record.resetTime
      })
    }

    // Update counters
    record.requests++

    // Add response interceptor to track actual token usage
    const originalJson = res.json
    res.json = function (data) {
      // Track actual token usage from response
      if (data && data.usage) {
        const actualTokens = data.usage.total_tokens || estimatedTokens
        record.tokens += actualTokens

        // Add rate limit headers
        res.set({
          'x-ratelimit-limit-requests': rateConfig.maxRequests,
          'x-ratelimit-remaining-requests': Math.max(0, rateConfig.maxRequests - record.requests),
          'x-ratelimit-limit-tokens': rateConfig.maxTokens,
          'x-ratelimit-remaining-tokens': Math.max(0, rateConfig.maxTokens - record.tokens),
          'x-ratelimit-reset': new Date(record.resetTime).toISOString()
        })
      }

      return originalJson.call(this, data)
    }

    next()
  }

  // Estimate tokens for a request
  function estimateTokens (req) {
    try {
      const body = req.body
      if (!body || !body.model) return 50 // Default estimate

      const model = body.model
      const estimator = tokenEstimates[model]

      if (!estimator) return 50 // Unknown model

      let tokens = estimator.base || 0

      // Estimate based on messages
      if (body.messages && Array.isArray(body.messages)) {
        tokens += body.messages.length * (estimator.perMessage || 0)
        tokens += body.messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0) * (estimator.perToken || 0.1)
      }

      // Estimate based on input text
      if (body.input) {
        if (Array.isArray(body.input)) {
          tokens += body.input.reduce((sum, text) => sum + (text?.length || 0), 0) * (estimator.perToken || 0.1)
        } else {
          tokens += (body.input.length || 0) * (estimator.perToken || 0.1)
        }
      }

      // Add max_tokens if specified
      if (body.max_tokens) {
        tokens = Math.min(tokens, body.max_tokens)
      }

      return Math.ceil(tokens)
    } catch (error) {
      logger.warn('Failed to estimate tokens, using default', error)
      return 50 // Conservative default
    }
  }

  // Default rate limit handler
  function defaultHandler (req, res, next, options) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      message: `Too many requests. Try again after ${new Date(options.resetTime).toISOString()}`,
      details: {
        limit: {
          requests: rateConfig.maxRequests,
          tokens: rateConfig.maxTokens
        },
        current: {
          requests: options.requests,
          tokens: options.tokens
        },
        resetTime: new Date(options.resetTime).toISOString()
      }
    })
  }

  // Default limit reached handler
  function defaultOnLimitReached (req, res, next, options) {
    logger.warn('Rate limit reached', {
      key: options.key,
      requests: options.requests,
      tokens: options.tokens,
      estimatedTokens: options.estimatedTokens,
      userId: req.user?.id,
      ip: req.ip
    })

    // Cleanup old records periodically
  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    let cleaned = 0

    for (const [key, record] of rateLimitStore.entries()) {
      if (now > record.resetTime + rateConfig.windowMs) {
        rateLimitStore.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.debug(`Cleaned ${cleaned} expired rate limit records`)
    }
  }, 60000) // Clean every minute

  // Cleanup on process exit
  const cleanup = () => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval)
      logger.debug('Rate limit cleanup interval cleared')
    }
  }

  process.on('exit', cleanup)
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  // Expose rate limit stats for monitoring
  config.rateLimitStats = {
    getStats: () => ({
      activeKeys: rateLimitStore.size,
      config: rateConfig
    }),
    getKeyStats: (key) => rateLimitStore.get(key),
    resetKey: (key) => {
      const record = rateLimitStore.get(key)
      if (record) {
        record.requests = 0
        record.tokens = 0
        record.resetTime = Date.now() + rateConfig.windowMs
        return true
      }
      return false
    }
  }

  // Expose rate limit stats for monitoring
  config.rateLimitStats = {
    getStats: () => ({
      activeKeys: rateLimitStore.size,
      config: rateConfig
    }),
    getKeyStats: (key) => rateLimitStore.get(key),
    resetKey: (key) => {
      const record = rateLimitStore.get(key)
      if (record) {
        record.requests = 0
        record.tokens = 0
        record.resetTime = Date.now() + rateConfig.windowMs
        return true
      }
      return false
    }
  }

  return aiRateLimit
}
