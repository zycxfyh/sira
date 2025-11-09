/**
 * Jest全局设置文件
 * 为所有测试提供通用的设置和工具
 */

// 设置测试环境变量
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error"; // 减少测试时的日志输出

// 禁用可能导致异步操作的功能
process.env.DISABLE_USAGE_ANALYTICS = "true";
process.env.DISABLE_AUTO_ROTATION = "true";
process.env.DISABLE_SCHEDULED_TASKS = "true";

// 设置测试环境的安全配置
process.env.EG_CRYPTO_CIPHER_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"; // 64字符的十六进制 = 32字节
process.env.EG_SESSION_SECRET =
  "test-session-secret-for-jest-testing-only-64-chars-1234567890123456789012345678901234567890123456789012345678901234";

// 全局测试工具
global.testConfig = {
  timeout: 10000,
  retries: 3,
  slowThreshold: 1000,
};

// 测试辅助函数
global.testHelpers = {
  // 生成随机ID
  generateId: () => Math.random().toString(36).substr(2, 9),

  // 创建测试用户
  createTestUser: (overrides = {}) => ({
    id: global.testHelpers.generateId(),
    username: `testuser_${global.testHelpers.generateId()}`,
    email: `test${global.testHelpers.generateId()}@example.com`,
    role: "user",
    ...overrides,
  }),

  // 创建测试应用
  createTestApp: (overrides = {}) => ({
    id: global.testHelpers.generateId(),
    name: `Test App ${global.testHelpers.generateId()}`,
    description: "Test application for automated testing",
    owner: global.testHelpers.createTestUser(),
    ...overrides,
  }),

  // 创建测试API密钥
  createTestApiKey: (overrides = {}) => ({
    id: global.testHelpers.generateId(),
    key: `sk_test_${global.testHelpers.generateId()}`,
    name: `Test Key ${global.testHelpers.generateId()}`,
    scopes: ["read", "write"],
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后过期
    ...overrides,
  }),

  // 模拟延迟
  delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),

  // 重试函数
  retry: async (fn, maxRetries = 3, delayMs = 1000) => {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (i < maxRetries - 1) {
          await global.testHelpers.delay(delayMs);
        }
      }
    }
    throw lastError;
  },
};

// Mock服务器管理器
global.mockServer = {
  servers: new Map(),

  // 启动Mock服务器
  async start(type, config = {}) {
    const { mockServerManager } = require("../common/mock-server-manager");
    const server = await mockServerManager.startServer(type, config);
    this.servers.set(type, server);
    return server;
  },

  // 停止Mock服务器
  async stop(type) {
    const server = this.servers.get(type);
    if (server) {
      await server.stop();
      this.servers.delete(type);
    }
  },

  // 停止所有Mock服务器
  async stopAll() {
    for (const [_type, server] of this.servers) {
      await server.stop();
    }
    this.servers.clear();
  },
};

// 数据库清理工具
global.databaseCleaner = {
  // 清理测试数据库
  async clean() {
    // 这里可以添加数据库清理逻辑
    // 例如清理Redis、清理文件数据库等
  },
};

// 性能监控工具
global.performanceMonitor = {
  start: (name) => {
    console.time(`⏱️  ${name}`);
    return { name, startTime: Date.now() };
  },

  end: (monitor) => {
    console.timeEnd(`⏱️  ${monitor.name}`);
    const duration = Date.now() - monitor.startTime;
    return duration;
  },
};

// 在所有测试结束后清理资源
afterAll(async () => {
  await global.mockServer.stopAll();
  await global.databaseCleaner.clean();

  // 清理全局模块资源
  if (
    global.usageAnalytics &&
    typeof global.usageAnalytics.cleanup === "function"
  ) {
    global.usageAnalytics.cleanup();
  }

  if (
    global.parameterManager &&
    typeof global.parameterManager.cleanup === "function"
  ) {
    global.parameterManager.cleanup();
  }

  if (
    global.apiKeyManager &&
    typeof global.apiKeyManager.cleanup === "function"
  ) {
    global.apiKeyManager.cleanup();
  }

  if (
    global.promptTemplateManager &&
    typeof global.promptTemplateManager.cleanup === "function"
  ) {
    global.promptTemplateManager.cleanup();
  }

  // 清理全局事件监听器
  if (typeof process !== "undefined" && process.removeAllListeners) {
    // 只清理我们添加的监听器，避免影响 Node.js 内部监听器
    const listenersToKeep = [
      "SIGINT",
      "SIGTERM",
      "uncaughtException",
      "unhandledRejection",
    ];
    const allEvents = process.eventNames();

    for (const event of allEvents) {
      if (!listenersToKeep.includes(event)) {
        process.removeAllListeners(event);
      }
    }
  }
});

// 在每个测试套件后清理
afterEach(async () => {
  // 清理可能存在的全局状态
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// 自定义Jest匹配器
expect.extend({
  // 检查响应时间是否在可接受范围内
  toHaveAcceptableResponseTime(received, maxTime = 1000) {
    const pass = received < maxTime;
    return {
      message: () =>
        `expected response time ${received}ms to be less than ${maxTime}ms`,
      pass,
    };
  },

  // 检查API响应是否符合模式
  toMatchApiResponse(received, _expectedSchema) {
    // 这里可以实现更复杂的模式匹配
    const pass = typeof received === "object" && received !== null;
    return {
      message: () =>
        `expected API response to match schema, but received: ${JSON.stringify(received)}`,
      pass,
    };
  },
});

// 控制台输出控制
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // 在测试中抑制不重要的控制台输出
  console.error = (...args) => {
    if (
      args[0] &&
      typeof args[0] === "string" &&
      (args[0].includes("Warning: ReactDOM.render is no longer supported") ||
        args[0].includes("Warning: React.createFactory is deprecated"))
    ) {
      return;
    }
    originalConsoleError(...args);
  };

  console.warn = (...args) => {
    if (
      args[0] &&
      typeof args[0] === "string" &&
      args[0].includes("Warning: ")
    ) {
      return;
    }
    originalConsoleWarn(...args);
  };
});

afterAll(() => {
  // 恢复原始控制台方法
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});
