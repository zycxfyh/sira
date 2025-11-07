# 🤝 贡献指南

感谢您对 API 中转站项目的兴趣！我们欢迎各种形式的贡献，无论是代码、文档、测试还是建议。

## 📋 目录

- [快速开始](#快速开始)
- [贡献类型](#贡献类型)
- [开发流程](#开发流程)
- [代码规范](#代码规范)
- [测试要求](#测试要求)
- [提交规范](#提交规范)
- [问题报告](#问题报告)
- [文档贡献](#文档贡献)

---

## 🚀 快速开始

### 1. 环境准备

```bash
# 克隆项目
git clone https://github.com/zycxfyh/sira.git
cd sira

# 安装依赖
npm install

# 设置开发环境
npm run dev:setup

# 启动开发服务
npm run dev:start
```

### 2. 创建特性分支

```bash
# 从主分支创建特性分支
git checkout -b feature/your-feature-name

# 或修复bug
git checkout -b fix/issue-number-description
```

### 3. 开发和测试

```bash
# 运行测试
npm test

# 代码格式化
npm run format

# 代码检查
npm run lint
```

### 4. 提交更改

```bash
# 添加文件
git add .

# 提交 (会自动运行pre-commit检查)
git commit -m "feat: add new feature description"

# 推送
git push origin feature/your-feature-name
```

### 5. 创建Pull Request

在GitHub上创建PR，我们会尽快review！

---

## 📝 贡献类型

### 🐛 Bug修复
- 修复现有bug
- 改进错误处理
- 修复安全漏洞

### ✨ 新功能
- 添加新特性
- 扩展API接口
- 改进用户体验

### 📚 文档改进
- 完善API文档
- 添加使用示例
- 改进README

### 🧪 测试增强
- 添加单元测试
- 集成测试用例
- 性能测试改进

### 🔧 工具和基础设施
- 构建工具改进
- CI/CD优化
- 开发工具增强

---

## 🔄 开发流程

### 1. 选择任务

- 查看 [GitHub Issues](https://github.com/zycxfyh/sira/issues)
- 选择 `good first issue` 标签的任务开始
- 或提出新的功能建议

### 2. 环境设置

```bash
# 基础版本开发
cd api-gateway
npm install
cp env.template .env
# 编辑 .env 添加测试API密钥

# 企业版本开发
cd api-gateway-v2
npm run dev:setup
```

### 3. 本地开发

```bash
# 运行测试
npm test

# 代码检查
npm run lint

# 格式化
npm run format

# 构建检查
npm run build
```

### 4. 提交代码

```bash
# 确保所有检查通过
npm run lint && npm test && npm run build

# 提交
git add .
git commit -m "type(scope): description"

# 推送
git push origin feature/your-branch
```

### 5. Pull Request

- 创建PR时填写模板
- 描述清楚变更内容
- 关联相关issue
- 请求review

---

## 📏 代码规范

### JavaScript/Node.js 规范

```javascript
// ✅ 推荐写法
const express = require('express');
const router = express.Router();

// 异步函数使用async/await
async function getUserData(userId) {
  try {
    const user = await User.findById(userId);
    return user;
  } catch (error) {
    logger.error('Failed to get user data', { userId, error });
    throw error;
  }
}

// 使用ES6+特性
const users = usersData.map(user => ({
  id: user._id,
  name: user.name,
  email: user.email
}));

// ❌ 避免写法
// var, let (优先使用const)
// 回调地狱
// 硬编码字符串
// 缺乏错误处理
```

### API设计规范

```javascript
// RESTful API设计
// GET /api/v2/users - 获取用户列表
// POST /api/v2/users - 创建用户
// GET /api/v2/users/:id - 获取单个用户
// PUT /api/v2/users/:id - 更新用户
// DELETE /api/v2/users/:id - 删除用户

// 响应格式统一
{
  "success": true,
  "data": { /* 数据 */ },
  "message": "操作成功",
  "timestamp": "2024-01-01T00:00:00Z"
}

// 错误响应格式
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "输入参数无效",
  "details": { /* 详细错误信息 */ }
}
```

### 数据库设计规范

```javascript
// Mongoose Schema定义
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Invalid email']
  }
}, {
  timestamps: true
});

// 索引定义
userSchema.index({ email: 1 });
userSchema.index({ createdAt: -1 });
```

---

## 🧪 测试要求

### 单元测试

```javascript
// 使用Jest进行单元测试
describe('Cache Service', () => {
  let cache;

  beforeEach(async () => {
    cache = new CacheService();
    await cache.connect();
  });

  afterEach(async () => {
    await cache.disconnect();
  });

  test('should cache and retrieve values', async () => {
    const key = 'test-key';
    const value = { data: 'test' };

    await cache.set(key, value, 300);
    const retrieved = await cache.get(key);

    expect(retrieved).toEqual(value);
  });

  test('should respect TTL', async () => {
    // 测试TTL过期逻辑
  });
});
```

### 集成测试

```javascript
// API集成测试
const request = require('supertest');
const app = require('../src/app');

describe('API Integration Tests', () => {
  test('should create chat completion', async () => {
    const response = await request(app)
      .post('/api/v2/chat/completions')
      .set('x-api-key', 'test-key')
      .send({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello' }]
      })
      .expect(200);

    expect(response.body).toHaveProperty('choices');
  });
});
```

### 测试覆盖率要求

- **整体覆盖率**: ≥ 80%
- **语句覆盖率**: ≥ 80%
- **分支覆盖率**: ≥ 75%
- **函数覆盖率**: ≥ 85%
- **行覆盖率**: ≥ 80%

### 性能测试

```javascript
// 使用Artillery进行性能测试
{
  "config": {
    "target": "http://localhost:3000",
    "phases": [
      {
        "duration": 60,
        "arrivalRate": 5,
        "name": "Warm-up"
      },
      {
        "duration": 300,
        "arrivalRate": 20,
        "name": "Sustained load"
      }
    ]
  },
  "scenarios": [
    {
      "name": "Chat completion load test",
      "flow": [
        {
          "post": {
            "url": "/api/v2/chat/completions",
            "headers": {
              "x-api-key": "{{ apiKey }}"
            },
            "json": {
              "model": "gpt-3.5-turbo",
              "messages": [
                {
                  "role": "user",
                  "content": "Say hello in 5 words"
                }
              ]
            }
          }
        }
      ]
    }
  ]
}
```

---

## 📝 提交规范

### 提交消息格式

```
type(scope): description

[optional body]

[optional footer]
```

### 类型定义

- **feat**: 新功能
- **fix**: 修复bug
- **docs**: 文档更新
- **style**: 代码格式调整
- **refactor**: 代码重构
- **test**: 测试相关
- **chore**: 构建工具或辅助功能更新

### 示例

```bash
# 功能提交
git commit -m "feat(auth): add JWT token refresh endpoint"

# Bug修复
git commit -m "fix(cache): resolve Redis connection timeout issue

- Add connection retry logic
- Increase timeout to 30 seconds
- Add proper error handling

Fixes #123"

# 文档更新
git commit -m "docs(api): update chat completions endpoint documentation"

# 测试添加
git commit -m "test(cache): add unit tests for cache service TTL logic"
```

### 作用域定义

- **api**: API相关
- **auth**: 认证授权
- **cache**: 缓存系统
- **db**: 数据库
- **docs**: 文档
- **docker**: 容器化
- **test**: 测试
- **ci**: CI/CD

---

## 🐛 问题报告

### Bug报告模板

**标题**: `[BUG] 简洁描述问题`

**环境信息**:
- 版本: v1.0.0 / v2.0.0
- Node.js版本: 18.x
- 操作系统: Windows 10 / Ubuntu 20.04
- 浏览器: Chrome 119 (如果适用)

**问题描述**:
清晰描述问题的现象、预期行为和实际行为。

**重现步骤**:
1. 步骤1
2. 步骤2
3. 步骤3

**错误日志**:
```
粘贴相关错误日志
```

**截图**:
如果适用，添加截图

**其他信息**:
任何有助于诊断的信息

### 功能建议模板

**标题**: `[FEATURE] 功能名称`

**问题背景**:
描述当前存在的问题或限制

**建议方案**:
详细描述建议的解决方案

**替代方案**:
如果有其他可行的方案

**影响评估**:
对现有功能的潜在影响

---

## 📚 文档贡献

### 文档类型

- **README**: 项目介绍和快速开始
- **API文档**: 接口规范和使用示例
- **部署指南**: 各种环境的部署说明
- **故障排除**: 常见问题和解决方案
- **最佳实践**: 使用建议和性能优化

### 文档规范

```markdown
# 标题使用层级结构
## 二级标题
### 三级标题

# 代码块使用语法高亮
```javascript
console.log('Hello, World!');
```

# 链接和引用
[链接文本](URL)
> 引用内容

# 列表和表格
- 项目1
- 项目2

| 列1 | 列2 |
|-----|-----|
| 数据 | 数据 |
```

### 文档更新流程

1. 识别需要更新的文档
2. 创建文档更新分支
3. 更新内容并验证格式
4. 提交PR并请求review
5. 合并后更新相关链接

---

## 🎯 行为准则

### 我们的承诺

我们致力于为所有人提供一个无骚扰的社区环境，不论年龄、体型、残疾、民族、性别认同和表达、经验水平、教育程度、社会经济地位、国籍、个人外貌、种族或宗教。

### 我们的标准

**鼓励的行为**:
- 使用友好和包容性的语言
- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同情

**不可接受的行为**:
- 使用性化语言或图像
- 进行人身攻击或政治攻击
- 公开或私下骚扰
- 发布他人的私人信息
- 其他有理由认为不适当的行为

### 责任和后果

社区维护者有责任澄清和执行可接受行为的标准，并对任何不可接受行为采取适当和公平的纠正措施。

---

## 📞 联系方式

- **GitHub Issues**: [报告问题](https://github.com/zycxfyh/sira/issues)
- **Discussions**: [技术讨论](https://github.com/zycxfyh/sira/discussions)
- **邮箱**: 项目维护者邮箱

---

## 🙏 致谢

感谢您对API中转站项目的贡献！

您的每一份贡献都让这个项目变得更好，帮助更多开发者优化AI应用的成本和性能。

**Happy Contributing! 🎉**
