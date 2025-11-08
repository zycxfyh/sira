# 📋 Sira AI Gateway - 运维操作指南

<div align="center">

## 🚀 企业级AI网关运维手册

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Ready-326CE5?style=for-the-badge&logo=kubernetes)](https://kubernetes.io/)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg?style=for-the-badge&logo=apache)](https://opensource.org/licenses/Apache-2.0)

*基于Express Gateway深度定制，专为AI服务场景优化的智能API网关*

[快速开始](#-快速开始) • [部署指南](#-部署方式) • [监控运维](#-监控与运维) • [故障排除](#-故障排除) • [最佳实践](#-最佳实践)

---

</div>

## 📖 目录

- [📋 Sira AI Gateway - 运维操作指南](#-sira-ai-gateway---运维操作指南)
  - [🎯 运维概述](#-运维概述)
  - [🏗️ 系统架构](#️-系统架构)
  - [⚡ 快速开始](#-快速开始)
  - [🐳 部署方式](#-部署方式)
  - [⚙️ 配置管理](#️-配置管理)
  - [🔧 日常运维](#-日常运维)
  - [📊 监控与运维](#-监控与运维)
  - [🚨 故障排除](#-故障排除)
  - [📈 性能优化](#-性能优化)
  - [🔒 安全运维](#-安全运维)
  - [📚 最佳实践](#-最佳实践)
  - [🆘 紧急处理](#-紧急处理)
  - [📞 技术支持](#-技术支持)

---

## 🎯 运维概述

### 核心职责

Sira AI Gateway作为AI服务的统一入口，其运维核心包括：

- **🚀 服务可用性**: 确保7×24小时高可用
- **⚡ 性能监控**: AI请求响应时间 < 500ms
- **🔄 自动扩展**: 根据负载动态调整资源
- **🛡️ 安全防护**: 多层安全防护和审计
- **📊 智能路由**: 20+ AI提供商的智能调度

### 关键指标

| 指标类型 | 目标值 | 告警阈值 | 严重程度 |
|---------|--------|----------|----------|
| 服务可用性 | 99.9% | < 99.5% | 🔴 严重 |
| API响应时间 | < 500ms | > 2000ms | 🔴 严重 |
| 错误率 | < 1% | > 5% | 🟡 警告 |
| 并发连接数 | < 1000 | > 2000 | 🟡 警告 |
| CPU使用率 | < 70% | > 85% | 🟡 警告 |
| 内存使用率 | < 80% | > 90% | 🔴 严重 |

---

## 🏗️ 系统架构

### 核心组件

```
┌─────────────────────────────────────────────────────────────┐
│                    🌐 客户端层                              │
│  Web/Mobile Apps • Third-party Services • Internal Systems  │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                 🚪 网关层 (Sira AI Gateway)                  │
│  ┌─────────────────┬─────────────────┬─────────────────┐    │
│  │   🔐 认证授权   │   🧠 AI路由     │   📊 监控统计    │    │
│  │                 │   🤖 智能调度   │   📈 用量分析    │    │
│  │   JWT/OAuth     │   🔄 负载均衡   │   📋 审计日志    │    │
│  │   API Keys      │   💰 成本优化   │   🔍 链路追踪    │    │
│  └─────────────────┴─────────────────┴─────────────────┘    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  🤖 AI服务层                                │
│  ┌─────────────────┬─────────────────┬─────────────────┐    │
│  │   OpenAI        │   Anthropic     │   Google        │    │
│  │   GPT-4/3.5     │   Claude        │   Gemini        │    │
│  │   DALL-E        │   Titan         │   LaMDA         │    │
│  │   Whisper       │   TTS           │                 │    │
│  └─────────────────┼─────────────────┼─────────────────┘    │
│  ┌─────────────────┬─────────────────┬─────────────────┐    │
│  │   Azure         │   AWS           │   国内厂商      │    │
│  │   OpenAI        │   Bedrock       │   百度/腾讯      │    │
│  │   Computer      │   SageMaker     │   阿里云        │    │
│  │   Vision        │   Comprehend    │   华为云        │    │
│  └─────────────────┴─────────────────┴─────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 技术栈

- **网关框架**: Express Gateway (深度定制)
- **编程语言**: Node.js 18+
- **缓存系统**: Redis (多级缓存)
- **数据库**: PostgreSQL + Redis
- **消息队列**: Redis Queue
- **监控栈**: Prometheus + Grafana + Jaeger
- **容器化**: Docker + Kubernetes
- **CI/CD**: GitHub Actions + ArgoCD

---

## ⚡ 快速开始

### 环境要求

```bash
# 系统要求
- Ubuntu 20.04+ / CentOS 8+ / macOS 12+
- CPU: 2核心以上
- 内存: 4GB以上
- 磁盘: 20GB以上

# 依赖软件
- Node.js 18.0+
- Docker 20.0+
- Redis 6.0+
- PostgreSQL 13+
```

### 一键部署

```bash
# 1. 克隆项目
git clone https://github.com/your-org/sira-ai-gateway.git
cd sira-ai-gateway

# 2. 环境配置
cp env.template .env
# 编辑 .env 文件，配置数据库和AI提供商密钥

# 3. 一键启动
docker-compose up -d

# 4. 验证部署
curl http://localhost:8080/health
curl http://localhost:9876/api-keys
```

### 手动部署

```bash
# 1. 安装依赖
npm install

# 2. 初始化数据库
npm run db:migrate

# 3. 配置环境变量
export EG_HTTP_PORT=8080
export EG_ADMIN_PORT=9876
export REDIS_URL=redis://localhost:6379
export DATABASE_URL=postgresql://user:pass@localhost:5432/sira

# 4. 启动服务
npm start

# 5. 验证服务
curl http://localhost:8080/health
```

---

## 🐳 部署方式

### Docker 部署

```yaml
# docker-compose.yml
version: '3.8'
services:
  sira-gateway:
    image: sira/ai-gateway:latest
    ports:
      - "8080:8080"   # 网关端口
      - "9876:9876"   # 管理端口
    environment:
      - EG_HTTP_PORT=8080
      - EG_ADMIN_PORT=9876
      - REDIS_URL=redis://redis:6379
      - DATABASE_URL=postgresql://db:5432/sira
    depends_on:
      - redis
      - postgres
    volumes:
      - ./config:/app/config
      - ./logs:/app/logs
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: sira
      POSTGRES_USER: sira
      POSTGRES_PASSWORD: your_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

### Kubernetes 部署

```yaml
# k8s/deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sira-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sira-gateway
  template:
    metadata:
      labels:
        app: sira-gateway
    spec:
      containers:
      - name: gateway
        image: sira/ai-gateway:latest
        ports:
        - containerPort: 8080
        - containerPort: 9876
        env:
        - name: EG_HTTP_PORT
          value: "8080"
        - name: EG_ADMIN_PORT
          value: "9876"
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 2000m
            memory: 4Gi
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 云服务部署

#### AWS ECS

```hcl
# Terraform 配置示例
resource "aws_ecs_service" "sira_gateway" {
  name            = "sira-gateway"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.sira_gateway.arn
  desired_count   = 3

  load_balancer {
    target_group_arn = aws_lb_target_group.gateway.arn
    container_name   = "sira-gateway"
    container_port   = 8080
  }

  lifecycle {
    ignore_changes = [desired_count]
  }
}
```

#### Azure AKS

```yaml
# Helm values.yml
replicaCount: 3

image:
  repository: sira/ai-gateway
  tag: latest

service:
  type: LoadBalancer
  port: 80
  targetPort: 8080

env:
  - name: EG_HTTP_PORT
    value: "8080"
  - name: REDIS_URL
    value: "redis://redis:6379"

ingress:
  enabled: true
  annotations:
    kubernetes.io/ingress.class: nginx
```

---

## ⚙️ 配置管理

### 核心配置文件

```
ai-gateway/
├── config/
│   ├── gateway.config.yml      # 网关配置
│   ├── system.config.yml       # 系统配置
│   └── ai-providers.yml        # AI提供商配置
├── lib/config/
│   └── gateway.config.yml      # 默认配置
└── env.template                # 环境变量模板
```

### 环境变量配置

```bash
# 基础配置
export EG_HTTP_PORT=8080              # 网关端口
export EG_ADMIN_PORT=9876             # 管理端口
export NODE_ENV=production            # 运行环境

# 数据库配置
export DATABASE_URL=postgresql://user:pass@host:5432/db
export REDIS_URL=redis://host:6379

# AI提供商配置
export OPENAI_API_KEY=sk-...
export ANTHROPIC_API_KEY=sk-ant-...
export GOOGLE_API_KEY=...

# 安全配置
export JWT_SECRET=your-secret-key
export EG_CRYPTO_CIPHER_KEY=cipher-key

# 监控配置
export PROMETHEUS_PORT=9090
export GRAFANA_PORT=3000
```

### 动态配置更新

```bash
# 更新网关配置
curl -X PUT http://localhost:9876/config \
  -H "Content-Type: application/json" \
  -d '{
    "policies": {
      "ai-router": {
        "timeout": 30000
      }
    }
  }'

# 重新加载配置
curl -X POST http://localhost:9876/config/reload
```

---

## 🔧 日常运维

### 服务管理

```bash
# 查看服务状态
systemctl status sira-gateway

# 启动服务
systemctl start sira-gateway

# 停止服务
systemctl stop sira-gateway

# 重启服务
systemctl restart sira-gateway

# 查看日志
journalctl -u sira-gateway -f
```

### 日志管理

```bash
# 查看应用日志
tail -f logs/application.log

# 查看错误日志
tail -f logs/error.log

# 按时间范围查看日志
journalctl --since "2024-01-01" --until "2024-01-02"

# 按服务过滤日志
journalctl -u sira-gateway --grep "ERROR"
```

### 数据备份

```bash
# 数据库备份
pg_dump sira_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Redis数据备份
redis-cli SAVE

# 配置文件备份
tar -czf config_backup_$(date +%Y%m%d).tar.gz config/

# 日志归档
find logs/ -name "*.log" -mtime +30 -exec gzip {} \;
```

---

## 📊 监控与运维

### 监控指标

#### 核心业务指标

```prometheus
# AI请求成功率
rate(ai_requests_total{status="success"}[5m]) /
rate(ai_requests_total[5m])

# 平均响应时间
histogram_quantile(0.95,
  rate(ai_request_duration_bucket[5m])
)

# 提供商切换次数
increase(ai_provider_switches_total[1h])
```

#### 系统资源指标

```prometheus
# CPU使用率
100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# 内存使用率
1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)

# 磁盘使用率
(1 - node_filesystem_avail_bytes / node_filesystem_size_bytes) * 100
```

### Grafana 仪表板

#### 核心仪表板配置

1. **AI服务概览**
   - 请求量趋势图
   - 各提供商使用分布
   - 错误率和响应时间

2. **系统性能**
   - CPU/内存使用率
   - 网络I/O监控
   - 队列积压情况

3. **业务指标**
   - 用户活跃度
   - API调用模式
   - 成本分析图表

### 告警配置

```yaml
# Prometheus Alert Rules
groups:
  - name: sira_gateway_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(ai_requests_total{status="error"}[5m]) / rate(ai_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "AI请求错误率过高"
          description: "错误率超过5%，当前值: {{ $value }}"

      - alert: SlowResponseTime
        expr: histogram_quantile(0.95, rate(ai_request_duration_bucket[5m])) > 5
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "AI响应时间过慢"
          description: "95分位响应时间超过5秒"
```

### 日志分析

```bash
# 分析错误日志
grep "ERROR" logs/application.log | jq '.message' | sort | uniq -c | sort -nr

# 分析慢查询
grep "duration.*[0-9]\{4,\}" logs/application.log | jq '.duration' | sort -n

# 分析API使用模式
grep "API_CALL" logs/application.log | jq '.endpoint' | sort | uniq -c | sort -nr
```

---

## 🚨 故障排除

### 常见问题

#### 1. 服务启动失败

**现象**: `Error: listen EADDRINUSE`

**解决**:
```bash
# 检查端口占用
netstat -tulpn | grep :8080

# 杀掉占用进程
sudo kill -9 <PID>

# 或修改端口配置
export EG_HTTP_PORT=8081
```

#### 2. AI提供商连接失败

**现象**: `Provider connection timeout`

**解决**:
```bash
# 检查网络连接
curl -I https://api.openai.com/v1/models

# 验证API密钥
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# 更新提供商配置
curl -X PUT http://localhost:9876/config/ai-providers \
  -d '{"openai": {"timeout": 60000}}'
```

#### 3. 高内存使用

**现象**: 内存使用率持续 > 90%

**解决**:
```bash
# 检查内存泄漏
node --inspect --max-old-space-size=4096 lib/index.js

# 重启服务
systemctl restart sira-gateway

# 如果持续存在，考虑扩容
kubectl scale deployment sira-gateway --replicas=5
```

#### 4. 缓存性能问题

**现象**: Redis连接超时

**解决**:
```bash
# 检查Redis状态
redis-cli ping

# 重启Redis
systemctl restart redis

# 检查连接池配置
curl http://localhost:9876/metrics | grep redis
```

### 诊断工具

```bash
# 健康检查
curl http://localhost:8080/health

# 详细诊断
curl http://localhost:9876/diagnostics

# 性能分析
curl http://localhost:9876/metrics

# 连接测试
curl http://localhost:8080/api/v1/ai/test \
  -H "Authorization: Bearer test-key"
```

### 应急预案

#### 降级策略

```javascript
// 自动降级配置
const fallbackConfig = {
  // 当主要提供商失败时
  fallbackProviders: ['anthropic', 'google'],
  // 简化响应格式
  simplifiedResponses: true,
  // 禁用非核心功能
  disableFeatures: ['analytics', 'webhooks']
}

// 手动降级命令
curl -X POST http://localhost:9876/admin/degrade \
  -d '{"level": "partial", "duration": 3600000}'
```

#### 故障转移

```bash
# Kubernetes故障转移
kubectl scale deployment sira-gateway-backup --replicas=3
kubectl scale deployment sira-gateway --replicas=0

# DNS切换
# 更新DNS记录指向备用集群
nslookup gateway.example.com
```

---

## 📈 性能优化

### 缓存优化

```javascript
// 多级缓存配置
const cacheConfig = {
  l1: { // 内存缓存
    ttl: 300,    // 5分钟
    maxSize: 1000
  },
  l2: { // Redis缓存
    ttl: 3600,   // 1小时
    prefix: 'sira:ai:'
  },
  l3: { // 数据库缓存
    ttl: 86400,  // 24小时
    compression: true
  }
}
```

### 连接池配置

```javascript
// HTTP连接池
const httpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 100,
  maxFreeSockets: 10,
  timeout: 60000
})

// 数据库连接池
const dbPool = new Pool({
  max: 20,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
})
```

### 负载均衡

```yaml
# Nginx负载均衡配置
upstream sira_gateway {
    least_conn;
    server gateway-1:8080 weight=3;
    server gateway-2:8080 weight=3;
    server gateway-3:8080 weight=2;
    server gateway-4:8080 weight=1 backup;
}

server {
    listen 80;
    location / {
        proxy_pass http://sira_gateway;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 数据库优化

```sql
-- 性能优化索引
CREATE INDEX CONCURRENTLY idx_ai_requests_timestamp
ON ai_requests (timestamp DESC);

CREATE INDEX CONCURRENTLY idx_ai_requests_provider_status
ON ai_requests (provider, status);

-- 分区表
CREATE TABLE ai_requests_y2024m01 PARTITION OF ai_requests
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

---

## 🔒 安全运维

### 访问控制

```yaml
# API密钥策略
apiKeyPolicy:
  required: true
  headerName: 'X-API-Key'
  queryParam: 'api_key'
  rateLimit:
    windowMs: 900000  # 15分钟
    max: 100         # 最大请求数

# JWT认证
jwtPolicy:
  secret: ${JWT_SECRET}
  issuer: 'sira-gateway'
  audience: 'ai-services'
  algorithms: ['HS256', 'RS256']
```

### 数据加密

```javascript
// API密钥加密存储
const encryptedKey = crypto.createCipher('aes-256-cbc', process.env.EG_CRYPTO_CIPHER_KEY)
  .update(apiKey, 'utf8', 'hex')
  .final('hex')

// 敏感数据脱敏
const maskSensitiveData = (data) => {
  return {
    ...data,
    apiKey: data.apiKey.replace(/./g, '*').slice(-4),
    token: data.token.substring(0, 8) + '...'
  }
}
```

### 安全审计

```bash
# 审计日志分析
grep "SECURITY" logs/audit.log | jq '.event' | sort | uniq -c

# 异常访问检测
grep "UNAUTHORIZED\|FORBIDDEN" logs/access.log | awk '{print $1}' | sort | uniq -c | sort -nr

# 暴力破解防护
iptables -A INPUT -p tcp --dport 8080 -m recent --name bad_guys --rcheck --seconds 60 --hitcount 5 -j DROP
```

---

## 📚 最佳实践

### 部署策略

#### 蓝绿部署

```bash
# 创建新版本
kubectl create deployment sira-gateway-v2 --image=sira/ai-gateway:v2.0.0

# 切换流量
kubectl patch service sira-gateway -p '{"spec":{"selector":{"version":"v2.0.0"}}}'

# 验证新版本
curl http://gateway.example.com/health

# 删除旧版本
kubectl delete deployment sira-gateway-v1
```

#### 金丝雀部署

```yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: sira-gateway
spec:
  http:
  - route:
    - destination:
        host: sira-gateway
        subset: v1
      weight: 90
    - destination:
        host: sira-gateway
        subset: v2
      weight: 10
```

### 监控策略

#### 主动监控

```javascript
// 健康检查端点
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date(),
    checks: {
      database: checkDatabase(),
      redis: checkRedis(),
      aiProviders: checkAIProviders()
    }
  }

  const unhealthy = Object.values(health.checks).some(check => !check.healthy)
  res.status(unhealthy ? 503 : 200).json(health)
})
```

#### 性能监控

```javascript
// 响应时间监控中间件
app.use((req, res, next) => {
  const start = Date.now()
  res.on('finish', () => {
    const duration = Date.now() - start
    metrics.histogram('http_request_duration', duration, {
      method: req.method,
      route: req.route?.path,
      status: res.statusCode
    })
  })
  next()
})
```

### 备份策略

#### 3-2-1备份规则

```bash
# 本地备份 (3份)
tar -czf /backup/daily/sira_$(date +%Y%m%d).tar.gz /app/data/
cp /backup/daily/sira_$(date +%Y%m%d).tar.gz /backup/weekly/
cp /backup/daily/sira_$(date +%Y%m%d).tar.gz /backup/monthly/

# 异地备份 (2份)
aws s3 cp /backup/daily/ s3://sira-backup/daily/ --recursive
az storage blob upload-batch --destination backup --source /backup/daily/

# 云备份 (1份)
gcloud storage cp /backup/daily/* gs://sira-backup/daily/
```

---

## 🆘 紧急处理

### 紧急响应流程

```mermaid
graph TD
    A[告警触发] --> B{严重程度?}
    B -->|🔴 严重| C[立即响应]
    B -->|🟡 警告| D[评估影响]
    C --> E[通知团队]
    D --> F{业务影响?}
    F -->|大| E
    F -->|小| G[监控观察]
    E --> H[启动应急预案]
    H --> I[隔离故障]
    I --> J[恢复服务]
    J --> K[事后分析]
    K --> L[改进措施]
```

### 应急预案

#### 1. 服务完全不可用

```bash
# 立即切换到备用集群
kubectl config use-context backup-cluster
kubectl scale deployment sira-gateway-backup --replicas=10

# 更新DNS
# 通知业务方
# 启动状态页面
```

#### 2. 数据丢失

```bash
# 停止服务防止数据污染
systemctl stop sira-gateway

# 从备份恢复数据
pg_restore -d sira_db backup_file.sql

# 验证数据完整性
psql -d sira_db -c "SELECT COUNT(*) FROM ai_requests;"

# 重新启动服务
systemctl start sira-gateway
```

#### 3. 安全事件

```bash
# 隔离受影响系统
iptables -A INPUT -s malicious_ip -j DROP

# 轮换所有凭据
./scripts/rotate-all-keys.sh

# 启用增强监控
./scripts/enable-security-mode.sh

# 通知安全团队和用户
```

---

## 📞 技术支持

### 联系方式

- **📧 邮箱**: support@sira-ai.com
- **💬 Slack**: #sira-support
- **📱 电话**: +86-400-123-4567 (7×24小时)
- **🐛 GitHub Issues**: [提交问题](https://github.com/your-org/sira-ai-gateway/issues)

### 支持级别

| 级别 | 响应时间 | 支持内容 |
|-----|---------|----------|
| 🆘 紧急 | 15分钟 | 生产环境宕机、数据丢失 |
| 🔴 严重 | 2小时 | 主要功能不可用、性能严重下降 |
| 🟡 一般 | 8小时 | 功能异常、配置问题 |
| 🟢 轻微 | 24小时 | 文档问题、功能建议 |

### 知识库

- 📚 [官方文档](https://docs.sira-ai.com)
- 🎥 [视频教程](https://learn.sira-ai.com)
- 💡 [最佳实践](https://best-practices.sira-ai.com)
- 🔧 [故障排除](https://troubleshooting.sira-ai.com)

---

<div align="center">

## 🙏 贡献与反馈

我们欢迎社区贡献！请查看我们的[贡献指南](CONTRIBUTING.md)了解如何参与项目开发。

**⭐ 如果这个指南对你有帮助，请给我们一个star！**

---

*最后更新: 2024年11月8日*

*版本: v2.0.0*

</div>
