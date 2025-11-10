# @sira/services - 业务服务协调器

业务服务协调器整合所有业务逻辑服务，提供统一的接口来管理AI服务、路由、监控等核心功能。

## 功能特性

- 🎯 **服务整合**: 统一管理所有业务服务
- 🔄 **事件协调**: 服务间事件通信
- 📊 **状态聚合**: 整合各服务状态信息
- 🚀 **便捷接口**: 简化服务调用

## 安装使用

```javascript
const { ServiceManager } = require('@sira/services');

const serviceManager = new ServiceManager({
  ai: { timeout: 30000 },
  routing: { strategy: 'load_balance' },
  monitoring: { enabled: true }
});

await serviceManager.start();

// 使用便捷接口
const aiResponse = await serviceManager.executeAIRequest({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
});

const routeResult = await serviceManager.routeRequest(request);
```

## API 接口

### ServiceManager

#### 构造函数
```javascript
new ServiceManager(options)
```

**参数:**
- `options` (Object): 服务配置
  - `ai` (Object): AI服务配置
  - `routing` (Object): 路由服务配置
  - `monitoring` (Object): 监控服务配置

#### 方法

##### `start()`
启动所有业务服务。

```javascript
await serviceManager.start()
```

##### `stop()`
停止所有业务服务。

```javascript
await serviceManager.stop()
```

##### `getStatus()`
获取所有服务的状态信息。

```javascript
const status = serviceManager.getStatus()
```

**返回:**
```javascript
{
  ai: {
    providers: 2,
    models: 5
  },
  routing: {
    activeRoutes: 10,
    totalRequests: 1000
  },
  monitoring: {
    collectors: 3,
    alertRules: 5
  }
}
```

##### `executeAIRequest(request, options)`
便捷方法：执行AI请求。

```javascript
const response = await serviceManager.executeAIRequest({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }]
})
```

**参数:**
- `request` (Object): AI请求配置
- `options` (Object): 执行选项

**返回:** Promise<AIResponse>

##### `routeRequest(request, context)`
便捷方法：路由请求。

```javascript
const result = await serviceManager.routeRequest(request, {
  userId: 'user123',
  priority: 'high'
})
```

**参数:**
- `request` (Object): 请求对象
- `context` (Object): 路由上下文

**返回:** 路由结果

##### `getMonitoringStatus()`
便捷方法：获取监控状态。

```javascript
const status = await serviceManager.getMonitoringStatus()
```

**返回:** 监控状态信息

## 协调的服务

ServiceManager整合以下业务服务：

### AI服务 (@sira/ai-core)
- 多AI提供商集成
- 智能请求处理
- 模型管理和切换

### 路由服务 (@sira/routing)
- 智能负载均衡
- 故障转移
- 健康检查

### 监控服务 (@sira/monitoring)
- 系统指标收集
- 性能监控
- 告警规则

## 事件流

服务间通过事件进行通信：

```javascript
// AI请求事件流
ai.requestStart → monitoring.requestStart
ai.requestComplete → monitoring.requestComplete
ai.requestError → monitoring.requestError

// 路由事件流
routing.routeCompleted → monitoring.routeCompleted
routing.routeError → monitoring.routeError
```

## 依赖关系

- `@sira/ai-core`: AI核心服务
- `@sira/routing`: 智能路由服务
- `@sira/monitoring`: 系统监控服务

## 示例

```javascript
const { ServiceManager } = require('@sira/services');

async function runAIGateway() {
  // 创建服务管理器
  const serviceManager = new ServiceManager({
    ai: {
      timeout: 30000,
      maxRetries: 3
    },
    routing: {
      strategy: 'cost_first',
      healthCheckInterval: 30000
    },
    monitoring: {
      metrics: true,
      alerts: true
    }
  });

  // 启动服务
  await serviceManager.start();
  console.log('AI Gateway started');

  // 处理AI请求
  const response = await serviceManager.executeAIRequest({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Explain microservices architecture.' }
    ],
    temperature: 0.7
  });

  console.log('AI Response:', response.getContent());

  // 获取系统状态
  const status = serviceManager.getStatus();
  console.log('System Status:', status);

  // 优雅关闭
  await serviceManager.stop();
  console.log('AI Gateway stopped');
}

runAIGateway().catch(console.error);
```

## 最佳实践

1. **配置管理**: 在初始化时提供完整的配置选项
2. **错误处理**: 使用try-catch包装服务调用
3. **资源清理**: 确保在应用退出时调用`stop()`方法
4. **监控集成**: 利用内置的监控功能跟踪系统状态
5. **事件监听**: 根据需要监听服务事件进行自定义处理
