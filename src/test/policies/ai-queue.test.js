const { expect } = require("chai");
const sinon = require("sinon");
const aiQueue = require("../../../core/policies/ai-queue");

describe("AI Queue Policy", () => {
  let req, res, next, config;

  beforeEach(() => {
    req = {
      method: "POST",
      url: "/api/v1/ai/chat/completions",
      body: {
        model: "gpt-4",
        messages: [{ role: "user", content: "Hello" }],
      },
      ip: "127.0.0.1",
    };

    res = {
      status: sinon.spy(),
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

  describe("Queue Management", () => {
    it("should queue requests when at capacity", (done) => {
      const policy = aiQueue(
        {
          maxConcurrent: 1,
          maxQueueSize: 10,
          timeout: 5000,
        },
        config,
      );

      // First request should proceed
      policy(req, res, next);

      // Second request should be queued
      const req2 = { ...req };
      const next2 = sinon.spy();
      policy(req2, res, next2);

      expect(next.calledOnce).to.be.true;
      // Second request should be queued
      expect(next2.called).to.be.false;

      done();
    });

    it("should reject requests when queue is full", (done) => {
      const policy = aiQueue(
        {
          maxConcurrent: 1,
          maxQueueSize: 1,
          timeout: 5000,
        },
        config,
      );

      // Fill the queue
      for (let i = 0; i < 3; i++) {
        const testReq = { ...req };
        policy(testReq, res, next);
      }

      // Last request should be rejected
      expect(res.status.calledWith(429)).to.be.true;
      expect(
        res.json.calledWith({
          error: "Queue is full",
          retryAfter: sinon.match.number,
        }),
      ).to.be.true;

      done();
    });
  });

  describe("Priority Queue", () => {
    it("should handle different priority levels", () => {
      const policy = aiQueue(
        {
          maxConcurrent: 2,
          maxQueueSize: 10,
          priorityLevels: {
            premium: 1,
            standard: 2,
            basic: 3,
          },
        },
        config,
      );

      const premiumReq = { ...req, user: { tier: "premium" } };
      const basicReq = { ...req, user: { tier: "basic" } };

      policy(premiumReq, res, next);
      policy(basicReq, res, next);

      // Premium should be processed first
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Timeout Handling", () => {
    it("should timeout queued requests", (done) => {
      const policy = aiQueue(
        {
          maxConcurrent: 1,
          maxQueueSize: 5,
          timeout: 100, // Very short timeout
        },
        config,
      );

      // Fill concurrent capacity
      policy(req, res, next);

      // Queue a request that will timeout
      const timeoutReq = { ...req };
      const timeoutRes = { ...res };
      policy(timeoutReq, timeoutRes, next);

      setTimeout(() => {
        expect(timeoutRes.status.calledWith(408)).to.be.true;
        expect(
          timeoutRes.json.calledWith({
            error: "Request timeout in queue",
          }),
        ).to.be.true;
        done();
      }, 150);
    });
  });

  describe("Load Balancing Integration", () => {
    it("should work with multiple service instances", () => {
      const policy = aiQueue(
        {
          maxConcurrent: 5,
          maxQueueSize: 20,
          loadBalancing: true,
        },
        config,
      );

      // Simulate multiple concurrent requests
      for (let i = 0; i < 10; i++) {
        const testReq = { ...req };
        policy(testReq, res, next);
      }

      expect(next.callCount).to.be.within(5, 10);
    });
  });
});
