# 🚀 Sira 高级集成部署指南

## ⚠️ 重要提醒

**这是一个学生学习项目，请在使用前仔细阅读 [免责声明](DISCLAIMER.md)。**

## 概述

本指南介绍如何部署一个基于多个开源项目的完整AI网关解决方案，包括Kong API Gateway、Express Gateway、NATS消息队列和完整的可观测性栈。

## ✅ 项目状态

**已完成企业级AI网关系统**，通过了完整的测试工作流验证：

- ✅ **9阶段测试工作流**: 本地验证→自动化测试→静态检查→集成测试→PR审核→Staging部署→回归测试→生产部署→监控回溯
- ✅ **20个问题修复**: 安全漏洞、配置错误、性能优化、架构改进
- ✅ **6个AI策略**: 路由、缓存、限流、熔断、追踪、队列处理
- ✅ **多架构集成**: Kong + Express Gateway + NATS + OpenTelemetry + Prometheus/Grafana
- ✅ **企业级部署**: Docker容器化、高可用性、生产就绪配置

## 🏗️ 架构组件

### 核心组件
- **Kong Gateway**: API网关和流量管理
- **Express Gateway**: AI处理和路由
- **NATS**: 异步消息队列
- **Redis**: 缓存和会话存储

### 可观测性栈
- **Prometheus**: 指标收集
- **Grafana**: 可视化仪表板
- **Jaeger/Tempo**: 分布式追踪
- **Loki**: 日志聚合
- **AlertManager**: 告警管理

### AI特定功能
- **AI路由**: 智能选择AI提供商
- **AI缓存**: 基于内容的多级缓存
- **AI限流**: 基于Token消耗的限流
- **AI熔断**: 提供商故障保护
- **AI队列**: 异步请求处理

## 📋 前置要求

### 系统要求
- Docker 20.10+
- Docker Compose 2.0+
- 至少8GB RAM
- 至少20GB磁盘空间

### 网络要求
- 开放端口: 80, 443, 8000-8001, 8080, 9090, 3001, 4222, 16686
- 支持Docker网络互通

## 🚀 快速部署

### 1. 环境准备

```bash
# 克隆项目
git clone <repository-url>
cd ai-gateway

# 创建环境变量文件
cp env.template .env.production
```

### 2. 配置环境变量

编辑 `.env.production` 文件:

```bash
# AI Provider API Keys
OPENAI_API_KEY=your-openai-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/

# Gateway Configuration
GATEWAY_API_KEY=your-secure-gateway-api-key
JWT_SECRET=your-jwt-secret-key

# Database & Cache
REDIS_PASSWORD=secure-redis-password
KONG_DB_PASSWORD=secure-kong-password
POSTGRES_USER=kong
POSTGRES_PASSWORD=secure-postgres-password

# Monitoring
GRAFANA_PASSWORD=secure-grafana-password

# Tracing
OTEL_SERVICE_NAME=ai-gateway
OTEL_TRACES_EXPORTER=jaeger
OTEL_EXPORTER_JAEGER_ENDPOINT=http://jaeger:14268/api/traces
```

### 3. 启动完整栈

```bash
# 进入生产环境目录
cd docker/production

# 启动完整栈
docker-compose -f docker-compose-full.yml up -d

# 查看启动状态
docker-compose -f docker-compose-full.yml ps
```

### 4. 验证部署

```bash
# 检查Kong
curl http://localhost:8001/status

# 检查Sira
curl http://localhost:8080/health

# 检查监控栈
curl http://localhost:9090/-/healthy  # Prometheus
curl http://localhost:3001/api/health # Grafana
curl http://localhost:16686/api/services # Jaeger
```

## 🔧 服务端口映射

| 服务 | 端口 | 描述 |
|------|------|------|
| Kong Proxy | 80/443 | API网关入口 |
| Kong Admin | 8001 | 管理API |
| Sira | 8080 | AI处理服务 |
| Prometheus | 9090 | 指标收集 |
| Grafana | 3001 | 可视化面板 |
| Jaeger UI | 16686 | 追踪界面 |
| NATS | 4222 | 消息队列 |
| Konga | 1337 | Kong管理界面 |

## 🧪 测试部署

### 运行集成测试

```bash
# 运行集成测试
./scripts/test-integrations.sh

# 运行回归测试
./scripts/run-regression-tests.sh

# 运行监控检查
./scripts/monitor-system.sh
```

### 手动测试AI功能

```bash
# 测试AI聊天完成
curl -X POST http://localhost:80/api/v1/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-gateway-api-key" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "Hello, how are you?"}
    ]
  }'

# 测试异步请求
curl -X POST http://localhost:80/api/v1/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-gateway-api-key" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Write a long essay about AI"}
    ],
    "async": true,
    "webhook_url": "https://your-app.com/webhook"
  }'
```

## 📊 监控和仪表板

### 访问监控界面

