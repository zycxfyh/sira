# Sira AI Gateway 环境变量配置指南

## 概述

本项目支持多种环境变量配置，用于不同的部署场景和功能模块。

## 配置文件

- `.env` - 实际的环境变量文件（已加入.gitignore）
- `.env.example` - 配置模板文件
- `.env.template` - 基础模板

## 环境变量分类

### 🔧 应用基本配置

| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `NODE_ENV` | `development` | 运行环境：development/staging/production/test |
| `PORT` | `3000` | 服务器监听端口 |
| `LOG_LEVEL` | `debug` | 日志级别：error/warn/info/debug |
| `DEBUG` | `sira:*` | 调试命名空间 |

### 🗄️ 数据库配置

#### PostgreSQL
| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `DATABASE_URL` | - | 完整的数据库连接URL |
| `POSTGRES_HOST` | `localhost` | 数据库主机 |
| `POSTGRES_PORT` | `5433` | 数据库端口 |
| `POSTGRES_DB` | `sira_dev` | 数据库名 |
| `POSTGRES_USER` | `sira` | 数据库用户名 |
| `POSTGRES_PASSWORD` | - | 数据库密码 |

#### Redis
| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `REDIS_URL` | - | 完整的Redis连接URL |
| `REDIS_HOST` | `localhost` | Redis主机 |
| `REDIS_PORT` | `6380` | Redis端口 |
| `REDIS_PASSWORD` | - | Redis密码 |

### 🤖 AI 服务配置

| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `DEEPSEEK_API_KEY` | - | DeepSeek API密钥 |
| `OPENAI_API_KEY` | - | OpenAI API密钥 |
| `ANTHROPIC_API_KEY` | - | Anthropic Claude API密钥 |
| `GOOGLE_AI_API_KEY` | - | Google Gemini API密钥 |

### 📨 消息队列配置

| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `RABBITMQ_URL` | - | 完整的RabbitMQ连接URL |
| `RABBITMQ_HOST` | `localhost` | RabbitMQ主机 |
| `RABBITMQ_PORT` | `5673` | RabbitMQ端口 |
| `RABBITMQ_USER` | `sira` | RabbitMQ用户名 |
| `RABBITMQ_PASSWORD` | - | RabbitMQ密码 |
| `RABBITMQ_VHOST` | `/` | RabbitMQ虚拟主机 |

### 📊 监控和可观测性

| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `PROMETHEUS_URL` | `http://localhost:9090` | Prometheus服务URL |
| `GRAFANA_URL` | `http://localhost:3001` | Grafana服务URL |
| `ELASTICSEARCH_URL` | `http://localhost:9200` | Elasticsearch服务URL |

### 🔒 安全配置

| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `JWT_SECRET` | - | JWT签名密钥（生产环境必须设置） |
| `JWT_EXPIRE` | `24h` | JWT过期时间 |
| `SESSION_SECRET` | - | 会话密钥（生产环境必须设置） |
| `API_KEY_ROTATION_ENABLED` | `true` | 是否启用API密钥轮换 |
| `API_KEY_ROTATION_INTERVAL` | `86400000` | 密钥轮换间隔(ms) |

### ⚡ 性能和限流配置

#### 速率限制
| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `RATE_LIMIT_WINDOW_MS` | `900000` | 速率限制窗口(ms) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | 最大请求数 |

#### 熔断器
| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `CIRCUIT_BREAKER_TIMEOUT` | `5000` | 熔断器超时(ms) |
| `CIRCUIT_BREAKER_FAILURE_THRESHOLD` | `5` | 失败阈值 |
| `CIRCUIT_BREAKER_RECOVERY_TIMEOUT` | `30000` | 恢复超时(ms) |

#### 连接池
| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `DB_POOL_MIN` | `2` | 数据库连接池最小连接数 |
| `DB_POOL_MAX` | `20` | 数据库连接池最大连接数 |
| `REDIS_POOL_MAX` | `10` | Redis连接池最大连接数 |

### 💾 缓存配置

| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `CACHE_TTL` | `3600` | 缓存过期时间(秒) |
| `CACHE_MAX_MEMORY` | `512mb` | 缓存最大内存 |

### 📁 文件上传配置

| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `UPLOAD_MAX_SIZE` | `10485760` | 最大上传文件大小(bytes) |
| `UPLOAD_DEST` | `/tmp/uploads` | 上传文件存储路径 |

