# 🧪 Test 测试套件模块

## 📋 概述

Test模块实现了完整的测试工作流，包含9阶段测试流程，从本地验证到生产部署。该模块采用多层测试策略，确保AI网关的质量和稳定性，提供了全面的自动化测试覆盖。

## 🏗️ 架构组成

```
test/
├── common/                    # 测试公共工具
│   ├── admin-helper.js       # 管理界面测试助手
│   ├── cli.helper.js         # CLI测试助手
│   ├── file-helper.js        # 文件操作助手
│   ├── gateway.helper.js     # 网关测试助手
│   ├── output-helper.js      # 输出格式化助手
│   ├── routing.helper.js     # 路由测试助手
│   ├── server-helper.js      # 服务器测试助手
│   └── session-provider.js   # 会话提供者
├── fixtures/                  # 测试数据和配置
│   ├── gateway.config.yml    # 测试网关配置
│   ├── users.json            # 测试用户数据
│   └── policies.yml          # 测试策略配置
├── e2e/                      # 端到端测试
│   ├── basic-auth.e2e.test.js
│   ├── cli-plugin-install.e2e.test.js
│   ├── hot-reload.test.js
│   ├── key-auth.e2e.test.js
│   ├── oauth2-authorization-code.js
│   ├── policy-seq-oauth2-expression-log-ratelimit-proxy.js
│   └── round-robin.test.js
├── oauth/                     # OAuth测试
│   ├── oauth2-flow.test.js
│   ├── token-validation.test.js
│   ├── scope-check.test.js
│   └── provider-integration.test.js
├── pipelines/                 # 管道测试
│   └── empty.test.js
├── plugins/                   # 插件测试
│   ├── plugin-loader.test.js
│   ├── plugin-installer.test.js
│   └── plugin-lifecycle.test.js
├── policies/                  # 策略测试 (20个测试文件)
├── rest-api/                  # REST API测试
│   ├── apps.test.js
│   ├── credentials.test.js
│   ├── pipelines.test.js
│   ├── policies.test.js
│   ├── scopes.test.js
│   ├── service-endpoints.test.js
│   ├── tokens.test.js
│   └── users.test.js
├── routing/                   # 路由测试
├── services/                  # 服务测试
├── conditions.test.js         # 条件测试
├── config-http-hostname.test.js
├── config-https-sni.test.js
├── module.js                  # 测试模块入口
└── test-ai-gateway.js         # AI网关专项测试
```

## 🚀 九阶段测试工作流

### 1. 本地验证阶段 ✅

**目标**: 确保开发环境配置正确

```bash
# 依赖安装检查
npm install

# 环境变量验证
node test/common/env-validator.js

# 配置文件检查
node test/common/config-validator.js

# 本地服务启动测试
npm run test:local-setup
```

### 2. 自动化测试阶段 ✅

**目标**: 代码质量和单元测试

```bash
# ESLint代码检查
npm run lint

# 单元测试执行
npm run test:unit

# 代码覆盖率检查
npm run test:coverage

# 代码质量报告
npm run test:quality
```

### 3. 静态安全检查阶段 ✅

**目标**: 安全漏洞扫描和修复

```bash
# npm audit安全扫描
npm audit

# 依赖安全检查
npm run test:security-deps

# 代码安全扫描
npm run test:security-code

# 安全测试报告
npm run test:security-report
```

### 4. 集成测试阶段 ✅

**目标**: 组件协作验证

```bash
# 多组件集成测试
npm run test:integration

# Kong + Express Gateway协作测试
npm run test:kong-integration

# NATS消息队列集成测试
npm run test:nats-integration

# 数据库集成测试
npm run test:db-integration
```

### 5. PR审核流程阶段 ✅

**目标**: 代码审查自动化

```bash
# PR代码审查
npm run test:pr-review

# 代码风格检查
npm run test:code-style

# 提交信息检查
npm run test:commit-message

# 分支策略验证
npm run test:branch-policy
```

### 6. Staging部署阶段 ✅

**目标**: 容器化环境验证

```bash
# Docker镜像构建测试
npm run test:docker-build

# 容器启动测试
npm run test:container-startup

# 环境配置测试
npm run test:staging-config

# 基础功能验证
npm run test:staging-basic
```

### 7. 回归测试阶段 ✅

**目标**: 历史功能稳定性

```bash
# 全量回归测试
npm run test:regression-full

# 性能回归测试
npm run test:regression-performance

# 兼容性回归测试
npm run test:regression-compatibility

# 历史数据回归
npm run test:regression-data
```

### 8. 生产部署阶段 ✅

**目标**: 生产环境就绪验证

```bash
# 生产配置验证
npm run test:production-config

# 高可用性测试
npm run test:production-ha

# 负载均衡测试
npm run test:production-loadbalance

# 灾难恢复测试
npm run test:production-disaster
```

