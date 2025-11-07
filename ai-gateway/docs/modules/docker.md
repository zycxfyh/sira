# 🐳 Docker 部署模块

## 📋 概述

Docker模块提供了完整的容器化部署解决方案，支持生产环境和Staging环境的快速部署。该模块包含多服务编排、监控栈集成、自动化部署脚本，确保AI网关在容器环境中的高可用性和可扩展性。

## 🏗️ 架构组成

```
docker/
├── production/               # 生产环境部署
│   ├── docker-compose-full.yml    # 完整生产栈
│   ├── docker-compose.yml         # 基础生产配置
│   └── redis/
│       └── redis.conf             # Redis配置
├── staging/                  # 预发布环境
│   ├── docker-compose.yml         # Staging配置
│   ├── monitoring/                # 监控配置
│   │   ├── grafana/...
│   │   ├── prometheus.yml
│   │   └── ...
│   └── redis.conf                 # Redis配置
└── Dockerfile                 # AI网关镜像构建
```

## 🚀 部署模式

### 1. 完整生产环境 (production/docker-compose-full.yml)

**服务架构**:
```yaml
version: '3.8'
services:
  # AI网关核心服务
  ai-gateway:
    image: ai-gateway:latest
    ports:
      - "8080:8080"          # HTTP端口
      - "8443:8443"          # HTTPS端口
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - NATS_URL=nats://nats:4222
    depends_on:
      - redis
      - nats
      - kong
    volumes:
      - ./config:/app/config:ro
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Kong API网关
  kong:
    image: kong:3.4
    ports:
      - "8000:8000"          # Kong代理端口
      - "8443:8443"          # Kong HTTPS端口
      - "8001:8001"          # Kong管理端口
      - "8444:8444"          # Kong管理HTTPS
    environment:
      - KONG_DATABASE=postgres
      - KONG_PG_HOST=kong-db
      - KONG_PG_PASSWORD=kong_password
    depends_on:
      - kong-db
    volumes:
      - kong_data:/usr/local/kong/declarative
    restart: unless-stopped

  # Kong数据库
  kong-db:
    image: postgres:15
    environment:
      - POSTGRES_DB=kong
      - POSTGRES_USER=kong
      - POSTGRES_PASSWORD=kong_password
    volumes:
      - kong_db_data:/var/lib/postgresql/data
    restart: unless-stopped

  # Redis缓存
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - ./redis/redis.conf:/etc/redis/redis.conf
      - redis_data:/data
    command: redis-server /etc/redis/redis.conf
    restart: unless-stopped

  # NATS消息队列
  nats:
    image: nats:2.9
    ports:
      - "4222:4222"          # 客户端端口
      - "8222:8222"          # 监控端口
      - "6222:6222"          # 集群端口
    volumes:
      - nats_data:/data
      - ./nats.conf:/etc/nats/nats.conf
    command: ["-c", "/etc/nats/nats.conf", "--jetstream"]
    restart: unless-stopped

  # Prometheus监控
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
    restart: unless-stopped

  # Grafana可视化
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3001"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
    restart: unless-stopped

  # Jaeger追踪
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"        # Jaeger UI
      - "14268:14268"        # 接收Jaeger数据
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    volumes:
      - jaeger_data:/tmp
    restart: unless-stopped

  # Loki日志聚合
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - loki_data:/loki
      - ./monitoring/loki-config.yml:/etc/loki/local-config.yaml
    command: -config.file=/etc/loki/local-config.yaml
    restart: unless-stopped

  # Promtail日志收集
  promtail:
    image: grafana/promtail:latest
    volumes:
      - ./logs:/var/log/ai-gateway
      - ./monitoring/promtail-config.yml:/etc/promtail/config.yml
    command: -config.file=/etc/promtail/config.yml
    depends_on:
      - loki
    restart: unless-stopped

volumes:
  kong_data:
  kong_db_data:
  redis_data:
  nats_data:
  prometheus_data:
  grafana_data:
  jaeger_data:
  loki_data:
```

### 2. 简化生产环境 (production/docker-compose.yml)

**轻量级部署**:
```yaml
version: '3.8'
services:
  ai-gateway:
    build: ..
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
    depends_on:
      - redis

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

### 3. Staging环境 (staging/docker-compose.yml)

**预发布验证**:
```yaml
version: '3.8'
services:
  ai-gateway:
    image: ai-gateway:staging
    environment:
      - NODE_ENV=staging
    deploy:
      replicas: 2
      update_config:
        parallelism: 1
        delay: 10s
```

## 🐳 Docker镜像构建

### Dockerfile分析

```dockerfile
# 使用Node.js官方镜像
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# 复制package文件
COPY package*.json ./

# 安装依赖（生产环境）
RUN npm ci --only=production && npm cache clean --force

# 复制应用代码
COPY . .

# 创建非root用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ai-gateway -u 1001

# 更改文件所有权
RUN chown -R ai-gateway:nodejs /app
USER ai-gateway

# 暴露端口
EXPOSE 8080 8443

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# 使用dumb-init启动应用
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:ai"]
```

### 多阶段构建优化

```dockerfile
# 构建阶段
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# 生产镜像
FROM node:18-alpine AS production

