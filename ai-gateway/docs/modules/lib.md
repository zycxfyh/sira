# 🏗️ Lib 核心库模块

## 📋 概述

Lib模块是AI网关的核心功能实现层，包含所有业务逻辑、策略、插件、服务和工具类。该模块采用模块化设计，支持插件扩展和策略定制，提供了完整的网关运行时环境。

## 🏗️ 架构组成

```
lib/
├── index.js                    # 核心库入口
├── db.js                       # 数据库连接管理
├── eventBus.js                 # 事件总线系统
├── logger.js                   # 日志管理
├── plugin-installer.js         # 插件安装器
├── plugins.js                  # 插件管理系统
├── conditions/                 # 条件判断引擎
│   ├── index.js
│   ├── json-schema.js
│   └── predefined.js
├── config/                     # 配置管理 (见config模块)
├── gateway/                    # 网关运行时
│   ├── index.js
│   ├── server.js
│   ├── pipelines.js
│   ├── context.js
│   └── actionParams.js
├── policies/                   # 策略引擎 (25个策略)
├── rest/                       # REST API层
├── schemas/                    # 数据模式验证
└── services/                   # 业务服务层
```

## 🚀 核心组件

### 1. 网关运行时 (gateway/)

**服务器管理 (server.js)**:
```javascript
const server = require('./gateway/server');

// 启动HTTP服务器
await server.start({
  port: 8080,
  host: '0.0.0.0',
  ssl: false
});

// 优雅关闭
process.on('SIGTERM', async () => {
  await server.stop();
});
```

**管道系统 (pipelines.js)**:
```javascript
const pipelines = require('./gateway/pipelines');

// 执行管道
const result = await pipelines.execute('ai-pipeline', {
  req: request,
  res: response,
  next: nextFunction
});
```

**上下文管理 (context.js)**:
```javascript
const Context = require('./gateway/context');

// 创建请求上下文
const ctx = new Context(request, response);
ctx.set('user', authenticatedUser);
ctx.set('cache', cacheResult);
```

### 2. 策略引擎 (policies/)

**AI专用策略 (6个核心策略)**:

#### 🔄 AI路由策略 (ai-router)
```javascript
// lib/policies/ai-router/ai-router.js
module.exports = function(params, config) {
  return function aiRouter(req, res, next) {
    // 智能选择AI提供商
    const provider = selectBestProvider(req.body, config);
    req.egContext.set('aiProvider', provider);
    next();
  };
};
```

#### 💾 AI缓存策略 (ai-cache)
```javascript
// 基于请求内容的智能缓存
{
  ttl: 300,                    // 缓存时间5分钟
  maxSize: 1000,              // 最大缓存条目
  strategy: "lru",            // 淘汰策略
  compression: true,          // 启用压缩
  keyGenerator: "content-hash" // 基于内容生成键
}
```

#### 🛡️ AI熔断器策略 (ai-circuit-breaker)
```javascript
// 提供商故障自动熔断
{
  timeout: 30000,                    // 超时时间
  errorThresholdPercentage: 50,      // 错误率阈值
  resetTimeout: 30000,               // 重试间隔
  name: "ai-circuit-breaker"         // 熔断器名称
}
```

#### 🚦 AI速率限制策略 (ai-rate-limit)
```javascript
// 基于Token消耗的智能限流
{
  windowMs: 900000,      // 15分钟窗口
  maxRequests: 100,      // 最大请求数
  maxTokens: 10000,      // 最大Token数
  keyGenerator: "user",  // 按用户限流
  burstLimit: 10         // 突发请求限制
}
```

#### 📊 AI追踪策略 (ai-tracing)
```javascript
// 分布式追踪
{
  serviceName: "ai-gateway",
  exporter: "jaeger",
  sampleRate: 1.0,
  jaegerEndpoint: "http://localhost:14268/api/traces",
  tags: {
    version: "1.0.0",
    environment: "production"
  }
}
```

#### 📋 AI队列策略 (ai-queue)
```javascript
// 异步请求处理
{
  natsUrl: "nats://localhost:4222",
  queueName: "ai.requests",
  enableAsync: false,
  asyncThreshold: 10000,     // Token数阈值
  maxConcurrency: 5,         // 最大并发数
  retryAttempts: 3           // 重试次数
}
```

**通用策略**:
- 🔐 **认证策略**: `basic-auth`, `key-auth`, `jwt`, `oauth2`
- 🌐 **网络策略**: `cors`, `rate-limit`, `proxy`
- 🔄 **转换策略**: `request-transformer`, `response-transformer`
- 📝 **日志策略**: `log`, `expression`
- 🛑 **控制策略**: `terminate`, `headers`

### 3. 插件系统 (plugins.js)

**插件生命周期**:
```javascript
class AIPlugin {
  constructor(config) {
    this.config = config;
  }

  // 插件初始化
  async init() {
    // 注册策略、路由等
  }

  // 插件清理
  async destroy() {
    // 清理资源
  }

  // 健康检查
  async healthCheck() {
    return { status: 'healthy' };
  }
}
```