### 9. 监控回溯阶段 ✅

**目标**: 系统监控和告警验证

```bash
# 监控指标验证
npm run test:monitoring-metrics

# 告警规则测试
npm run test:monitoring-alerts

# 日志聚合测试
npm run test:monitoring-logs

# 可观测性端到端测试
npm run test:monitoring-e2e
```

## 🧪 测试分类详解

### 单元测试 (Unit Tests)

**策略测试示例**:

```javascript
// test/policies/ai-router.test.js
const aiRouter = require('../lib/policies/ai-router');

describe('AI Router Policy', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    mockReq = {
      body: { model: 'gpt-4', messages: [] },
      egContext: new Map(),
    };
    mockRes = {};
    mockNext = jest.fn();
  });

  it('should select OpenAI for GPT-4 requests', () => {
    const policy = aiRouter(
      {},
      {
        providers: ['openai', 'anthropic'],
      }
    );

    policy(mockReq, mockRes, mockNext);

    expect(mockReq.egContext.get('aiProvider')).toBe('openai');
    expect(mockNext).toHaveBeenCalled();
  });

  it('should handle provider failures gracefully', () => {
    const policy = aiRouter(
      {},
      {
        providers: ['failing-provider'],
        fallbackProvider: 'openai',
      }
    );

    policy(mockReq, mockRes, mockNext);

    expect(mockReq.egContext.get('aiProvider')).toBe('openai');
  });
});
```

**服务测试示例**:

```javascript
// test/services/auth.test.js
const authService = require('../lib/services/auth');

describe('Authentication Service', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('authenticate()', () => {
    it('should authenticate valid credentials', async () => {
      const result = await authService.authenticate({
        username: 'testuser',
        password: 'validpassword',
      });

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.username).toBe('testuser');
    });

    it('should reject invalid credentials', async () => {
      await expect(
        authService.authenticate({
          username: 'testuser',
          password: 'wrongpassword',
        })
      ).rejects.toThrow('Invalid credentials');
    });
  });
});
```

### 集成测试 (Integration Tests)

**端到端流程测试**:

```javascript
// test/e2e/ai-gateway.e2e.test.js
const { setupGateway, teardownGateway } = require('../common/gateway.helper');

describe('Sira E2E', () => {
  let gateway;

  beforeAll(async () => {
    gateway = await setupGateway({
      config: 'test/fixtures/gateway.config.yml',
    });
  });

  afterAll(async () => {
    await teardownGateway(gateway);
  });

  it('should handle complete AI request flow', async () => {
    const response = await gateway.request({
      method: 'POST',
      path: '/api/v1/ai/chat/completions',
      headers: {
        'x-api-key': 'test-key',
        'Content-Type': 'application/json',
      },
      body: {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello!' }],
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('choices');
    expect(response.headers).toHaveProperty('x-cache-status');
    expect(response.headers).toHaveProperty('x-ai-provider');
  });
});
```

### 性能测试 (Performance Tests)

**负载测试**:

```javascript
// test/performance/load.test.js
const loadTest = require('loadtest');

describe('Load Testing', () => {
  it('should handle 100 concurrent requests', async () => {
    const options = {
      url: 'http://localhost:8080/api/v1/ai/chat/completions',
      maxRequests: 1000,
      concurrency: 100,
      method: 'POST',
      body: {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Test' }],
      },
      headers: {
        'x-api-key': 'test-key',
        'Content-Type': 'application/json',
      },
    };

    const result = await loadTest.loadTest(options);

    expect(result.totalErrors).toBe(0);
    expect(result.meanLatencyMs).toBeLessThan(1000);
    expect(result.percentiles['50']).toBeLessThan(500);
  });
});
```

## 🛠️ 测试工具和助手

### 测试助手 (Test Helpers)

**网关测试助手**:

```javascript
// test/common/gateway.helper.js
class GatewayHelper {
  static async setupGateway(config) {
    // 启动测试网关实例
    const gateway = new Gateway(config);

    // 配置测试中间件
    gateway.use(testMiddleware());

    // 等待网关就绪
    await gateway.ready();

    return gateway;
  }

  static async teardownGateway(gateway) {
    // 清理测试数据
    await gateway.clearData();

    // 停止网关
    await gateway.stop();
  }

  static createTestRequest(overrides = {}) {
    return {
      method: 'GET',
      path: '/test',
      headers: {},
      body: null,
      ...overrides,
    };
  }
}
```

**数据库测试助手**:

```javascript
// test/common/db.helper.js
class DatabaseHelper {
  static async setupTestDatabase() {
    // 创建测试数据库
    const db = new Database({
      url: 'mongodb://localhost:27017/test-db',
    });

    // 插入测试数据
    await db.seed(testData);

    return db;
  }

  static async teardownTestDatabase(db) {
    // 清理测试数据
    await db.clear();

    // 关闭连接
    await db.close();
  }
}
```

