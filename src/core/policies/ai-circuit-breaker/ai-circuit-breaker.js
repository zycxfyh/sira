// AI Circuit Breaker Policy
// Implements circuit breaker pattern for AI provider resilience
// Uses Redis-backed circuit breaker state for cluster compatibility

const db = require('../../db');

// Redis-backed Circuit Breaker implementation
class RedisCircuitBreaker {
  constructor(provider, config, logger) {
    this.provider = provider;
    this.config = config;
    this.logger = logger;

    // Redis keys
    this.stateKey = `circuit:${provider}:state`;
    this.failuresKey = `circuit:${provider}:failures`;
    this.successesKey = `circuit:${provider}:successes`;
    this.lastFailureKey = `circuit:${provider}:last_failure`;
    this.nextAttemptKey = `circuit:${provider}:next_attempt`;

    this.states = {
      CLOSED: 'closed',
      OPEN: 'open',
      HALF_OPEN: 'half_open',
    };
  }

  async getState() {
    try {
      const state = await db.get(this.stateKey);
      return state || this.states.CLOSED;
    } catch (error) {
      this.logger.error(`Failed to get circuit state for ${this.provider}:`, error.message);
      return this.states.CLOSED; // Fail closed
    }
  }

  async setState(state) {
    try {
      await db.set(this.stateKey, state);
      this.logger.info(`Circuit breaker for ${this.provider} changed to ${state}`);
    } catch (error) {
      this.logger.error(`Failed to set circuit state for ${this.provider}:`, error.message);
    }
  }

