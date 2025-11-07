# API Gateway 使用示例

## 快速开始

### 1. 环境设置

```bash
# 克隆项目
git clone <repository-url>
cd api-gateway

# 安装依赖
npm install

# 配置环境变量
cp env.template .env
# 编辑 .env 文件，填入你的API密钥

# 启动服务
docker-compose up -d
```

### 2. 基本请求

```bash
curl -X POST http://localhost:3000/api/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-api-key: your_gateway_api_key" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {
        "role": "user",
        "content": "你好，请介绍一下自己"
      }
    ]
  }'
```

## 实际应用场景

### 场景1: 客户服务聊天机器人

```javascript
// 客户服务助手
async function customerServiceChat(userMessage, userId) {
  const messages = [
    {
      role: "system",
      content: "你是专业的客户服务助手，请礼貌、耐心、准确地回答用户问题。"
    },
    {
      role: "user",
      content: userMessage
    }
  ];

  const response = await fetch('/api/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.GATEWAY_API_KEY,
      'x-user-id': userId  // 用于成本追踪
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages,
      temperature: 0.7,
      max_tokens: 500
    })
  });

  const result = await response.json();
  return result.choices[0].message.content;
}
```

### 场景2: 内容生成和摘要

```javascript
// 文档摘要生成
async function generateSummary(documentText, summaryLength = "short") {
  const promptMap = {
    short: "请用100字以内总结以下文档的主要内容：",
    medium: "请用300字左右详细总结以下文档：",
    long: "请详细分析和总结以下文档，包含关键信息和要点："
  };

  const messages = [
    {
      role: "user",
      content: `${promptMap[summaryLength]}\n\n${documentText}`
    }
  ];

  const response = await fetch('/api/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.GATEWAY_API_KEY
    },
    body: JSON.stringify({
      model: "gpt-4",  // 使用更强大的模型进行摘要
      messages,
      temperature: 0.3,  // 降低随机性以提高一致性
      max_tokens: summaryLength === "long" ? 1000 : 500
    })
  });

  const result = await response.json();
  return result.choices[0].message.content;
}
```

### 场景3: 多语言翻译

```javascript
// 多语言翻译服务
async function translateText(text, targetLanguage, sourceLanguage = "auto") {
  const systemPrompt = `你是一个专业的翻译助手。请将${sourceLanguage === "auto" ? "" : `从${sourceLanguage}`}翻译成${targetLanguage}。
要求：
1. 保持原文的意思和语气
2. 使用自然的${targetLanguage}表达
3. 保持专业术语的准确性
4. 只返回翻译结果，不要添加其他解释`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: text }
  ];

  const response = await fetch('/api/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.GATEWAY_API_KEY
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",  // 翻译任务使用成本较低的模型
      messages,
      temperature: 0.1  // 翻译需要高确定性
    })
  });

  const result = await response.json();
  return result.choices[0].message.content;
}

// 使用示例
translateText("Hello, how are you today?", "中文")
  .then(translation => console.log(translation)); // "你好，今天怎么样？"
```

### 场景4: 代码生成和审查

```javascript
// 代码生成助手
async function generateCode(requirement, language, framework = null) {
  let systemPrompt = `你是一个经验丰富的${language}开发者。请根据需求生成高质量的代码。`;

  if (framework) {
    systemPrompt += `使用${framework}框架。`;
  }

  systemPrompt += `
要求：
1. 代码要完整、可运行
2. 包含必要的注释
3. 遵循${language}最佳实践
4. 处理错误情况
5. 提供使用示例`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: requirement }
  ];

  const response = await fetch('/api/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.GATEWAY_API_KEY
    },
    body: JSON.stringify({
      model: "gpt-4",  // 代码生成需要更强的推理能力
      messages,
      temperature: 0.2,  // 代码生成需要确定性
      max_tokens: 1500
    })
  });

  const result = await response.json();
  return result.choices[0].message.content;
}

// 代码审查
async function reviewCode(code, language) {
  const messages = [
    {
      role: "system",
      content: `你是一个资深的${language}代码审查专家。请对提供的代码进行全面审查，包括：
1. 代码质量和规范
2. 性能优化建议
3. 安全漏洞检查
4. 最佳实践遵循
5. 可维护性评估`
    },
    {
      role: "user",
      content: `请审查以下${language}代码：\n\n${code}`
    }
  ];

  const response = await fetch('/api/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.GATEWAY_API_KEY
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages,
      temperature: 0.1
    })
  });

  const result = await response.json();
  return result.choices[0].message.content;
}
```

### 场景5: 数据分析和报告生成

```javascript
// 数据分析报告生成
async function generateAnalysisReport(data, analysisType) {
  const analysisPrompts = {
    summary: "请对以下数据进行概述分析：",
    trend: "请分析数据的趋势和发展规律：",
    insight: "请从数据中提取关键洞察和商业建议：",
    prediction: "基于当前数据，预测未来发展趋势："
  };

  const messages = [
    {
      role: "system",
      content: "你是一个专业的数据分析师。请提供深入、准确、实用的分析报告。"
    },
    {
      role: "user",
      content: `${analysisPrompts[analysisType]}\n\n数据：${JSON.stringify(data, null, 2)}`
    }
  ];

  const response = await fetch('/api/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.GATEWAY_API_KEY
    },
    body: JSON.stringify({
      model: "gpt-4",  // 数据分析需要强大的推理能力
      messages,
      temperature: 0.3,
      max_tokens: 2000
    })
  });

  const result = await response.json();
  return result.choices[0].message.content;
}
```

