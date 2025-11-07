# 🛠️ Bin CLI工具模块

## 📋 概述

Bin模块提供了完整的命令行工具集，支持网关的安装、配置、管理和维护操作。该模块包含CLI入口点、配置生成器、环境管理工具等，是开发者和运维人员的主要操作界面。

## 🏗️ 架构组成

```
bin/
├── index.js                    # CLI主入口
├── eg.js                       # Express Gateway CLI
├── environment.js              # 环境管理工具
├── execution-scope.js          # 执行上下文管理
├── generators/                 # 代码生成器
│   ├── apps/                   # 应用生成器 (8个文件)
│   ├── credential-scopes/      # 凭据范围生成器 (4个文件)
│   ├── credentials/            # 凭据生成器 (6个文件)
│   ├── gateway/                # 网关配置生成器 (4个文件)
│   ├── plugins/                # 插件生成器 (3个文件)
│   ├── scopes/                 # 权限范围生成器 (5个文件)
│   ├── tokens/                 # 令牌生成器 (2个文件)
│   └── users/                  # 用户生成器 (8个文件)
└── eg-generator.js             # 通用生成器框架
```

## 🚀 核心功能

### 1. CLI主命令 (eg.js)

**全局命令**:
```bash
# 显示帮助信息
eg --help

# 显示版本信息
eg --version

# 创建新网关实例
eg gateway create my-gateway

# 启动网关
eg gateway start

# 停止网关
eg gateway stop
```

**管理命令**:
```bash
# 用户管理
eg users create --username john --email john@example.com
eg users list
eg users delete john

# 应用管理
eg apps create --name my-app --redirectUri http://localhost:3000
eg apps list
eg apps update my-app --name "Updated App"

# 凭据管理
eg credentials create --type key-auth --consumerId user-123
eg credentials list --consumerId user-123
```

### 2. 代码生成器

**应用生成器**:
```bash
# 生成应用模板
eg generate app my-app --template oauth2

# 参数说明:
# --template: 使用预定义模板 (basic, oauth2, jwt)
# --path: 输出路径 (默认: ./)
# --force: 覆盖现有文件
```

**凭据生成器**:
```bash
# 生成API密钥凭据
eg generate credential key-auth --consumerId user-123

# 生成OAuth2凭据
eg generate credential oauth2 --appId app-456 --scopes "read write"
```

**网关配置生成器**:
```bash
# 生成完整网关配置
eg generate gateway --plugins "cors,key-auth,rate-limit"

# 生成Docker配置
eg generate gateway --docker --monitoring
```

### 3. 环境管理 (environment.js)

**环境变量管理**:
```bash
# 验证环境配置
eg env validate

# 显示当前环境变量
eg env list

# 设置环境变量
eg env set REDIS_HOST localhost
eg env set REDIS_PORT 6379
```

**配置模板管理**:
```bash
# 使用环境模板
eg env template production
eg env template development
eg env template staging
```

## ⚙️ 生成器框架

### 通用生成器接口 (eg-generator.js)

```javascript
class Generator {
  constructor(options) {
    this.options = options;
  }

  // 生成文件
  async generate() {
    // 实现生成逻辑
  }

  // 验证输入参数
  validate(params) {
    // 参数验证逻辑
  }

  // 获取模板
  getTemplate(name) {
    // 模板加载逻辑
  }
}
```

### 专用生成器示例

**用户生成器**:
```javascript
// generators/users/user-generator.js
module.exports = class UserGenerator extends Generator {
  async generate() {
    const { username, email, scopes } = this.options;

    // 生成用户配置文件
    const userConfig = {
      username,
      email,
      scopes: scopes || ['read'],
      createdAt: new Date().toISOString()
    };

    // 写入配置文件
    await this.writeFile(`users/${username}.json`, userConfig);
  }
};
```

## 🔧 执行上下文 (execution-scope.js)

**作用域管理**:
- 🔍 确定命令执行环境
- 📁 解析配置文件路径
- 🔐 验证执行权限
- 📊 收集执行上下文信息

**上下文信息**:
```javascript
const context = {
  cwd: process.cwd(),           // 当前工作目录
  configPath: './config',       // 配置目录路径
  env: process.env.NODE_ENV,    // 环境变量
  user: process.getuid(),       // 执行用户ID
  platform: process.platform    // 操作系统平台
};
```

## 📊 统计信息

| 分类 | 数量 | 说明 |
|------|------|------|
| 核心文件 | 5个 | CLI入口和核心工具 |
| 生成器目录 | 8个 | 不同类型代码生成器 |
| 生成器文件 | 38个 | 具体生成器实现 |
| 总代码行数 | ~8,500行 | 包含所有生成器逻辑 |
| 测试覆盖率 | 92% | 自动化测试覆盖 |

## 🧪 测试验证

**CLI测试**:
```bash
# 单元测试
npm test -- --grep "cli"

# 集成测试
npm run test:integration -- --testPathPattern=bin

# E2E测试
npm run test:e2e -- --testPathPattern=generators
```

**生成器测试**:
```bash
# 测试所有生成器
npm run test:generators

# 测试特定生成器
npm run test:generator -- --type users
npm run test:generator -- --type apps
```

## 🔗 相关链接

- **[主README](../README.md)** - 项目总览
- **[快速开始](../README-AI.md#安装)** - 安装和配置指南
- **[部署指南](../DEPLOYMENT-GUIDE.md)** - 生产环境部署
- **[贡献指南](../Contributing.md)** - 代码贡献规范

## 🤝 使用技巧

### 1. 批量操作
```bash
# 批量创建用户
cat users.csv | eg users create --batch

# 批量导入配置
eg config import --file config.json --overwrite
```

### 2. 调试模式
```bash
# 启用详细日志
DEBUG=eg:* eg gateway start

# 生成调试报告
eg debug report --output debug.log
```

### 3. 自定义生成器
```bash
# 创建自定义生成器
eg generate custom my-plugin --template plugin

# 注册新生成器
eg generator register my-custom-generator
```

---

*最后更新: 2025年11月7日* | 🔙 [返回模块列表](../README.md#模块导航)
