# ⚙️ Config 配置管理模块

## 📋 概述

Config模块是AI网关的核心配置管理系统，采用声明式配置方式，支持YAML和JSON格式。提供了完整的配置加载、验证、热重载和环境管理功能，确保网关在不同环境下的灵活部署和运行。

## 🏗️ 架构组成

```
config/
├── index.js              # 配置管理主入口
├── config.js             # 配置加载器
├── gateway.config.yml    # 网关核心配置
├── system.config.yml     # 系统级配置
├── models/               # 数据模型定义
│   ├── applications.json # 应用模型
│   └── users.json        # 用户模型
└── schemas/              # JSON Schema验证
    ├── gateway.config.json
    └── system.config.json
```

## 🚀 核心功能

### 1. 配置加载器 (config.js)

**多格式支持**:

```javascript
const config = require('./config');

// 加载YAML配置
const gatewayConfig = await config.load('gateway.config.yml');

// 加载JSON配置
const systemConfig = await config.load('system.config.json');

// 环境变量覆盖
const finalConfig = config.mergeWithEnv(gatewayConfig, process.env);
```

**配置优先级**:

1. 🔴 环境变量 (最高优先级)
2. 🟡 运行时覆盖配置
3. 🟢 用户配置文件
4. 🔵 默认配置 (最低优先级)

### 2. 热重载机制

**自动重载**:

```javascript
// 启用配置热重载
config.enableHotReload({
  watchPaths: ['./config/*.yml', './config/*.json'],
  debounceMs: 1000,
  onReload: newConfig => {
    console.log('配置已重载:', newConfig.version);
    gateway.restart();
  },
});
```

**手动重载**:

```bash
# CLI命令重载配置
eg config reload

# API触发重载
curl -X POST http://localhost:8001/config/reload
```

## 📋 配置结构

### 网关配置 (gateway.config.yml)

```yaml
# 网关基本信息
version: '1.0.0'
name: 'Sira'
description: '智能API网关系统'

# HTTP服务器配置
http:
  port: 8080
  host: '0.0.0.0'
  timeout: 30000

# HTTPS配置
https:
  port: 8443
  cert: '/path/to/cert.pem'
  key: '/path/to/key.pem'

# 数据库配置
db:
  url: 'mongodb://localhost:27017/ai-gateway'
  poolSize: 10
  retryWrites: true

# Redis缓存配置
redis:
  host: 'localhost'
  port: 6379
  password: '${REDIS_PASSWORD}'
  db: 0

# API管道配置
pipelines:
  ai-pipeline:
    apiEndpoints:
      - ai-api
    policies:
      - cors: {}
      - key-auth:
          apiKeyHeader: 'x-api-key'
      - ai-rate-limit:
          windowMs: 900000
          maxTokens: 10000
      - ai-cache:
          ttl: 300
          maxSize: 1000
      - ai-router:
          timeout: 30000
      - proxy:
          target: '${AI_PROVIDER_URL}'

# API端点定义
apiEndpoints:
  ai-api:
    paths:
      - '/api/v1/ai/*'
    methods: ['GET', 'POST']
    scopes: ['ai:read', 'ai:write']

# 服务端点配置
serviceEndpoints:
  openai:
    url: 'https://api.openai.com/v1'
    timeout: 30000
  anthropic:
    url: 'https://api.anthropic.com/v1'
    timeout: 30000

# 策略配置
policies:
  - name: 'ai-router'
    condition:
      name: 'pathMatch'
      pattern: '/api/v1/ai/*'
  - name: 'ai-cache'
    condition:
      name: 'method'
      methods: ['GET']

# 用户和应用配置
users:
  admin:
    username: 'admin'
    scopes: ['admin:read', 'admin:write', 'admin:delete']

apps:
  ai-client:
    name: 'AI Client App'
    redirectUri: 'http://localhost:3000/callback'
    scopes: ['ai:read', 'ai:write']
```

### 系统配置 (system.config.yml)

