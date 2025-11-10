# @sira/config-manager - 配置管理系统

提供统一的多源配置管理功能，支持配置加载、验证、合并和热重载。

## 功能特性

- 📁 **多格式支持**: JSON、YAML、JS等配置文件格式
- 🔍 **配置验证**: JSON Schema验证和自定义规则
- 🔀 **智能合并**: 多源配置深度合并和优先级处理
- 🌐 **环境变量**: 环境变量自动映射
- 📊 **命令行参数**: 命令行参数解析
- 🔄 **热重载**: 配置变更自动重载
- 📈 **缓存优化**: 配置缓存提升性能

## 安装使用

```javascript
const { ConfigManager } = require('@sira/config-manager');

const configManager = new ConfigManager({
  loader: { configDir: './config' }
});

// 加载配置文件
const config = await configManager.load('app.json', {
  validate: true,
  schema: 'app'
});

// 合并多源配置
const mergedConfig = await configManager.loadMerged([
  'defaults.json',
  'production.json',
  { custom: 'override' }
]);
```

## API 接口

### ConfigManager

#### 构造函数
```javascript
new ConfigManager(options)
```

**参数:**
- `options` (Object): 配置选项
  - `loader` (Object): 加载器配置
  - `validator` (Object): 验证器配置
  - `merger` (Object): 合并器配置

#### 方法

##### `load(configPath, options)`
加载单个配置文件。

```javascript
const config = await configManager.load('database.json', {
  validate: true,
  schema: 'database'
})
```

##### `loadMerged(configs, options)`
合并加载多个配置源。

```javascript
const config = await configManager.loadMerged([
  'defaults.yaml',
  'local.json',
  process.env
])
```

##### `loadFromEnv(prefix, options)`
从环境变量加载配置。

```javascript
const config = configManager.loadFromEnv('APP_', {
  mappings: { 'APP_PORT': 'port' }
})
```

##### `loadFromArgs(args)`
从命令行参数加载配置。

```javascript
const config = configManager.loadFromArgs(process.argv.slice(2))
```

##### `validate(config, schemaName)`
验证配置对象。

```javascript
const result = configManager.validate(config, 'api')
```

##### `registerSchema(name, schema)`
注册配置模式。

```javascript
configManager.registerSchema('database', {
  type: 'object',
  properties: {
    host: { type: 'string' },
    port: { type: 'number' }
  }
})
```

## 配置格式支持

### JSON 配置
```json
{
  "database": {
    "host": "localhost",
    "port": 5432
  },
  "api": {
    "timeout": 30000
  }
}
```

### YAML 配置
```yaml
database:
  host: localhost
  port: 5432
api:
  timeout: 30000
```

### JavaScript 配置
```javascript
module.exports = {
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432
  }
};
```

### 环境变量映射
```javascript
// 自动映射 APP_DATABASE_HOST -> database.host
const config = configManager.loadFromEnv('APP_', {
  mappings: {
    'DATABASE_HOST': 'database.host',
    'DATABASE_PORT': 'database.port'
  }
});
```

## 配置验证

### 内置模式
- `database`: 数据库配置验证
- `redis`: Redis配置验证
- `api`: API配置验证
- `logging`: 日志配置验证

### 自定义模式
```javascript
configManager.registerSchema('myService', {
  type: 'object',
  required: ['apiKey', 'endpoint'],
  properties: {
    apiKey: { type: 'string', minLength: 10 },
    endpoint: { type: 'string', format: 'uri' },
    timeout: { type: 'number', minimum: 1000 }
  }
});
```

## 配置合并策略

### 对象合并
- `deep`: 深度合并（默认）
- `shallow`: 浅合并

### 数组合并
- `replace`: 替换（默认）
- `concat`: 连接
- `unique`: 去重合并

### 基本类型
- `override`: 覆盖（默认）
- `keep`: 保留原值

## 依赖关系

无外部依赖，使用内置Node.js模块。

## 示例

```javascript
const { ConfigManager } = require('@sira/config-manager');

async function loadAppConfig() {
  const configManager = new ConfigManager({
    loader: { configDir: './config' },
    validator: { strictMode: true }
  });

  // 注册自定义模式
  configManager.registerSchema('app', {
    type: 'object',
    required: ['name', 'version'],
    properties: {
      name: { type: 'string' },
      version: { type: 'string' },
      database: { $ref: '#/definitions/database' }
    },
    definitions: {
      database: {
        type: 'object',
        properties: {
          host: { type: 'string' },
          port: { type: 'number' }
        }
      }
    }
  });

  try {
    // 加载并验证配置
    const config = await configManager.load('app.json', {
      validate: true,
      schema: 'app'
    });

    console.log('配置加载成功:', config);
    return config;

  } catch (error) {
    console.error('配置加载失败:', error.message);
    throw error;
  }
}

// 从多源加载配置
async function loadMultiSourceConfig() {
  const configManager = new ConfigManager();

  const config = await configManager.loadMerged([
    'defaults.json',           // 默认配置
    'development.json',        // 环境配置
    configManager.loadFromEnv('APP_'),  // 环境变量
    configManager.loadFromArgs(process.argv.slice(2))  // 命令行参数
  ]);

  return config;
}
```
