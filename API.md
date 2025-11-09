# Sira AI Gateway API 文档

## 📋 概述

Sira AI Gateway 是一个智能 API 网关，支持多 AI 服务商的智能路由和监控。本文档描述了所有可用的 API 接口。

## 🚀 快速开始

### 基础 URL
```
http://localhost:8080
```

### 认证
目前 API 不需要认证，后续版本将添加 API Key 认证。

## 📚 API 接口

### 健康检查

检查服务健康状态。

**端点**: `GET /health`

**响应示例**:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-09T07:00:00.000Z",
  "uptime": 123.456,
  "version": "0.1.0"
}
```

### AI 聊天

与 AI 模型进行对话。

**端点**: `POST /api/ai/chat`

**请求头**:
```
Content-Type: application/json
```

**请求体**:
```json
{
  "messages": [
    {
      "role": "user",
      "content": "你好，请介绍一下你自己"
    }
  ],
  "model": "deepseek-chat",
  "provider": "auto"
}
```

**参数说明**:
- `messages` (必需): 消息数组，每个消息包含 `role` 和 `content`
- `model` (可选): AI 模型名称，默认 "deepseek-chat"
- `provider` (可选): AI 服务商，可选值: "auto", "deepseek", "openai"

**响应示例**:
```json
{
  "id": "chat_1731135600000",
  "object": "chat.completion",
  "created": 1731135600,
  "model": "deepseek-chat",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "我是 Sira AI Gateway 的 AI 助手..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 50,
    "total_tokens": 60
  },
  "provider": "deepseek"
}
```

**错误响应**:
```json
{
  "error": "messages参数是必需的，必须是数组且不能为空",
  "details": "请求验证失败"
}
```

### AI 提供商状态

检查所有 AI 提供商的连接状态。

**端点**: `GET /api/ai/providers`

**响应示例**:
```json
{
  "providers": {
    "deepseek": {
      "available": true,
      "configured": true,
      "responseTime": 245,
      "error": null
    },
    "openai": {
      "available": false,
      "configured": false,
      "responseTime": null,
      "error": "API key not configured"
    }
  },
  "timestamp": "2025-11-09T07:00:00.000Z"
}
```

### 测试端点

简单的测试端点，用于验证服务可用性。

**端点**: `GET /test`

**响应示例**:
```text
Test route works!
```

## 🔧 配置

### 环境变量

| 变量名 | 描述 | 默认值 | 必需 |
|--------|------|--------|------|
| `PORT` | 服务器端口 | 8080 | 否 |
| `NODE_ENV` | 运行环境 | development | 否 |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | - | 是 |
| `OPENAI_API_KEY` | OpenAI API 密钥 | - | 否 |

### 支持的 AI 提供商

#### DeepSeek
- **模型**: deepseek-chat, deepseek-coder
- **特点**: 国内服务，响应速度快
- **配置**: 设置 `DEEPSEEK_API_KEY`

#### OpenAI
- **模型**: gpt-3.5-turbo, gpt-4, gpt-4-turbo
- **特点**: 全球领先的 AI 服务
- **配置**: 设置 `OPENAI_API_KEY`

## 📊 监控和指标

### 健康指标

服务提供以下健康指标：
- **状态**: 服务运行状态
- **运行时间**: 服务启动后的运行时长
- **版本**: 当前版本号
- **时间戳**: 响应生成时间

### AI 提供商指标

每个 AI 提供商的状态包括：
- **可用性**: 服务是否可访问
- **配置状态**: API 密钥是否已配置
- **响应时间**: 最近一次请求的响应时间
- **错误信息**: 连接或配置错误详情

## 🚨 错误处理

### HTTP 状态码

| 状态码 | 含义 | 描述 |
|--------|------|------|
| 200 | 成功 | 请求成功处理 |
| 400 | 请求错误 | 请求参数无效 |
| 404 | 未找到 | 请求的资源不存在 |
| 500 | 服务器错误 | 服务器内部错误 |

### 常见错误

#### 消息验证错误
```json
{
  "error": "messages参数是必需的，必须是数组且不能为空"
}
```

#### 内容大小限制
```json
{
  "error": "消息内容过大，请减少内容长度"
}
```

#### AI 服务错误
```json
{
  "error": "AI服务调用失败",
  "details": "API key invalid",
  "provider": "deepseek"
}
```

## 🔒 安全考虑

### API 密钥管理
- 所有 API 密钥都通过环境变量配置
- 不要在代码中硬编码 API 密钥
- 定期轮换 API 密钥

### 请求限制
- 实现适当的速率限制
- 监控 API 使用情况
- 防止滥用

### 数据隐私
- 不记录用户消息内容
- 仅记录使用统计信息
- 遵守数据保护法规

## 📈 使用示例

### JavaScript/Node.js

```javascript
const fetch = require('node-fetch');

async function chatWithAI(message) {
  const response = await fetch('http://localhost:8080/api/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: message }],
      model: 'deepseek-chat'
    })
  });

  const result = await response.json();
  return result.choices[0].message.content;
}

// 使用示例
chatWithAI('你好，AI！').then(console.log);
```

### Python

```python
import requests
import json

def chat_with_ai(message):
    url = 'http://localhost:8080/api/ai/chat'
    headers = {'Content-Type': 'application/json'}
    data = {
        'messages': [{'role': 'user', 'content': message}],
        'model': 'deepseek-chat'
    }

    response = requests.post(url, headers=headers, data=json.dumps(data))
    result = response.json()

    return result['choices'][0]['message']['content']

# 使用示例
print(chat_with_ai('你好，AI！'))
```

### cURL

```bash
# 健康检查
curl http://localhost:8080/health

# AI 聊天
curl -X POST http://localhost:8080/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "你好，请介绍一下你自己"}],
    "model": "deepseek-chat"
  }'

# 检查提供商状态
curl http://localhost:8080/api/ai/providers
```

## 🔄 版本历史

### v0.1.0 (当前版本)
- ✅ 基础 AI 聊天接口
- ✅ 多 AI 提供商支持
- ✅ 健康检查和监控
- ✅ 基本错误处理

### 计划功能 (v0.2.0)
- 🔄 API Key 认证
- 🔄 请求速率限制
- 🔄 详细使用统计
- 🔄 缓存机制
- 🔄 负载均衡

## 📞 支持

如果您在使用 API 时遇到问题：

1. 检查本文档的故障排除部分
2. 查看 [GitHub Issues](../../issues)
3. 提交新的 Issue 描述问题

## 📝 许可证

本项目采用 Apache 2.0 许可证。详见 [LICENSE](../LICENSE) 文件。
