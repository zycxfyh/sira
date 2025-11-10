# 🧠 @sira/ai-router

**智能AI路由引擎 - Sira的核心竞争力**

[![npm version](https://badge.fury.io/js/%40sira%2Fai-router.svg)](https://badge.fury.io/js/%40sira%2Fai-router)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## 🎯 核心功能

这个包实现了Sira项目的核心智能路由功能：

- **复杂度感知路由** - 根据请求复杂度自动选择最适合的AI模型
- **多维度决策算法** - 综合考虑成本、性能、质量等因素
- **智能缓存系统** - 避免重复的路由决策计算
- **实时统计监控** - 提供路由效果的实时分析
- **策略模式设计** - 支持成本优先、性能优先、均衡等多种路由策略

## 🏗️ 架构设计原则

### 1. 单一职责原则 (SRP)
```javascript
// ✅ 好的设计：只负责路由决策
class IntelligentRouter {
  route(request, context) {
    // 只做路由相关的逻辑
  }
}

// ❌ 坏的设计：什么都做
class GodClass {
  route() { /* ... */ }
  cache() { /* ... */ }
  log() { /* ... */ }
  authenticate() { /* ... */ }
}
```

### 2. 开放封闭原则 (OCP)
```javascript
// ✅ 通过策略模式扩展路由算法
const strategies = {
  cost_first: { weights: { cost: 0.5, performance: 0.3, quality: 0.2 } },
  performance_first: { weights: { performance: 0.5, quality: 0.3, cost: 0.2 } }
};

// 添加新策略不需要修改现有代码
strategies.quality_first = { weights: { quality: 0.5, performance: 0.3, cost: 0.2 } };
```

### 3. 依赖倒置原则 (DIP)
```javascript
// ✅ 依赖抽象接口，不依赖具体实现
class IntelligentRouter {
  constructor(options = {}) {
    this.cache = options.cache || new Map(); // 可以注入不同的缓存实现
    this.metrics = options.metrics || new Metrics(); // 可以注入不同的监控实现
  }
}
```

## 📊 使用示例

### 基本使用

```javascript
const { IntelligentRouter } = require('@sira/ai-router');

const router = new IntelligentRouter({
  enableCache: true,
  cacheTTL: 300000 // 5分钟
});

// 执行路由决策
const result = await router.route({
  messages: [
    { role: 'user', content: '请解释什么是机器学习' }
  ],
  taskType: 'explanation'
}, {
  apiKeys: {
    openai: 'your-openai-key',
    anthropic: 'your-anthropic-key'
  }
});

console.log(result);
// {
//   success: true,
//   model: 'gpt-4',
//   provider: 'openai',
//   strategy: 'balanced',
//   fromCache: false,
//   processingTime: 45,
//   reasoning: '基于均衡策略选择gpt-4'
// }
```

### 切换路由策略

```javascript
// 成本优先策略
router.setStrategy('cost_first');

// 性能优先策略
router.setStrategy('performance_first');

// 均衡策略（默认）
router.setStrategy('balanced');
```

### 获取统计信息

```javascript
const metrics = router.getMetrics();
console.log(metrics);
// {
//   totalRequests: 150,
//   cacheHits: 45,
//   cacheHitRate: 0.3,
//   avgDecisionTime: 42,
//   currentStrategy: 'balanced'
// }
```

## 🔧 路由算法详解

### 复杂度分析

路由器首先分析请求的复杂度：

```javascript
_analyzeComplexity(request) {
  let score = 0;

  // 基于消息长度
  const totalLength = request.messages.reduce((sum, msg) =>
    sum + (msg.content?.length || 0), 0);

  if (totalLength > 10000) score += 3;      // 复杂
  else if (totalLength > 1000) score += 2;  // 中等
  else score += 1;                          // 简单

  // 基于任务类型
  if (request.taskType === 'code_generation') score += 2;

  // 基于能力要求
  if (request.requiredCapabilities) {
    score += request.requiredCapabilities.length;
  }

  return score >= 5 ? 'complex' : score >= 3 ? 'medium' : 'simple';
}
```

### 多维度评分

为每个候选模型计算综合得分：

```javascript
_calculateModelScore(model, complexity, weights, context) {
  let score = 0;

  // 成本得分（归一化）
  const costScore = Math.max(0, 1 - model.cost / 0.05);
  score += costScore * weights.cost;

  // 性能得分
  score += model.performance * weights.performance;

  // 质量得分
  score += model.quality * weights.quality;

  // 复杂度适应性调整
  if (complexity === 'complex' && model.quality > 0.9) {
    score += 0.1; // 复杂任务优先高质量模型
  }

  // 用户偏好调整
  if (context.userPreferences?.preferredModels?.includes(model.name)) {
    score += 0.2;
  }

  return score;
}
```

## 🧪 测试驱动开发

这个包采用了完整的测试驱动开发实践：

```bash
# 运行测试
npm test

# 运行测试覆盖率
npm run test:coverage

# 运行特定测试
npm test -- --testNamePattern="复杂度分析"
```

### 测试策略

1. **单元测试** - 测试单个函数和方法
2. **集成测试** - 测试模块间的协作
3. **性能测试** - 确保路由决策足够快
4. **边界测试** - 测试异常情况和错误处理

## 📈 性能优化

### 缓存策略
- **L1缓存**: 内存中的快速缓存
- **TTL机制**: 自动清理过期缓存
- **智能键生成**: 基于请求内容生成缓存键

### 异步处理
- **Promise-based**: 所有操作都是异步的
- **错误传播**: 完整的错误处理链
- **事件驱动**: 通过事件总线进行解耦通信

## 🔄 扩展点

### 添加新的路由策略

```javascript
// 注册新策略
router.strategies.custom_strategy = {
  name: '自定义策略',
  weights: { cost: 0.2, performance: 0.2, quality: 0.2, custom: 0.4 }
};
```

### 自定义复杂度分析器

```javascript
class CustomComplexityAnalyzer {
  analyze(request) {
    // 自定义复杂度分析逻辑
    return { complexity: 'custom', score: 10 };
  }
}

const router = new IntelligentRouter({
  complexityAnalyzer: new CustomComplexityAnalyzer()
});
```

## 🤝 贡献指南

### 开发流程

1. **Fork项目** 到你的GitHub账户
2. **创建特性分支** `git checkout -b feature/new-strategy`
3. **编写测试** 先写测试，再写实现
4. **运行测试** `npm test` 确保所有测试通过
5. **提交代码** `git commit -m "Add new routing strategy"`
6. **创建Pull Request**

### 代码规范

- 使用ES6+语法
- 遵循JavaScript Standard Style
- 编写完整的JSDoc注释
- 保持测试覆盖率 > 90%

## 📚 学习资源

### 推荐阅读

1. **《Clean Code》** - Robert C. Martin
   - 学习编写可维护的代码

2. **《Design Patterns》** - Gang of Four
   - 理解设计模式的应用

3. **《Domain-Driven Design》** - Eric Evans
   - 学习领域驱动设计

### 在线资源

- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Test-Driven Development](https://martinfowler.com/bliki/TestDrivenDevelopment.html)
- [Domain-Driven Design](https://dddcommunity.org/)

## 📄 许可证

Apache License 2.0 - 详见 [LICENSE](../../LICENSE) 文件

## 🙋‍♂️ 问题反馈

- 📧 Email: 1666384464@qq.com
- 🐛 Issues: [GitHub Issues](../../issues)
- 💬 Discussions: [GitHub Discussions](../../discussions)

---

**记住：好的架构不是一开始就设计出来的，而是重构出来的。** 🎯
