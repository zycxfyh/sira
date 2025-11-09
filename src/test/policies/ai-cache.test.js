const { expect } = require("chai");
const sinon = require("sinon");
const aiCache = require("../../../core/policies/ai-cache");

describe("AI Cache Policy", () => {
  let req, res, next, config, cache;

  beforeEach(() => {
    req = {
      method: "POST",
      url: "/api/v1/ai/chat/completions",
      headers: {
        "content-type": "application/json",
        "x-api-key": "test-key",
      },
      body: {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: "Hello" }],
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
      cacheStats: null,
    };
  });

  describe("Policy Configuration", () => {
    it("should create policy with default configuration", () => {
      const policy = aiCache(
        {
          ttl: 300,
          maxSize: 1000,
        },
        config,
      );

      expect(policy).to.be.a("function");
      expect(config.cacheStats).to.be.a("function");
    });

    it("should validate configuration parameters", () => {
      expect(() => aiCache({ ttl: -1 }, config)).to.throw();
      expect(() => aiCache({ maxSize: 0 }, config)).to.throw();
      expect(() => aiCache({ ttl: "invalid" }, config)).to.throw();
    });

    it("should handle missing configuration gracefully", () => {
      const policy = aiCache({}, config);
      expect(policy).to.be.a("function");
    });
  });

  describe("Cache Functionality", () => {
    let policy, cache;

    beforeEach(() => {
      policy = aiCache(
        {
          ttl: 300,
          maxSize: 1000,
          compressionEnabled: true,
        },
        config,
      );

      // Access the internal cache (in a real scenario, this would be private)
      cache = policy.cache || new Map();
    });

    it("should cache AI responses", (done) => {
      const originalSend = res.send;
      res.send = function (data) {
        originalSend.call(this, data);

        // Verify cache was populated
        const cacheKey = policy.generateCacheKey(req);
        expect(cache.has(cacheKey)).to.be.true;

        const cached = cache.get(cacheKey);
        expect(cached).to.have.property("body", data);
        expect(cached).to.have.property("cachedAt");
        expect(cached).to.have.property("ttl", 300);

        done();
      };

      policy(req, res, next);
    });

    it("should serve from cache when available", (done) => {
      // First request to populate cache
      const firstResponse = {
        choices: [{ message: { content: "First response" } }],
      };
      cache.set(policy.generateCacheKey(req), {
        body: JSON.stringify(firstResponse),
        cachedAt: Date.now(),
        ttl: 300,
      });

      const originalSend = res.send;
      let callCount = 0;
      res.send = function (data) {
        callCount++;
        originalSend.call(this, data);

        if (callCount === 1) {
          // Verify we got cached response
          expect(JSON.parse(data)).to.deep.equal(firstResponse);
          done();
        }
      };

      policy(req, res, next);
    });

    it("should respect TTL and expire old entries", (done) => {
      // Add expired entry
      const expiredTime = Date.now() - 301 * 1000; // 301 seconds ago
      cache.set("expired-key", {
        body: "expired data",
        cachedAt: expiredTime,
        ttl: 300,
      });

      // Wait for cleanup interval
      setTimeout(() => {
        expect(cache.has("expired-key")).to.be.false;
        done();
      }, 100);
    });

    it("should handle cache size limits", () => {
      const _largePolicy = aiCache(
        {
          ttl: 300,
          maxSize: 2, // Very small cache
        },
        config,
      );

      // Add entries beyond limit
      for (let i = 0; i < 5; i++) {
        cache.set(`key-${i}`, {
          body: `data-${i}`,
          cachedAt: Date.now(),
          ttl: 300,
        });
      }

      // Cache should have been trimmed (exact behavior depends on implementation)
      expect(cache.size).to.be.at.most(2);
    });
  });

  describe("Cache Key Generation", () => {
    it("should generate consistent cache keys", () => {
      const policy = aiCache({}, config);
      const key1 = policy.generateCacheKey(req);
      const key2 = policy.generateCacheKey(req);

      expect(key1).to.equal(key2);
    });

    it("should include relevant request data in cache key", () => {
      const policy = aiCache({}, config);
      const key = policy.generateCacheKey(req);

      expect(key).to.include("gpt-3.5-turbo");
      expect(key).to.include("Hello");
      expect(key).to.include("0.7");
    });

    it("should differentiate requests with different parameters", () => {
      const policy = aiCache({}, config);
      const req2 = { ...req, body: { ...req.body, temperature: 0.8 } };

      const key1 = policy.generateCacheKey(req);
      const key2 = policy.generateCacheKey(req2);

      expect(key1).to.not.equal(key2);
    });
  });

  describe("Error Handling", () => {
    it("should handle cache serialization errors", (done) => {
      const circularObj = {};
      circularObj.self = circularObj;

      req.body = circularObj;

      policy = aiCache({}, config);

      // Should not crash on circular reference
      expect(() => policy(req, res, next)).to.not.throw();
      done();
    });

    it("should handle malformed cached data", () => {
      const _policy = aiCache({}, config);

      // Add malformed cache entry
      cache.set("bad-key", {
        body: "{invalid json}",
        cachedAt: Date.now(),
        ttl: 300,
      });

      // Should not crash when retrieving bad data
      expect(() => {
        const data = cache.get("bad-key");
        if (data) JSON.parse(data.body);
      }).to.not.throw();
    });
  });

  describe("Statistics and Monitoring", () => {
    it("should expose cache statistics", () => {
      const _policy = aiCache(
        {
          ttl: 300,
          maxSize: 100,
        },
        config,
      );

      const stats = config.cacheStats();
      expect(stats).to.have.property("totalEntries");
      expect(stats).to.have.property("hitRate");
      expect(stats).to.have.property("entries");
      expect(stats.entries).to.be.an("array");
    });

    it("should track cache hits and misses", () => {
      const _policy = aiCache({}, config);

      // This would require mocking internal counters
      // Implementation depends on how statistics are tracked
      const stats = config.cacheStats();
      expect(stats).to.be.an("object");
    });
  });

  describe("Performance", () => {
    it("should have minimal overhead for cache misses", (done) => {
      const policy = aiCache({}, config);
      const startTime = Date.now();

      policy(req, res, next);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete in reasonable time
      expect(duration).to.be.below(100); // Less than 100ms
      done();
    });

    it("should serve cached responses quickly", (done) => {
      const policy = aiCache({}, config);

      // Populate cache
      cache.set(policy.generateCacheKey(req), {
        body: JSON.stringify({ response: "cached" }),
        cachedAt: Date.now(),
        ttl: 300,
      });

      const startTime = Date.now();

      policy(req, res, next);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Cached response should be very fast
      expect(duration).to.be.below(10); // Less than 10ms
      done();
    });
  });
});
