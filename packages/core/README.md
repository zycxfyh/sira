# @sira/core - 核心服务容器

核心服务容器提供依赖注入和服务管理功能，是整个Sira AI Gateway的基础设施层。

## 功能特性

- 🔗 **依赖注入**: 统一管理服务依赖关系
- 🏗️ **服务容器**: 自动初始化和配置服务
- 🔄 **生命周期管理**: 服务的启动、停止和清理
- 📊 **状态监控**: 实时监控服务健康状态

## 安装使用

```javascript
const { CoreContainer } = require('@sira/core');

const container = new CoreContainer({
  logger: { service: 'my-app' },
  cache: { maxSize: 1000 },
  metrics: { namespace: 'my-app' }
});

await container.initialize();

// 获取服务实例
const logger = container.get('logger');
const cache = container.get('cache');
```

## API 接口

### CoreContainer

#### 构造函数
```javascript
new CoreContainer(options)
```

**参数:**
- `options` (Object): 配置选项
  - `logger` (Object): 日志服务配置
  - `cache` (Object): 缓存服务配置
  - `metrics` (Object): 指标收集配置
  - `events` (Object): 事件总线配置
  - `errors` (Object): 错误处理配置

#### 方法

##### `initialize()`
初始化所有核心服务。

```javascript
await container.initialize()
```

**返回:** Promise<CoreContainer>

##### `get(serviceName)`
获取服务实例。

```javascript
const service = container.get('logger')
```

**参数:**
- `serviceName` (string): 服务名称

**返回:** 服务实例

##### `register(serviceName, instance)`
注册服务实例。

```javascript
container.register('customService', myService)
```

**参数:**
- `serviceName` (string): 服务名称
- `instance` (Object): 服务实例

##### `has(serviceName)`
检查服务是否存在。

```javascript
const exists = container.has('logger')
```

**参数:**
- `serviceName` (string): 服务名称

**返回:** boolean

##### `getStatus()`
获取容器状态。

```javascript
const status = container.getStatus()
```

**返回:**
```javascript
{
  initialized: true,
  services: {
    logger: { status: 'ready', type: 'LoggerService' },
    cache: { status: 'ready', type: 'CacheService' }
  }
}
```

##### `cleanup()`
清理所有服务资源。

```javascript
await container.cleanup()
```

## 默认服务

容器自动注册以下核心服务：

- **logger**: 日志服务 (`@sira/logger`)
- **cache**: 缓存服务 (`@sira/cache`)
- **metrics**: 指标收集服务 (`@sira/metrics`)
- **eventBus**: 事件总线 (`@sira/events`)
- **errorHandler**: 错误处理器 (`@sira/errors`)

## 自定义服务

```javascript
// 注册服务工厂
container.factory('database', () => new DatabaseService(config));

// 注册服务实例
container.register('apiClient', new APIClient(config));
```

## 依赖关系

- `@sira/cache`: 缓存服务
- `@sira/logger`: 日志服务
- `@sira/metrics`: 指标收集
- `@sira/events`: 事件总线
- `@sira/errors`: 错误处理
- `@sira/utils`: 工具函数

## 示例

```javascript
const { CoreContainer } = require('@sira/core');

async function main() {
  // 创建容器
  const container = new CoreContainer({
    logger: { level: 'info' },
    cache: { ttl: 3600 }
  });

  // 初始化
  await container.initialize();

  // 使用服务
  const logger = container.get('logger');
  const cache = container.get('cache');

  logger.info('Application started');
  await cache.set('key', 'value');

  // 清理资源
  await container.cleanup();
}

main().catch(console.error);
```
