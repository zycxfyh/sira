# 贡献指南

感谢您对 Sira AI Gateway 项目的兴趣！我们欢迎任何形式的贡献，包括但不限于：

- 🐛 报告 Bug
- 💡 提出新功能建议
- 📝 改进文档
- 🔧 提交代码修复
- 🧪 编写测试

## 🚀 快速开始

### 环境要求

- Node.js 18.0.0 或更高版本
- npm 或 pnpm
- Git

### 本地开发设置

1. **克隆仓库**
   ```bash
   git clone https://github.com/your-username/sira-ai-gateway.git
   cd sira-ai-gateway
   ```

2. **安装依赖**
   ```bash
   npm install
   # 或使用 pnpm
   pnpm install
   ```

3. **环境配置**
   ```bash
   cp env.template .env
   # 编辑 .env 文件，配置 API 密钥
   ```

4. **启动开发服务器**
   ```bash
   npm run start:dev
   ```

5. **运行测试**
   ```bash
   npm test
   ```

## 🐛 报告 Bug

当您发现 Bug 时，请：

1. 检查 [Issues](../../issues) 页面，确认是否已被报告
2. 如果没有，请创建一个新的 Issue
3. 提供详细的复现步骤
4. 包含环境信息（Node.js 版本、操作系统等）

### Bug 报告模板

```markdown
## Bug 描述

[清晰简洁地描述问题]

## 复现步骤

1. 执行 '...'
2. 点击 '...'
3. 出现错误

## 期望行为

[描述期望的结果]

## 实际行为

[描述实际发生的情况]

## 环境信息

- OS: [e.g., Windows 10]
- Node.js: [e.g., 18.17.0]
- 浏览器: [e.g., Chrome 119]

## 附加信息

[任何其他相关信息]
```

## 💡 功能请求

我们欢迎新功能建议！请：

1. 检查现有功能和路线图
2. 创建 [Feature Request](../../issues/new?template=feature_request.md) Issue
3. 详细描述功能需求
4. 说明为什么这个功能对项目有益

## 🔧 代码贡献

### 开发工作流

1. **创建分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或
   git checkout -b fix/issue-number
   ```

2. **编写代码**
   - 遵循现有的代码风格
   - 添加必要的测试
   - 更新文档

3. **代码质量检查**
   ```bash
   # 运行 ESLint
   npm run lint

   # 运行测试
   npm test

   # 格式化代码
   npm run format
   ```

4. **提交代码**
   ```bash
   git add .
   git commit -m "feat: add new feature

   - Add detailed description
   - Mention related issues
   - Explain breaking changes"
   ```

5. **推送分支**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **创建 Pull Request**
   - 提供清晰的 PR 描述
   - 关联相关 Issue
   - 请求审查

### 代码风格

我们使用以下工具确保代码质量：

- **ESLint**: JavaScript 代码检查
- **Prettier**: 代码格式化
- **Biome**: 快速代码检查和格式化
- **Jest**: 单元测试和集成测试

### 提交信息规范

我们遵循 [Conventional Commits](https://conventionalcommits.org/) 规范：

```
type(scope): description

[optional body]

[optional footer]
```

类型包括：
- `feat`: 新功能
- `fix`: 修复 Bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或工具配置

## 🧪 测试

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- src/test/server.test.js

# 运行带覆盖率的测试
npm run test:coverage

# 监听模式运行测试
npm run test:watch
```

### 编写测试

- 使用 Jest 作为测试框架
- 测试文件放在 `src/test/` 目录
- 测试文件名格式：`*.test.js` 或 `*.spec.js`
- 使用 `describe` 和 `it` 组织测试
- 遵循 AAA 模式（Arrange, Act, Assert）

```javascript
describe('Server', () => {
  it('should respond to health check', async () => {
    // Arrange
    const expected = { status: 'healthy' };

    // Act
    const response = await request(app).get('/health');

    // Assert
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject(expected);
  });
});
```

## 📚 文档

### 更新文档

- README.md: 项目主要说明
- API.md: API 接口文档
- CONTRIBUTING.md: 本文件
- docs/: 详细文档

### 文档标准

- 使用 Markdown 格式
- 提供代码示例
- 包含使用说明
- 及时更新

## 🤝 行为准则

### 我们的承诺

我们致力于为所有人提供一个无骚扰的环境，无论年龄、体型、残疾、民族、性别认同和表达、经验水平、国籍、个人外貌、种族、宗教或性取向。

### 标准

有助于创造积极环境的行为包括：

- 使用友好的语言
- 尊重不同观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

不可接受的行为包括：

- 使用性暗示语言或图像
- 侮辱性评论
- 公开或私下骚扰
- 未经明确许可发布他人私人信息
- 其他不道德或不专业行为

### 责任

项目维护者有责任澄清行为标准，并对任何不可接受行为采取适当和公平的纠正措施。

## 📞 联系方式

- 📧 Email: your-email@example.com
- 💬 Discord: [加入我们的 Discord](https://discord.gg/example)
- 🐛 Issues: [GitHub Issues](../../issues)

感谢您的贡献！🎉