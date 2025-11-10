# 🔧 Sira AI网关依赖关系重构方案

## 📋 问题诊断

### 🔍 当前架构问题

1. **路径依赖复杂**
   - 多层相对路径: `require('../../../core/xxx')`
   - 路径计算复杂，容易出错
   - 重构时需要大量修改导入语句

2. **依赖关系混乱**
   - 循环依赖风险高
   - 模块间耦合度过高
   - 依赖方向不清晰

3. **模块职责不清**
   - 一个文件承担多种职责
   - 接口定义不明确
   - 错误处理不统一

4. **配置管理分散**
   - 配置加载逻辑分散在各模块
   - 环境变量处理不统一
   - 默认值硬编码在各处

## 🛠️ 重构方案

### 阶段1：建立模块化架构 (Week 1-2)

#### 1.1 创建模块索引文件

**目标**: 统一模块导出，避免复杂的相对路径

```javascript
// src/core/index.js - 核心模块统一导出
const { IntelligentRoutingManager } = require('./routing/intelligent-routing-manager');
const { ComplexityAnalyzer } = require('./routing/complexity-analyzer');
const { CacheManager } = require('./cache/cache-manager');
const { RateLimiter } = require('./rate-limit/rate-limiter');
const { logger } = require('./services/logger');
const { metrics } = require('./services/metrics');

module.exports = {
  // 路由相关
  IntelligentRoutingManager,
  ComplexityAnalyzer,

  // 缓存相关
  CacheManager,

  // 限流相关
  RateLimiter,

  // 基础服务
  logger,
  metrics,

  // 便捷访问
  get services() {
    return require('./services');
  },

  get routing() {
    return require('./routing');
  },

  get cache() {
    return require('./cache');
  }
};
```

#### 1.2 重构目录结构

**新的目录结构：**
```
src/
├── core/                    # 核心业务逻辑
│   ├── index.js            # 统一导出
│   ├── routing/            # 路由模块
│   │   ├── index.js        # 路由模块导出
│   │   ├── intelligent-router.js
│   │   ├── complexity-analyzer.js
│   │   ├── decision-engine.js
│   │   └── strategies/
│   ├── cache/              # 缓存模块
│   │   ├── index.js
│   │   ├── memory-cache.js
│   │   ├── redis-cache.js
│   │   └── cache-manager.js
│   ├── rate-limit/         # 限流模块
│   ├── services/           # 基础服务
│   │   ├── index.js
│   │   ├── logger.js
│   │   ├── metrics.js
│   │   └── config.js
│   └── types/              # 类型定义
├── api/                    # API层
├── middleware/             # 中间件
├── utils/                  # 工具函数
└── config/                 # 配置管理
```

#### 1.3 依赖注入容器

**目标**: 解决模块间耦合，统一依赖管理

```javascript
// src/core/services/container.js
class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.factories = new Map();
  }

  register(name, service) {
    this.services.set(name, service);
    return this;
  }

  factory(name, factoryFn) {
    this.factories.set(name, factoryFn);
    return this;
  }

  get(name) {
    if (this.services.has(name)) {
      return this.services.get(name);
    }

    if (this.factories.has(name)) {
      const factory = this.factories.get(name);
      const service = factory(this);
      this.services.set(name, service);
      return service;
    }

    throw new Error(`Service ${name} not found`);
  }

  has(name) {
    return this.services.has(name) || this.factories.has(name);
  }
}

// 默认容器配置
const container = new ServiceContainer();

// 注册基础服务
container
  .factory('logger', () => require('./logger').createLogger())
  .factory('cache', (c) => new CacheManager({ logger: c.get('logger') }))
  .factory('metrics', () => new MetricsCollector())
  .factory('router', (c) => new IntelligentRouter({
    cache: c.get('cache'),
    logger: c.get('logger'),
    metrics: c.get('metrics')
  }));

module.exports = { ServiceContainer, container };
```

