# Sira API 文档

## 📋 概述

Sira 提供统一的AI服务API接口，支持多种AI服务提供商的智能路由和统一管理。

**Base URL**: `https://your-gateway-domain.com/api/v1/ai`

## 🔐 认证

所有API请求都需要在请求头中包含API密钥：

```
X-API-Key: your_gateway_api_key
```

## 🚀 AI Chat Completions

生成AI对话回复，支持多种AI模型和提供商。

### 请求

```http
POST /api/v1/ai/chat/completions
Content-Type: application/json
X-API-Key: your_gateway_api_key

{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "system",
      "content": "You are a helpful assistant."
    },
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1000,
  "stream": false
}
```

### 参数

| 参数          | 类型    | 必需 | 描述                      |
| ------------- | ------- | ---- | ------------------------- |
| `model`       | string  | 是   | AI模型名称                |
| `messages`    | array   | 是   | 对话消息数组              |
| `temperature` | number  | 否   | 随机性 (0.0-2.0)，默认0.7 |
| `max_tokens`  | number  | 否   | 最大token数，默认1000     |
| `stream`      | boolean | 否   | 是否流式响应，默认false   |
| `async`       | boolean | 否   | 是否异步处理，默认false   |

### 响应

#### 同步响应

```json
{
  "id": "chatcmpl-1234567890",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-3.5-turbo",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm doing well, thank you for asking. How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 13,
    "completion_tokens": 20,
    "total_tokens": 33
  }
}
```

#### 异步响应

```json
{
  "request_id": "req_1234567890",
  "status": "queued",
  "estimated_time": 30,
  "webhook_url": "https://your-app.com/webhook"
}
```

## 📝 AI Embeddings

生成文本的向量表示，用于语义搜索和相似度计算。

### 请求

```http
POST /api/v1/ai/embeddings
Content-Type: application/json
X-API-Key: your_gateway_api_key

{
  "model": "text-embedding-ada-002",
  "input": "The food was delicious and the service was excellent.",
  "encoding_format": "float"
}
```

### 参数

| 参数              | 类型         | 必需 | 描述                  |
| ----------------- | ------------ | ---- | --------------------- |
| `model`           | string       | 是   | Embedding模型名称     |
| `input`           | string/array | 是   | 输入文本或文本数组    |
| `encoding_format` | string       | 否   | 编码格式，默认"float" |

### 响应

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "embedding": [
        0.0023064255,
        -0.009327292,
        ...
      ],
      "index": 0
    }
  ],
  "model": "text-embedding-ada-002",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}
