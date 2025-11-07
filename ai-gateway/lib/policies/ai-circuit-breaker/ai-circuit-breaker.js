// AI Circuit Breaker Policy
// Implements circuit breaker pattern for AI provider resilience

const CircuitBreaker = require('opossum')

module.exports = function (params, config) {
  const logger = config.logger || console

  // Circuit breaker configuration
  const circuitConfig = {
    timeout: params.timeout || 30000, // Request timeout
    errorThresholdPercentage: params.errorThresholdPercentage || 50, // Error rate threshold
    resetTimeout: params.resetTimeout || 30000, // Time to wait before trying again
    rollingCountTimeout: params.rollingCountTimeout || 10000, // Rolling window
    rollingCountBuckets: params.rollingCountBuckets || 10,
    name: params.name || 'ai-circuit-breaker'
  }

  // Circuit breakers for each AI provider
  const circuitBreakers = new Map()

  // Fallback responses for different failure types
  const fallbacks = {
    timeout: {
      error: 'Request timeout',
      code: 'CIRCUIT_TIMEOUT',
      retryAfter: Math.ceil(circuitConfig.resetTimeout / 1000)
    },
    open: {
      error: 'Service temporarily unavailable',
      code: 'CIRCUIT_OPEN',
      retryAfter: Math.ceil(circuitConfig.resetTimeout / 1000)
    },
    halfOpen: {
      error: 'Service recovering',
      code: 'CIRCUIT_HALF_OPEN',
      retryAfter: 5
    }
  }

  function aiCircuitBreaker (req, res, next) {
    // Extract provider information from request
    const provider = req.headers['x-ai-provider'] ||
                    req.body?.provider ||
                    detectProviderFromModel(req.body?.model)

    if (!provider) {
      logger.debug('No provider detected for circuit breaker')
      return next()
    }

    // Get or create circuit breaker for this provider
    let breaker = circuitBreakers.get(provider)
    if (!breaker) {
      breaker = createCircuitBreaker(provider)
      circuitBreakers.set(provider, breaker)
    }

    // Check circuit breaker state
    if (breaker.opened) {
      return handleCircuitOpen(req, res, next, provider, breaker)
    }

    // Execute request through circuit breaker
    breaker.fire(async () => {
      // This function will be called when the circuit breaker allows the request
      // We return a promise that resolves when the request is complete
      return new Promise((resolve, reject) => {
        // Store original response methods
        const originalJson = res.json
        const originalStatus = res.status
        const originalSend = res.send

        let requestCompleted = false

        // Override response methods to track completion
        res.json = function (data) {
          if (!requestCompleted) {
            requestCompleted = true
            resolve({ status: res.statusCode, data })
          }
          return originalJson.call(this, data)
        }

        res.send = function (data) {
          if (!requestCompleted) {
            requestCompleted = true
            resolve({ status: res.statusCode, data })
          }
          return originalSend.call(this, data)
        }

        res.status = function (code) {
          const result = originalStatus.call(this, code)
          // Store status code for later use
          res.statusCode = code
          return result
        }

        // Continue to next middleware
        next()
      })
    })
      .then(result => {
      // Request succeeded
        logger.debug(`Circuit breaker success for ${provider}`, {
          status: result.status,
          state: breaker.stats
        })
      })
      .catch(error => {
      // Request failed or circuit breaker is open
        logger.warn(`Circuit breaker failed for ${provider}`, {
          error: error.message,
          state: breaker.stats,
          opened: breaker.opened
        })

        handleCircuitFailure(req, res, next, provider, breaker, error)
      })
  }

  // Create circuit breaker for a provider
  function createCircuitBreaker (provider) {
    const breaker = new CircuitBreaker(async (fn) => {
      return await fn()
    }, circuitConfig)

    // Circuit breaker event handlers
    breaker.on('open', () => {
      logger.warn(`Circuit breaker OPENED for ${provider}`, {
        stats: breaker.stats,
        config: circuitConfig
      })

      // Emit custom event for monitoring
      if (config.eventEmitter) {
        config.eventEmitter.emit('circuit-breaker:open', {
          provider,
          stats: breaker.stats,
          timestamp: new Date()
        })
      }
    })

    breaker.on('close', () => {
      logger.info(`Circuit breaker CLOSED for ${provider}`, {
        stats: breaker.stats
      })

      if (config.eventEmitter) {
        config.eventEmitter.emit('circuit-breaker:close', {
          provider,
          stats: breaker.stats,
          timestamp: new Date()
        })
      }
    })

    breaker.on('halfOpen', () => {
      logger.info(`Circuit breaker HALF-OPEN for ${provider}`)

      if (config.eventEmitter) {
        config.eventEmitter.emit('circuit-breaker:half-open', {
          provider,
          timestamp: new Date()
        })
      }
    })

    breaker.on('reject', () => {
      logger.debug(`Request rejected by circuit breaker for ${provider}`)
    })

    breaker.on('timeout', () => {
      logger.warn(`Request timeout in circuit breaker for ${provider}`)
    })

    breaker.on('success', () => {
      logger.debug(`Request success in circuit breaker for ${provider}`)
    })

    breaker.on('failure', (error) => {
      logger.warn(`Request failure in circuit breaker for ${provider}`, { error: error.message })
    })

    return breaker
  }

  // Detect provider from model name
  function detectProviderFromModel (model) {
    if (!model) return null

    if (model.startsWith('gpt-')) return 'openai'
    if (model.startsWith('claude-')) return 'anthropic'
    if (model.includes('azure') || model.includes('embedding')) return 'azure'

    return 'openai' // Default fallback
  }

  // Handle circuit open state
  function handleCircuitOpen (req, res, next, provider, breaker) {
    const fallback = fallbacks.open

    res.set({
      'x-circuit-breaker': 'open',
      'x-provider': provider,
      'retry-after': fallback.retryAfter,
      'cache-control': 'no-cache'
    })

    res.status(503).json({
      error: fallback.error,
      code: fallback.code,
      message: `${provider} service is temporarily unavailable due to high error rate`,
      details: {
        provider,
        retryAfter: fallback.retryAfter,
        stats: {
          errorRate: breaker.stats.errorRate,
          totalRequests: breaker.stats.totalRequests,
          successfulRequests: breaker.stats.successfulRequests,
          failedRequests: breaker.stats.failedRequests
        }
      }
    })
  }

  // Handle circuit breaker failure
  function handleCircuitFailure (req, res, next, provider, breaker, error) {
    let fallback = fallbacks.timeout

    if (breaker.opened) {
      fallback = fallbacks.open
    } else if (breaker.halfOpen) {
      fallback = fallbacks.halfOpen
    }

    res.set({
      'x-circuit-breaker': breaker.opened ? 'open' : (breaker.halfOpen ? 'half-open' : 'closed'),
      'x-provider': provider,
      'retry-after': fallback.retryAfter,
      'cache-control': 'no-cache'
    })

    res.status(503).json({
      error: fallback.error,
      code: fallback.code,
      message: `${provider} service is currently experiencing issues`,
      details: {
        provider,
        retryAfter: fallback.retryAfter,
        circuitState: breaker.opened ? 'open' : (breaker.halfOpen ? 'half-open' : 'closed'),
        stats: {
          errorRate: breaker.stats.errorRate,
          totalRequests: breaker.stats.totalRequests,
          successfulRequests: breaker.stats.successfulRequests,
          failedRequests: breaker.stats.failedRequests
        }
      }
    })

    // Health check function for monitoring
    config.circuitBreakerHealth = {
      getStats: () => {
        const stats = {}
        for (const [provider, breaker] of circuitBreakers.entries()) {
          stats[provider] = {
            opened: breaker.opened,
            halfOpen: breaker.halfOpen,
            warmUp: breaker.warmUp,
            stats: breaker.stats,
            config: circuitConfig
          }
        }
        return stats
      },
      reset: (provider) => {
        const breaker = circuitBreakers.get(provider)
        if (breaker) {
          breaker.reset()
          return true
        }
        return false
      },
      open: (provider) => {
        const breaker = circuitBreakers.get(provider)
        if (breaker) {
          breaker.open()
          return true
        }
        return false
      },
      close: (provider) => {
        const breaker = circuitBreakers.get(provider)
        if (breaker) {
          breaker.close()
          return true
        }
        return false
      }
    }

    return aiCircuitBreaker
  }
}
