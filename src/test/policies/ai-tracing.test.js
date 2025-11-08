const { expect } = require('chai');
const sinon = require('sinon');
const aiTracing = require('../../../src/core/policies/ai-tracing');

describe('AI Tracing Policy', () => {
  let req, res, next, config;

  beforeEach(() => {
    req = {
      method: 'POST',
      url: '/api/v1/ai/chat/completions',
      headers: {
        'content-type': 'application/json',
        'x-api-key': 'test-key',
        'x-request-id': 'req-123',
      },
      body: {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 0.7,
      },
      ip: '127.0.0.1',
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
    };
  });

  describe('Trace Creation', () => {
    it('should create trace for AI requests', done => {
      const policy = aiTracing(
        {
          serviceName: 'sira-gateway',
          enabled: true,
        },
        config
      );

      policy(req, res, () => {
        expect(req.egContext).to.have.property('traceId');
        expect(req.egContext).to.have.property('spanId');
        expect(req.egContext).to.have.property('startTime');
        done();
      });
    });

    it('should generate unique trace IDs', () => {
      const policy = aiTracing({}, config);

      policy(req, res, next);
      const traceId1 = req.egContext.traceId;

      const req2 = { ...req };
      policy(req2, res, next);
      const traceId2 = req2.egContext.traceId;

      expect(traceId1).to.not.equal(traceId2);
    });
  });

  describe('Span Management', () => {
    it('should create spans for different operations', done => {
      const policy = aiTracing(
        {
          spans: ['request', 'routing', 'response'],
        },
        config
      );

      policy(req, res, () => {
        expect(req.egContext.spans).to.be.an('array');
        expect(req.egContext.spans).to.have.length.above(0);

        const span = req.egContext.spans[0];
        expect(span).to.have.property('name');
        expect(span).to.have.property('startTime');
        expect(span).to.have.property('tags');
        done();
      });
    });

    it('should record span timings', done => {
      const policy = aiTracing({}, config);

      const start = Date.now();
      policy(req, res, () => {
        const span = req.egContext.spans[0];
        expect(span.duration).to.be.at.least(0);
        expect(span.endTime).to.be.at.least(start);
        done();
      });
    });
  });

  describe('Distributed Tracing', () => {
    it('should handle incoming trace headers', () => {
      const policy = aiTracing({}, config);

      req.headers['x-trace-id'] = 'incoming-trace-123';
      req.headers['x-parent-span-id'] = 'parent-span-456';

      policy(req, res, next);

      expect(req.egContext.traceId).to.equal('incoming-trace-123');
      expect(req.egContext.parentSpanId).to.equal('parent-span-456');
    });

    it('should propagate trace headers to downstream', done => {
      const policy = aiTracing({}, config);

      policy(req, res, () => {
        expect(res.setHeader.calledWith('x-trace-id', req.egContext.traceId)).to.be.true;
        expect(res.setHeader.calledWith('x-span-id', req.egContext.spanId)).to.be.true;
        done();
      });
    });
  });

  describe('Performance Monitoring', () => {
    it('should track request latency', done => {
      const policy = aiTracing({}, config);

      policy(req, res, () => {
        const { trace } = req.egContext;
        expect(trace).to.have.property('totalLatency');
        expect(trace.totalLatency).to.be.a('number');
        expect(trace.totalLatency).to.be.at.least(0);
        done();
      });
    });

    it('should record AI model metrics', done => {
      const policy = aiTracing(
        {
          recordModelMetrics: true,
        },
        config
      );

      policy(req, res, () => {
        const { trace } = req.egContext;
        expect(trace).to.have.property('model', 'gpt-4');
        expect(trace).to.have.property('inputTokens');
        expect(trace).to.have.property('outputTokens');
        done();
      });
    });
  });

  describe('Error Tracing', () => {
    it('should record errors in traces', () => {
      const policy = aiTracing({}, config);

      req.egContext = { error: new Error('Test error') };
      policy(req, res, next);

      const { trace } = req.egContext;
      expect(trace).to.have.property('error');
      expect(trace.error).to.have.property('message', 'Test error');
      expect(trace.error).to.have.property('stack');
    });

    it('should handle timeout errors', () => {
      const policy = aiTracing(
        {
          timeoutTracking: true,
        },
        config
      );

      req.egContext = { timeout: true, timeoutDuration: 5000 };
      policy(req, res, next);

      const { trace } = req.egContext;
      expect(trace).to.have.property('timeout', true);
      expect(trace).to.have.property('timeoutDuration', 5000);
    });
  });

  describe('Integration with Other Systems', () => {
    it('should integrate with Jaeger tracing', () => {
      const policy = aiTracing(
        {
          exporter: 'jaeger',
          jaeger: {
            endpoint: 'http://jaeger:14268/api/traces',
          },
        },
        config
      );

      policy(req, res, next);

      // Verify Jaeger integration setup
      expect(req.egContext).to.have.property('jaegerSpan');
    });

    it('should support OpenTelemetry', () => {
      const policy = aiTracing(
        {
          exporter: 'otlp',
          otlp: {
            endpoint: 'http://otel-collector:4318',
          },
        },
        config
      );

      policy(req, res, next);

      expect(req.egContext).to.have.property('otelSpan');
    });

    it('should export to multiple systems', () => {
      const policy = aiTracing(
        {
          exporters: ['jaeger', 'otlp', 'console'],
        },
        config
      );

      policy(req, res, next);

      expect(req.egContext).to.have.property('jaegerSpan');
      expect(req.egContext).to.have.property('otelSpan');
    });
  });

  describe('Configuration', () => {
    it('should respect sampling rate', () => {
      const policy = aiTracing(
        {
          samplingRate: 0.5, // 50% sampling
        },
        config
      );

      let sampledCount = 0;
      for (let i = 0; i < 100; i++) {
        const testReq = { ...req };
        policy(testReq, res, next);
        if (testReq.egContext.sampled) {
          sampledCount++;
        }
      }

      // Should be roughly 50% (with some tolerance for randomness)
      expect(sampledCount).to.be.within(35, 65);
    });

    it('should handle invalid configuration', () => {
      expect(() => aiTracing({ samplingRate: 1.5 }, config)).to.throw();
      expect(() => aiTracing({ samplingRate: -0.1 }, config)).to.throw();
    });
  });
});
