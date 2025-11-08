const { expect } = require('chai');
const sinon = require('sinon');
const aiRouter = require('../../../src/core/policies/ai-router');

describe('AI Router Policy', () => {
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
        temperature: 0.7,
      },
    };

    res = {
      statusCode: 200,
      setHeader: sinon.spy(),
      end: sinon.spy(),
      write: sinon.spy(),
    };

    next = sinon.spy();

    config = {
      logger: {
        debug: sinon.spy(),
        info: sinon.spy(),
        warn: sinon.spy(),
        error: sinon.spy(),
      },
      serviceEndpoints: {
        openai: { url: 'http://localhost:3001/v1' },
        anthropic: { url: 'http://localhost:3001/v1' },
        azure: { url: 'http://localhost:3001/openai/deployments/gpt-4' },
      },
    };
  });

  describe('Model Routing', () => {
    it('should route OpenAI models correctly', done => {
      const policy = aiRouter({}, config);

      req.body.model = 'gpt-4';
      policy(req, res, next);

      // Verify routing logic
      expect(req.egContext).to.have.property('targetService', 'openai');
      done();
    });

    it('should route Anthropic models correctly', done => {
      const policy = aiRouter({}, config);

      req.body.model = 'claude-3-opus';
      policy(req, res, next);

      expect(req.egContext).to.have.property('targetService', 'anthropic');
      done();
    });

    it('should route Azure models correctly', done => {
      const policy = aiRouter({}, config);

      req.body.model = 'gpt-4-azure';
      policy(req, res, next);

      expect(req.egContext).to.have.property('targetService', 'azure');
      done();
    });

    it('should handle unknown models gracefully', done => {
      const policy = aiRouter({}, config);

      req.body.model = 'unknown-model';
      policy(req, res, next);

      // Should default to a service or throw appropriate error
      expect(req.egContext).to.have.property('targetService');
      done();
    });
  });

  describe('Load Balancing', () => {
    it('should distribute load across multiple endpoints', () => {
      const policy = aiRouter(
        {
          loadBalancing: {
            enabled: true,
            strategy: 'round-robin',
          },
        },
        config
      );

      const requests = [];
      for (let i = 0; i < 10; i++) {
        const testReq = { ...req, body: { ...req.body } };
        policy(testReq, res, next);
        requests.push(testReq.egContext.targetService);
      }

      // Should distribute across available services
      expect(requests).to.include('openai');
      expect(requests).to.include('anthropic');
    });

    it('should respect service weights', () => {
      const policy = aiRouter(
        {
          loadBalancing: {
            enabled: true,
            strategy: 'weighted',
            weights: {
              openai: 70,
              anthropic: 30,
            },
          },
        },
        config
      );

      const requests = [];
      for (let i = 0; i < 100; i++) {
        const testReq = { ...req, body: { ...req.body } };
        policy(testReq, res, next);
        requests.push(testReq.egContext.targetService);
      }

      const openaiCount = requests.filter(s => s === 'openai').length;
      const anthropicCount = requests.filter(s => s === 'anthropic').length;

      // OpenAI should get roughly 70% of requests
      expect(openaiCount).to.be.above(anthropicCount);
      expect(openaiCount / (openaiCount + anthropicCount)).to.be.closeTo(0.7, 0.1);
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should avoid failed services', () => {
      const policy = aiRouter(
        {
          circuitBreaker: {
            enabled: true,
            failureThreshold: 3,
          },
        },
        config
      );

      // Simulate failures for OpenAI
      for (let i = 0; i < 3; i++) {
        const testReq = { ...req, body: { ...req.body, model: 'gpt-4' } };
        testReq.egContext = { circuitBreakerFailure: true };
        policy(testReq, res, next);
      }

      // Next request should avoid OpenAI
      const testReq = { ...req, body: { ...req.body, model: 'gpt-4' } };
      policy(testReq, res, next);

      expect(testReq.egContext.targetService).to.not.equal('openai');
    });
  });

  describe('Fallback Strategy', () => {
    it('should fallback to alternative service on failure', () => {
      const policy = aiRouter(
        {
          fallback: {
            enabled: true,
            order: ['openai', 'anthropic', 'azure'],
          },
        },
        config
      );

      req.egContext = { primaryServiceFailed: true };
      req.body.model = 'gpt-4';

      policy(req, res, next);

      // Should fallback to next service in order
      expect(['anthropic', 'azure']).to.include(req.egContext.targetService);
    });
  });

  describe('Configuration Validation', () => {
    it('should validate routing configuration', () => {
      expect(() =>
        aiRouter(
          {
            loadBalancing: {
              strategy: 'invalid',
            },
          },
          config
        )
      ).to.throw();
    });

    it('should handle missing service endpoints', () => {
      const badConfig = { ...config, serviceEndpoints: {} };

      expect(() => aiRouter({}, badConfig)).to.throw();
    });
  });

  describe('Performance', () => {
    it('should route requests quickly', done => {
      const policy = aiRouter({}, config);
      const startTime = Date.now();

      policy(req, res, next);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).to.be.below(50); // Less than 50ms
      done();
    });

    it('should handle concurrent requests', done => {
      const policy = aiRouter({}, config);
      const concurrentRequests = 100;
      let completed = 0;

      for (let i = 0; i < concurrentRequests; i++) {
        const testReq = { ...req, body: { ...req.body } };
        policy(testReq, res, () => {
          completed++;
          if (completed === concurrentRequests) {
            done();
          }
        });
      }
    });
  });
});
