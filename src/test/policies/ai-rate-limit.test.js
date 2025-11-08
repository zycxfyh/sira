const { expect } = require('chai');
const sinon = require('sinon');
const aiRateLimit = require('../../../src/core/policies/ai-rate-limit');

describe('AI Rate Limit Policy', () => {
  let req, res, next, config;

  beforeEach(() => {
    req = {
      method: 'POST',
      url: '/api/v1/ai/chat/completions',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'test-key',
      },
      body: {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }],
      },
      ip: '127.0.0.1',
    };

    res = {
      statusCode: 200,
      setHeader: sinon.spy(),
      end: sinon.spy(),
      write: sinon.spy(),
      status(code) {
        this.statusCode = code;
        return this;
      },
      json: sinon.spy(),
    };

    next = sinon.spy();

    config = {
      logger: {
        debug: sinon.spy(),
        info: sinon.spy(),
        warn: sinon.spy(),
        error: sinon.spy(),
      },
    };
  });

  describe('Rate Limiting Logic', () => {
    it('should allow requests within limits', done => {
      const policy = aiRateLimit(
        {
          windowMs: 60000, // 1 minute
          maxTokens: 100,
          tokensPerRequest: 1,
        },
        config
      );

      policy(req, res, next);

      setTimeout(() => {
        expect(next.calledOnce).to.be.true;
        done();
      }, 10);
    });

    it('should block requests exceeding limits', done => {
      const policy = aiRateLimit(
        {
          windowMs: 1000, // 1 second
          maxTokens: 2,
          tokensPerRequest: 1,
        },
        config
      );

      // Make 3 requests quickly
      policy(req, res, next);
      policy(req, res, next);
      policy(req, res, next);

      setTimeout(() => {
        // Third request should be blocked
        expect(res.statusCode).to.equal(429);
        expect(
          res.json.calledWith({
            error: 'Rate limit exceeded',
            retryAfter: sinon.match.number,
          })
        ).to.be.true;
        done();
      }, 10);
    });

    it('should reset limits after window expires', done => {
      const policy = aiRateLimit(
        {
          windowMs: 100, // Very short window
          maxTokens: 1,
          tokensPerRequest: 1,
        },
        config
      );

      // First request
      policy(req, res, next);

      setTimeout(() => {
        // Second request after window expires
        policy(req, res, next);
        expect(next.calledTwice).to.be.true;
        done();
      }, 150);
    });
  });

  describe('Token Consumption', () => {
    it('should consume tokens based on request complexity', () => {
      const policy = aiRateLimit(
        {
          windowMs: 60000,
          maxTokens: 100,
          tokensPerRequest: {
            'gpt-3.5-turbo': 1,
            'gpt-4': 5,
            'claude-3-opus': 10,
          },
        },
        config
      );

      // Test different models consume different tokens
      const models = ['gpt-3.5-turbo', 'gpt-4', 'claude-3-opus'];
      models.forEach(model => {
        const testReq = { ...req, body: { ...req.body, model } };
        policy(testReq, res, next);
      });

      // Verify different consumption rates
      expect(next.callCount).to.equal(3);
    });

    it('should handle token calculation errors gracefully', () => {
      const policy = aiRateLimit(
        {
          windowMs: 60000,
          maxTokens: 100,
          tokensPerRequest: 'invalid',
        },
        config
      );

      expect(() => policy(req, res, next)).to.not.throw();
    });
  });

  describe('Different Strategies', () => {
    it('should support IP-based rate limiting', () => {
      const policy = aiRateLimit(
        {
          windowMs: 60000,
          maxTokens: 10,
          strategy: 'ip',
        },
        config
      );

      policy(req, res, next);
      expect(next.calledOnce).to.be.true;
    });

    it('should support user-based rate limiting', () => {
      const policy = aiRateLimit(
        {
          windowMs: 60000,
          maxTokens: 10,
          strategy: 'user',
        },
        config
      );

      req.user = { id: 'user123' };
      policy(req, res, next);
      expect(next.calledOnce).to.be.true;
    });

    it('should support API key-based rate limiting', () => {
      const policy = aiRateLimit(
        {
          windowMs: 60000,
          maxTokens: 10,
          strategy: 'api-key',
        },
        config
      );

      policy(req, res, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe('Response Headers', () => {
    it('should set rate limit headers', done => {
      const policy = aiRateLimit(
        {
          windowMs: 60000,
          maxTokens: 100,
          tokensPerRequest: 1,
        },
        config
      );

      policy(req, res, () => {
        expect(res.setHeader.calledWith('X-RateLimit-Limit', 100)).to.be.true;
        expect(res.setHeader.calledWith('X-RateLimit-Remaining')).to.be.true;
        expect(res.setHeader.calledWith('X-RateLimit-Reset')).to.be.true;
        done();
      });
    });
  });
});
