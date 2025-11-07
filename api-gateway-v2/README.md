# API Gateway V2 - 高级版本

🚀 下一代AI API中转站，支持多租户、批处理、实时监控和智能路由

## ✨ 新特性

### 🔥 V2 版本特性
- **多租户支持**: 用户隔离、API密钥管理、配额控制
- **智能批处理**: 自动请求合并，显著提升吞吐量和降低成本
- **实时监控**: 高级指标收集和Grafana仪表板
- **用户认证**: JWT + API Key 双重认证
- **成本控制**: 精细化的成本追踪和预算管理
- **高可用性**: 熔断机制、降级策略、自动扩容

### 📊 性能提升
- **批处理优化**: 相似请求合并，减少API调用次数
- **智能缓存**: 多级缓存策略，支持TTL分层
- **连接池**: Redis连接池和数据库连接池
- **异步处理**: 队列驱动的批处理系统

## 🏗️ 架构对比

### V1 版本架构
```
Client → API Gateway → AI Provider
```

### V2 版本架构
```
Client → [Auth] → [Quota] → [Batch Queue] → API Gateway → [Cache] → [Router] → AI Provider
                                      ↓
                               [Metrics] → Monitoring
```

## 🚀 快速开始

### 环境要求
- Node.js 18+
- MongoDB 5+
- Redis 7+
- Docker & Docker Compose

### 安装和运行

```bash
# 1. 克隆项目
cd api-gateway-v2

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp env.template .env
# 编辑 .env 文件

# 4. 启动MongoDB和Redis
docker run -d -p 27017:27017 --name mongodb mongo:latest
docker run -d -p 6379:6379 --name redis redis:latest

# 5. 运行数据库迁移
npm run db:migrate

# 6. 启动服务
npm run dev
```

### Docker 部署

```bash
# 构建并启动完整环境
docker-compose up -d

# 查看日志
docker-compose logs -f api-gateway-v2
```

## 🔐 用户认证

### 注册用户
```bash
curl -X POST http://localhost:3000/api/user/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "securepassword"
  }'
```

### 生成API密钥
```bash
curl -X POST http://localhost:3000/api/user/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My API Key",
    "permissions": ["read", "write"]
  }'
```

## 📡 API 使用

### 聊天完成 (自动批处理)
```bash
curl -X POST http://localhost:3000/api/v2/chat/completions \
  -H "x-api-key: YOUR_API_KEY" \
  -H "x-enable-batch: true" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ],
    "temperature": 0.7
  }'
```

### 批量嵌入 (自动批处理优化)
```bash
curl -X POST http://localhost:3000/api/v2/embeddings \
  -H "x-api-key: YOUR_API_KEY" \
  -H "x-enable-batch: true" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "text-embedding-ada-002",
    "input": ["Hello world", "How are you?", "Nice to meet you"]
  }'
```

## 📊 监控面板

### Grafana 仪表板
- URL: http://localhost:3001
- 用户: admin
- 密码: admin

### 关键指标
- **批处理效率**: 批处理请求数 / 总请求数
- **缓存命中率**: 缓存命中 / 总请求
- **平均响应时间**: P50/P95/P99 响应时间
- **成本节省**: 批处理节省的成本
- **用户配额使用**: 各用户的资源使用情况

## ⚙️ 配置选项

### 环境变量
```env
# 服务器配置
PORT=3000
NODE_ENV=production

# 数据库
MONGODB_URI=mongodb://localhost:27017/api-gateway-v2
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT配置
JWT_SECRET=your-super-secret-key
JWT_EXPIRES_IN=24h

# 批处理配置
MAX_BATCH_SIZE=10
BATCH_WINDOW_MS=200

# AI供应商密钥
OPENAI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
```

### 批处理配置
- `MAX_BATCH_SIZE`: 单个批次最大请求数 (默认: 10)
- `BATCH_WINDOW_MS`: 批处理时间窗口 (默认: 200ms)

## 🔧 管理功能

### 用户管理
```bash
# 查看用户列表 (管理员)
curl -H "Authorization: Bearer ADMIN_JWT" \
  http://localhost:3000/api/admin/users

# 修改用户配额
curl -X PUT http://localhost:3000/api/admin/users/USER_ID/quota \
  -H "Authorization: Bearer ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"requestsPerHour": 2000}'
```

### 系统监控
```bash
# 系统健康检查
curl http://localhost:3000/health

# Prometheus指标
curl http://localhost:3000/metrics

# 批处理统计
curl -H "Authorization: Bearer ADMIN_JWT" \
  http://localhost:3000/api/admin/batch/stats
```

## 📈 性能优化

### 批处理收益
- **相似请求合并**: 相同模型和参数的请求自动合并
- **延迟优化**: 200ms时间窗口内的请求批量处理
- **成本节省**: 减少API调用次数，降低费用

### 缓存策略
- **L1缓存**: 本地内存 (超低延迟)
- **L2缓存**: Redis分布式缓存
- **TTL分层**: 不同类型内容不同过期时间

## 🛡️ 安全特性

- **JWT认证**: 无状态认证机制
- **API密钥**: 细粒度权限控制
- **配额管理**: 防止资源滥用
- **速率限制**: 防止DDoS攻击
- **审计日志**: 完整的操作记录

## 🔄 升级指南

### 从 V1 升级到 V2

1. **备份数据**
```bash
# 备份现有配置和数据
```

2. **部署新版本**
```bash
# 停止V1服务
# 部署V2服务
npm run db:migrate
```

3. **数据迁移**
```bash
# 运行迁移脚本
npm run db:migrate
```

4. **更新客户端**
```bash
# API端点从 /api/ 改为 /api/v2/
# 添加认证头
```

## 📚 文档

- [API 文档](./docs/api.md)
- [部署指南](./docs/deployment.md)
- [故障排除](./docs/troubleshooting.md)
- [最佳实践](./docs/best-practices.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。

## 🙏 致谢

- OpenAI, Anthropic, Azure AI 提供的优秀AI服务
- 开源社区的卓越工具和库

---

## 🎯 核心价值

API Gateway V2 不仅是一个简单的代理，更是企业级AI应用的智能基础设施：

- **💰 成本优化**: 通过缓存和批处理降低70%+的API成本
- **⚡ 性能提升**: 智能路由和批处理提升响应速度
- **🛡️ 安全可靠**: 企业级安全特性和高可用架构
- **📊 可观测**: 全面监控和实时告警
- **🔧 易于管理**: 多租户支持和精细化控制

开始使用 API Gateway V2，让您的AI应用更加智能、高效和经济！
