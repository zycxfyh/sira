# 🔄 Sira AI网关渐进式重构计划

## 📋 计划概述

**现状**: 项目功能完整但架构复杂，难以维护
**目标**: 在保留现有功能基础上，逐步重构为清晰、可维护的架构
**策略**: 小步快跑，边重构边验证，确保功能不退化

---

## 🎯 第一阶段：架构梳理与模块化 (Week 1)

### 1.1 项目结构重组
**目标**: 建立清晰的目录结构和模块边界
**优先级**: 🔴 高

#### 修改内容

**A. 创建清晰的目录结构**
```
src/
├── core/           # 核心业务逻辑
│   ├── ai/        # AI相关功能
│   ├── routing/   # 路由功能
│   ├── cache/     # 缓存管理
│   └── services/  # 基础服务
├── api/           # API路由处理
├── config/        # 配置管理 (保留)
├── middleware/    # 中间件
├── utils/         # 工具函数
└── types/         # 类型定义
```

**B. 移动文件到合适位置**
```bash
# 创建新目录
mkdir -p src/core/{ai,routing,cache,services}
mkdir -p src/api
mkdir -p src/middleware
mkdir -p src/types

# 移动智能路由相关文件
mv src/core/intelligent-routing-manager.js src/core/routing/
mv src/core/complexity-analyzer.js src/core/routing/
mv src/core/routing-decision-engine.js src/core/routing/

# 移动AI相关文件
mv src/ai-client.js src/core/ai/
mv src/core/ai-*.js src/core/ai/

# 移动缓存相关文件
mv src/core/cache-manager.js src/core/cache/
```

**C. 更新导入路径**
```javascript
// 修改前
const { IntelligentRoutingManager } = require('./core/intelligent-routing-manager');

// 修改后
const { IntelligentRoutingManager } = require('./core/routing/intelligent-routing-manager');
```

### 1.2 核心功能简化
**目标**: 将700+行的路由管理器拆分为多个小模块
**优先级**: 🔴 高

#### 修改内容

**A. 拆分智能路由管理器**
```javascript
// src/core/routing/intelligent-routing-manager.js (重构后 ≈200行)
class IntelligentRoutingManager {
  constructor(options = {}) {
    this.analyzer = new ComplexityAnalyzer();
    this.decisionEngine = new RoutingDecisionEngine();
    this.cache = new RouteCache(options.cache);
    this.metrics = new RoutingMetrics();
  }

  async route(request, context) {
    // 1. 复杂度分析
    const analysis = await this.analyzer.analyze(request);

    // 2. 检查缓存
    const cached = this.cache.get(analysis);
    if (cached) return cached;

    // 3. 决策路由
    const decision = await this.decisionEngine.decide(analysis, context);

    // 4. 缓存结果
    this.cache.set(analysis, decision);

    // 5. 记录指标
    this.metrics.record(decision);

    return decision;
  }
}
```

**B. 提取路由策略**
```javascript
// src/core/routing/strategies.js (新增)
class RoutingStrategy {
  calculateScore(model, context) {
    // 基础评分逻辑
  }
}

class CostFirstStrategy extends RoutingStrategy {
  calculateScore(model, context) {
    return model.cost * 0.6 + model.performance * 0.2 + model.quality * 0.2;
  }
}
```

**C. 简化复杂度分析器**
```javascript
// src/core/routing/complexity-analyzer.js (简化后 ≈100行)
class ComplexityAnalyzer {
  analyze(request) {
    const score = this._calculateScore(request);
    const complexity = score > 5 ? 'complex' : score > 3 ? 'medium' : 'simple';

    return {
      complexity,
      score,
      factors: this._extractFactors(request)
    };
  }

  _calculateScore(request) {
    let score = 0;

    // 简化评分逻辑
    const contentLength = request.messages?.reduce((sum, msg) =>
      sum + (msg.content?.length || 0), 0) || 0;

    if (contentLength > 10000) score += 3;
    else if (contentLength > 1000) score += 2;
    else score += 1;

    return score;
  }
}
```

### 1.3 测试重构
**目标**: 建立可靠的测试体系
**优先级**: 🔴 高

#### 修改内容