### 阶段2：接口抽象和契约定义 (Week 3-4)

#### 2.1 定义模块接口

**目标**: 明确模块职责和接口契约

```javascript
// src/core/types/interfaces.js

/**
 * 路由器接口契约
 * @interface
 */
class RouterInterface {
  /**
   * 执行路由决策
   * @param {Request} request - 请求对象
   * @param {Context} context - 上下文信息
   * @returns {Promise<RoutingDecision>}
   */
  async route(request, context) {
    throw new Error('Not implemented');
  }

  /**
   * 获取路由统计信息
   * @returns {RoutingMetrics}
   */
  getMetrics() {
    throw new Error('Not implemented');
  }
}

/**
 * 缓存接口契约
 * @interface
 */
class CacheInterface {
  /**
   * 获取缓存值
   * @param {string} key - 缓存键
   * @returns {Promise<any>}
   */
  async get(key) {
    throw new Error('Not implemented');
  }

  /**
   * 设置缓存值
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {number} ttl - 生存时间
   * @returns {Promise<void>}
   */
  async set(key, value, ttl) {
    throw new Error('Not implemented');
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>}
   */
  async delete(key) {
    throw new Error('Not implemented');
  }

  /**
   * 清空缓存
   * @returns {Promise<void>}
   */
  async clear() {
    throw new Error('Not implemented');
  }
}

module.exports = {
  RouterInterface,
  CacheInterface
};
```

#### 2.2 抽象配置管理

**目标**: 统一配置加载和管理

```javascript
// src/core/services/config.js
const fs = require('fs').promises;
const path = require('path');

class ConfigManager {
  constructor(options = {}) {
    this.configDir = options.configDir || path.join(process.cwd(), 'config');
    this.env = process.env.NODE_ENV || 'development';
    this.cache = new Map();
  }

  /**
   * 获取配置值
   * @param {string} key - 配置键 (dot notation)
   * @param {*} defaultValue - 默认值
   * @returns {*}
   */
  get(key, defaultValue = null) {
    // 先检查缓存
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    // 从环境变量获取
    const envKey = key.toUpperCase().replace(/\./g, '_');
    const envValue = process.env[envKey];
    if (envValue !== undefined) {
      const parsed = this._parseValue(envValue);
      this.cache.set(key, parsed);
      return parsed;
    }

    // 从文件获取
    const fileValue = this._getFromFile(key);
    if (fileValue !== undefined) {
      this.cache.set(key, fileValue);
      return fileValue;
    }

    return defaultValue;
  }

  /**
   * 重新加载配置
   */
  async reload() {
    this.cache.clear();
    // 重新加载文件配置
    await this._loadFileConfigs();
  }

  /**
   * 从文件获取配置
   * @private
   */
  _getFromFile(key) {
    const keys = key.split('.');
    let config = this.fileConfig;

    for (const k of keys) {
      if (config && typeof config === 'object') {
        config = config[k];
      } else {
        return undefined;
      }
    }

    return config;
  }

  /**
   * 解析配置值
   * @private
   */
  _parseValue(value) {
    // 布尔值
    if (value === 'true') return true;
    if (value === 'false') return false;

    // 数字
    const num = Number(value);
    if (!isNaN(num)) return num;

    // JSON
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value);
      } catch (e) {
        // 解析失败，当作字符串
      }
    }

    return value;
  }

  /**
   * 加载文件配置
   * @private
   */
  async _loadFileConfigs() {
    const configFiles = [
      'config.yml',
      'config.json',
      `${this.env}.yml`,
      `${this.env}.json`
    ];

    this.fileConfig = {};

    for (const file of configFiles) {
      const filePath = path.join(this.configDir, file);
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const config = file.endsWith('.yml') ?
          require('js-yaml').load(content) :
          JSON.parse(content);

        this.fileConfig = this._deepMerge(this.fileConfig, config);
      } catch (error) {
        // 文件不存在或解析失败，跳过
      }
    }
  }

  /**
   * 深合并对象
   * @private
   */
  _deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this._deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }
}

// 全局配置实例
const config = new ConfigManager();

// 初始化加载
config._loadFileConfigs().catch(console.error);

module.exports = { ConfigManager, config };
```

