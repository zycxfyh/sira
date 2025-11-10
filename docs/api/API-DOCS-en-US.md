# Sira API Documentation

## 📋 Overview

Sira provides a unified AI service API interface with intelligent routing and unified management across multiple AI service providers.

**Base URL**: `https://your-gateway-domain.com/api/v1/ai`

## 🔐 Authentication

All API requests require an API key in the request header:

```
X-API-Key: your_gateway_api_key
```

## 🚀 AI Chat Completions

Generate AI conversation responses with support for multiple AI models and providers.

### Request

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

### Parameters

| Parameter | Type | Required | Description |
| -------------- | --------- | -------------- | ---------------- |
| `model` | string | Yes | AImodel name |
| `messages` | array | Yes | conversation messages array |
| `temperature` | number | No | temperature parameter (0-2) |
| `max_tokens` | number | No | maximum number of tokens |
| `stream` | boolean | No | whether to stream the response |

### Responses

#### Success Response

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

#### Error Response

```json
{
  "error": {
    "code": "invalid_request",
    "message": "Invalid request parameters",
    "details": {}
  }
}
```

## 📚 Error Codes

| Error Code | Description |
| ---------------- | ---------------- |
| `invalid_request` | Invalid request parameters |
| `unauthorized` | Invalid API key |
| `rate_limited` | Rate limit exceeded |
| `service_unavailable` | Service unavailable |

## 🎯 Examples

### Basic Conversation

```bash
curl -X POST https://your-gateway-domain.com/api/v1/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_gateway_api_key" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "Hello, please introduce yourself"}
    ]
  }'
```

---

*Last updated: ${new Date().toISOString().split('T')[0]}*

*Version: 2.1.0-beta.1*