**插件安装器 (plugin-installer.js)**:
```javascript
const installer = require('./plugin-installer');

// 安装插件
await installer.install('ai-cache', {
  version: '1.0.0',
  registry: 'npm'
});

// 卸载插件
await installer.uninstall('ai-cache');
```

### 4. 业务服务层 (services/)

**认证服务 (auth.js)**:
```javascript
const auth = require('./services/auth');

// 用户认证
const token = await auth.authenticate({
  username: 'john',
  password: 'secret'
});

// 令牌验证
const user = await auth.verifyToken(token);
```

**用户服务**:
```javascript
const users = require('./services/consumers/user.service');

// 创建用户
const user = await users.create({
  username: 'john_doe',
  email: 'john@example.com',
  password: 'hashed_password'
});

// 用户查询
const userList = await users.find({
  role: 'admin',
  status: 'active'
});
```

**凭据服务**:
```javascript
const credentials = require('./services/credentials/credential.service');

// 生成API密钥
const credential = await credentials.create({
  type: 'key-auth',
  consumerId: 'user-123',
  key: generateSecureKey()
});
```

**令牌服务**:
```javascript
const tokens = require('./services/tokens/token.service');

// 生成JWT令牌
const token = await tokens.generate({
  userId: 'user-123',
  scopes: ['read', 'write'],
  expiresIn: '1h'
});

// 验证令牌
const payload = await tokens.verify(token);
```

### 5. 条件判断引擎 (conditions/)

**预定义条件**:
```javascript
// conditions/predefined.js
module.exports = {
  // 路径匹配
  pathMatch: (condition, req) => {
    return req.path.match(condition.pattern);
  },

  // 方法匹配
  method: (condition, req) => {
    return condition.methods.includes(req.method);
  },

  // 范围检查
  scope: (condition, ctx) => {
    const userScopes = ctx.get('user.scopes') || [];
    return condition.scopes.every(scope => userScopes.includes(scope));
  }
};
```

**JSON Schema条件**:
```javascript
// conditions/json-schema.js
const validateRequest = (schema, data) => {
  const Ajv = require('ajv');
  const ajv = new Ajv();
  const validate = ajv.compile(schema);
  return validate(data);
};
```

### 6. 事件总线 (eventBus.js)

**事件系统**:
```javascript
const eventBus = require('./eventBus');

// 注册事件监听器
eventBus.on('request.start', (req) => {
  console.log('Request started:', req.id);
});

eventBus.on('ai.response', (response) => {
  console.log('AI response received:', response.model);
});

// 发布事件
eventBus.emit('request.complete', {
  id: requestId,
  duration: Date.now() - startTime,
  status: 200
});
```

## 📊 统计信息

| 组件 | 文件数 | 代码行数 | 功能描述 |
|------|--------|----------|----------|
| 策略引擎 | 25个目录 | ~12,000行 | 请求处理策略 |
| 服务层 | 15个文件 | ~8,500行 | 业务逻辑服务 |
| 网关运行时 | 5个文件 | ~3,200行 | 核心运行环境 |
| 条件引擎 | 3个文件 | ~800行 | 条件判断逻辑 |
| 插件系统 | 2个文件 | ~600行 | 插件管理框架 |
| **总计** | **50+文件** | **~25,000行** | **完整核心库** |

## 🧪 测试验证

**单元测试覆盖**:
```bash
# 策略测试
npm test -- --grep "policies"

# 服务测试
npm test -- --grep "services"

# 网关测试
npm test -- --grep "gateway"
```

**集成测试**:
```bash
# 端到端策略测试
npm run test:e2e -- --testPathPattern=policies

# 性能测试
npm run test:perf -- --module lib
```

**策略测试示例**:
```javascript
// test/policies/ai-router.test.js
describe('AI Router Policy', () => {
  it('should select best provider based on cost', async () => {
    const req = { body: { model: 'gpt-4', max_tokens: 100 } };
    const policy = aiRouter({}, { providers: ['openai', 'anthropic'] });

    await policy(req, {}, () => {});
    expect(req.egContext.get('aiProvider')).toBe('openai');
  });
});
```

## 🔗 相关链接

- **[主README](../README.md)** - 项目总览
- **[策略文档](../README-AI.md#自定义策略)** - 策略配置和使用
- **[API文档](../README-AI.md#api-使用)** - 服务接口说明
- **[插件开发](../Contributing.md)** - 插件开发指南

## 🤝 开发指南

### 1. 添加新策略
```javascript
// lib/policies/custom-policy/index.js
module.exports = function(params, config) {
  return function customPolicy(req, res, next) {
    // 实现策略逻辑
    next();
  };
};

// lib/policies/custom-policy/schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "enabled": { "type": "boolean" },
    "config": { "type": "object" }
  }
}
```

### 2. 扩展服务
```javascript
// lib/services/custom/custom.service.js
class CustomService {
  async create(data) {
    // 业务逻辑
  }

  async find(query) {
    // 查询逻辑
  }
}

module.exports = new CustomService();
```

### 3. 自定义条件
```javascript
// lib/conditions/custom.js
module.exports = function customCondition(condition, context) {
  // 条件判断逻辑
  return true;
};
```

---

*最后更新: 2025年11月7日* | 🔙 [返回模块列表](../README.md#模块导航)