### 阶段3：算法优化和错误处理 (Week 5-6)

#### 3.1 缓存算法升级

**当前问题**: 简单的LRU策略
**优化方案**: 更智能的缓存策略

```javascript
// src/core/cache/smart-cache.js
class SmartCache extends CacheInterface {
  constructor(options = {}) {
    super();
    this.capacity = options.capacity || 1000;
    this.items = new Map();
    this.accessOrder = new Map(); // 访问顺序
    this.accessCount = 0;

    // 智能清理配置
    this.cleanupThreshold = options.cleanupThreshold || 0.8;
    this.minTTL = options.minTTL || 60000; // 1分钟
  }

  async get(key) {
    const item = this.items.get(key);
    if (!item) return null;

    // 检查过期
    if (Date.now() > item.expiresAt) {
      this.items.delete(key);
      this.accessOrder.delete(key);
      return null;
    }

    // 更新访问信息
    this._updateAccess(key);
    return item.value;
  }

  async set(key, value, ttl = this.minTTL) {
    const expiresAt = Date.now() + Math.max(ttl, this.minTTL);

    // 检查容量
    if (!this.items.has(key) && this.items.size >= this.capacity) {
      this._evict();
    }

    this.items.set(key, { value, expiresAt, setAt: Date.now() });
    this._updateAccess(key);

    // 定期清理
    if (Math.random() < 0.01) { // 1%的概率触发清理
      this._cleanup();
    }
  }

  /**
   * 智能淘汰策略
   * @private
   */
  _evict() {
    // 计算每个条目的价值分数
    const scores = new Map();

    for (const [key, item] of this.items) {
      const accessInfo = this.accessOrder.get(key);
      const age = Date.now() - item.setAt;
      const accessCount = accessInfo ? accessInfo.count : 0;
      const lastAccess = accessInfo ? accessInfo.lastAccess : 0;
      const timeSinceAccess = Date.now() - lastAccess;

      // 价值分数 = 访问频率 / (年龄 + 时间间隔 + 1)
      const score = accessCount / (age + timeSinceAccess + 1);
      scores.set(key, score);
    }

    // 淘汰分数最低的条目
    let minScore = Infinity;
    let victimKey = null;

    for (const [key, score] of scores) {
      if (score < minScore) {
        minScore = score;
        victimKey = key;
      }
    }

    if (victimKey) {
      this.items.delete(victimKey);
      this.accessOrder.delete(victimKey);
    }
  }

  /**
   * 定期清理过期条目
   * @private
   */
  _cleanup() {
    const now = Date.now();
    const toDelete = [];

    for (const [key, item] of this.items) {
      if (now > item.expiresAt) {
        toDelete.push(key);
      }
    }

    toDelete.forEach(key => {
      this.items.delete(key);
      this.accessOrder.delete(key);
    });
  }

  /**
   * 更新访问信息
   * @private
   */
  _updateAccess(key) {
    const now = Date.now();
    const accessInfo = this.accessOrder.get(key) || { count: 0, lastAccess: 0 };

    accessInfo.count++;
    accessInfo.lastAccess = now;

    this.accessOrder.set(key, accessInfo);
  }
}
```

#### 3.2 统一错误处理

**目标**: 建立统一的错误处理机制

