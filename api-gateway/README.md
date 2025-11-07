# API 中转站 (API Gateway)

基于成本优化策略设计的轻量级API中转站，支持多厂商路由、缓存、监控和成本追踪。

## 特性

- 🚀 **智能路由**: 根据成本、质量、延迟自动选择最优AI供应商
- 💾 **缓存优化**: Redis缓存减少重复请求，显著降低成本
- 📊 **监控告警**: 集成Prometheus + Grafana监控面板
- 💰 **成本追踪**: 实时计算和展示API调用成本
- 🛡️ **安全隔离**: API密钥隔离，保护供应商凭据
- 🔄 **熔断降级**: 自动熔断故障供应商，确保服务可用性

## 快速开始

### 环境要求

- Node.js 18+
- Redis 7+
- Docker & Docker Compose (推荐)

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制环境配置模板：

```bash
cp env.template .env
```

编辑 `.env` 文件，配置你的API密钥：

```env
# API Gateway Configuration
PORT=3000
NODE_ENV=development

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Vendor API Keys (必需)
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
AZURE_OPENAI_API_KEY=your_azure_key_here

# Gateway Configuration
GATEWAY_API_KEY=your_gateway_api_key
```

### 启动服务

#### 方式1: 使用Docker Compose (推荐)

```bash
# 启动基础服务 (API Gateway + Redis)
docker-compose up -d

# 启动完整监控栈 (包含Prometheus + Grafana)
docker-compose --profile monitoring up -d
```

#### 方式2: 本地开发

```bash
# 启动Redis
redis-server

# 启动API Gateway
npm run dev
```

### 验证安装

```bash
# 健康检查
curl http://localhost:3000/health

# 查看监控指标
curl http://localhost:3000/metrics
```

## 使用方法

### API调用示例

```bash
curl -X POST http://localhost:3000/api/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_gateway_api_key" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {
        "role": "user",
        "content": "你好，请介绍一下API中转站"
      }
    ],
    "temperature": 0.7
  }'
```

### 支持的模型

- **OpenAI**: `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`
- **Anthropic**: `claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku`
- **Azure OpenAI**: `gpt-4`, `gpt-3.5-turbo`

## 成本测算

运行成本效益分析：

```bash
# 查看不同场景的成本测算
npm run cost:calc

# 自定义参数测算
npm run cost:calc custom --N_raw 500000 --HR 0.4 --BR 0.6

# 灵敏度分析
npm run cost:calc sensitivity

# 成本趋势预测
npm run cost:calc trend 12
```

## 监控面板

### Grafana访问

- URL: http://localhost:3001
- 用户名: admin
- 密码: admin

### Prometheus访问

- URL: http://localhost:9090

## 项目结构

```
api-gateway/
├── src/
│   ├── index.js              # 主入口文件
│   ├── services/
│   │   ├── cache.js          # Redis缓存服务
│   │   ├── router.js         # 智能路由服务
│   │   └── proxy.js          # API代理服务
│   └── utils/
│       ├── logger.js         # 日志工具
│       └── metrics.js        # 监控指标
├── config/
│   └── default.js            # 配置文件
├── scripts/
│   └── cost-calculator.js    # 成本测算脚本
├── monitoring/
│   ├── prometheus.yml        # Prometheus配置
│   └── grafana/              # Grafana配置
├── Dockerfile                # Docker镜像
├── docker-compose.yml        # Docker编排
└── package.json
```

## 核心功能详解

### 1. 缓存策略

- **L1缓存**: 本地内存 (超低延迟)
- **L2缓存**: Redis (跨实例共享)
- **缓存键**: 基于prompt hash + 参数归一化
- **TTL策略**: 按数据类型分层设置过期时间

### 2. 智能路由

- **选择维度**: 成本、质量、延迟、可用性
- **动态调整**: 基于实时性能指标调整权重
- **熔断机制**: 自动隔离故障供应商

### 3. 监控指标

- 请求总数、缓存命中率、响应时间
- 各供应商调用成功率、失败率
- 模型维度成本聚合
- 系统资源使用情况

## 部署指南

### 生产环境部署

1. **配置环境变量**
   ```bash
   export NODE_ENV=production
   export OPENAI_API_KEY=your_production_key
   # ... 其他配置
   ```

2. **使用Docker部署**
   ```bash
   docker-compose -f docker-compose.yml up -d
   ```

3. **配置反向代理**
   ```nginx
   server {
     listen 80;
     server_name your-domain.com;

     location / {
       proxy_pass http://localhost:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
     }
   }
   ```

### 横向扩展

```bash
# 启动多个实例
docker-compose up -d --scale api-gateway=3
```

## 安全注意事项

- ✅ API密钥隔离存储
- ✅ 请求频率限制
- ✅ 输入验证和清理
- ✅ HTTPS传输加密
- ✅ 审计日志记录

## 故障排除

### 常见问题

1. **Redis连接失败**
   ```bash
   # 检查Redis状态
   redis-cli ping
   ```

2. **API密钥无效**
   - 检查环境变量配置
   - 确认API密钥权限

3. **监控数据为空**
   - 检查Prometheus配置
   - 确认网络连通性

### 日志查看

```bash
# 查看应用日志
docker-compose logs api-gateway

# 查看Redis日志
docker-compose logs redis
```

## 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 相关文档

- [API中转站成本优化策略手册](../API_中转站成本优化策略手册.md)
- [架构设计文档](./docs/architecture.md)
- [API文档](./docs/api.md)

---

## 技术栈

- **运行时**: Node.js
- **框架**: Express.js
- **缓存**: Redis
- **监控**: Prometheus + Grafana
- **容器化**: Docker
- **部署**: Docker Compose / Kubernetes