**A. 重构现有测试**
```javascript
// src/test/routing/routing-manager.test.js
describe('IntelligentRoutingManager', () => {
  let router;
  let mockAnalyzer;
  let mockDecisionEngine;
  let mockCache;

  beforeEach(() => {
    mockAnalyzer = { analyze: jest.fn() };
    mockDecisionEngine = { decide: jest.fn() };
    mockCache = { get: jest.fn(), set: jest.fn() };

    router = new IntelligentRoutingManager({
      analyzer: mockAnalyzer,
      decisionEngine: mockDecisionEngine,
      cache: mockCache
    });
  });

  test('应该正确处理简单请求', async () => {
    const request = { messages: [{ content: 'Hello' }] };
    const context = { apiKeys: { openai: 'test' } };

    mockAnalyzer.analyze.mockResolvedValue({
      complexity: 'simple',
      score: 1
    });

    mockDecisionEngine.decide.mockResolvedValue({
      model: 'gpt-3.5-turbo',
      provider: 'openai'
    });

    const result = await router.route(request, context);

    expect(result.model).toBe('gpt-3.5-turbo');
    expect(mockAnalyzer.analyze).toHaveBeenCalledWith(request);
    expect(mockDecisionEngine.decide).toHaveBeenCalled();
  });
});
```

**B. 集成测试**
```javascript
// src/test/integration/routing-integration.test.js
describe('路由集成测试', () => {
  test('端到端路由流程', async () => {
    const app = require('../server');
    const request = require('supertest')(app);

    const response = await request
      .post('/api/ai/chat')
      .send({
        messages: [{ role: 'user', content: 'Hello' }],
        model: 'gpt-3.5-turbo'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('choices');
  });
});
```

---

## 🎯 第二阶段：API层重构 (Week 2)

### 2.1 API路由重构
**目标**: 将路由处理逻辑从server.js中分离
**优先级**: 🟡 中

#### 修改内容

**A. 创建API控制器**
```javascript
// src/api/controllers/ai-controller.js
class AIController {
  constructor(router) {
    this.router = router;
  }

  setupRoutes(app) {
    app.post('/api/ai/chat', this.handleChat.bind(this));
    app.get('/api/ai/providers', this.handleProviders.bind(this));
  }

  async handleChat(req, res) {
    try {
      const { messages, model } = req.body;

      // 验证输入
      const validation = this._validateChatRequest(req.body);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      // 路由决策
      const routingResult = await this.router.route({
        messages,
        model,
        userId: req.user?.id
      }, {
        apiKeys: this._getApiKeys(req),
        userPreferences: req.user?.preferences
      });

      // 调用AI服务
      const response = await this._callAI(routingResult, req.body);

      res.json(response);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async handleProviders(req, res) {
    const providers = await this.router.getAvailableProviders();
    res.json({ providers });
  }

  _validateChatRequest(body) {
    if (!body.messages || !Array.isArray(body.messages)) {
      return { valid: false, error: 'messages必须是数组' };
    }

    const totalLength = body.messages.reduce((sum, msg) =>
      sum + (msg.content?.length || 0), 0);

    if (totalLength > 50000) {
      return { valid: false, error: '消息内容过长' };
    }

    return { valid: true };
  }
}
```

**B. 重构server.js**
```javascript
// src/server.js (简化后)
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const { logger } = require('./core/services/logger');
const { IntelligentRoutingManager } = require('./core/routing/intelligent-routing-manager');
const { AIController } = require('./api/controllers/ai-controller');

async function createApp() {
  const app = express();

  // 中间件
  app.use(helmet());
  app.use(cors());
  app.use(express.json());

  // 初始化路由器
  const router = new IntelligentRoutingManager();

  // 初始化控制器
  const aiController = new AIController(router);

  // 基础路由
  app.get('/', (req, res) => {
    res.json({
      message: 'Sira AI Gateway',
      version: '2.1.0',
      status: 'running'
    });
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // API路由
  aiController.setupRoutes(app);

  // 404处理
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  return app;
}

module.exports = createApp;
```

### 2.2 中间件重组
**目标**: 整理和简化中间件
**优先级**: 🟡 中

#### 修改内容

**A. 认证中间件**
```javascript
// src/middleware/auth.js
const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return next(); // 允许匿名访问
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { authenticate };
```

**B. 请求日志中间件**
```javascript
// src/middleware/logging.js
const { logger } = require('../core/services/logger');

function requestLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('API Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent')
    });
  });

  next();
}

module.exports = { requestLogger };
```

### 2.3 配置管理统一
**目标**: 简化配置系统
**优先级**: 🟢 低

#### 修改内容

**A. 简化配置加载**
```javascript
// src/config/index.js
const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    this.config = {};
    this.loadConfig();
  }

  loadConfig() {
    // 加载环境变量
    this.config.port = process.env.PORT || 8080;
    this.config.nodeEnv = process.env.NODE_ENV || 'development';

    // 加载AI提供商配置
    const providersPath = path.join(__dirname, 'ai-providers.yml');
    if (fs.existsSync(providersPath)) {
      // 简化版：只加载基本配置
      this.config.providers = this._loadYaml(providersPath);
    }

    // 加载路由配置
    this.config.routing = {
      defaultStrategy: 'balanced',
      cacheEnabled: true,
      cacheTTL: 300000
    };
  }

  get(key) {
    return key.split('.').reduce((obj, k) => obj?.[k], this.config);
  }
}

module.exports = new ConfigManager();
```