```javascript
// src/core/types/errors.js

class SiraError extends Error {
  constructor(message, code, statusCode = 500, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends SiraError {
  constructor(message, details = {}) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

class RoutingError extends SiraError {
  constructor(message, details = {}) {
    super(message, 'ROUTING_ERROR', 500, details);
  }
}

class CacheError extends SiraError {
  constructor(message, details = {}) {
    super(message, 'CACHE_ERROR', 500, details);
  }
}

class RateLimitError extends SiraError {
  constructor(message, details = {}) {
    super(message, 'RATE_LIMIT_ERROR', 429, details);
  }
}

// 错误处理器
class ErrorHandler {
  static handle(error, context = {}) {
    // 记录错误
    const logger = require('../services/logger').logger;
    logger.error('Application Error', {
      error: error.message,
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
      stack: error.stack,
      context
    });

    // 根据错误类型返回适当的响应
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: error.message,
        code: error.code,
        details: error.details
      };
    }

    if (error instanceof RateLimitError) {
      return {
        success: false,
        error: '请求过于频繁，请稍后再试',
        code: error.code,
        retryAfter: error.details.retryAfter || 60
      };
    }

    // 默认错误响应
    return {
      success: false,
      error: '服务器内部错误',
      code: 'INTERNAL_ERROR'
    };
  }

  static isOperationalError(error) {
    return error instanceof SiraError;
  }
}

module.exports = {
  SiraError,
  ValidationError,
  RoutingError,
  CacheError,
  RateLimitError,
  ErrorHandler
};
```

### 阶段4：渐进式迁移和测试 (Week 7-8)

#### 4.1 适配器模式迁移

**目标**: 平滑过渡，避免破坏现有功能

```javascript
// src/core/legacy-adapters.js

/**
 * 遗留路由管理器适配器
 * 保持向后兼容，同时内部使用新的架构
 */
class LegacyRoutingAdapter {
  constructor(options = {}) {
    // 创建新的服务容器
    this.container = require('./services/container').container;

    // 初始化新架构的路由器
    this.newRouter = this.container.get('router');
    this.logger = this.container.get('logger');

    // 保持旧接口的配置兼容性
    this.options = this._migrateOptions(options);
  }

  /**
   * 旧接口方法
   */
  async routeRequest(request, context = {}) {
    try {
      // 转换参数格式
      const normalizedRequest = this._normalizeRequest(request);
      const normalizedContext = this._normalizeContext(context);

      // 使用新架构
      const result = await this.newRouter.route(normalizedRequest, normalizedContext);

      // 转换响应格式
      return this._convertResponse(result);
    } catch (error) {
      this.logger.error('Legacy routing adapter error:', error);
      throw error;
    }
  }

  /**
   * 迁移选项配置
   * @private
   */
  _migrateOptions(oldOptions) {
    return {
      cacheEnabled: oldOptions.cacheEnabled !== false,
      cacheTTL: oldOptions.cacheTTL || 300000,
      enableML: oldOptions.enableMLPrediction !== false,
      enableAdaptiveLearning: oldOptions.enableAdaptiveLearning !== false,
      // ... 其他配置映射
    };
  }

  /**
   * 标准化请求格式
   * @private
   */
  _normalizeRequest(request) {
    return {
      messages: request.messages || [],
      model: request.model || 'auto',
      taskType: request.taskType,
      requiredCapabilities: request.requiredCapabilities,
      userId: request.userId,
      // ... 其他字段
    };
  }

  /**
   * 标准化上下文
   * @private
   */
  _normalizeContext(context) {
    return {
      apiKeys: context.apiKeys || {},
      userPreferences: context.userPreferences || {},
      budget: context.budget,
      constraints: context.constraints || {},
      // ... 其他上下文信息
    };
  }

  /**
   * 转换响应格式
   * @private
   */
  _convertResponse(newResult) {
    return {
      success: newResult.success,
      model: newResult.model,
      provider: newResult.provider,
      reasoning: newResult.reasoning,
      fromCache: newResult.fromCache,
      processingTime: newResult.processingTime,
      // 保持旧格式的兼容性
      strategy: newResult.strategy,
      confidence: newResult.confidence || 1.0
    };
  }
}

// 导出适配器作为默认导出
module.exports = LegacyRoutingAdapter;
```

