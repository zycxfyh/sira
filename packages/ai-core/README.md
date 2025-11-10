# @sira/ai-core - AI核心服务

AI核心服务提供多AI服务商集成、智能请求处理和响应格式化功能。

## 功能特性

- 🤖 **多AI服务商支持**: OpenAI、Anthropic、Google等
- 🔄 **智能重试**: 自动重试失败请求
- 📊 **指标监控**: 详细的性能和使用统计
- 🎯 **模型管理**: 统一模型配置和切换
- ⚡ **流式响应**: 支持实时流式输出

## 安装使用

```javascript
const { AIServiceManager, AIRequest, AIResponse } = require('@sira/ai-core');

const aiManager = new AIServiceManager({
  timeout: 30000,
  maxRetries: 3
});

// 注册AI提供商
aiManager.registerProvider('openai', openaiProvider);
aiManager.registerModel('gpt-4', 'openai', { maxTokens: 4000 });

// 执行请求
const response = await aiManager.executeRequest({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

## API 接口

### AIServiceManager

#### 构造函数
```javascript
new AIServiceManager(options)
```

**参数:**
- `options` (Object): 配置选项
  - `timeout` (number): 请求超时时间，默认30000ms
  - `maxRetries` (number): 最大重试次数，默认3
  - `retryDelay` (number): 重试延迟，默认1000ms
  - `metrics` (Object): 指标收集器
  - `logger` (Object): 日志记录器

#### 方法

##### `registerProvider(name, provider)`
注册AI提供商。

```javascript
aiManager.registerProvider('openai', openaiProvider)
```

**参数:**
- `name` (string): 提供商名称
- `provider` (Object): 提供商实例

##### `registerModel(modelName, providerName, modelConfig)`
注册AI模型。

```javascript
aiManager.registerModel('gpt-4', 'openai', {
  maxTokens: 4000,
  pricing: { prompt: 0.03, completion: 0.06 }
})
```

**参数:**
- `modelName` (string): 模型名称
- `providerName` (string): 提供商名称
- `modelConfig` (Object): 模型配置

##### `executeRequest(request, options)`
执行AI请求。

```javascript
const response = await aiManager.executeRequest({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
  temperature: 0.7
})
```

**参数:**
- `request` (Object): 请求配置
  - `model` (string): 模型名称
  - `messages` (Array): 消息数组
  - 其他模型参数
- `options` (Object): 执行选项

**返回:** Promise<AIResponse>

##### `executeStreamingRequest(request, options)`
执行流式AI请求。

```javascript
for await (const chunk of aiManager.executeStreamingRequest(request)) {
  console.log(chunk.content);
}
```

**参数:**
- `request` (Object): 请求配置
- `options` (Object): 执行选项

**返回:** AsyncIterable<StreamChunk>

##### `getModel(modelName)`
获取模型配置。

```javascript
const model = aiManager.getModel('gpt-4')
```

**参数:**
- `modelName` (string): 模型名称

**返回:** 模型配置对象或null

##### `getAvailableModels()`
获取所有可用模型。

```javascript
const models = aiManager.getAvailableModels()
```

**返回:** 模型信息数组

##### `validateModel(modelName)`
验证模型可用性。

```javascript
const result = await aiManager.validateModel('gpt-4')
```

**返回:**
```javascript
{
  valid: true,        // 是否有效
  error: null         // 错误信息
}
```

##### `getStats()`
获取服务统计信息。

```javascript
const stats = aiManager.getStats()
```

**返回:**
```javascript
{
  providers: ['openai', 'anthropic'],
  models: ['gpt-4', 'claude-3'],
  capabilities: ['chat', 'completion', 'embedding']
}
```

### AIRequest

#### 构造函数
```javascript
new AIRequest(model, messages, options)
```

**参数:**
- `model` (string): 模型名称
- `messages` (Array): 消息数组
- `options` (Object): 请求选项

#### 方法

##### `addMessage(message)`
添加消息。

```javascript
request.addMessage({ role: 'user', content: 'How are you?' })
```

##### `setOption(key, value)`
设置请求选项。

```javascript
request.setOption('temperature', 0.8)
```

##### `toAPIFormat()`
转换为API格式。

```javascript
const apiFormat = request.toAPIFormat()
```

### AIResponse

#### 构造函数
```javascript
new AIResponse(content, usage, metadata)
```

**参数:**
- `content` (string): 响应内容
- `usage` (Object): 使用统计
- `metadata` (Object): 元数据

#### 方法

##### `getContent()`
获取响应内容。

```javascript
const content = response.getContent()
```

##### `getUsage()`
获取使用统计。

```javascript
const usage = response.getUsage()
// { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
```

##### `calculateCost(pricing)`
计算请求成本。

```javascript
const cost = response.calculateCost({
  prompt: 0.03,      // 提示词价格($/1K tokens)
  completion: 0.06    // 完成价格($/1K tokens)
})
```

## 事件

AIServiceManager继承自EventEmitter，会发出以下事件：

- `providerRegistered`: 提供商注册
- `providerUnregistered`: 提供商注销
- `modelRegistered`: 模型注册
- `requestStart`: 请求开始
- `requestComplete`: 请求完成
- `requestError`: 请求错误
- `streamingRequestStart`: 流式请求开始
- `streamingChunk`: 流式数据块
- `streamingRequestComplete`: 流式请求完成
- `streamingRequestError`: 流式请求错误

## 依赖关系

- `@sira/core`: 核心服务容器
- `@sira/utils`: 工具函数

## 示例

```javascript
const { AIServiceManager, AIRequest } = require('@sira/ai-core');

async function chatWithAI() {
  const aiManager = new AIServiceManager();

  // 注册OpenAI提供商
  aiManager.registerProvider('openai', openaiProvider);
  aiManager.registerModel('gpt-4', 'openai', {
    maxTokens: 4000,
    temperature: 0.7
  });

  // 创建请求
  const request = new AIRequest('gpt-4', [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Explain quantum computing.' }
  ]);

  // 执行请求
  try {
    const response = await aiManager.executeRequest(request);
    console.log('Response:', response.getContent());
    console.log('Usage:', response.getUsage());
    console.log('Cost:', response.calculateCost(modelPricing));
  } catch (error) {
    console.error('Error:', error.message);
  }
}
```