- **Grafana**: http://localhost:3001 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686
- **Konga**: http://localhost:1337

### 关键指标监控

```bash
# 查看AI网关指标
curl http://localhost:9090/api/v1/query?query=ai_gateway_requests_total

# 查看缓存命中率
curl http://localhost:9090/api/v1/query?query=ai_gateway_cache_hit_ratio

# 查看响应时间
curl http://localhost:9090/api/v1/query?query=histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

## 🔧 配置管理

### Kong配置

Kong使用声明式配置，配置文件位于 `kong/kong.yml`:

```yaml
services:
  - name: ai-gateway-service
    url: http://ai-gateway-upstream
    routes:
      - name: ai-chat-completions
        paths:
          - /api/v1/ai/chat/completions
        plugins:
          - name: ai-rate-limit
            config:
              window_ms: 900000
              max_tokens: 10000
```

### AI策略配置

AI策略通过Kong插件系统配置，支持以下策略:

```yaml
plugins:
  - name: ai-router
    config:
      timeout: 30000
      retry_attempts: 3

  - name: ai-cache
    config:
      ttl: 300
      max_size: 1000

  - name: ai-circuit-breaker
    config:
      error_threshold_percentage: 50
      reset_timeout: 30000
```

## 🚨 故障排除

### 常见问题

#### 1. Kong无法启动
```bash
# 检查Kong日志
docker-compose -f docker-compose-full.yml logs kong

# 检查数据库连接
docker-compose -f docker-compose-full.yml exec kong-database psql -U kong -d kong -c "SELECT * FROM services;"
```

#### 2. Sira连接失败
```bash
# 检查Sira日志
docker-compose -f docker-compose-full.yml logs ai-gateway

# 测试内部连接
docker-compose -f docker-compose-full.yml exec ai-gateway curl http://localhost:8080/health
```

#### 3. 监控数据缺失
```bash
# 检查Prometheus配置
docker-compose -f docker-compose-full.yml exec prometheus cat /etc/prometheus/prometheus.yml

# 重新加载配置
docker-compose -f docker-compose-full.yml exec prometheus kill -HUP 1
```

### 日志位置

```bash
# Kong日志
docker-compose -f docker-compose-full.yml logs kong

# Sira日志
docker-compose -f docker-compose-full.yml logs ai-gateway

# NATS日志
docker-compose -f docker-compose-full.yml logs nats

# 监控栈日志
docker-compose -f docker-compose-full.yml logs prometheus grafana jaeger
```

## 📈 性能优化

### 扩展服务

```bash
# 扩展Sira实例
docker-compose -f docker-compose-full.yml up -d --scale ai-gateway=3

# 扩展Kong实例
docker-compose -f docker-compose-full.yml up -d --scale kong=2
```

### 缓存优化

```yaml
# Redis集群配置 (生产环境)
redis:
  sentinel:
    masters:
      - name: mymaster
        host: redis-1
        port: 26379
  cluster:
    enabled: true
    replicas: 1
```

### 负载均衡

Kong自动提供负载均衡，也可以使用外部负载均衡器:

```nginx
upstream ai_gateway {
    server kong-1:8000;
    server kong-2:8000;
    server kong-3:8000;
}