#### 4.2 渐进式测试策略

**目标**: 确保重构不破坏现有功能

```javascript
// 测试策略
describe('重构兼容性测试', () => {
  let oldRouter;
  let newRouter;

  beforeEach(() => {
    // 初始化旧版本
    const OldRouter = require('../legacy/intelligent-routing-manager');
    oldRouter = new OldRouter();

    // 初始化新版本
    const NewRouter = require('../routing/intelligent-router');
    newRouter = new NewRouter();
  });

  test('相同输入应该产生相同输出', async () => {
    const request = {
      messages: [{ role: 'user', content: 'Hello world' }],
      model: 'gpt-3.5-turbo'
    };
    const context = { apiKeys: { openai: 'test-key' } };

    const oldResult = await oldRouter.routeRequest(request, context);
    const newResult = await newRouter.route(request, context);

    // 比较关键字段
    expect(newResult.model).toBe(oldResult.model);
    expect(newResult.provider).toBe(oldResult.provider);
    expect(newResult.success).toBe(oldResult.success);
  });

  test('错误处理应该一致', async () => {
    const badRequest = { messages: [] }; // 无效请求

    await expect(oldRouter.routeRequest(badRequest)).rejects.toThrow();
    await expect(newRouter.route(badRequest)).rejects.toThrow();
  });

  test('性能应该不下降', async () => {
    const requests = Array(100).fill().map(() => ({
      messages: [{ role: 'user', content: 'test' }]
    }));

    const oldStart = Date.now();
    await Promise.all(requests.map(r => oldRouter.routeRequest(r, { apiKeys: { openai: 'test' } })));
    const oldTime = Date.now() - oldStart;

    const newStart = Date.now();
    await Promise.all(requests.map(r => newRouter.route(r, { apiKeys: { openai: 'test' } })));
    const newTime = Date.now() - newStart;

    // 新版本性能不应该比旧版本差太多 (允许10%的性能下降)
    expect(newTime).toBeLessThan(oldTime * 1.1);
  });
});
```

## 📊 实施时间表

| 阶段 | 时间 | 主要任务 | 验收标准 |
|------|------|----------|----------|
| 阶段1 | Week 1-2 | 建立模块化架构 | 模块索引正常工作，路径简化 |
| 阶段2 | Week 3-4 | 接口抽象和契约 | 清晰的模块接口，统一配置管理 |
| 阶段3 | Week 5-6 | 算法优化和错误处理 | 更智能的缓存算法，统一错误处理 |
| 阶段4 | Week 7-8 | 渐进式迁移和测试 | 保持向后兼容，测试覆盖完整 |

## 🎯 成功标志

1. **模块化**: 每个模块职责清晰，接口明确
2. **可维护性**: 新功能开发时间减少50%
3. **兼容性**: 现有API完全向后兼容
4. **性能**: 重构后性能不下降
5. **可测试性**: 单元测试覆盖率 > 90%

## 🚨 风险控制

### 技术风险
1. **兼容性破坏**: 通过适配器模式和全面测试解决
2. **性能下降**: 性能基准测试和监控
3. **依赖混乱**: 依赖注入容器统一管理

### 项目风险
1. **时间延误**: 分阶段实施，设置里程碑
2. **需求变更**: 保持与用户沟通
3. **测试不充分**: 自动化测试 + 人工验收

## 💡 关键洞察

**重构不是推倒重来，而是精雕细琢**

1. **保留核心价值**: 你的AI路由算法、复杂度分析等都是宝贵的资产
2. **渐进式改进**: 小步快跑，每次只改进一个模块
3. **测试先行**: 完善的测试是重构的安全网
4. **接口兼容**: 适配器模式保证平滑过渡

**最终目标**: 让代码更清晰、更易维护，同时保持所有现有功能和性能！