### 📧 邮件配置

| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `SMTP_HOST` | `smtp.gmail.com` | SMTP服务器主机 |
| `SMTP_PORT` | `587` | SMTP服务器端口 |
| `SMTP_USER` | - | SMTP用户名 |
| `SMTP_PASS` | - | SMTP密码 |
| `FROM_EMAIL` | `noreply@sira.local` | 发件人邮箱 |

### ☁️ 对象存储配置 (MinIO/S3)

| 变量名 | 默认值 | 描述 |
|--------|--------|------|
| `MINIO_ENDPOINT` | `localhost:9000` | MinIO服务端点 |
| `MINIO_ACCESS_KEY` | `sira_access_key` | MinIO访问密钥 |
| `MINIO_SECRET_KEY` | `sira_secret_key` | MinIO秘密密钥 |
| `MINIO_BUCKET` | `sira-files` | 默认存储桶 |
| `MINIO_USE_SSL` | `false` | 是否使用SSL |

## 环境特定配置

### 开发环境配置

```bash
# .env.development
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
DEBUG=sira:*

# 开发数据库
DATABASE_URL=postgresql://sira:dev_password@localhost:5433/sira_dev
REDIS_URL=redis://localhost:6380
RABBITMQ_URL=amqp://sira:dev_password@localhost:5673/

# AI服务密钥
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

### 测试环境配置

```bash
# .env.test
NODE_ENV=test
PORT=8080
LOG_LEVEL=error

# 测试数据库
DATABASE_URL=postgresql://test:test_password@localhost:5434/sira_test
REDIS_URL=redis://localhost:6381
RABBITMQ_URL=amqp://test:test_password@localhost:5674/

# 测试API密钥
DEEPSEEK_API_KEY=sk-test-key-for-testing
OPENAI_API_KEY=sk-test-key-for-testing
```

### 生产环境配置

```bash
# .env.production
NODE_ENV=production
PORT=8080
LOG_LEVEL=info

# 生产数据库
DATABASE_URL=postgresql://prod_user:secure_password@prod-db-host:5432/sira_prod
REDIS_URL=redis://prod-redis-host:6379
RABBITMQ_URL=amqp://prod_user:secure_password@prod-rabbitmq-host:5672/

# 生产AI服务密钥
DEEPSEEK_API_KEY=sk-production-key-here
OPENAI_API_KEY=sk-production-key-here

# 安全配置（必须设置强密钥）
JWT_SECRET=your_64_character_random_string_here
SESSION_SECRET=your_64_character_random_string_here

# 监控配置
PROMETHEUS_URL=http://prod-prometheus:9090
GRAFANA_URL=http://prod-grafana:3000
```

## Docker环境变量

### 容器化部署的额外变量

```bash
# Docker Compose变量
COMPOSE_PROJECT_NAME=sira-ai-gateway
COMPOSE_FILE=docker-compose.yml:docker-compose.services.yml

# 容器特定变量
CONTAINER_NAME_PREFIX=sira
DOCKER_REGISTRY=your-registry.com
IMAGE_TAG=latest

# 网络配置
NETWORK_NAME=sira-network
NETWORK_DRIVER=bridge
```

## 配置验证

项目启动时会验证关键配置项：

```javascript
// 必须配置的项目
const requiredConfigs = [
  'DEEPSEEK_API_KEY',  // 或其他AI服务密钥
  'DATABASE_URL',      // 数据库连接
  'REDIS_URL',         // Redis连接
  'JWT_SECRET',        // JWT密钥（生产环境）
  'SESSION_SECRET'     // 会话密钥（生产环境）
];
```

## 安全注意事项

1. **敏感信息**: API密钥、数据库密码等敏感信息不要提交到代码库
2. **生产密钥**: 生产环境使用强随机生成的密钥
3. **权限控制**: 配置文件权限设置为600
4. **环境隔离**: 不同环境的配置完全隔离

## 配置加载顺序

1. `.env` 文件（最高优先级）
2. 系统环境变量
3. 默认值（最低优先级）

## 相关文档

- [Docker Compose配置](./DOCKER_IMPROVEMENT_PLAN.md)
- [部署指南](./docs/DEPLOYMENT-GUIDE.md)
- [安全配置](./SECURITY.md)