```yaml
# 系统级配置
system:
  logLevel: 'info'
  enableMetrics: true
  enableTracing: true

# 监控配置
monitoring:
  prometheus:
    enabled: true
    port: 9090
    path: '/metrics'
  grafana:
    enabled: true
    port: 3001

# 安全配置
security:
  jwtSecret: '${JWT_SECRET}'
  apiKeyEncryption: true
  rateLimitEnabled: true

# AI提供商配置
ai:
  providers:
    openai:
      apiKey: '${OPENAI_API_KEY}'
      baseUrl: 'https://api.openai.com/v1'
      models: ['gpt-4', 'gpt-3.5-turbo']
    anthropic:
      apiKey: '${ANTHROPIC_API_KEY}'
      baseUrl: 'https://api.anthropic.com/v1'
      models: ['claude-3-opus', 'claude-3-sonnet']
    azure:
      apiKey: '${AZURE_OPENAI_API_KEY}'
      endpoint: '${AZURE_OPENAI_ENDPOINT}'
      models: ['gpt-4', 'gpt-3.5-turbo']

# 缓存配置
cache:
  l1:
    enabled: true
    maxSize: 1000
    ttl: 300
  l2:
    enabled: true
    redis: true
    ttl: 3600

# 队列配置
queue:
  nats:
    enabled: true
    url: 'nats://localhost:4222'
    jetstream: true
  asyncThreshold: 10000 # Token数阈值
```

## 🔍 配置验证

### JSON Schema验证

```json
// schemas/gateway.config.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["version", "http", "pipelines"],
  "properties": {
    "version": {
      "type": "string",
      "pattern": "^\\d+\\.\\d+\\.\\d+$"
    },
    "http": {
      "type": "object",
      "properties": {
        "port": {
          "type": "integer",
          "minimum": 1,
          "maximum": 65535
        }
      },
      "required": ["port"]
    }
  }
}
```

### 配置验证命令

```bash
# 验证网关配置
eg config validate gateway.config.yml

# 验证系统配置
eg config validate system.config.yml

# 检查配置完整性
eg config check --comprehensive
```

## 🌍 环境管理

### 环境变量映射

```javascript
// 环境变量到配置的映射
const envMappings = {
  REDIS_HOST: 'redis.host',
  REDIS_PORT: 'redis.port',
  REDIS_PASSWORD: 'redis.password',
  OPENAI_API_KEY: 'ai.providers.openai.apiKey',
  ANTHROPIC_API_KEY: 'ai.providers.anthropic.apiKey',
  JWT_SECRET: 'security.jwtSecret',
};
```

### 多环境配置

```bash
# 开发环境
cp config/gateway.config.dev.yml config/gateway.config.yml

# 生产环境
cp config/gateway.config.prod.yml config/gateway.config.yml

# 使用环境变量覆盖
export NODE_ENV=production
export REDIS_HOST=redis.prod.company.com
```

## 📊 统计信息

| 指标       | 值       |
| ---------- | -------- |
| 配置文件   | 4个      |
| 数据模型   | 2个      |
| Schema文件 | 2个      |
| 配置选项   | 150+     |
| 环境变量   | 25+      |
| 代码行数   | ~1,800行 |

## 🧪 测试验证

**配置测试**:

```bash
# 配置加载测试
npm test -- --grep "config.*load"

# 验证测试
npm test -- --grep "config.*validate"

# 热重载测试
npm test -- --grep "config.*reload"
```

**集成测试**:

```bash
# 端到端配置测试
npm run test:e2e -- --testPathPattern=config

# 性能测试
npm run test:perf -- --config config/gateway.config.yml
```

## 🔗 相关链接

- **[主README](../README.md)** - 项目总览
- **[AI配置指南](../README-AI.md#配置)** - AI相关配置说明
- **[部署配置](../DEPLOYMENT-GUIDE.md)** - 生产环境配置
- **[环境变量](../env.template)** - 环境变量模板

## 🤝 配置最佳实践

### 1. 配置分层

```yaml
# base.yml - 基础配置
# dev.yml - 开发环境覆盖
# prod.yml - 生产环境覆盖
```

### 2. 敏感信息管理

```bash
# 使用环境变量存储敏感信息
export DB_PASSWORD="secure-password"
export API_KEY="your-secret-key"
```

### 3. 配置版本控制

```yaml
version: '1.2.3'
lastModified: '2025-11-07T10:00:00Z'
changelog:
  - 'Added AI router configuration'
  - 'Updated cache settings'
```

---

_最后更新: 2025年11月7日_ | 🔙 [返回模块列表](../README.md#模块导航)
