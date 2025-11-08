# Sira AI网关API集成指南

## 📖 概述

Sira AI网关是一个统一的AI API网关，支持20+主流AI服务商的智能路由、负载均衡、缓存、限流等企业级功能。本指南将详细介绍如何集成和使用各种AI API供应商。

## 🎯 核心特性

### 🚀 智能路由

- **自动选择最优供应商**: 基于成本、性能、可用性智能选择
- **故障自动切换**: 当某个供应商故障时自动切换到备用供应商
- **地理位置优化**: 根据用户位置选择最近的数据中心

### 💾 多级缓存

- **L1内存缓存**: <10ms响应
- **L2 Redis缓存**: 分布式缓存支持
- **智能缓存策略**: 基于内容和参数的缓存键生成

### 🔒 企业级安全

- **API密钥管理**: 支持多租户API密钥
- **请求限流**: 基于Token的精确限流控制
- **审计日志**: 完整的请求响应审计

## 🌐 支持的AI供应商

### 📊 供应商概览

| 供应商            | Base URL                                           | 支持模型            | 定价等级 | 区域   |
| ----------------- | -------------------------------------------------- | ------------------- | -------- | ------ |
| **OpenAI**        | `https://api.openai.com/v1`                        | GPT-4, GPT-3.5      | 高级     | 全球   |
| **Anthropic**     | `https://api.anthropic.com`                        | Claude-3系列        | 高级     | 美西   |
| **Azure OpenAI**  | `https://{resource}.openai.azure.com`              | GPT-4, GPT-3.5      | 企业     | 多区域 |
| **Google Gemini** | `https://generativelanguage.googleapis.com/v1beta` | Gemini-1.5          | 标准     | 多区域 |
| **DeepSeek**      | `https://api.deepseek.com/v1`                      | DeepSeek Chat/Coder | 经济     | 中国   |
| **通义千问**      | `https://dashscope.aliyuncs.com/api/v1`            | Qwen系列            | 标准     | 中国   |
| **文心一言**      | `https://aip.baidubce.com/rpc/2.0/ai_custom/v1`    | ERNIE-4.0           | 标准     | 中国   |
| **智谱GLM**       | `https://open.bigmodel.cn/api/paas/v4`             | GLM-4系列           | 标准     | 中国   |
| **Kimi**          | `https://api.moonshot.cn/v1`                       | Moonshot-v1         | 经济     | 中国   |
| **豆包**          | `https://ark.cn-beijing.volces.com/api/v3`         | Doubao系列          | 标准     | 中国   |
| **腾讯混元**      | `https://api.hunyuan.cloud.tencent.com/v1`         | Hunyuan系列         | 标准     | 中国   |
| **百度千帆**      | `https://qianfan.baidubce.com/v2`                  | ERNIE系列           | 标准     | 中国   |
| **Cohere**        | `https://api.cohere.ai/v1`                         | Command系列         | 标准     | 美东   |
| **AI21 Labs**     | `https://api.ai21.com/studio/v1`                   | Jurassic-2          | 标准     | 美东   |
| **Stability AI**  | `https://api.stability.ai/v1`                      | Stable Diffusion    | 标准     | 美西   |
| **Midjourney**    | `https://api.midjourney.com/v1`                    | Midjourney          | 高级     | 美东   |
| **Replicate**     | `https://api.replicate.com/v1`                     | 开源模型集合        | 标准     | 美西   |

## 🚀 快速开始

### 1. 环境准备

```bash
# 克隆项目
git clone https://github.com/zycxfyh/sira.git
cd ai-gateway

# 安装依赖
npm install

# 配置环境变量
cp env.template .env
# 编辑 .env 文件，添加你的API密钥
```

### 2. 配置API密钥

创建 `.env` 文件：

```bash
# Sira网关配置
NODE_ENV=production
EG_HTTP_PORT=8080
EG_ADMIN_PORT=9876

# OpenAI
OPENAI_API_KEY=sk-your-openai-key

# Anthropic
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key

# Azure OpenAI
AZURE_OPENAI_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/

# 国内供应商
DEEPSEEK_API_KEY=sk-your-deepseek-key
QIANFAN_API_KEY=your-qianfan-key
GLM_API_KEY=your-glm-key

# 其他供应商...
```

### 3. 启动服务

```bash
# 开发环境
npm run start:dev

# 生产环境（推荐使用Docker）
docker-compose -f docker/production/docker-compose-full.yml up -d
```

## 📡 API使用指南

### 🔄 统一API接口

Sira网关提供统一的API接口，无需关心底层供应商切换：

```bash
# 聊天补全 (自动路由到最优供应商)
curl -X POST http://localhost:8080/api/v1/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-gateway-key" \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "你好，请介绍一下自己"}
    ],
    "temperature": 0.7,
    "max_tokens": 1000
  }'
```

