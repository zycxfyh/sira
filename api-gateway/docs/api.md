# API Gateway API 文档

## 概览

API Gateway 提供统一的AI模型调用接口，支持OpenAI、Anthropic、Azure OpenAI等多种供应商的智能路由和成本优化。

## 基础信息

- **Base URL**: `http://localhost:3000`
- **认证方式**: API Key (Header: `x-api-key`)
- **内容类型**: `application/json`

## 认证

所有API请求都需要在Header中包含API Key：

```bash
curl -H "x-api-key: your_gateway_api_key" \
     -H "Content-Type: application/json" \
     http://localhost:3000/api/chat/completions
```

## API 端点

### POST /api/chat/completions

创建聊天完成请求，支持所有主流AI模型。

#### 请求参数

| 参数 | 类型 | 必填 | 描述 |
|------|------|------|------|
| `model` | string | 是 | 模型名称 (gpt-4, gpt-3.5-turbo, claude-3-opus等) |
| `messages` | array | 是 | 消息数组 |
| `temperature` | number | 否 | 随机性 (0-2), 默认1 |
| `max_tokens` | number | 否 | 最大token数 |
| `stream` | boolean | 否 | 是否流式响应, 默认false |

#### 请求示例

```json
{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "system",
      "content": "你是一个有用的助手"
    },
    {
      "role": "user",
      "content": "请介绍一下API网关"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1000
}
```

#### 响应示例

```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1677858242,
  "model": "gpt-3.5-turbo-0613",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "API网关是一个统一的管理和优化AI API调用的中间层服务..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 20,
    "completion_tokens": 150,
    "total_tokens": 170
  }
}
```

#### 错误响应

```json
{
  "error": "Unauthorized"
}
```

```json
{
  "error": "Rate limit exceeded"
}
```

### GET /health

健康检查端点。

#### 响应示例

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

### GET /metrics

Prometheus指标端点，返回监控指标。

#### 响应示例

```text
# HELP api_gateway_requests_total Total number of API requests
# TYPE api_gateway_requests_total counter
api_gateway_requests_total{method="POST",endpoint="/api/chat/completions",status="200",vendor="openai",model="gpt-3.5-turbo"} 42
```

## 支持的模型

### OpenAI
- `gpt-4`
- `gpt-4-turbo`
- `gpt-4-turbo-preview`
- `gpt-3.5-turbo`
- `gpt-3.5-turbo-16k`

### Anthropic
- `claude-3-opus`
- `claude-3-sonnet`
- `claude-3-haiku`
- `claude-2`
- `claude-instant-1`

### Azure OpenAI
- `gpt-4`
- `gpt-4-turbo`
- `gpt-3.5-turbo`

## 智能路由

API Gateway 会根据以下因素自动选择最优供应商：

1. **成本**: 优先选择价格更低的模型
2. **质量**: 根据历史成功率选择可靠的供应商
3. **延迟**: 选择响应速度快的供应商
4. **可用性**: 避开故障或限流的供应商

## 缓存机制

API Gateway 实现了多级缓存策略：

- **L1缓存**: 本地内存缓存 (超低延迟)
- **L2缓存**: Redis分布式缓存 (跨实例共享)

缓存键基于请求内容的哈希值生成，确保相同请求的缓存命中。

## 限流和熔断

- **令牌桶算法**: 控制请求频率
- **熔断机制**: 当供应商连续失败时自动切换
- **降级策略**: 在高负载时返回缓存结果

## 监控指标

API Gateway 提供丰富的监控指标：

- 请求总数和成功率
- 各供应商调用统计
- 缓存命中率
- 响应时间分布
- 成本统计 (按供应商和模型)

## 错误处理

### 常见错误码

| 错误码 | 描述 |
|--------|------|
| 400 | 请求参数错误 |
| 401 | API密钥无效 |
| 403 | 权限不足 |
| 429 | 请求频率超限 |
| 500 | 服务器内部错误 |
| 502 | 供应商服务不可用 |
| 503 | 服务暂时不可用 |

### 供应商错误映射

API Gateway 会将不同供应商的错误统一转换为标准的HTTP状态码和错误信息。

## 示例代码

### Python

```python
import requests

def chat_completion(model, messages, api_key):
    url = "http://localhost:3000/api/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key
    }
    data = {
        "model": model,
        "messages": messages,
        "temperature": 0.7
    }

    response = requests.post(url, headers=headers, json=data)
    return response.json()

# 使用示例
messages = [
    {"role": "user", "content": "Hello, how are you?"}
]
result = chat_completion("gpt-3.5-turbo", messages, "your_api_key")
print(result)
```

### JavaScript/Node.js

```javascript
const axios = require('axios');

async function chatCompletion(model, messages, apiKey) {
  try {
    const response = await axios.post(
      'http://localhost:3000/api/chat/completions',
      {
        model,
        messages,
        temperature: 0.7
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error:', error.response.data);
    throw error;
  }
}

// 使用示例
const messages = [
  { role: 'user', content: 'Hello, how are you?' }
];

chatCompletion('gpt-3.5-turbo', messages, 'your_api_key')
  .then(result => console.log(result))
  .catch(error => console.error(error));
```

### cURL

```bash
curl -X POST http://localhost:3000/api/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_api_key" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {
        "role": "user",
        "content": "Hello, how are you?"
      }
    ],
    "temperature": 0.7
  }'
```

## 最佳实践

1. **错误处理**: 始终检查响应状态和错误信息
2. **重试机制**: 对于临时错误实现指数退避重试
3. **请求限制**: 控制并发请求数量，避免触发限流
4. **监控告警**: 设置关键指标的监控和告警
5. **缓存利用**: 合理设计提示词以提高缓存命中率

## 故障排除

### 常见问题

1. **401 Unauthorized**
   - 检查API Key是否正确
   - 确认Key格式和权限

2. **429 Rate Limited**
   - 降低请求频率
   - 检查当前使用配额

3. **502 Bad Gateway**
   - 供应商服务暂时不可用
   - API Gateway会自动重试或切换供应商

4. **缓存命中率低**
   - 检查提示词标准化
   - 调整缓存TTL设置

## 版本历史

- **v1.0.0**: 初始版本，支持基础路由和缓存
- **v1.1.0**: 添加监控和告警功能
- **v1.2.0**: 实现智能熔断和降级
- **v2.0.0**: 支持请求批处理和合并