## 高级用法

### 流式响应

```javascript
// 处理流式响应
async function streamChatCompletion(model, messages) {
  const response = await fetch('/api/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.GATEWAY_API_KEY
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true  // 启用流式响应
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content;
          if (content) {
            process.stdout.write(content);  // 实时输出
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }
}
```

### 批量处理

```javascript
// 批量处理多个请求
async function batchProcess(requests) {
  const results = [];

  // 限制并发数量，避免触发限流
  const concurrencyLimit = 5;
  const semaphore = new Semaphore(concurrencyLimit);

  const promises = requests.map(async (request, index) => {
    await semaphore.acquire();

    try {
      const response = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.GATEWAY_API_KEY,
          'x-request-id': `batch-${index}`  // 添加请求ID用于追踪
        },
        body: JSON.stringify(request)
      });

      const result = await response.json();
      results[index] = result;
    } catch (error) {
      results[index] = { error: error.message };
    } finally {
      semaphore.release();
    }
  });

  await Promise.all(promises);
  return results;
}

// 信号量实现
class Semaphore {
  constructor(maxConcurrent) {
    this.maxConcurrent = maxConcurrent;
    this.currentConcurrent = 0;
    this.waitQueue = [];
  }

  async acquire() {
    if (this.currentConcurrent < this.maxConcurrent) {
      this.currentConcurrent++;
      return;
    }

    return new Promise((resolve) => {
      this.waitQueue.push(resolve);
    });
  }

  release() {
    this.currentConcurrent--;
    if (this.waitQueue.length > 0) {
      this.currentConcurrent++;
      const resolve = this.waitQueue.shift();
      resolve();
    }
  }
}
```

### 错误处理和重试

```javascript
// 带重试机制的请求函数
async function resilientChatCompletion(model, messages, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.GATEWAY_API_KEY
        },
        body: JSON.stringify({
          model,
          messages,
          ...options
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // 检查业务层面的错误
      if (result.error) {
        throw new Error(result.error.message || result.error);
      }

      return result;

    } catch (error) {
      lastError = error;

      // 判断是否值得重试
      const shouldRetry = attempt < maxRetries && (
        error.message.includes('502') ||  // 网关错误
        error.message.includes('503') ||  // 服务不可用
        error.message.includes('timeout') ||  // 超时
        error.message.includes('rate limit')  // 限流
      );

      if (!shouldRetry) {
        break;
      }

      // 指数退避 + 随机抖动
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      const jitter = Math.random() * 0.1 * delay;
      const finalDelay = delay + jitter;

      console.log(`Attempt ${attempt} failed, retrying in ${Math.round(finalDelay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
  }

  throw new Error(`Request failed after ${maxRetries} attempts: ${lastError.message}`);
}
```

### 性能监控

```javascript
// 性能监控和指标收集
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      costs: {}
    };
  }

  async trackRequest(request, startTime) {
    this.metrics.totalRequests++;

    try {
      const response = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.GATEWAY_API_KEY,
          'x-track-performance': 'true'  // 启用性能追踪
        },
        body: JSON.stringify(request)
      });

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // 更新平均响应时间
      this.metrics.averageResponseTime =
        (this.metrics.averageResponseTime * (this.metrics.totalRequests - 1) + responseTime) /
        this.metrics.totalRequests;

      if (response.ok) {
        this.metrics.successfulRequests++;
        return await response.json();
      } else {
        this.metrics.failedRequests++;
        throw new Error(`HTTP ${response.status}`);
      }

    } catch (error) {
      this.metrics.failedRequests++;
      throw error;
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalRequests > 0 ?
        (this.metrics.successfulRequests / this.metrics.totalRequests * 100).toFixed(2) + '%' : '0%',
      cacheHitRate: (this.metrics.cacheHits + this.metrics.cacheMisses) > 0 ?
        (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100).toFixed(2) + '%' : '0%'
    };
  }

  logMetrics() {
    const metrics = this.getMetrics();
    console.log('=== Performance Metrics ===');
    console.log(`Total Requests: ${metrics.totalRequests}`);
    console.log(`Success Rate: ${metrics.successRate}`);
    console.log(`Average Response Time: ${metrics.averageResponseTime.toFixed(2)}ms`);
    console.log(`Cache Hit Rate: ${metrics.cacheHitRate}`);
    console.log(`Total Cost: ¥${Object.values(metrics.costs).reduce((a, b) => a + b, 0).toFixed(2)}`);
  }
}

// 使用示例
const monitor = new PerformanceMonitor();

async function monitoredRequest(model, messages) {
  const startTime = Date.now();
  const result = await monitor.trackRequest({ model, messages }, startTime);
  return result;
}

// 定期输出性能指标
setInterval(() => {
  monitor.logMetrics();
}, 60000);  // 每分钟输出一次
```

## 最佳实践

1. **错误处理**: 始终使用 try-catch 包装API调用
2. **重试策略**: 实现指数退避重试机制
3. **并发控制**: 限制同时请求数量
4. **缓存优化**: 合理设计提示词提高缓存命中率
5. **监控告警**: 关注关键性能指标
6. **成本控制**: 根据使用场景选择合适的模型
7. **超时设置**: 设置合理的请求超时时间