### 🎯 指定供应商

如果需要明确指定供应商：

```bash
# 强制使用OpenAI
curl -X POST http://localhost:8080/api/v1/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-gateway-key" \
  -H "x-ai-provider: openai" \
  -d '{"model": "gpt-4", "messages": [{"role": "user", "content": "Hello"}]}'

# 使用国内供应商
curl -X POST http://localhost:8080/api/v1/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-gateway-key" \
  -H "x-ai-provider: deepseek" \
  -d '{"model": "deepseek-chat", "messages": [{"role": "user", "content": "你好"}]}'
```

### 📋 异步请求

对于大型请求，支持异步处理：

```bash
# 异步请求
curl -X POST http://localhost:8080/api/v1/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-gateway-key" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "写一篇2000字的文章"}],
    "async": true,
    "webhook_url": "https://your-app.com/webhook"
  }'

# 查询请求状态
curl http://localhost:8080/api/v1/requests/{request-id}/status \
  -H "x-api-key: your-gateway-key"

# 获取结果
curl http://localhost:8080/api/v1/requests/{request-id}/result \
  -H "x-api-key: your-gateway-key"
```

## 🧠 路由策略

### 🎯 成本优化路由

默认策略：成本优先，自动选择最经济的供应商

```yaml
# 路由优先级 (从便宜到贵)
priority_order:
  - deepseek # 最便宜
  - kimi
  - glm
  - ernie
  - qwen
  - doubao
  - hunyuan
  - qianfan
  - google_gemini
  - cohere
  - ai21
  - anthropic # 最贵
  - openai
  - azure_openai
```

### ⚡ 性能优化路由

```yaml
# 性能优先 (响应速度)
priority_order:
  - openai # 最快
  - azure_openai
  - anthropic
  - google_gemini
  - qwen
  - ernie
  - glm
  - doubao
  - hunyuan
  - qianfan
  - cohere
  - ai21
  - deepseek
  - kimi
```

### 🛡️ 可靠性优化路由

```yaml
# 企业级供应商优先
priority_order:
  - azure_openai # 最可靠
  - openai
  - anthropic
  - google_gemini
  - qwen
  - ernie
  - glm
  - doubao
  - hunyuan
  - qianfan
  - cohere
  - ai21
  - deepseek
  - kimi
```

## 📊 供应商配置详情

### OpenAI集成

```yaml
# config/gateway.config.yml
serviceEndpoints:
  openai:
    url: 'https://api.openai.com/v1'

pipelines:
  ai-pipeline:
    policies:
      - ai-router:
          providers:
            openai:
              api_key: '${OPENAI_API_KEY}'
              models: ['gpt-4', 'gpt-3.5-turbo']
              priority: 10
```

### Azure OpenAI集成

```yaml
serviceEndpoints:
  azure-openai:
    url: 'https://{your-resource}.openai.azure.com/openai/deployments/{deployment}'

pipelines:
  ai-pipeline:
    policies:
      - ai-router:
          providers:
            azure_openai:
              api_key: '${AZURE_OPENAI_API_KEY}'
              endpoint: '${AZURE_OPENAI_ENDPOINT}'
              deployment: 'gpt-4'
              priority: 9
```

### 国内供应商集成

```yaml
serviceEndpoints:
  deepseek:
    url: 'https://api.deepseek.com/v1'
  qwen:
    url: 'https://dashscope.aliyuncs.com/api/v1'
  ernie:
    url: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1'

pipelines:
  ai-pipeline:
    policies:
      - ai-router:
          providers:
            deepseek:
              api_key: '${DEEPSEEK_API_KEY}'
              priority: 1 # 成本优先
            qwen:
              api_key: '${QIANFAN_API_KEY}'
              priority: 3
            ernie:
              api_key: '${ERNIE_API_KEY}'
              priority: 4
```

## 🔧 高级配置

### 缓存配置

```yaml
policies:
  - ai-cache:
      ttl: 300 # 缓存5分钟
      maxSize: 10000 # 最大缓存条目
      compressionEnabled: true
```

### 限流配置

```yaml
policies:
  - ai-rate-limit:
      windowMs: 60000 # 1分钟窗口
      maxTokens: 100000 # 每分钟最多10万个token
      strategy: 'user' # 按用户限流
```

### 熔断配置

```yaml
policies:
  - ai-circuit-breaker:
      failureThreshold: 5 # 失败5次后熔断
      recoveryTimeout: 60000 # 熔断60秒后重试
      monitoring: true
```

### 队列配置

```yaml
policies:
  - ai-queue:
      maxConcurrent: 10 # 最大并发数
      maxQueueSize: 1000 # 队列最大长度
      timeout: 300000 # 超时时间
      priorityLevels: 3 # 优先级数量
```

