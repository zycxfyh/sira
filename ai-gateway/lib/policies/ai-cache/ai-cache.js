const crypto = require('crypto')

// AI Cache Policy
// Intelligent caching for AI requests based on content and parameters
module.exports = function (params, config) {
  const logger = config.logger || console

  // Configuration validation
  const validationErrors = validateCacheConfiguration(params)
  if (validationErrors.length > 0) {
    const error = new Error(`AI Cache configuration validation failed: ${validationErrors.join(', ')}`)
    logger.error(error.message)
    throw error
  }

  // Cache storage (in production, use Redis or other distributed cache)
  const cache = new Map()

  // Cache configuration with defaults
  const cacheConfig = Object.assign({
    ttl: 300, // 5 minutes default
    maxSize: 10000, // Maximum cache entries
    compressionEnabled: true,
    varyByHeaders: [],
    strategy: 'lru', // lru, lfu, ttl
    cleanupInterval: 60000 // Cleanup every minute
  }, params)

  function aiCache (req, res, next) {
    // Periodic cleanup of expired entries (run once per request to avoid performance impact)
    const cleanupInterval = setInterval(() => {
      let cleaned = 0
      const now = Date.now()
      const ttlMs = cacheConfig.ttl * 1000

      for (const [key, value] of cache) {
        if (now - value.cachedAt > ttlMs) {
          cache.delete(key)
          cleaned++
        }
      }

      if (cleaned > 0) {
        logger.debug('Cleaned expired cache entries', { cleaned })
      }
    }, cacheConfig.cleanupInterval || 60000) // Clean every minute

    // Cleanup on process exit
    const cleanup = () => {
      if (cleanupInterval) {
        clearInterval(cleanupInterval)
        logger.debug('Cache cleanup interval cleared')
      }
    }

    process.on('exit', cleanup)
    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)

    // Only cache GET and POST requests
    if (!['GET', 'POST'].includes(req.method)) {
      return next()
    }

    // Generate cache key
    const cacheKey = generateCacheKey(req)

    // Check cache
    const cachedResponse = getCachedResponse(cacheKey)
    if (cachedResponse) {
      // Return cached response
      res.set({
        'x-cache-status': 'HIT',
        'x-cache-key': cacheKey,
        'x-cached-at': cachedResponse.cachedAt
      })

      logger.debug('Cache hit', { cacheKey, age: Date.now() - cachedResponse.cachedAt })
      return res.status(cachedResponse.statusCode).json(cachedResponse.body)
    }

    // Cache miss - intercept response
    res.set('x-cache-status', 'MISS')

    const originalJson = res.json
    const originalStatus = res.status

    let responseBody
    let statusCode = 200

    // Override res.status to capture status code
    res.status = function (code) {
      statusCode = code
      return originalStatus.call(this, code)
    }

    // Override res.json to capture and cache response
    res.json = function (body) {
      // Only cache successful responses
      if (statusCode >= 200 && statusCode < 300) {
        setCachedResponse(cacheKey, {
          body,
          statusCode,
          headers: res.getHeaders(),
          cachedAt: Date.now()
        })
      }

      // Call original json method
      return originalJson.call(this, body)
    }

    next()
  }

  // Generate cache key based on request content
  function generateCacheKey (req) {
    try {
      const keyComponents = {
        method: req.method,
        url: req.url,
        body: req.body,
        headers: {}
      }

      // Include relevant headers for cache variation
      cacheConfig.varyByHeaders.forEach(header => {
        if (req.headers[header]) {
          keyComponents.headers[header] = req.headers[header]
        }
      })

      // For AI requests, normalize the content for better cache hits
      if (req.body && typeof req.body === 'object') {
        keyComponents.body = normalizeRequestBody(req.body)
      }

      // Generate hash
      const keyString = JSON.stringify(keyComponents, Object.keys(keyComponents).sort())
      const hash = crypto.createHash('sha256').update(keyString).digest('hex')

      return `ai-cache:${hash.substring(0, 16)}` // Use first 16 chars for readability
    } catch (error) {
      logger.warn('Failed to generate cache key, using fallback', error)
      // Fallback cache key
      return `ai-cache:fallback:${Date.now()}:${Math.random()}`
    }
  }

  // Normalize request body for consistent caching
  function normalizeRequestBody (body) {
    if (!body || typeof body !== 'object') {
      return body
    }

    const normalized = { ...body }

    // For chat completions, normalize messages while preserving content
    if (normalized.messages && Array.isArray(normalized.messages)) {
      normalized.messages = normalized.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        // Include other properties that affect the response
        name: msg.name,
        function_call: msg.function_call
      }))
    }

    // Sort object keys for consistency
    return sortObjectKeys(normalized)
  }

  // Sort object keys recursively for consistent hashing
  function sortObjectKeys (obj) {
    if (obj === null || typeof obj !== 'object' || obj instanceof Date) {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map(sortObjectKeys)
    }

    const sorted = {}
    Object.keys(obj).sort().forEach(key => {
      sorted[key] = sortObjectKeys(obj[key])
    })

    return sorted
  }

  // Get cached response
  function getCachedResponse (key) {
    const cached = cache.get(key)

    if (!cached) {
      return null
    }

    // Check if cache entry has expired
    if (Date.now() - cached.cachedAt > cacheConfig.ttl * 1000) {
      cache.delete(key)
      logger.debug('Cache entry expired', { key })
      return null
    }

    return cached
  }

  // Set cached response
  function setCachedResponse (key, response) {
    // Check cache size limit
    if (cache.size >= cacheConfig.maxSize) {
      // Remove oldest entries (simple LRU approximation)
      const keysToDelete = Array.from(cache.keys()).slice(0, Math.floor(cacheConfig.maxSize * 0.1))
      keysToDelete.forEach(k => cache.delete(k))
      logger.debug('Cache size limit reached, removed old entries', { removedCount: keysToDelete.length })
    }

    cache.set(key, response)
    logger.debug('Response cached', { key, size: cache.size })
  }

  return aiCache
}

// Configuration validation function
function validateCacheConfiguration (params) {
  const errors = []

  if (!params) {
    errors.push('Configuration object is required')
    return errors
  }

  // Validate TTL
  if (params.ttl !== undefined) {
    if (typeof params.ttl !== 'number' || params.ttl < 10 || params.ttl > 86400) {
      errors.push('ttl must be a number between 10 and 86400 seconds')
    }
  }

  // Validate maxSize
  if (params.maxSize !== undefined) {
    if (typeof params.maxSize !== 'number' || params.maxSize < 100 || params.maxSize > 100000) {
      errors.push('maxSize must be a number between 100 and 100000 entries')
    }
  }

  // Validate strategy
  if (params.strategy !== undefined) {
    const validStrategies = ['lru', 'lfu', 'ttl', 'random']
    if (!validStrategies.includes(params.strategy)) {
      errors.push(`strategy must be one of: ${validStrategies.join(', ')}`)
    }
  }

  // Validate cleanup interval
  if (params.cleanupInterval !== undefined) {
    if (typeof params.cleanupInterval !== 'number' || params.cleanupInterval < 10000 || params.cleanupInterval > 3600000) {
      errors.push('cleanupInterval must be a number between 10000 and 3600000 milliseconds')
    }
  }

  // Validate varyByHeaders
  if (params.varyByHeaders !== undefined) {
    if (!Array.isArray(params.varyByHeaders)) {
      errors.push('varyByHeaders must be an array of header names')
    } else {
      params.varyByHeaders.forEach(header => {
        if (typeof header !== 'string') {
          errors.push('varyByHeaders must contain only string values')
        }
      })
    }
  }

  return errors
}