---

## 🎯 第三阶段：性能优化与监控 (Week 3)

### 3.1 缓存系统优化
**目标**: 改进缓存实现
**优先级**: 🟡 中

#### 修改内容

**A. 缓存接口抽象**
```javascript
// src/core/cache/cache-interface.js
class CacheInterface {
  async get(key) { throw new Error('Not implemented'); }
  async set(key, value, ttl) { throw new Error('Not implemented'); }
  async delete(key) { throw new Error('Not implemented'); }
  async clear() { throw new Error('Not implemented'); }
}

// 内存缓存实现
class MemoryCache extends CacheInterface {
  constructor() {
    super();
    this.storage = new Map();
  }

  async get(key) {
    const item = this.storage.get(key);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
      this.storage.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key, value, ttl = 300000) {
    this.storage.set(key, {
      value,
      expiresAt: Date.now() + ttl
    });
  }
}
```

### 3.2 监控指标完善
**目标**: 添加关键性能指标
**优先级**: 🟢 低

#### 修改内容

**A. 性能监控**
```javascript
// src/core/services/metrics.js
class MetricsService {
  constructor() {
    this.metrics = {
      requests: 0,
      errors: 0,
      avgResponseTime: 0,
      cacheHitRate: 0
    };
  }

  recordRequest(duration, success = true) {
    this.metrics.requests++;
    if (!success) this.metrics.errors++;

    // 更新平均响应时间
    this.metrics.avgResponseTime =
      (this.metrics.avgResponseTime + duration) / 2;
  }

  recordCacheHit(hit) {
    // 实现缓存命中率统计
  }

  getStats() {
    return {
      ...this.metrics,
      errorRate: this.metrics.requests > 0 ?
        this.metrics.errors / this.metrics.requests : 0
    };
  }
}
```

---

## 🎯 第四阶段：文档与部署优化 (Week 4)

### 4.1 文档完善
**目标**: 建立完整的项目文档
**优先级**: 🟢 低

#### 修改内容

**A. API文档**
```markdown
<!-- docs/api.md -->
# Sira AI Gateway API

## 聊天接口

### POST /api/ai/chat

智能路由到最适合的AI模型

**请求体:**
```json
{
  "messages": [
    {"role": "user", "content": "你好"}
  ],
  "model": "auto"
}
```

**响应:**
```json
{
  "id": "chat_123456",
  "model": "deepseek-chat",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "你好！我是AI助手。"
      }
    }
  ]
}
```
```

### 4.2 部署配置优化
**目标**: 简化Docker和部署配置
**优先级**: 🟢 低

#### 修改内容

**A. 简化Dockerfile**
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# 只复制必要文件
COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/
COPY config/ ./config/

EXPOSE 8080
CMD ["npm", "start"]
```

---

## 📊 验收标准

### 功能验收
- ✅ 所有API接口正常工作
- ✅ 智能路由功能完整
- ✅ 缓存和性能优化生效
- ✅ 测试覆盖率 > 80%

### 质量验收
- ✅ 代码重复率 < 10%
- ✅ 圈复杂度 < 15
- ✅ 文档完整性 > 90%

### 性能验收
- ✅ API响应时间 < 200ms
- ✅ 缓存命中率 > 50%
- ✅ 错误率 < 1%

---

## 🛠️ 实施指南

### 每日工作流程
1. **早上**: 规划当天任务，检查现有测试
2. **编码**: 小步提交，确保功能不退化
3. **测试**: 运行相关测试，验证修改
4. **下午**: 代码审查，重构优化
5. **晚上**: 更新文档，总结进展

### 风险控制
1. **备份**: 每次重构前创建备份
2. **测试**: 确保所有测试通过后再提交
3. **回滚**: 准备回滚方案
4. **沟通**: 及时记录问题和解决方案

### 进度跟踪
```bash
# 每周进度检查
npm run test                    # 运行所有测试
npm run test:coverage          # 检查覆盖率
npm run lint                   # 代码质量检查
```

---

## 🎉 成功标志

当你看到以下迹象时，重构就成功了：

1. **代码可读性**: 新人能快速理解代码结构
2. **维护效率**: 修改功能时只需改动少量文件
3. **测试稳定性**: 新功能开发时很少破坏现有功能
4. **部署便捷**: 启动和部署过程简单可靠
5. **扩展性**: 添加新功能变得容易

**记住：重构是一场持久战，贵在持之以恒！** 🚀
