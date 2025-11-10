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

| 参数 | 类型 | 必需 | 描述 |
| -------------- | --------- | -------------- | ---------------- |
| `model` | string | 是 | AI模型名称 |
| `messages` | array | 是 | 对话消息数组 |
| `temperature` | number | 否 | 温度参数 (0-2) |
| `max_tokens` | number | 否 | 最大token数 |
| `stream` | boolean | 否 | 是否流式输出 |

### 响应

#### 成功响应

```json
{
  "id": "chatcmpl-123456",
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
  },
  "provider": "openai"
}
```

#### 错误响应

```json
{
  "error": {
    "code": "invalid_request",
    "message": "无效的请求参数",
    "details": {}
  }
}
```

## 📚 错误代码

| 错误代码 | 描述 |
| ---------------- | ---------------- |
| `invalid_request` | 请求参数无效 |
| `unauthorized` | API密钥无效 |
| `rate_limited` | 请求频率超限 |
| `service_unavailable` | 服务不可用 |

## 🎯 示例

### 基本对话

```bash
curl -X POST https://your-gateway-domain.com/api/v1/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_gateway_api_key" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "你好，请介绍一下自己"}
    ]
  }'
```

---

*最后更新: ${new Date().toISOString().split('T')[0]}*

*版本: 2.1.0-beta.1*
