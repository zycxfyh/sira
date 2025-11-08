# Sira AI Gateway 快速失败机制指南

## 📋 概述

本指南介绍Sira AI Gateway实现的严格快速失败机制，参考GitHub社区最佳实践，确保系统在出现问题时立即停止，避免级联故障和难以调试的问题。

## 🎯 快速失败原则

### 核心原则
1. **Fail Fast**: 遇到错误立即停止，而不是继续执行
2. **Fail Loud**: 清晰地报告错误原因
3. **Fail Early**: 在问题变得复杂之前检测到问题
4. **Fail Safe**: 确保系统处于安全状态

### 实施层次
1. **启动时验证**: 模块加载时的前置条件检查
2. **配置验证**: 构造函数参数和配置的有效性检查
3. **运行时验证**: 方法调用时的参数和状态验证
4. **依赖检查**: 外部依赖和内部模块的可用性检查

## 🔧 实施机制

### 1. 严格模式 ('use strict')

所有核心文件都使用严格模式：

```javascript
'use strict';
```

**作用**: 启用更严格的语法检查和运行时行为。

### 2. Node.js版本验证

```javascript
// 快速失败：验证Node.js版本
const requiredNodeVersion = 18;
if (parseInt(process.versions.node.split('.')[0]) < requiredNodeVersion) {
  console.error(`❌ 需要Node.js ${requiredNodeVersion}+，当前版本: ${process.versions.node}`);
  process.exit(1);
}
```

**验证**: 确保运行环境满足最低版本要求。

### 3. 环境变量验证

```javascript
// 快速失败：验证必需的环境变量
const requiredEnvVars = ['NODE_ENV'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ 缺少必需的环境变量: ${envVar}`);
    process.exit(1);
  }
}
```

**验证**: 确保必需的环境变量已设置。

### 4. 依赖模块验证

```javascript
// 快速失败：验证依赖模块
const requiredModules = ['./doc-generator', './knowledge-base'];
for (const modulePath of requiredModules) {
  try {
    require.resolve(modulePath);
  } catch (error) {
    console.error(`❌ 无法加载必需模块: ${modulePath}`, error.message);
    process.exit(1);
  }
}
```

**验证**: 确保所有必需的内部模块可以加载。

### 5. 构造函数参数验证

```javascript
constructor(options = {}) {
  // 快速失败：验证选项参数
  if (typeof options !== 'object' || options === null) {
    throw new Error('选项必须是有效的对象');
  }

  // 快速失败：验证关键配置参数
  if (options.timeout !== undefined && (typeof options.timeout !== 'number' || options.timeout <= 0)) {
    throw new Error('timeout必须是正数');
  }
  // ...
}
```

**验证**: 确保构造函数接收到有效的参数。

### 6. 函数参数验证

```javascript
module.exports = function (params, config) {
  // 快速失败：验证必需参数
  if (!params) {
    throw new Error('需要配置参数 (params)');
  }

  if (!config) {
    throw new Error('需要配置对象 (config)');
  }

  // 快速失败：验证参数类型
  if (typeof params !== 'object' || params === null) {
    const error = new Error('参数必须是有效的对象');
    logger.error(error.message);
    throw error;
  }
  // ...
}
```

**验证**: 确保函数接收到正确类型的参数。

## 📁 已实施的文件

### 核心模块

#### `src/core/index.js` - 扩展管理器
- ✅ Node.js版本验证
- ✅ 环境变量验证
- ✅ 模块依赖验证
- ✅ 构造函数验证
- ✅ 组件初始化验证

#### `src/core/policies/ai-router/ai-router.js` - AI路由器
- ✅ Node.js版本验证
- ✅ 外部依赖验证 (axios)
- ✅ 内部模块依赖验证
- ✅ 函数参数验证
- ✅ 配置属性验证

#### `src/core/cache-manager.js` - 缓存管理器
- ✅ Node.js版本验证
- ✅ 核心模块验证 (events, crypto)
- ✅ 构造函数参数验证
- ✅ 配置参数类型验证

#### `src/core/health-check.js` - 健康检查服务
- ✅ Node.js版本验证
- ✅ 核心模块验证 (os, fs)
- ✅ 构造函数参数验证
- ✅ 配置参数范围验证

#### `src/core/template-engine.js` - 模板引擎
- ✅ Node.js版本验证
- ✅ 核心模块验证 (fs, path)
- ✅ 外部依赖验证 (handlebars)
- ✅ 构造函数参数验证

#### `src/core/i18n-manager.js` - 国际化管理器
- ✅ Node.js版本验证
- ✅ 核心模块验证 (fs, path, events)
- ✅ 构造函数参数验证
- ✅ 配置参数类型验证

## 🧪 验证机制

### 启动时验证
```bash
npm start
# 如果缺少环境变量，会立即退出并显示错误
```

### 测试快速失败机制

#### 测试级别快速失败配置

本项目实现了严格的测试快速失败机制，参考GitHub社区最佳实践，确保在CI/CD流水线中快速发现问题并反馈。

##### 配置架构

```javascript
// test-fail-fast.config.js - 集中配置管理
module.exports = {
  // 不同测试类型的快速失败策略
  strategies: {
    unit: { bail: true, description: '单元测试在第一个失败时立即停止' },
    integration: { bail: process.env.CI === 'true' ? 1 : 3 },
    e2e: { bail: process.env.CI === 'true' ? 1 : 5 },
    performance: { bail: false }, // 性能测试不禁用快速失败
    accessibility: { bail: false }, // 可访问性测试不禁用快速失败
    visual: { bail: false }, // 视觉回归测试不禁用快速失败
  }
};
```

##### Jest配置

```javascript
// jest.config.js
const failFastConfig = require('./test-fail-fast.config');

