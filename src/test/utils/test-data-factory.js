/**
 * 测试数据工厂
 * 提供生成各种测试数据的工具函数
 */

const { faker } = require("@faker-js/faker");
const { v4: uuidv4 } = require("uuid");

class TestDataFactory {
  constructor() {
    this.createdEntities = new Map();
  }

  /**
   * 生成测试用户
   */
  createUser(overrides = {}) {
    const user = {
      id: uuidv4(),
      username: faker.internet.userName(),
      email: faker.internet.email(),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      role: "user",
      status: "active",
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };

    this.createdEntities.set(`user-${user.id}`, user);
    return user;
  }

  /**
   * 生成测试应用
   */
  createApplication(overrides = {}) {
    const owner = overrides.owner || this.createUser();
    const app = {
      id: uuidv4(),
      name: faker.company.name(),
      description: faker.lorem.sentence(),
      ownerId: owner.id,
      status: "active",
      apiKey: this.createApiKey({ applicationId: null }),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };

    this.createdEntities.set(`app-${app.id}`, app);
    return app;
  }

  /**
   * 生成测试API密钥
   */
  createApiKey(overrides = {}) {
    const key = {
      id: uuidv4(),
      key: `sk_test_${faker.string.alphanumeric(48)}`,
      name: faker.lorem.words(2),
      scopes: ["read", "write"],
      applicationId: overrides.applicationId || uuidv4(),
      expiresAt: faker.date.future(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides,
    };

    this.createdEntities.set(`key-${key.id}`, key);
    return key;
  }

  /**
   * 生成测试AI请求
   */
  createAIRequest(overrides = {}) {
    const models = [
      "gpt-3.5-turbo",
      "gpt-4",
      "gpt-4-turbo",
      "claude-3-opus",
      "claude-3-sonnet",
      "gpt-4-azure",
      "claude-2",
    ];

    const request = {
      id: uuidv4(),
      model: faker.helpers.arrayElement(models),
      messages: [
        {
          role: "user",
          content: faker.lorem.sentences(2),
        },
      ],
      temperature: faker.number.float({ min: 0, max: 2, precision: 0.1 }),
      max_tokens: faker.number.int({ min: 1, max: 4096 }),
      stream: faker.datatype.boolean(),
      user: faker.internet.userName(),
      createdAt: faker.date.recent(),
      ...overrides,
    };

    this.createdEntities.set(`request-${request.id}`, request);
    return request;
  }

  /**
   * 生成测试AI响应
   */
  createAIResponse(request, overrides = {}) {
    const response = {
      id: `chatcmpl-${faker.string.alphanumeric(14)}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: request.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: faker.lorem.paragraphs(2),
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: faker.number.int({ min: 10, max: 1000 }),
        completion_tokens: faker.number.int({ min: 10, max: 2000 }),
        total_tokens: faker.number.int({ min: 20, max: 3000 }),
      },
      requestId: request.id,
      ...overrides,
    };

    return response;
  }

  /**
   * 生成测试性能指标
   */
  createPerformanceMetrics(overrides = {}) {
    const metrics = {
      requestId: uuidv4(),
      responseTime: faker.number.int({ min: 100, max: 10000 }),
      tokensProcessed: faker.number.int({ min: 10, max: 4000 }),
      cost: faker.number.float({ min: 0.001, max: 0.5, precision: 0.0001 }),
      success: faker.datatype.boolean({ probability: 0.95 }),
      errorType: null,
      timestamp: faker.date.recent(),
      ...overrides,
    };

    // 如果不成功，添加错误类型
    if (!metrics.success) {
      metrics.errorType = faker.helpers.arrayElement([
        "timeout",
        "rate_limit",
        "server_error",
        "network_error",
      ]);
    }

    return metrics;
  }

  /**
   * 生成测试批次数据
   */
  createBatch(size = 10, factoryFunction, ...args) {
    return Array.from({ length: size }, () =>
      factoryFunction.apply(this, args),
    );
  }

  /**
   * 生成测试数据集
   */
  createDataset(name, size = 100) {
    const datasets = {
      users: () => this.createBatch(size, this.createUser.bind(this)),
      applications: () =>
        this.createBatch(size, this.createApplication.bind(this)),
      apiKeys: () => this.createBatch(size, this.createApiKey.bind(this)),
      aiRequests: () => this.createBatch(size, this.createAIRequest.bind(this)),
      performance: () =>
        this.createBatch(size, this.createPerformanceMetrics.bind(this)),
    };

    if (!datasets[name]) {
      throw new Error(`Unknown dataset type: ${name}`);
    }

    return datasets[name]();
  }

  /**
   * 创建完整的测试场景
   */
  createScenario(name) {
    const scenarios = {
      basicUser: () => ({
        user: this.createUser(),
        app: this.createApplication(),
        apiKey: this.createApiKey(),
      }),

      aiInteraction: () => {
        const user = this.createUser();
        const app = this.createApplication({ owner: user });
        const apiKey = this.createApiKey({ applicationId: app.id });
        const request = this.createAIRequest();
        const response = this.createAIResponse(request);

        return {
          user,
          app,
          apiKey,
          request,
          response,
          metrics: this.createPerformanceMetrics({
            requestId: request.id,
            responseTime: faker.number.int({ min: 500, max: 3000 }),
          }),
        };
      },

      loadTest: () => ({
        users: this.createBatch(50, this.createUser.bind(this)),
        apps: this.createBatch(20, this.createApplication.bind(this)),
        requests: this.createBatch(1000, this.createAIRequest.bind(this)),
        metrics: this.createBatch(
          1000,
          this.createPerformanceMetrics.bind(this),
        ),
      }),
    };

    if (!scenarios[name]) {
      throw new Error(`Unknown scenario: ${name}`);
    }

    return scenarios[name]();
  }

  /**
   * 清理创建的实体
   */
  cleanup() {
    this.createdEntities.clear();
  }

  /**
   * 获取创建的实体统计
   */
  getStats() {
    const stats = {};
    for (const [key] of this.createdEntities) {
      const type = key.split("-")[0];
      stats[type] = (stats[type] || 0) + 1;
    }
    return stats;
  }

  /**
   * 查找实体
   */
  findEntity(type, id) {
    return this.createdEntities.get(`${type}-${id}`);
  }

  /**
   * 获取所有实体
   */
  getAllEntities(type) {
    const entities = [];
    for (const [key, entity] of this.createdEntities) {
      if (key.startsWith(`${type}-`)) {
        entities.push(entity);
      }
    }
    return entities;
  }
}

// 创建单例实例
const testDataFactory = new TestDataFactory();

module.exports = {
  TestDataFactory,
  testDataFactory,
};
