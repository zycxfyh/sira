/**
 * AI路由器策略 - 性能测试
 * 验证路由器的性能表现和基准
 */

const {
  describe,
  beforeAll,
  afterAll,
  it,
  expect,
  jest,
} = require("@jest/globals");
const aiRouter = require("../../core/policies/ai-router");
const { testDataFactory } = require("../utils/test-data-factory");

describe("AI Router Policy - Performance Tests", () => {
  let mockConfig;
  let policy;

  beforeAll(() => {
    // 设置性能测试配置
    mockConfig = {
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
      serviceEndpoints: {
        openai: { url: "https://api.openai.com/v1" },
        anthropic: { url: "https://api.anthropic.com/v1" },
        azure: { url: "https://azure-openai.openai.azure.com" },
      },
    };

    policy = aiRouter({}, mockConfig);
  });

  afterAll(() => {
    testDataFactory.cleanup();
  });

  describe("Routing Performance", () => {
    it("should route requests within acceptable time limits", async () => {
      const requests = testDataFactory.createBatch(1000, () =>
        testDataFactory.createAIRequest(),
      );
      const startTime = performance.now();

      for (const request of requests) {
        const mockReq = {
          method: "POST",
          url: "/api/v1/ai/chat/completions",
          headers: {
            "content-type": "application/json",
            "x-api-key": "test-key",
          },
          body: request,
          egContext: {},
        };

        const mockRes = {};
        const mockNext = jest.fn();

        policy(mockReq, mockRes, mockNext);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / requests.length;

      console.log(`Performance Test Results:
        Total requests: ${requests.length}
        Total time: ${totalTime.toFixed(2)}ms
        Average time: ${avgTime.toFixed(2)}ms per request
        Requests/second: ${(1000 / avgTime).toFixed(2)}`);

      // 性能断言
      expect(avgTime).toBeLessThan(10); // 平均每次路由应小于10ms
      expect(totalTime).toBeLessThan(5000); // 1000个请求应在5秒内完成
    });

    it("should maintain performance under load balancing", () => {
      const loadBalancingConfig = {
        loadBalancing: {
          enabled: true,
          strategy: "round-robin",
        },
      };

      const loadBalancingPolicy = aiRouter(loadBalancingConfig, mockConfig);
      const requests = testDataFactory.createBatch(500, () =>
        testDataFactory.createAIRequest(),
      );

      const startTime = performance.now();

      for (const request of requests) {
        const mockReq = {
          method: "POST",
          url: "/api/v1/ai/chat/completions",
          headers: {
            "content-type": "application/json",
            "x-api-key": "test-key",
          },
          body: request,
          egContext: {},
        };

        const mockRes = {};
        const mockNext = jest.fn();

        loadBalancingPolicy(mockReq, mockRes, mockNext);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / requests.length;

      console.log(`Load Balancing Performance:
        Total requests: ${requests.length}
        Total time: ${totalTime.toFixed(2)}ms
        Average time: ${avgTime.toFixed(2)}ms per request`);

      // 负载均衡不应显著影响性能
      expect(avgTime).toBeLessThan(15);
    });

    it("should handle concurrent requests efficiently", async () => {
      const concurrentRequests = 100;
      const promises = [];

      for (let i = 0; i < concurrentRequests; i++) {
        const request = testDataFactory.createAIRequest();
        const promise = new Promise((resolve) => {
          const mockReq = {
            method: "POST",
            url: "/api/v1/ai/chat/completions",
            headers: {
              "content-type": "application/json",
              "x-api-key": "test-key",
            },
            body: request,
            egContext: {},
          };

          const mockRes = {};
          const mockNext = () => resolve();

          policy(mockReq, mockRes, mockNext);
        });

        promises.push(promise);
      }

      const startTime = performance.now();
      await Promise.all(promises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      console.log(`Concurrent Requests Performance:
        Concurrent requests: ${concurrentRequests}
        Total time: ${totalTime.toFixed(2)}ms
        Average time: ${(totalTime / concurrentRequests).toFixed(2)}ms per request`);

      // 并发请求应在合理时间内完成
      expect(totalTime).toBeLessThan(2000);
    });
  });

  describe("Memory Usage", () => {
    it("should not have memory leaks during sustained operation", async () => {
      const initialMemory = process.memoryUsage();
      const iterations = 10000;

      for (let i = 0; i < iterations; i++) {
        const request = testDataFactory.createAIRequest();
        const mockReq = {
          method: "POST",
          url: "/api/v1/ai/chat/completions",
          headers: {
            "content-type": "application/json",
            "x-api-key": "test-key",
          },
          body: request,
          egContext: {},
        };

        const mockRes = {};
        const mockNext = jest.fn();

        policy(mockReq, mockRes, mockNext);

        // 每1000次迭代检查一次内存
        if (i % 1000 === 0) {
          const currentMemory = process.memoryUsage();
          const memoryIncrease =
            currentMemory.heapUsed - initialMemory.heapUsed;

          console.log(`Memory check at iteration ${i}:
            Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
            Current heap: ${(currentMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
            Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

          // 内存增长不应过大（允许一些正常的增长）
          expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
        }
      }

      const finalMemory = process.memoryUsage();
      const totalIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Final Memory Usage:
        Initial heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        Final heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        Total increase: ${(totalIncrease / 1024 / 1024).toFixed(2)}MB`);

      // 总内存增长应在合理范围内
      expect(totalIncrease).toBeLessThan(100 * 1024 * 1024); // 100MB
    });
  });

  describe("Scalability Benchmarks", () => {
    const benchmarks = [
      { name: "Small Load", requests: 100 },
      { name: "Medium Load", requests: 1000 },
      { name: "Large Load", requests: 10000 },
    ];

    it.each(benchmarks)(
      "should scale efficiently - $name ($requests requests)",
      ({ name, requests }) => {
        const testRequests = testDataFactory.createBatch(requests, () =>
          testDataFactory.createAIRequest(),
        );
        const startTime = performance.now();

        for (const request of testRequests) {
          const mockReq = {
            method: "POST",
            url: "/api/v1/ai/chat/completions",
            headers: {
              "content-type": "application/json",
              "x-api-key": "test-key",
            },
            body: request,
            egContext: {},
          };

          const mockRes = {};
          const mockNext = jest.fn();

          policy(mockReq, mockRes, mockNext);
        }

        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const avgTime = totalTime / requests;
        const throughput = requests / (totalTime / 1000); // 请求/秒

        console.log(`${name} Benchmark Results:
        Requests: ${requests}
        Total time: ${totalTime.toFixed(2)}ms
        Average latency: ${avgTime.toFixed(2)}ms
        Throughput: ${throughput.toFixed(2)} req/sec`);

        // 吞吐量基准
        expect(throughput).toBeGreaterThan(1000); // 至少1000 req/sec
        expect(avgTime).toBeLessThan(20); // 平均延迟小于20ms
      },
    );
  });

  describe("Resource Utilization", () => {
    it("should maintain CPU usage within limits", async () => {
      const startCpu = process.cpuUsage();
      const requests = testDataFactory.createBatch(5000, () =>
        testDataFactory.createAIRequest(),
      );

      for (const request of requests) {
        const mockReq = {
          method: "POST",
          url: "/api/v1/ai/chat/completions",
          headers: {
            "content-type": "application/json",
            "x-api-key": "test-key",
          },
          body: request,
          egContext: {},
        };

        const mockRes = {};
        const mockNext = jest.fn();

        policy(mockReq, mockRes, mockNext);
      }

      const endCpu = process.cpuUsage(startCpu);
      const totalCpuTime = (endCpu.user + endCpu.system) / 1000; // 毫秒
      const avgCpuPerRequest = totalCpuTime / requests.length;

      console.log(`CPU Usage Results:
        Total CPU time: ${totalCpuTime.toFixed(2)}ms
        Average CPU per request: ${avgCpuPerRequest.toFixed(4)}ms
        Requests processed: ${requests.length}`);

      // CPU使用率应在合理范围内
      expect(avgCpuPerRequest).toBeLessThan(1); // 平均每个请求少于1ms CPU时间
    });
  });

  describe("Error Handling Performance", () => {
    it("should handle errors without performance degradation", () => {
      const normalRequests = testDataFactory.createBatch(500, () =>
        testDataFactory.createAIRequest(),
      );
      const errorRequests = testDataFactory.createBatch(500, () => ({
        ...testDataFactory.createAIRequest(),
        model: "invalid-model-that-does-not-exist",
      }));

      // 测试正常请求性能
      const normalStartTime = performance.now();
      for (const request of normalRequests) {
        const mockReq = {
          method: "POST",
          url: "/api/v1/ai/chat/completions",
          headers: {
            "content-type": "application/json",
            "x-api-key": "test-key",
          },
          body: request,
          egContext: {},
        };

        const mockRes = {};
        const mockNext = jest.fn();

        policy(mockReq, mockRes, mockNext);
      }
      const normalEndTime = performance.now();
      const normalAvgTime =
        (normalEndTime - normalStartTime) / normalRequests.length;

      // 测试错误请求性能
      const errorStartTime = performance.now();
      for (const request of errorRequests) {
        const mockReq = {
          method: "POST",
          url: "/api/v1/ai/chat/completions",
          headers: {
            "content-type": "application/json",
            "x-api-key": "test-key",
          },
          body: request,
          egContext: {},
        };

        const mockRes = {};
        const mockNext = jest.fn();

        policy(mockReq, mockRes, mockNext);
      }
      const errorEndTime = performance.now();
      const errorAvgTime =
        (errorEndTime - errorStartTime) / errorRequests.length;

      console.log(`Error Handling Performance:
        Normal requests avg time: ${normalAvgTime.toFixed(2)}ms
        Error requests avg time: ${errorAvgTime.toFixed(2)}ms
        Performance degradation: ${(((errorAvgTime - normalAvgTime) / normalAvgTime) * 100).toFixed(2)}%`);

      // 错误处理不应导致显著性能下降
      expect(errorAvgTime).toBeLessThan(normalAvgTime * 2);
    });
  });

  describe("Memory Leak Detection", () => {
    it("should not leak memory over time", async () => {
      // 运行多次GC来获得准确的内存读数
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage().heapUsed;
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const request = testDataFactory.createAIRequest();
        const mockReq = {
          method: "POST",
          url: "/api/v1/ai/chat/completions",
          headers: {
            "content-type": "application/json",
            "x-api-key": "test-key",
          },
          body: request,
          egContext: {},
        };

        const mockRes = {};
        const mockNext = jest.fn();

        policy(mockReq, mockRes, mockNext);

        // 每100次释放一些内存
        if (i % 100 === 0) {
          testDataFactory.cleanup();
        }
      }

      // 强制垃圾回收
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const allowedIncrease = 10 * 1024 * 1024; // 允许10MB的增长

      console.log(`Memory Leak Test Results:
        Initial memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB
        Final memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB
        Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB
        Allowed increase: ${(allowedIncrease / 1024 / 1024).toFixed(2)}MB`);

      // 内存增长应在允许范围内
      expect(memoryIncrease).toBeLessThan(allowedIncrease);
    });
  });
});