module.exports = {
  // 根据测试类型应用相应的快速失败策略
  ...failFastConfig.getConfig(process.env.TEST_TYPE || 'unit'),
  // ... 其他配置
};
```

##### Playwright配置

```javascript
// playwright.config.js
const failFastConfig = require('./test-fail-fast.config');

module.exports = defineConfig({
  // 根据测试类型应用相应的快速失败策略
  bail: failFastConfig.getConfig(process.env.TEST_TYPE || 'e2e').bail,
  // ... 其他配置
});
```

#### 测试脚本配置

所有测试脚本都设置了相应的`TEST_TYPE`环境变量：

```json
{
  "scripts": {
    "test": "cross-env TEST_TYPE=unit jest",
    "test:unit": "cross-env TEST_TYPE=unit jest --testPathPattern=\"src/test/unit\"",
    "test:integration": "cross-env TEST_TYPE=integration jest --testPathPattern=\"src/test/integration\"",
    "test:e2e": "cross-env TEST_TYPE=e2e jest --testPathPattern=\"src/test/e2e\"",
    "test:performance": "cross-env TEST_TYPE=performance jest --testPathPattern=\"src/test/performance\"",
    "test:visual": "cross-env TEST_TYPE=visual jest --testPathPattern=\"src/test/visual\"",
    "test:accessibility": "cross-env TEST_TYPE=accessibility jest --testPathPattern=\"src/test/accessibility\""
  }
}
```

#### 环境变量控制

| 环境变量 | 描述 | 默认值 |
|---------|------|--------|
| `CI` | 在CI环境中强制启用严格快速失败 | `false` |
| `TEST_TYPE` | 指定测试类型以应用相应策略 | `unit` |
| `JEST_BAIL` | 控制Jest快速失败，设为`false`可禁用 | `true` (CI) / `false` (本地) |
| `PLAYWRIGHT_BAIL` | 控制Playwright失败次数阈值 | `1` (CI) / `0` (本地) |

#### CI/CD集成

在GitHub Actions等CI环境中：

```yaml
- name: Run Unit Tests
  run: npm run test:ci  # TEST_TYPE=unit, CI=true, 立即失败

- name: Run Integration Tests
  run: npm run test:integration  # TEST_TYPE=integration, CI=true, 允许1个失败

- name: Run E2E Tests
  run: npm run test:e2e  # TEST_TYPE=e2e, CI=true, 立即失败
```

### 单元测试验证
```javascript
describe('快速失败测试', () => {
  test('应该在无效参数时立即失败', () => {
    expect(() => new CacheManager(null)).toThrow('选项必须是有效的对象');
  });

  test('应该在无效配置时立即失败', () => {
    expect(() => new CacheManager({ defaultTTL: -1 })).toThrow('defaultTTL必须是正数');
  });
});
```

## 🚨 错误处理模式

### 错误消息格式
```
❌ [组件名称] 错误描述
详细信息...
```

### 错误代码
- `MODULE_NOT_FOUND`: 模块加载失败
- `INVALID_CONFIG`: 配置参数无效
- `MISSING_DEPENDENCY`: 缺少必需依赖
- `VERSION_TOO_LOW`: 版本不符合要求

## 📊 监控和告警

### 启动失败告警
系统启动失败时会：
1. 输出清晰的错误信息到控制台
2. 使用`process.exit(1)`立即终止进程
3. 提供解决建议

### 运行时失败告警
运行时检测到问题时会：
1. 记录详细的错误日志
2. 抛出带有上下文信息的异常
3. 避免继续执行可能导致更大问题的代码

## 🔒 安全考虑

### 敏感信息保护
- 不在错误消息中暴露敏感配置
- 使用占位符隐藏API密钥等信息
- 验证输入以防止注入攻击

### 资源清理
- 确保在失败时正确清理资源
- 避免资源泄漏
- 提供优雅的关闭机制

## 📈 性能影响

### 最小开销
- 验证代码只在启动和初始化时执行
- 运行时验证使用轻量级检查
- 缓存验证结果以提高性能

### 基准测试
```javascript
// 验证性能影响
console.time('快速失败验证');
const manager = new CacheManager({ maxMemorySize: 100 * 1024 * 1024 });
console.timeEnd('快速失败验证');
// 预期: < 10ms
```

## 🎯 最佳实践

### 开发时的快速失败
1. **及早验证**: 在函数开始处验证所有输入
2. **清晰错误**: 提供具体的错误信息和解决建议
3. **安全默认**: 使用安全的默认值
4. **测试覆盖**: 为所有验证逻辑编写测试

### 生产环境的快速失败
1. **监控告警**: 设置启动失败的告警
2. **日志记录**: 详细记录失败原因和上下文
3. **自动恢复**: 实现自动重启机制
4. **降级策略**: 提供服务降级方案

## 🔄 持续改进

### 定期审查
- 定期审查和更新验证逻辑
- 添加新的验证场景
- 优化性能影响

### 社区贡献
- 欢迎提交改进快速失败机制的PR
- 报告新的验证场景
- 分享最佳实践经验

---

**实施日期**: 2024年11月9日
**状态**: ✅ 已完成核心模块实施 + ✅ 已完成测试快速失败机制实施
**覆盖范围**:
- 6个核心模块的快速失败机制
- Jest测试框架的快速失败配置
- Playwright端到端测试的快速失败配置
- 7种测试类型的差异化策略
**验证状态**: ✅ 通过语法检查和启动测试 + ✅ 通过测试快速失败验证
**测试覆盖**: ✅ 所有测试脚本均配置TEST_TYPE环境变量
