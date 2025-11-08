# Sira AI网关 - AI供应商配置完整指南

> **📚 本文档版本**: v1.0.0
> **📅 更新日期**: 2025-11-07
> **👨‍💻 维护者**: Sira Team

## 📖 目录

- [🎯 概述](#-概述)
- [🚀 快速开始](#-快速开始)
- [🎛️ 交互式配置向导](#️-交互式配置向导)
- [📋 支持的AI供应商](#-支持的ai供应商)
- [🔑 API密钥配置](#-api密钥配置)
- [🤖 模型选择策略](#-模型选择策略)
- [🔗 连接测试](#-连接测试)
- [🛡️ 错误处理机制](#️-错误处理机制)
- [📊 监控和报告](#-监控和报告)
- [💰 价格和成本优化](#-价格和成本优化)
- [🔧 高级配置](#-高级配置)
- [🚨 故障排除](#-故障排除)
- [📚 API参考](#-api参考)
- [🎯 最佳实践](#-最佳实践)

## 🎯 概述

### 什么是Sira AI网关？

Sira AI网关是一个**企业级AI API网关解决方案**，支持**20+主流AI供应商**的统一管理和智能路由。通过简单的配置，您可以：

- ✅ **一站式集成**所有主流AI供应商
- ✅ **智能成本优化**，节省30-60%费用
- ✅ **自动故障转移**，保障99.9%可用性
- ✅ **企业级安全**，完整的审计和监控
- ✅ **5分钟配置完成**，开箱即用

### 核心特性

| 特性 | 说明 | 优势 |
|------|------|------|
| 🎯 **智能配置向导** | 交互式引导配置 | 无需技术背景，5分钟完成 |
| 🔄 **自动重试机制** | 指数退避 + 随机抖动 | 处理网络超时、API限流等 |
| 🛡️ **企业级稳定性** | 熔断保护、故障转移 | 99.9%可用性保障 |
| 💰 **成本透明化** | 集成官方价格文档 | 实时掌握价格变动 |
| 📊 **完整监控** | 连接测试、性能报告 | 问题快速定位 |

## 🚀 快速开始

### 方法1: 交互式配置 (推荐)

```bash
# 克隆项目
git clone https://github.com/zycxfyh/sira.git
cd ai-gateway

# 运行智能配置向导
./scripts/setup-ai-provider.sh
```

按照屏幕提示完成配置，整个过程只需**5分钟**！

### 方法2: 手动配置

```bash
# 配置环境变量
cp env.template .env
# 编辑.env文件

# 启动服务
npm run start:dev

# 测试连接
./scripts/test-provider-connection.sh --all
```

### 方法3: Docker部署

```bash
# 生产环境部署
cd docker/production
docker-compose -f docker-compose-full.yml up -d

# 查看服务状态
docker-compose ps
```

## 🎛️ 交互式配置向导

### 配置流程详解

Sira的配置向导采用**6步完成**的设计理念：

#### 步骤1: 供应商选择 🎯

```
================================================
                    🎯 Sira AI网关 - AI供应商配置向导
================================================

🇺🇸 国际供应商:
  1. OpenAI         - GPT-4, GPT-3.5, DALL-E, Whisper
  2. Anthropic      - Claude-3系列
  3. Azure OpenAI   - Microsoft Azure托管的OpenAI
  4. Google Gemini  - Gemini-1.5系列
  5. Cohere         - Command系列
  6. AI21 Labs      - Jurassic-2
  7. Stability AI   - Stable Diffusion图像生成
  8. Midjourney     - 艺术级图像创作
  9. Replicate      - 开源模型集合

🇨🇳 国内供应商:
 10. DeepSeek       - DeepSeek Chat/Coder (¥0.001/1K)
 11. 通义千问       - 阿里通义千问系列
 12. 文心一言       - 百度文心一言
 13. 智谱GLM        - 智谱GLM-4系列
 14. Kimi           - 月之暗面Kimi (¥0.005/1K)
 15. 豆包           - 字节跳动豆包
 16. 腾讯混元       - 腾讯混元系列
 17. 百度千帆       - 百度千帆平台

请选择AI供应商 (输入编号或名称):
```

**选择建议**:
- **新手推荐**: DeepSeek (性价比高，配置简单)
- **企业用户**: Azure OpenAI (企业级SLA)
- **开发者**: OpenAI (功能最全，文档完善)

#### 步骤2: API密钥输入 🔑

```bash
✅ 已选择: DeepSeek

请输入 DeepSeek API Key:
```

**安全特性**:
- ✅ **隐藏输入**: 密码不会在屏幕上显示
- ✅ **格式验证**: 自动检查API Key格式
- ✅ **安全存储**: 加密存储在配置文件中

**获取API Key的方法**:

| 供应商 | 获取地址 | 注意事项 |
|--------|----------|----------|
| DeepSeek | https://platform.deepseek.com/ | 注册后免费获得 |
| OpenAI | https://platform.openai.com/ | 需要绑定信用卡 |
| 通义千问 | https://bailian.console.aliyun.com/ | 阿里云账号 |
| 文心一言 | https://cloud.baidu.com/product/wenxinworkshop | 百度智能云 |

#### 步骤3: 模型列表拉取 📥

```bash
✅ API Key 格式验证通过

📥 正在拉取 DeepSeek 的可用模型列表...
✅ 成功拉取模型列表
```

**支持的拉取方式**:
- **API调用**: 实时从供应商API获取最新模型
- **本地缓存**: 已知模型列表的快速加载
- **手动配置**: 网络问题时的备选方案

#### 步骤4: 模型选择 🤖

```bash
🤖 选择 DeepSeek 的模型

可用的模型:
  1. deepseek-chat
  2. deepseek-coder

请选择模型编号 (1-2):
```

**模型选择建议**:

| 使用场景 | 推荐模型 | 理由 |
|----------|----------|------|
| 通用对话 | GPT-4 / Claude-3 | 推理能力强，回答质量高 |
| 代码生成 | DeepSeek-Coder / GPT-4 | 专门训练的编程模型 |
| 创意写作 | Claude-3 / GLM-4 | 擅长创造性任务 |
| 简单问答 | GPT-3.5 / DeepSeek-Chat | 性价比高，响应快 |

#### 步骤5: 连接测试 🔗

```bash
✅ 已选择模型: deepseek-chat

🔗 正在测试 DeepSeek 连接...
✅ DeepSeek 连接测试成功 (响应时间: 450ms)
```

**测试内容**:
- ✅ **网络连通性**: 检查API端点可访问
- ✅ **认证有效性**: 验证API Key正确性
- ✅ **模型可用性**: 确认选择的模型存在
- ✅ **响应时间**: 测量网络延迟

#### 步骤6: 配置生成 📝

```bash
📝 生成 DeepSeek 配置文件...
✅ 配置文件已生成: ai-gateway/config/provider-deepseek.yml

🎉 配置完成摘要

📋 配置详情:
  供应商: DeepSeek
  模型: deepseek-chat
  配置状态: ✅ 已配置并测试成功

📁 配置文件: ai-gateway/config/provider-deepseek.yml
```

### 生成的配置文件示例

```yaml
# DeepSeek 配置 - 由setup-ai-provider.sh生成
# 生成时间: 2025-11-07T21:30:00Z

provider:
  id: "deepseek"
  name: "DeepSeek"
  base_url: "https://api.deepseek.com/v1"
  auth_type: "Bearer"
  api_key: "sk-your-encrypted-api-key"
  selected_model: "deepseek-chat"
  status: "configured"
  last_tested: "2025-11-07T21:30:00Z"
  test_result: "success"

models:
  available:
    - deepseek-chat
    - deepseek-coder

routing:
  enabled: true
  priority: 10
  regions: ["auto"]
```

## 📋 支持的AI供应商

### 详细供应商信息

#### 🇺🇸 国际供应商

| 供应商 | Base URL | 支持模型 | 认证方式 | 价格区间 | 特色功能 |
|--------|----------|----------|----------|----------|----------|
| **OpenAI** | `https://api.openai.com/v1` | GPT-4, GPT-3.5, DALL-E, Whisper | Bearer Token | $0.002-0.06/1K tokens | 业界标准，功能最全 |
| **Anthropic** | `https://api.anthropic.com` | Claude-3系列 | Bearer Token | $0.015-0.032/1K tokens | 安全优化，推理强 |
| **Azure OpenAI** | `https://{resource}.openai.azure.com` | GPT-4, GPT-3.5 | API Key | $0.03-0.06/1K tokens | 企业级SLA |
| **Google Gemini** | `https://generativelanguage.googleapis.com/v1beta` | Gemini-1.5 | Bearer Token | $0.001-0.01/1K tokens | 多模态，超长上下文 |
| **Cohere** | `https://api.cohere.ai/v1` | Command系列 | Bearer Token | $0.01-0.02/1K tokens | 企业级文本处理 |
| **AI21 Labs** | `https://api.ai21.com/studio/v1` | Jurassic-2 | Bearer Token | $0.01-0.02/1K tokens | 学术级语言模型 |
| **Stability AI** | `https://api.stability.ai/v1` | Stable Diffusion | Bearer Token | $0.02-0.08/张 | 专业图像生成 |
| **Midjourney** | `https://api.midjourney.com/v1` | Midjourney | Bearer Token | $0.03-0.08/张 | 艺术级图像创作 |
| **Replicate** | `https://api.replicate.com/v1` | 开源模型集合 | Bearer Token | $0.0005-0.05/秒 | 开发者友好 |

#### 🇨🇳 国内供应商

| 供应商 | Base URL | 支持模型 | 认证方式 | 价格区间 | 特色功能 |
|--------|----------|----------|----------|----------|----------|
| **DeepSeek** | `https://api.deepseek.com/v1` | DeepSeek Chat/Coder | Bearer Token | ¥0.001-0.002/1K tokens | 高性价比，代码生成 |
| **通义千问** | `https://dashscope.aliyuncs.com/api/v1` | Qwen系列 | Bearer Token | ¥0.002-0.008/1K tokens | 多模态，阿里云生态 |
| **文心一言** | `https://aip.baidubce.com/rpc/2.0/ai_custom/v1` | ERNIE-4.0 | Bearer Token | ¥0.008-0.03/1K tokens | 知识增强，百度生态 |
| **智谱GLM** | `https://open.bigmodel.cn/api/paas/v4` | GLM-4系列 | Bearer Token | ¥0.005-0.01/1K tokens | 推理增强，学术级 |
| **Kimi** | `https://api.moonshot.cn/v1` | Moonshot-v1 | Bearer Token | ¥0.005-0.015/1K tokens | 网页搜索，长文档处理 |
| **豆包** | `https://ark.cn-beijing.volces.com/api/v3` | Doubao系列 | Bearer Token | ¥0.003-0.01/1K tokens | 多模态，字节生态 |
| **腾讯混元** | `https://api.hunyuan.cloud.tencent.com/v1` | Hunyuan系列 | Bearer Token | ¥0.008-0.015/1K tokens | 游戏AI，腾讯生态 |
| **百度千帆** | `https://qianfan.baidubce.com/v2` | ERNIE系列 | Bearer Token | ¥0.008-0.03/1K tokens | 企业服务，百度生态 |

## 🔑 API密钥配置

### 密钥格式要求

| 供应商 | 格式示例 | 验证规则 | 获取方式 |
|--------|----------|----------|----------|
| OpenAI | `sk-...AAAA` | 以`sk-`开头，51字符 | platform.openai.com |
| Anthropic | `sk-ant-...AAAA` | 以`sk-ant-`开头 | console.anthropic.com |
| DeepSeek | `sk-...AAAA` | 以`sk-`开头 | platform.deepseek.com |
| 通义千问 | `sk-...AAAA` | 以`sk-`开头 | bailian.console.aliyun.com |
| 文心一言 | `24.************AAAA` | 32字符十六进制 | cloud.baidu.com |
| 智谱GLM | `AAAA...AAAA` | 32字符字符串 | open.bigmodel.cn |

### 安全最佳实践

```bash
# 1. 使用环境变量 (推荐)
export DEEPSEEK_API_KEY="sk-your-key-here"
export OPENAI_API_KEY="sk-your-key-here"

# 2. 配置文件权限
chmod 600 ai-gateway/config/provider-*.yml

# 3. 定期轮换密钥
# 设置提醒定期更换API密钥

# 4. 密钥隔离
# 不同环境使用不同的API密钥
```

### 密钥管理

```yaml
# 企业级密钥管理配置
credentials:
  - id: "prod-openai"
    environment: "production"
    provider: "openai"
    key_rotation: "30d"  # 30天轮换
    backup_keys:
      - "sk-backup-key-1"
      - "sk-backup-key-2"

  - id: "dev-deepseek"
    environment: "development"
    provider: "deepseek"
    usage_limit: "1000"  # 每日限制
```

## 🤖 模型选择策略

### 模型性能对比

| 任务类型 | 推荐模型 | 理由 | 备选方案 |
|----------|----------|------|----------|
| **代码生成** | DeepSeek-Coder | 专门训练，准确率高 | GPT-4, Claude-3 |
| **创意写作** | Claude-3-Opus | 创造力强，风格多样 | GLM-4, Qwen-Max |
| **数据分析** | GPT-4 | 逻辑推理强 | Claude-3-Sonnet |
| **简单对话** | DeepSeek-Chat | 性价比高，响应快 | GPT-3.5, Kimi |
| **学术研究** | Claude-3-Opus | 严谨准确 | GPT-4, GLM-4 |
| **多语言翻译** | Qwen-Max | 多语言支持好 | GPT-4, Gemini |

### 模型选择算法

```javascript
// 智能模型选择算法
function selectModel(requirements) {
    const { task, budget, speed, quality } = requirements;

    // 任务类型映射
    const taskModels = {
        coding: ['deepseek-coder', 'gpt-4', 'claude-3'],
        creative: ['claude-3-opus', 'glm-4', 'qwen-max'],
        analysis: ['gpt-4', 'claude-3-sonnet', 'ernie-4'],
        chat: ['deepseek-chat', 'kimi', 'gpt-3.5-turbo']
    };

    // 成本效益分析
    const costEffective = taskModels[task]
        .filter(model => getCost(model) <= budget)
        .sort((a, b) => getCost(a) - getCost(b));

    // 性能评分
    return costEffective
        .map(model => ({
            model,
            score: calculateScore(model, { speed, quality })
        }))
        .sort((a, b) => b.score - a.score)[0].model;
}
```

## 🔗 连接测试

### 测试脚本使用

```bash
# 测试所有已配置供应商
./scripts/test-provider-connection.sh --all

# 测试特定供应商
./scripts/test-provider-connection.sh -p openai deepseek

# 生成详细报告
./scripts/test-provider-connection.sh --report
```

### 测试结果示例

```
================================================
🔗 Sira AI网关 - 供应商连接测试
================================================

[INFO] 2025-11-07 21:30:00 - 开始测试 3 个供应商...

[INFO] 2025-11-07 21:30:01 - 测试 DeepSeek
[SUCCESS] 2025-11-07 21:30:01 - DeepSeek 连接成功 (响应时间: 450ms)

[INFO] 2025-11-07 21:30:02 - 测试 OpenAI
[SUCCESS] 2025-11-07 21:30:02 - OpenAI 连接成功 (响应时间: 320ms)

[INFO] 2025-11-07 21:30:03 - 测试 通义千问
[ERROR] 2025-11-07 21:30:03 - 通义千问 连接失败: Invalid API key

================================================
📊 测试结果
================================================
总计供应商: 3
测试成功: 2
测试失败: 1
成功率: 66%
```

### 性能基准

| 供应商 | 平均响应时间 | 成功率 | 稳定性评分 |
|--------|--------------|--------|------------|
| DeepSeek | 450ms | 99.5% | ⭐⭐⭐⭐⭐ |
| OpenAI | 320ms | 99.8% | ⭐⭐⭐⭐⭐ |
| 通义千问 | 380ms | 99.2% | ⭐⭐⭐⭐⭐ |
| 文心一言 | 520ms | 98.8% | ⭐⭐⭐⭐ |
| 智谱GLM | 410ms | 99.3% | ⭐⭐⭐⭐⭐ |

## 🛡️ 错误处理机制

### 错误分类

| 错误类型 | 示例 | 处理策略 | 重试策略 |
|----------|------|----------|----------|
| **网络错误** | Connection timeout | 指数退避重试 | 3次，间隔1-8秒 |
| **认证错误** | Invalid API key | 立即失败，不重试 | 不重试，提示检查密钥 |
| **限流错误** | Rate limit exceeded | 等待后重试 | 指数退避，最大60秒 |
| **配额错误** | Quota exceeded | 降级到备选供应商 | 不重试，自动切换 |
| **模型错误** | Model not found | 尝试备选模型 | 1次，立即重试 |

### 重试算法

```javascript
class RetryHandler {
    constructor(options = {}) {
        this.maxRetries = options.maxRetries || 3;
        this.baseDelay = options.baseDelay || 1000;
        this.maxDelay = options.maxDelay || 30000;
        this.jitter = options.jitter !== false;
    }

    async execute(operation) {
        let attempt = 1;

        while (attempt <= this.maxRetries + 1) {
            try {
                return await operation();
            } catch (error) {
                if (attempt > this.maxRetries || !this.isRetryable(error)) {
                    throw error;
                }

                const delay = this.calculateDelay(attempt);
                await this.sleep(delay);
                attempt++;
            }
        }
    }

    calculateDelay(attempt) {
        let delay = this.baseDelay * Math.pow(2, attempt - 1);

        // 添加随机抖动
        if (this.jitter) {
            delay += Math.random() * 1000;
        }

        return Math.min(delay, this.maxDelay);
    }

    isRetryable(error) {
        const retryableCodes = [
            'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED',
            'rate_limit_exceeded', 'temporary_server_error'
        ];

        return retryableCodes.includes(error.code) ||
|--------|--------|--------|
               error.message.includes('timeout') ||
               error.status >= 500;
    }
}
```

### 故障转移

```yaml
# 自动故障转移配置
failover:
  enabled: true
  strategy: "priority"  # priority, load_balance, cost_optimize

  providers:
    primary:
      - provider: "openai"
        priority: 1
        timeout: 5000
      - provider: "anthropic"
        priority: 2
        timeout: 5000

    fallback:
      - provider: "deepseek"
        priority: 10
        timeout: 10000
      - provider: "kimi"
        priority: 11
        timeout: 10000

  health_check:
    interval: 30000  # 30秒检查一次
    timeout: 5000    # 5秒超时
    failure_threshold: 3  # 失败3次标记为不可用
    recovery_timeout: 60000  # 1分钟后重试
```

## 📊 监控和报告

### 监控指标

```javascript
// 监控指标收集
const metrics = {
    requestCount: 0,
    errorCount: 0,
    responseTime: [],
    providerUsage: new Map(),

    recordRequest(provider, responseTime, success) {
        this.requestCount++;
        this.responseTime.push(responseTime);

        if (!success) this.errorCount++;

        this.providerUsage.set(
            provider,
            (this.providerUsage.get(provider) || 0) + 1
        );
    },

    getStats() {
        const avgResponseTime = this.responseTime.reduce((a, b) => a + b, 0) / this.responseTime.length;

        return {
            totalRequests: this.requestCount,
            errorRate: (this.errorCount / this.requestCount * 100).toFixed(2) + '%',
            avgResponseTime: Math.round(avgResponseTime) + 'ms',
            providerUsage: Object.fromEntries(this.providerUsage)
        };
    }
};
```

### 报告生成

```bash
# 生成监控报告
./scripts/test-provider-connection.sh --report

# 报告示例
# Sira AI网关 - 供应商连接测试报告
#
# 生成时间: 2025-11-07 22:00:00
# 测试状态: ✅ 完成
#
# 测试结果汇总
# | 供应商 | 状态 | 响应时间 | 最后测试时间 |
|--------|--------|--------|--------|--------|--------|
# |--------|------|----------|--------------|
|--------|--------|--------|--------|--------|--------|
# | DeepSeek | ✅ 成功 | 450ms | 2025-11-07T22:00:00Z |
# | OpenAI | ✅ 成功 | 320ms | 2025-11-07T21:59:45Z |
```

### 告警配置

```yaml
# Prometheus告警规则
alerting:
  rules:
    - alert: HighErrorRate
      expr: rate(ai_requests_total{status="error"}[5m]) > 0.1
      labels:
        severity: critical
      annotations:
        summary: "AI请求错误率过高 (>10%)"

    - alert: ProviderDown
      expr: up{job="ai-provider"} == 0
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "AI供应商 {{ $labels.provider }} 不可用"

    - alert: SlowResponse
      expr: histogram_quantile(0.95, rate(ai_request_duration_bucket[5m])) > 10
      labels:
        severity: warning
      annotations:
        summary: "AI响应时间过慢 (P95 > 10s)"
```

## 💰 价格和成本优化

### 成本监控

```javascript
class CostMonitor {
    constructor() {
        this.pricing = {
            openai: {
                'gpt-4': 0.03,
                'gpt-3.5-turbo': 0.002
            },
            deepseek: {
                'deepseek-chat': 0.001,
                'deepseek-coder': 0.002
            }
        };
        this.usage = new Map();
    }

    trackUsage(provider, model, tokens) {
        const cost = this.pricing[provider]?.[model] || 0;
        const totalCost = cost * (tokens / 1000);

        const key = `${provider}:${model}`;
        this.usage.set(key, (this.usage.get(key) || 0) + totalCost);

        return totalCost;
    }

    getCostReport() {
        const report = {};
        for (const [key, cost] of this.usage) {
            const [provider, model] = key.split(':');
            if (!report[provider]) report[provider] = {};
            report[provider][model] = cost;
        }
        return report;
    }

    getOptimalProvider(task, budget) {
        // 基于任务类型和预算推荐最优供应商
        const recommendations = {
            coding: [
                { provider: 'deepseek', model: 'deepseek-coder', cost: 0.002 },
                { provider: 'openai', model: 'gpt-4', cost: 0.03 }
            ],
            chat: [
                { provider: 'deepseek', model: 'deepseek-chat', cost: 0.001 },
                { provider: 'openai', model: 'gpt-3.5-turbo', cost: 0.002 }
            ]
        };

        return recommendations[task]
            ?.filter(item => item.cost <= budget)
            ?.sort((a, b) => a.cost - b.cost)[0];
    }
}
```

### 成本优化策略

1. **智能路由**:
   ```yaml
   routing_strategy: cost_optimized
   provider_priority:
     - deepseek      # ¥0.001/1K - 最便宜
     - kimi          # ¥0.005/1K
     - doubao        # ¥0.003/1K
     - glm           # ¥0.005/1K
     - qwen          # ¥0.002/1K
   ```

2. **缓存策略**:
   ```yaml
   cache:
     enabled: true
     ttl: 3600
     hit_rate_target: 0.8
   ```

3. **批量处理**:
   ```javascript
   // 合并小请求为批量处理
   const batchProcessor = new BatchProcessor({
     maxBatchSize: 10,
     maxWaitTime: 1000
   });
   ```

## 🔧 高级配置

### 多环境配置

```yaml
# 环境配置模板
environments:
  development:
    providers:
      - deepseek
      - kimi
    rate_limits:
      requests_per_minute: 60
    cache_enabled: false

  staging:
    providers:
      - openai
      - anthropic
      - deepseek
    rate_limits:
      requests_per_minute: 1000
    cache_enabled: true

  production:
    providers:
      - azure_openai
      - anthropic
      - qwen
      - ernie
    rate_limits:
      requests_per_minute: 10000
    cache_enabled: true
    monitoring_enabled: true
```

### 自定义路由规则

```yaml
# 高级路由配置
routing:
  rules:
    # 按用户等级路由
    - condition: "user.tier == 'premium'"
      providers: ["openai", "anthropic"]
      priority: 1

    # 按地域路由
    - condition: "request.region == 'china'"
      providers: ["qwen", "ernie", "glm"]
      priority: 2

    # 按任务类型路由
    - condition: "request.task == 'coding'"
      providers: ["deepseek-coder", "gpt-4"]
      priority: 3

    # 默认路由
    - condition: "true"
      providers: ["deepseek", "kimi", "doubao"]
      priority: 10

  load_balancing:
    strategy: "weighted_round_robin"
    weights:
      openai: 20
      deepseek: 50
      kimi: 30
```

### 企业级安全配置

```yaml
# 企业安全配置
security:
  encryption:
    api_keys: true
    logs: true
    algorithm: "AES-256-GCM"

  audit:
    enabled: true
    log_level: "detailed"
    retention_days: 365

  compliance:
    gdpr: true
    ccpa: true
    data_residency: "china"  # 或 "eu", "us"

  rate_limiting:
    global:
      requests_per_minute: 10000
      burst_limit: 1000
    per_user:
      requests_per_minute: 100
    per_ip:
      requests_per_minute: 50
```

## 🚨 故障排除

### 常见问题

#### 1. 配置脚本无法运行

**问题**: `bash: ./scripts/setup-ai-provider.sh: Permission denied`

**解决**:
```bash
# 添加执行权限
chmod +x scripts/setup-ai-provider.sh
chmod +x scripts/test-provider-connection.sh
```

#### 2. API密钥验证失败

**问题**: `API Key 格式可能不正确`

**检查步骤**:
1. 确认API Key是否正确复制
2. 检查是否有空格或特殊字符
3. 验证API Key是否已过期
4. 确认账户是否有余额

#### 3. 连接测试失败

**问题**: `连接测试失败: Connection timeout`

**排查步骤**:
1. 检查网络连接: `ping api.deepseek.com`
2. 确认防火墙设置
3. 验证API Key有效性
4. 检查供应商服务状态

#### 4. 模型拉取失败

**问题**: `无法拉取模型列表`

**解决方法**:
1. 检查网络连接
2. 确认API Key权限
3. 使用预设模型列表
4. 联系供应商支持

### 错误代码对照表

| 错误代码 | 含义 | 处理建议 |
|----------|------|----------|
| `ECONNREFUSED` | 连接被拒绝 | 检查网络和防火墙 |
| `ETIMEDOUT` | 连接超时 | 增加超时时间，重试 |
| `ENOTFOUND` | 域名解析失败 | 检查DNS配置 |
| `401` | 未授权 | 验证API Key |
| `429` | 请求过于频繁 | 降低请求频率 |
| `500` | 服务器内部错误 | 稍后重试 |
| `502/503` | 服务不可用 | 切换备用供应商 |

### 日志分析

```bash
# 查看详细日志
tail -f ai-gateway/logs/app.log

# 过滤错误日志
grep "ERROR" ai-gateway/logs/app.log

# 分析连接问题
grep "connection" ai-gateway/logs/app.log | tail -20
```

## 📚 API参考

### 配置脚本API

```bash
# 配置向导
./scripts/setup-ai-provider.sh

# 选项:
#   -h, --help      显示帮助信息
```

### 测试脚本API

```bash
# 连接测试
./scripts/test-provider-connection.sh [选项] [供应商...]

# 选项:
#   -a, --all          测试所有供应商
#   -r, --report       生成测试报告
#   -p, --provider     指定供应商
#   -h, --help         显示帮助信息
```

### 配置文件格式

```yaml
# 供应商配置文件格式
provider:
  id: "provider-id"           # 供应商唯一标识
  name: "Provider Name"       # 显示名称
  base_url: "https://..."     # API基础URL
  auth_type: "Bearer"         # 认证类型
  api_key: "encrypted-key"    # 加密的API密钥
  selected_model: "model-id"  # 选择的模型
  status: "configured"        # 配置状态
  last_tested: "timestamp"    # 最后测试时间
  test_result: "success"      # 测试结果

models:
  available:                   # 可用模型列表
    - model-1
    - model-2

routing:
  enabled: true               # 是否启用路由
  priority: 10               # 路由优先级
  regions: ["auto"]          # 支持地域
```

## 🎯 最佳实践

### 1. 配置管理

```bash
# 使用版本控制管理配置
git add ai-gateway/config/
git commit -m "feat: 配置 DeepSeek 和 OpenAI 供应商"

# 备份配置
cp -r ai-gateway/config/ backup/config-$(date +%Y%m%d)

# 环境分离
# development: dev-*.yml
# staging: stg-*.yml
# production: prod-*.yml
```

### 2. 安全实践

```bash
# API密钥管理
export AI_API_KEYS_ENCRYPTION_KEY="your-encryption-key"

# 文件权限
chmod 600 ai-gateway/config/provider-*.yml

# 审计日志
./scripts/monitor-system.sh --audit
```

### 3. 性能优化

```yaml
# 性能优化配置
optimization:
  cache:
    enabled: true
    ttl: 3600
    compression: true

  connection_pool:
    max_connections: 100
    idle_timeout: 30000

  batch_processing:
    enabled: true
    max_batch_size: 10
    timeout: 5000
```

### 4. 监控告警

```yaml
# 监控配置
monitoring:
  metrics:
    enabled: true
    interval: 30000

  alerts:
    high_error_rate:
      threshold: 0.1
      channels: ["email", "slack"]

    provider_down:
      timeout: 300000  # 5分钟
      auto_failover: true
```

### 5. 成本控制

```javascript
// 成本控制策略
const costControl = {
    dailyBudget: 100,    // 每日预算
    monthlyBudget: 3000, // 月度预算

    trackUsage(provider, cost) {
        // 实时成本跟踪
    },

    enforceLimits() {
        // 预算超限自动停止
    }
};
```

---

## 📞 技术支持

### 联系方式

- **📧 邮箱**: 1666384464@qq.com
- **💬 Discord**: https://discord.gg/sira-ai
- **📖 文档**: https://docs.sira.ai
- **🐛 问题反馈**: https://github.com/zycxfyh/sira/issues

### 常见问题解答

**Q: 如何添加新的AI供应商？**
A: 在 `ai-gateway/config/ai-providers.yml` 中添加供应商配置，然后运行配置向导。

**Q: 配置多个供应商的优先级怎么设置？**
A: 在路由配置中设置 `priority` 字段，数字越小优先级越高。

**Q: 如何实现自动故障转移？**
A: 启用 `failover.enabled: true` 并配置备用供应商列表。

**Q: 成本监控怎么实现？**
A: 使用内置的成本监控功能，或集成第三方监控服务。

---

*本文档由 Sira AI网关团队维护，最后更新时间: 2025-11-07*
