const { expect } = require('chai')
const sinon = require('sinon')
const aiCircuitBreaker = require('../../lib/policies/ai-circuit-breaker')

describe('AI Circuit Breaker Policy', function () {
  let req, res, next, config

  beforeEach(function () {
    req = {
      method: 'POST',
      url: '/api/v1/ai/chat/completions',
      body: { model: 'gpt-4' }
    }

    res = {
      status: sinon.spy(),
      json: sinon.spy()
    }

    next = sinon.spy()

    config = {
      logger: {
        debug: sinon.spy(),
        warn: sinon.spy(),
        error: sinon.spy()
      }
    }
  })

  describe('Circuit Breaker States', function () {
    it('should start in closed state', function () {
      const policy = aiCircuitBreaker({
        failureThreshold: 3,
        recoveryTimeout: 1000
      }, config)

      policy(req, res, next)
      expect(next.calledOnce).to.be.true
    })

    it('should open circuit after failures', function () {
      const policy = aiCircuitBreaker({
        failureThreshold: 2,
        recoveryTimeout: 5000
      }, config)

      // Simulate failures
      req.egContext = { circuitBreakerFailure: true }
      policy(req, res, next)
      policy(req, res, next)

      // Next request should be blocked
      const newReq = { ...req }
      policy(newReq, res, next)

      expect(res.status.calledWith(503)).to.be.true
      expect(res.json.calledWith({
        error: 'Service temporarily unavailable',
        retryAfter: sinon.match.number
      })).to.be.true
    })

    it('should transition to half-open after timeout', function (done) {
      const policy = aiCircuitBreaker({
        failureThreshold: 2,
        recoveryTimeout: 100
      }, config)

      // Trigger circuit breaker
      req.egContext = { circuitBreakerFailure: true }
      policy(req, res, next)
      policy(req, res, next)

      // Wait for recovery timeout
      setTimeout(() => {
        const newReq = { ...req }
        policy(newReq, res, next)
        // Should allow one request in half-open state
        expect(next.called).to.be.true
        done()
      }, 150)
    })
  })

  describe('Provider-specific Circuit Breakers', function () {
    it('should maintain separate circuits per provider', function () {
      const policy = aiCircuitBreaker({}, config)

      // Fail OpenAI
      const openaiReq = { ...req, body: { model: 'gpt-4' } }
      openaiReq.egContext = { circuitBreakerFailure: true }
      for (let i = 0; i < 3; i++) {
        policy(openaiReq, res, next)
      }

      // Anthropic should still work
      const anthropicReq = { ...req, body: { model: 'claude-3' } }
      policy(anthropicReq, res, next)

      expect(next.called).to.be.true
    })
  })

  describe('Monitoring Integration', function () {
    it('should expose circuit breaker statistics', function () {
      const policy = aiCircuitBreaker({}, config)

      expect(config.circuitBreakerHealth).to.be.an('object')
      expect(config.circuitBreakerHealth.getStats).to.be.a('function')

      const stats = config.circuitBreakerHealth.getStats()
      expect(stats).to.be.an('object')
    })
  })
})