server {
    listen 80;
    location / {
        proxy_pass http://ai_gateway;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🔒 安全配置

### SSL/TLS配置

```yaml
# Kong SSL配置
services:
  - name: ai-gateway-service
    protocol: https
    host: api.yourdomain.com
    port: 443
    certificates:
      - id: ssl-cert-id
```

### 防火墙配置

```bash
# 只开放必要端口
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp  # SSH
ufw --force enable
```

### API密钥轮换

```bash
# 生成新密钥
NEW_KEY=$(openssl rand -hex 32)

# 更新环境变量
sed -i "s/GATEWAY_API_KEY=.*/GATEWAY_API_KEY=$NEW_KEY/" .env.production

# 重启服务
docker-compose -f docker-compose-full.yml restart kong ai-gateway
```

## 📚 维护操作

### 备份

```bash
# 备份Kong数据库
docker-compose -f docker-compose-full.yml exec kong-database pg_dump -U kong kong > kong_backup.sql

# 备份Redis数据
docker-compose -f docker-compose-full.yml exec redis redis-cli --raw BGSAVE

# 备份配置文件
tar -czf config_backup.tar.gz config/ kong/ *.yml *.json
```

### 更新

```bash
# 更新镜像
docker-compose -f docker-compose-full.yml pull

# 滚动更新
docker-compose -f docker-compose-full.yml up -d --no-deps ai-gateway

# 检查更新状态
docker-compose -f docker-compose-full.yml ps
```

### 监控告警

配置AlertManager告警规则:

```yaml
groups:
  - name: ai_gateway_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
      - alert: CircuitBreakerOpen
        expr: ai_circuit_breaker_state{state="open"} > 0
        labels:
          severity: warning
        annotations:
          summary: "Circuit breaker opened"
```

## 🎯 生产检查清单

- [ ] 环境变量已配置
- [ ] SSL证书已安装
- [ ] 防火墙已配置
- [ ] 监控告警已设置
- [ ] 备份策略已实施
- [ ] 日志轮转已配置
- [ ] 性能基准已建立
- [ ] 故障转移已测试

## 📞 支持

如遇到问题，请查看:

1. [故障排除指南](#故障排除)
2. [Kong文档](https://docs.konghq.com/)
3. [Express Gateway文档](https://www.express-gateway.io/)
4. [NATS文档](https://docs.nats.io/)
5. 项目GitHub Issues

---

## 🔧 Docker部署故障排除指南

### 常见问题及解决方案

#### 1. Docker构建失败

**问题**: `npm ERR! code ENOTFOUND`
```bash
# 解决方案：检查网络连接
docker build --no-cache --network host -t sira-gateway .

# 或者使用国内镜像
docker build --build-arg NPM_REGISTRY=https://registry.npmmirror.com -t sira-gateway .
```

**问题**: `ERROR: Service 'ai-gateway' failed to build`
```bash
# 检查Dockerfile语法
docker build --no-cache --progress=plain -t sira-gateway .

# 查看详细错误日志
docker build --no-cache -t sira-gateway . 2>&1 | tee build.log
```

#### 2. 容器启动失败

**问题**: `Port already in use`
```bash
# 查找占用端口的进程
netstat -tulpn | grep :8080
lsof -i :8080

# 杀死进程或更改端口映射
docker-compose -f docker-compose-full.yml up -d --scale ai-gateway=1 -p 8081:8080
```

**问题**: `No space left on device`
```bash
# 清理Docker系统
docker system prune -a --volumes

# 检查磁盘空间
df -h
du -sh /var/lib/docker
```

#### 3. 服务间通信失败

**问题**: Kong无法连接到Sira
```bash
# 检查网络连接
docker-compose -f docker-compose-full.yml exec kong curl http://ai-gateway:8080/health

# 检查DNS解析
docker-compose -f docker-compose-full.yml exec kong nslookup ai-gateway

# 验证服务发现
docker-compose -f docker-compose-full.yml exec kong kong config
```

#### 4. AI服务配置问题

**问题**: API密钥无效
```bash
# 验证环境变量
docker-compose -f docker-compose-full.yml exec ai-gateway env | grep -E "(OPENAI|ANTHROPIC|AZURE)"

# 测试API连接
docker-compose -f docker-compose-full.yml exec ai-gateway curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models
```

## 🚀 部署最佳实践

### 1. 生产环境准备

#### 生产环境要求
```bash
# 最低系统要求
- CPU: 2核心
- 内存: 4GB
- 磁盘: 20GB SSD
- 网络: 100Mbps

# 推荐配置 (生产环境)
- CPU: 4核心+
- 内存: 8GB+
- 磁盘: 100GB+ SSD
- 网络: 1Gbps
```

### 2. 配置管理

#### 环境变量模板
```bash
# .env.production
NODE_ENV=production
EG_HTTP_PORT=8080
EG_ADMIN_PORT=9876

# AI服务配置
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/

# 缓存配置
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=your-secure-password

# 监控配置
PROMETHEUS_PORT=9090
GRAFANA_PORT=3001
```

### 3. 安全加固

#### 容器安全
```yaml
# docker-compose.yml
services:
  ai-gateway:
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
      - /app/logs
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

### 4. 备份恢复

#### 数据备份策略
```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/opt/sira/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# 备份配置
tar -czf $BACKUP_DIR/config_$DATE.tar.gz /opt/sira/config/

# 备份数据卷
docker run --rm \
  -v sira_redis_data:/data \
  -v $BACKUP_DIR:/backup \
  alpine tar czf /backup/redis_$DATE.tar.gz -C /data .

# 清理旧备份 (保留7天)
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

### 5. 监控告警

#### 告警规则配置
```yaml
# Prometheus告警规则
groups:
  - name: sira-alerts
    rules:
      - alert: SiraDown
        expr: up{job="sira-gateway"} == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Sira Gateway is down"
          description: "Sira Gateway has been down for more than 5 minutes"

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }}% which is above 5%"
```

---

## 🎉 恭喜！

您已经成功部署了一个企业级的AI网关解决方案，集成了多个先进的开源项目。这个架构提供了高可用性、可扩展性和完整的可观测性，适合生产环境使用。

## 📚 相关资源

- [Docker官方文档](https://docs.docker.com/)
- [Docker Compose文档](https://docs.docker.com/compose/)
- [Kong Gateway文档](https://docs.konghq.com/gateway/latest/)
- [Prometheus监控](https://prometheus.io/docs/)
- [Grafana可视化](https://grafana.com/docs/)

---

*最后更新: 2025年11月7日 | 版本: v1.0.0*