# 仅复制生产依赖
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# 运行应用
CMD ["npm", "run", "start:ai"]
```

## 🚀 部署命令

### 完整环境部署

```bash
# 进入生产目录
cd docker/production

# 启动完整栈
docker-compose -f docker-compose-full.yml up -d

# 查看启动状态
docker-compose -f docker-compose-full.yml ps

# 查看日志
docker-compose -f docker-compose-full.yml logs -f ai-gateway

# 停止服务
docker-compose -f docker-compose-full.yml down
```

### 滚动更新

```bash
# 无缝更新AI网关
docker-compose -f docker-compose-full.yml up -d ai-gateway

# 查看更新状态
docker-compose -f docker-compose-full.yml ps ai-gateway
```

### 扩容服务

```bash
# 扩展AI网关实例
docker-compose -f docker-compose-full.yml up -d --scale ai-gateway=3

# 扩展监控服务
docker-compose -f docker-compose-full.yml up -d --scale prometheus=2
```

## 📊 监控和日志

### 服务健康检查

```bash
# 检查所有服务状态
docker-compose -f docker-compose-full.yml ps

# 查看特定服务健康状态
docker-compose -f docker-compose-full.yml exec ai-gateway curl -f http://localhost:8080/health

# 查看资源使用情况
docker stats
```

### 日志聚合

```bash
# 查看AI网关日志
docker-compose -f docker-compose-full.yml logs -f ai-gateway

# 查看所有服务日志
docker-compose -f docker-compose-full.yml logs -f

# 按时间范围查看日志
docker-compose -f docker-compose-full.yml logs --since "2025-11-07T00:00:00" ai-gateway
```

### 性能监控

```bash
# Prometheus指标
curl http://localhost:9090/api/v1/query?query=up

# Grafana访问
open http://localhost:3001  # 默认用户: admin/admin

# Jaeger追踪
open http://localhost:16686
```

## 🔒 安全配置

### 环境变量管理

```bash
# 创建环境文件
cat > .env << EOF
# 数据库密码
KONG_PG_PASSWORD=secure_kong_password
REDIS_PASSWORD=secure_redis_password

# AI提供商密钥
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key

# JWT密钥
JWT_SECRET=your_jwt_secret
EOF

# 使用环境文件
docker-compose --env-file .env -f docker-compose-full.yml up -d
```

### 网络安全

```yaml
# 内部网络隔离
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true

services:
  ai-gateway:
    networks:
      - frontend
      - backend
  redis:
    networks:
      - backend
```

## 📈 性能优化

### 资源限制

```yaml
services:
  ai-gateway:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### 数据持久化

```yaml
volumes:
  redis_data:
    driver: local
    driver_opts:
      type: tmpfs
      device: tmpfs
  prometheus_data:
    driver: local
    driver_opts:
      o: bind
      type: none
      device: /data/prometheus
```

## 🧪 测试验证

### 容器测试

```bash
# 构建镜像测试
docker build -t ai-gateway:test .

# 运行容器测试
docker run -d --name test-gateway -p 8080:8080 ai-gateway:test

# 集成测试
npm run test:integration

# 清理测试容器
docker rm -f test-gateway
```

### 编排测试

```bash
# 启动测试环境
docker-compose -f docker-compose.test.yml up -d

# 运行端到端测试
npm run test:e2e

# 清理测试环境
docker-compose -f docker-compose.test.yml down
```

## 📊 统计信息

| 组件 | 镜像大小 | 端口数量 | 数据卷 |
|------|----------|----------|--------|
| AI网关 | ~250MB | 2个 | 2个 |
| Kong | ~180MB | 4个 | 2个 |
| Redis | ~30MB | 1个 | 1个 |
| NATS | ~45MB | 3个 | 1个 |
| Prometheus | ~220MB | 1个 | 1个 |
| Grafana | ~280MB | 1个 | 1个 |
| **总计** | **~1.2GB** | **12个** | **8个** |

## 🔗 相关链接

- **[主README](../README.md)** - 项目总览
- **[部署指南](../DEPLOYMENT-GUIDE.md)** - 详细部署说明
- **[监控配置](../README-AI.md#监控)** - 可观测性配置
- **[Docker文档](https://docs.docker.com/)** - Docker官方文档

## 🤝 部署最佳实践

### 1. 渐进式部署
```bash
# 1. 部署基础设施
docker-compose up -d redis nats

# 2. 部署网关
docker-compose up -d kong ai-gateway

# 3. 部署监控
docker-compose up -d prometheus grafana jaeger
```

### 2. 备份策略
```bash
# 数据卷备份
docker run --rm -v ai-gateway_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz -C /data .

# 配置备份
docker run --rm -v ai-gateway_config:/config -v $(pwd):/backup alpine tar czf /backup/config-backup.tar.gz -C /config .
```

### 3. 故障恢复
```bash
# 快速重启服务
docker-compose restart ai-gateway

# 回滚到上一版本
docker-compose up -d --no-deps ai-gateway

# 完全重建
docker-compose up -d --force-recreate ai-gateway
```

---

*最后更新: 2025年11月7日* | 🔙 [返回模块列表](../README.md#模块导航)