### 测试配置管理

**测试环境配置**:

```javascript
// test/config/test.config.js
module.exports = {
  // 测试数据库配置
  database: {
    url: process.env.TEST_DB_URL || 'mongodb://localhost:27017/test',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    },
  },

  // 测试AI提供商配置
  ai: {
    providers: {
      mock: {
        apiKey: 'test-key',
        baseUrl: 'http://localhost:3001/mock',
      },
    },
  },

  // 测试服务器配置
  server: {
    port: 3000,
    host: 'localhost',
  },
};
```

## 📊 测试报告和指标

### 测试覆盖率报告

```bash
# 生成覆盖率报告
npm run test:coverage

# HTML报告查看
open coverage/lcov-report/index.html

# 覆盖率阈值检查
npm run test:coverage-check
```

### 质量门禁 (Quality Gates)

```javascript
// test/quality-gates.js
const qualityGates = {
  // 单元测试覆盖率
  unitCoverage: {
    statements: 80,
    branches: 75,
    functions: 85,
    lines: 80,
  },

  // 性能基准
  performance: {
    responseTime: 500, // ms
    throughput: 100, // req/sec
    errorRate: 0.1, // %
  },

  // 安全检查
  security: {
    vulnerabilities: 0,
    deprecatedPackages: 0,
    securityHeaders: true,
  },
};
```

## 🎯 测试策略和最佳实践

### 1. 测试金字塔策略

```
   /\
  /  \    E2E Tests (10%)
 /____\   Integration Tests (20%)
|    |    Unit Tests (70%)
 -----
```

### 2. 测试数据管理

```javascript
// 测试数据工厂
class TestDataFactory {
  static createUser(overrides = {}) {
    return {
      username: faker.internet.userName(),
      email: faker.internet.email(),
      password: faker.internet.password(),
      ...overrides,
    };
  }

  static createAIRequest(overrides = {}) {
    return {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: faker.lorem.sentence(),
        },
      ],
      temperature: 0.7,
      ...overrides,
    };
  }
}
```

### 3. 异步测试处理

```javascript
// 异步操作测试
it('should handle async AI requests', async () => {
  const requestId = await gateway.submitAsyncRequest(testData);

  // 等待异步处理完成
  await waitForAsyncCompletion(requestId, { timeout: 30000 });

  // 验证结果
  const result = await gateway.getAsyncResult(requestId);
  expect(result).toHaveProperty('status', 'completed');
});
```

## 📈 测试自动化

### CI/CD集成

```yaml
# .github/workflows/test.yml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [16, 18, 20]

    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}

      - name: Install dependencies
        run: npm ci

      - name: Run lint
        run: npm run lint

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### 测试并行化

```javascript
// test/parallel-runner.js
const { runTestsInParallel } = require('test-parallel-runner');

async function runParallelTests() {
  const testSuites = [
    'test/policies/**/*.test.js',
    'test/services/**/*.test.js',
    'test/e2e/**/*.test.js',
  ];

  const results = await runTestsInParallel(testSuites, {
    workers: 4,
    timeout: 60000,
  });

  return results;
}
```

## 📊 统计信息

| 测试类型 | 文件数量    | 代码行数      | 覆盖率目标 |
| -------- | ----------- | ------------- | ---------- |
| 单元测试 | 45+         | ~8,500行      | 85%        |
| 集成测试 | 15+         | ~3,200行      | 90%        |
| E2E测试  | 8+          | ~1,800行      | 95%        |
| 性能测试 | 5+          | ~600行        | -          |
| 测试助手 | 8+          | ~1,200行      | -          |
| **总计** | **81+文件** | **~15,300行** | **88%**    |

## 🔗 相关链接

- **[主README](../README.md)** - 项目总览
- **[测试运行](../README-AI.md#测试)** - 测试执行指南
- **[质量保证](../README-AI.md#完整的测试工作流)** - 测试工作流详解
- **[CI/CD配置](../.github/workflows/)** - 自动化测试配置

## 🤝 测试开发指南

### 1. 添加新测试

```bash
# 生成测试文件模板
npm run generate:test -- --type unit --name my-feature

# 运行特定测试
npm test -- --grep "my-feature"
```

### 2. 测试调试

```javascript
// 调试模式运行
DEBUG=test:* npm test

// 步进调试
node --inspect-brk test/policies/ai-router.test.js
```

### 3. 性能基准测试

```javascript
// 建立性能基准
npm run test:benchmark

// 性能回归检测
npm run test:performance-regression
```

---

_最后更新: 2025年11月7日_ | 🔙 [返回模块列表](../README.md#模块导航)