```

## 📋 AI Models

获取当前可用的AI模型列表。

### 请求

```http
GET /api/v1/ai/models
X-API-Key: your_gateway_api_key
```

### 响应

```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-4",
      "object": "model",
      "created": 1687882411,
      "owned_by": "openai",
      "permission": [
        {
          "id": "modelperm-abc123",
          "object": "model_permission",
          "created": 1687882411,
          "allow_create_engine": false,
          "allow_sampling": true,
          "allow_logprobs": true,
          "allow_search_indices": false,
          "allow_view": true,
          "allow_fine_tuning": false,
          "organization": "*",
          "group": null,
          "is_blocking": false
        }
      ],
      "root": "gpt-4",
      "parent": null
    }
  ]
}
```

## 🔍 异步请求状态查询

查询异步AI请求的处理状态。

### 请求

```http
GET /api/v1/ai/requests/{request_id}
X-API-Key: your_gateway_api_key
```

### 响应

```json
{
  "request_id": "req_1234567890",
  "status": "completed",
  "created_at": "2025-11-07T10:30:00Z",
  "completed_at": "2025-11-07T10:30:45Z",
  "result": {
    "id": "chatcmpl-1234567890",
    "object": "chat.completion",
    "created": 1677652288,
    "model": "gpt-4",
    "choices": [
      {
        "index": 0,
        "message": {
          "role": "assistant",
          "content": "这是GPT-4生成的回复内容..."
        },
        "finish_reason": "stop"
      }
    ],
    "usage": {
      "prompt_tokens": 50,
      "completion_tokens": 200,
      "total_tokens": 250
    }
  }
}
```

## 📊 缓存统计

获取缓存系统的统计信息。

### 请求

```http
GET /api/v1/ai/cache/stats
X-API-Key: your_gateway_api_key
```

### 响应

```json
{
  "total_requests": 1250,
  "cache_hits": 890,
  "cache_misses": 360,
  "hit_ratio": 0.712,
  "total_entries": 245,
  "memory_usage": "2.3MB",
  "uptime": "2h 30m 15s"
}
```

## 🏥 健康检查

检查Sira的健康状态。

### 请求

```http
GET /health
```

### 响应

```json
{
  "status": "healthy",
  "timestamp": "2025-11-07T10:30:00Z",
  "version": "2.0.0",
  "services": {
    "ai-router": "healthy",
    "ai-cache": "healthy",
    "ai-providers": {
      "openai": "healthy",
      "anthropic": "healthy",
      "azure": "healthy"
    }
  }
}
```

## 📈 响应头信息

每次API调用都会返回以下响应头：

| 头信息              | 描述             | 示例                           |
| ------------------- | ---------------- | ------------------------------ |
| `x-cache-status`    | 缓存状态         | `HIT` 或 `MISS`                |
| `x-ai-provider`     | 使用的AI提供商   | `openai`, `anthropic`, `azure` |
| `x-ai-model`        | 请求的AI模型     | `gpt-4`, `claude-3-opus`       |
| `x-response-time`   | 响应时间（毫秒） | `1250`                         |
| `x-request-id`      | 唯一请求ID       | `req_1234567890`               |
| `x-gateway-version` | 网关版本         | `2.0.0`                        |

## 🚨 错误处理

### 常见错误码

| 错误码 | 描述           | 解决方案               |
| ------ | -------------- | ---------------------- |
| `400`  | 请求参数错误   | 检查请求格式和参数     |
| `401`  | API密钥无效    | 验证API密钥是否正确    |
| `429`  | 请求频率过高   | 降低请求频率或升级配额 |
| `500`  | 服务器内部错误 | 联系技术支持           |
| `503`  | 服务不可用     | 检查服务状态或稍后重试 |

### 错误响应格式

```json
{
  "error": {
    "message": "Invalid API key provided",
    "type": "authentication_error",
    "code": 401
  },
  "request_id": "req_1234567890"
}
```

## 📝 支持的AI模型

### OpenAI

- `gpt-4` - 最新GPT-4模型
- `gpt-4-turbo` - GPT-4 Turbo版本
- `gpt-3.5-turbo` - GPT-3.5 Turbo模型

### Anthropic

- `claude-3-opus` - Claude 3 Opus（最高性能）
- `claude-3-sonnet` - Claude 3 Sonnet（平衡性能）
- `claude-3-haiku` - Claude 3 Haiku（快速响应）

### Azure OpenAI

- `gpt-4` - Azure GPT-4
- `gpt-3.5-turbo` - Azure GPT-3.5 Turbo

## 🔧 速率限制

默认速率限制：

- **请求数限制**: 100次/15分钟
- **Token限制**: 10,000个Token/15分钟
- **并发限制**: 10个并发请求

## 💡 使用建议

1. **选择合适的模型**: 根据任务复杂度选择合适的AI模型
2. **合理设置参数**: 根据需求调整temperature和max_tokens
3. **利用缓存**: 相似请求会自动使用缓存结果
4. **异步处理**: 大型请求建议使用异步模式
5. **监控使用量**: 定期检查API使用统计

## 📞 技术支持

如遇到技术问题，请提供：

- 请求ID (`x-request-id`)
- 完整的请求和响应信息
- 错误发生的时间和频率

---

_API文档版本: 2.0.0 | 最后更新: 2025年11月7日_