## 📈 监控和指标

### 实时监控

```bash
# 查看服务状态
curl http://localhost:8080/health

# 查看网关指标
curl http://localhost:8080/metrics

# 查看队列状态
curl http://localhost:8080/api/v1/queue/status
```

### 可观测性面板

- **Grafana**: http://localhost:3001 (可视化监控面板)
- **Prometheus**: http://localhost:9090 (指标收集)
- **Jaeger**: http://localhost:16686 (分布式追踪)

### 告警配置

```yaml
# Prometheus告警规则
alerting:
  rules:
    - alert: HighErrorRate
      expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
      labels:
        severity: warning
      annotations:
        summary: '高错误率警告'

    - alert: CircuitBreakerOpen
      expr: circuit_breaker_state{state="open"} > 0
      labels:
        severity: critical
      annotations:
        summary: '服务熔断器已开启'
```

## 🔒 安全配置

### API密钥管理

```yaml
credentials:
  - id: 'user-key-1'
    consumerId: 'user-1'
    type: 'key-auth'
    key: 'sk-user-key-123'

  - id: 'service-key-1'
    consumerId: 'service-1'
    type: 'key-auth'
    key: 'sk-service-key-456'
```

### 请求过滤

```yaml
policies:
  - request-transformer:
      add:
        headers:
          x-request-id: '$(uuid)'
          x-client-ip: '$(req.ip)'

  - response-transformer:
      add:
        headers:
          x-processed-by: 'sira-gateway'
          x-response-time: '$(res.responseTime)'
```

## 🚀 性能优化

### 缓存策略

```yaml
# 基于内容的缓存
ai-cache:
  keyGenerator: 'content-based'
  varyByHeaders: ['authorization', 'x-api-key']
  compression: true
```

### 负载均衡

```yaml
ai-router:
  loadBalancing:
    enabled: true
    strategy: 'weighted-round-robin'
    weights:
      openai: 30
      anthropic: 25
      azure_openai: 20
      deepseek: 15
      qwen: 10
```

### 连接池优化

```yaml
serviceEndpoints:
  openai:
    url: 'https://api.openai.com/v1'
    timeout: 30000
    retries: 3
    connectionPool:
      maxConnections: 100
      maxIdleTime: 30000
```

## 🐛 故障排除

### 常见问题

#### 1. 供应商切换失败

```bash
# 检查路由配置
curl http://localhost:8080/api/v1/router/status

# 查看错误日志
docker-compose logs ai-gateway | grep ERROR
```

#### 2. 缓存命中率低

```bash
# 检查缓存统计
curl http://localhost:8080/api/v1/cache/stats

# 调整缓存配置
# 增加TTL或调整缓存键生成策略
```

#### 3. 请求队列积压

```bash
# 检查队列状态
curl http://localhost:8080/api/v1/queue/status

# 扩展队列容量或增加并发数
```

### 日志分析

```bash
# 查看详细日志
docker-compose logs -f ai-gateway

# 过滤特定请求
docker-compose logs ai-gateway | grep "request-id-123"
```

## 📚 最佳实践

### 1. 生产环境部署

```bash
# 使用Docker Compose生产配置
docker-compose -f docker/production/docker-compose-full.yml up -d

# 配置反向代理
nginx -t && nginx -s reload

# 设置监控告警
./scripts/monitor-system.sh
```

### 2. 高可用配置

```yaml
# 多实例部署
services:
  ai-gateway-1:
    ports: ["8080:8080"]
  ai-gateway-2:
    ports: ["8081:8080"]
  ai-gateway-3:
    ports: ["8082:8080"]

# 负载均衡器配置
upstream ai_gateway {
    server localhost:8080;
    server localhost:8081;
    server localhost:8082;
}
```

### 3. 备份和恢复

```bash
# 数据备份
./scripts/backup.sh

# 配置恢复
./scripts/restore.sh backup-2025-11-07.tar.gz
```

## 🎯 总结

Sira AI网关为AI应用提供了完整的解决方案：

- ✅ **统一接口**: 支持20+ AI供应商，无缝切换
- ✅ **智能路由**: 成本、性能、可靠性多维度优化
- ✅ **企业级功能**: 缓存、限流、熔断、队列、监控
- ✅ **高可用**: 分布式架构，故障自动恢复
- ✅ **易于集成**: RESTful API，完整的SDK支持

通过Sira，您可以：

1. **降低成本**: 智能路由选择最经济的供应商
2. **提升性能**: 多级缓存和负载均衡
3. **保障稳定性**: 熔断和重试机制
4. **简化运维**: 完整的监控和告警体系
5. **快速扩展**: 支持新供应商的热插拔

开始使用Sira，让AI集成变得简单而强大！🚀
