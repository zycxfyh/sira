# @sira/cache - 高速缓存服务

提供LRU缓存、多级缓存和缓存装饰器功能，支持内存缓存和分布式缓存。

## 功能特性

- 🚀 **高性能**: LRU算法，最少最近使用淘汰
- 📊 **统计监控**: 缓存命中率、内存使用等指标
- 🏷️ **TTL支持**: 自动过期和清理
- 🔧 **装饰器**: 方法级缓存装饰器
- 🔄 **多级缓存**: L1内存 + L2分布式缓存

## 安装使用

```javascript
const { CacheService } = require('@sira/cache');

const cache = new CacheService({
  maxSize: 1000,      // 最大缓存条目数
  ttl: 3600000,       // 默认TTL: 1小时
  checkPeriod: 60000  // 清理间隔: 1分钟
});

// 基本操作
await cache.set('key', 'value', 300000); // 5分钟TTL
const value = await cache.get('key');
await cache.del('key');
```

## API 接口

### CacheService

#### 构造函数
```javascript
new CacheService(options)
```

**参数:**
- `options` (Object): 配置选项
  - `maxSize` (number): 最大缓存条目数，默认1000
  - `ttl` (number): 默认TTL(毫秒)，默认3600000
  - `checkPeriod` (number): 清理检查间隔，默认60000

#### 方法

##### `get(key)`
获取缓存值。

```javascript
const value = await cache.get('user:123')
```

##### `set(key, value, ttl)`
设置缓存值。

```javascript
await cache.set('user:123', userData, 300000) // 5分钟
```

##### `del(key)`
删除缓存条目。

```javascript
await cache.del('user:123')
```

##### `has(key)`
检查键是否存在。

```javascript
const exists = await cache.has('user:123')
```

##### `clear()`
清空所有缓存。

```javascript
await cache.clear()
```

##### `size()`
获取缓存条目数量。

```javascript
const count = cache.size()
```

##### `stats()`
获取缓存统计信息。

```javascript
const stats = cache.stats()
// { hits: 150, misses: 50, hitRate: 0.75, size: 100 }
```

## 缓存装饰器

```javascript
const { cacheable } = require('@sira/cache');

class UserService {
  @cacheable('user', 300000) // 缓存5分钟
  async getUser(id) {
    // 只有缓存未命中时才会执行
    return await this.database.getUser(id);
  }
}
```

## 依赖关系

无外部依赖，是独立的缓存服务。

## 示例

```javascript
const { CacheService } = require('@sira/cache');

async function demo() {
  const cache = new CacheService({
    maxSize: 100,
    ttl: 60000 // 1分钟
  });

  // 设置缓存
  await cache.set('config', { theme: 'dark' });
  await cache.set('temp', 'data', 10000); // 10秒TTL

  // 获取缓存
  const config = await cache.get('config');
  console.log(config); // { theme: 'dark' }

  // 等待过期
  await new Promise(resolve => setTimeout(resolve, 11000));
  const temp = await cache.get('temp');
  console.log(temp); // null (已过期)

  // 统计信息
  console.log(cache.stats());
  // { hits: 1, misses: 1, hitRate: 0.5, size: 1 }
}
```