  async recordSuccess() {
    try {
      const state = await this.getState();
      if (state === this.states.HALF_OPEN) {
        // Successful call in half-open state - close the circuit
        await this.setState(this.states.CLOSED);
        await db.del(this.failuresKey);
        await db.del(this.successesKey);
      } else if (state === this.states.CLOSED) {
        // Reset success counter periodically
        const successes = await db.incr(this.successesKey);
        if (successes >= 10) {
          // Reset after 10 successes
          await db.del(this.successesKey);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to record success for ${this.provider}:`, error.message);
    }
  }

  async recordFailure() {
    try {
      const failures = await db.incr(this.failuresKey);
      const successes = parseInt(await db.get(this.successesKey)) || 0;

      // Calculate error rate
      const totalRequests = failures + successes;
      const errorRate = totalRequests > 0 ? (failures / totalRequests) * 100 : 0;

      if (errorRate >= this.config.errorThresholdPercentage) {
        // Open the circuit
        await this.setState(this.states.OPEN);
        await db.setex(
          this.nextAttemptKey,
          Math.ceil(this.config.resetTimeout / 1000),
          Date.now() + this.config.resetTimeout
        );
        await db.setex(this.lastFailureKey, Math.ceil(this.config.resetTimeout / 1000), Date.now());

        this.logger.warn(`Circuit breaker OPENED for ${this.provider}`, {
          errorRate: `${errorRate.toFixed(1)}%`,
          failures,
          successes,
          threshold: `${this.config.errorThresholdPercentage}%`,
        });
      }
    } catch (error) {
      this.logger.error(`Failed to record failure for ${this.provider}:`, error.message);
    }
  }

  async shouldAllowRequest() {
    const state = await this.getState();

    if (state === this.states.CLOSED) {
      return true;
    }

    if (state === this.states.OPEN) {
      const nextAttempt = await db.get(this.nextAttemptKey);
      if (nextAttempt && Date.now() >= parseInt(nextAttempt)) {
        // Time to try again - go to half-open
        await this.setState(this.states.HALF_OPEN);
        return true;
      }
      return false;
    }

    // HALF_OPEN - allow one request
    return true;
  }

  async getStats() {
    try {
      const [state, failures, successes, lastFailure] = await Promise.all([
        db.get(this.stateKey),
        db.get(this.failuresKey),
        db.get(this.successesKey),
        db.get(this.lastFailureKey),
      ]);

      return {
        state: state || this.states.CLOSED,
        failures: parseInt(failures) || 0,
        successes: parseInt(successes) || 0,
        lastFailure: lastFailure ? new Date(parseInt(lastFailure)) : null,
      };
    } catch (error) {
      this.logger.error(`Failed to get stats for ${this.provider}:`, error.message);
      return { state: this.states.CLOSED, failures: 0, successes: 0, lastFailure: null };
    }
  }
}

module.exports = function (params, config) {
  const logger = config.logger || console;

  // Circuit breaker configuration
  const circuitConfig = {
    timeout: params.timeout || 30000, // Request timeout
    errorThresholdPercentage: params.errorThresholdPercentage || 50, // Error rate threshold
    resetTimeout: params.resetTimeout || 30000, // Time to wait before trying again
    rollingCountTimeout: params.rollingCountTimeout || 10000, // Rolling window
    rollingCountBuckets: params.rollingCountBuckets || 10,
    name: params.name || 'ai-circuit-breaker',
  };

  // Circuit breakers for each AI provider (Redis-backed)
  const circuitBreakers = new Map();

  // Fallback responses for different failure types
  const fallbacks = {
    timeout: {
      error: 'Request timeout',
      code: 'CIRCUIT_TIMEOUT',
      retryAfter: Math.ceil(circuitConfig.resetTimeout / 1000),
    },
    open: {
      error: 'Service temporarily unavailable',
      code: 'CIRCUIT_OPEN',
      retryAfter: Math.ceil(circuitConfig.resetTimeout / 1000),
    },
    halfOpen: {
      error: 'Service recovering',
      code: 'CIRCUIT_HALF_OPEN',
      retryAfter: 5,
    },
  };

  async function aiCircuitBreaker(req, res, next) {
    try {
      // Extract provider information from request
      const provider =
        req.headers['x-ai-provider'] ||
        req.body?.provider ||
        detectProviderFromModel(req.body?.model);

      if (!provider) {
        logger.debug('No provider detected for circuit breaker');
        return next();
      }

      // Get or create circuit breaker for this provider
      let breaker = circuitBreakers.get(provider);
      if (!breaker) {
        breaker = new RedisCircuitBreaker(provider, circuitConfig, logger);
        circuitBreakers.set(provider, breaker);
      }

      // Check if circuit breaker allows the request
      const allowed = await breaker.shouldAllowRequest();
      if (!allowed) {
        return handleCircuitOpen(req, res, next, provider, await breaker.getStats());
      }

      // Store original response methods to track completion
      const originalJson = res.json;
      const originalStatus = res.status;
      const originalSend = res.send;
      let requestCompleted = false;
      let isSuccess = false;

      // Override response methods to track completion
      res.json = function (data) {
        if (!requestCompleted) {
          requestCompleted = true;
          isSuccess = res.statusCode < 400;
        }
        return originalJson.call(this, data);
      };

      res.send = function (data) {
        if (!requestCompleted) {
          requestCompleted = true;
          isSuccess = res.statusCode < 400;
        }
        return originalSend.call(this, data);
      };

      res.status = function (code) {
        const result = originalStatus.call(this, code);
        res.statusCode = code;
        return result;
      };

      // Add response interceptor to record circuit breaker events
      const originalEnd = res.end;
      res.end = async function (chunk, encoding) {
        try {
          if (requestCompleted) {
            if (isSuccess) {
              await breaker.recordSuccess();
              logger.debug(`Circuit breaker success for ${provider}`, {
                status: res.statusCode,
                stats: await breaker.getStats(),
              });
            } else {
              await breaker.recordFailure();
              logger.warn(`Circuit breaker recorded failure for ${provider}`, {
                status: res.statusCode,
                stats: await breaker.getStats(),
              });
            }
          }
        } catch (error) {
          logger.error(`Failed to record circuit breaker event for ${provider}:`, error.message);
        }

        return originalEnd.call(this, chunk, encoding);
      };

      // Continue to next middleware
      next();
    } catch (error) {
      logger.error('Circuit breaker error:', error.message);
      // On error, allow request to proceed
      next();
    }
  }

  // Handle circuit open state
  async function handleCircuitOpen(req, res, next, provider, stats) {
    const fallback = fallbacks.open;

    res.set({
      'x-circuit-breaker': 'open',
      'x-provider': provider,
      'retry-after': fallback.retryAfter,
      'cache-control': 'no-cache',
    });

    res.status(503).json({
      error: fallback.error,
      code: fallback.code,
      message: `${provider} service is temporarily unavailable due to high error rate`,
      details: {
        provider,
        retryAfter: fallback.retryAfter,
        stats: {
          state: stats.state,
          failures: stats.failures,
          successes: stats.successes,
          lastFailure: stats.lastFailure,
        },
      },
    });
  }

  // Detect provider from model name
  function detectProviderFromModel(model) {
    if (!model) return null;

    const modelMappings = {
      gpt: 'openai',
      claude: 'anthropic',
      'text-davinci': 'openai',
      'text-curie': 'openai',
      'text-babbage': 'openai',
      'text-ada': 'openai',
      code: 'openai',
      'gpt-3': 'openai',
      'gpt-4': 'openai',
      palm: 'google',
      gemini: 'google',
      bard: 'google',
      titan: 'amazon',
      'amazon-q': 'amazon',
      command: 'cohere',
      base: 'cohere',
    };

    const lowerModel = model.toLowerCase();
    for (const [prefix, provider] of Object.entries(modelMappings)) {
      if (lowerModel.includes(prefix)) {
        return provider;
      }
    }

    return null;
  }

  return aiCircuitBreaker;
};
