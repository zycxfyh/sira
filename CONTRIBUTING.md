# 🤝 贡献指南

欢迎来到 **Sira AI Gateway** 贡献者社区！我们非常感谢您对项目的兴趣和贡献。

## 📋 目录

- [行为准则](#行为准则)
- [开始贡献](#开始贡献)
- [开发环境设置](#开发环境设置)
- [贡献类型](#贡献类型)
- [提交规范](#提交规范)
- [测试要求](#测试要求)
- [文档要求](#文档要求)
- [审查流程](#审查流程)

## 🎯 行为准则

我们致力于维护一个开放、包容和尊重的社区。请遵循以下行为准则：

### ✅ 鼓励的行为
- 友好的沟通和建设性的反馈
- 尊重不同的观点和经验水平
- 专注于解决问题而不是批评人
- 主动帮助新贡献者

### ❌ 禁止的行为
- 侮辱性、歧视性或贬低性的言论
- 故意发布误导信息
- 侵犯隐私或泄露个人信息
- 其他违反社区规范的行为

## 🚀 开始贡献

### 1. 选择任务
查看 [GitHub Issues](https://github.com/your-repo/sira-ai-gateway/issues) 寻找适合的任务：

- **🐛 Good First Issue**: 适合新贡献者的简单任务
- **✨ Feature Request**: 新功能需求
- **🐛 Bug Report**: 缺陷修复
- **📚 Documentation**: 文档改进

### 2. Fork 项目
```bash
# Fork 项目到你的 GitHub 账户
# 然后克隆到本地
git clone https://github.com/YOUR_USERNAME/sira-ai-gateway.git
cd sira-ai-gateway
```

### 3. 创建特性分支
```bash
# 创建特性分支
git checkout -b feature/amazing-feature

# 或者修复分支
git checkout -b fix/bug-description
```

## 🛠️ 开发环境设置

### 系统要求
- **Node.js**: 18.0.0 或更高版本
- **npm**: 8.0.0 或更高版本
- **Git**: 2.30.0 或更高版本

### 安装依赖
```bash
# 安装项目依赖
npm install

# 安装开发依赖（如需要）
npm install --save-dev <package-name>
```

### 环境配置
```bash
# 复制环境配置文件
cp .env.example .env

# 编辑配置文件
nano .env
```

### 启动开发服务器
```bash
# 启动开发服务器
npm run start:dev

# 或者使用热重载
npm run dev
```

## 📝 贡献类型

### 🐛 Bug 修复
1. 在 Issues 中报告问题或找到现有问题
2. 编写测试用例重现问题
3. 修复问题
4. 确保所有测试通过

### ✨ 新功能
1. 在 Discussions 中提出功能想法
2. 创建详细的功能需求文档
3. 实现功能并编写测试
4. 更新相关文档

### 📚 文档改进
1. 识别文档问题或缺失内容
2. 更新或创建相关文档
3. 确保文档清晰易懂

### 🧪 测试改进
1. 识别测试覆盖不足的代码
2. 编写新的测试用例
3. 改进现有测试

## 📝 提交规范

我们使用 [Conventional Commits](https://conventionalcommits.org/) 规范：

### 格式
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### 类型
- **feat**: 新功能
- **fix**: 缺陷修复
- **docs**: 文档更新
- **style**: 代码风格调整
- **refactor**: 代码重构
- **test**: 测试相关
- **chore**: 构建过程或工具配置

### 示例
```bash
# 新功能
git commit -m "feat: add AI model routing based on complexity"

# 缺陷修复
git commit -m "fix: resolve memory leak in cache manager"

# 文档更新
git commit -m "docs: update API documentation for v2.1.0"
```

## 🧪 测试要求

### 运行测试
```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行端到端测试
npm run test:e2e

# 运行性能测试
npm run test:performance
```

### 测试覆盖率
- 新代码需要有相应的测试
- 总体测试覆盖率应保持在 90% 以上
- 核心功能测试覆盖率应达到 95%+

### 性能测试
- 性能相关更改需要运行性能测试
- 确保不会引入性能回归
- 记录性能测试结果

## 📚 文档要求

### 代码文档
```javascript
/**
 * 函数描述
 * @param {类型} 参数名 - 参数描述
 * @returns {类型} 返回值描述
 */
function exampleFunction(param) {
  // 函数实现
}
```

### API 文档
- 使用 JSDoc 注释公共 API
- 更新 README.md 中的使用示例
- 更新 CHANGELOG.md

### 用户文档
- 更新 README.md
- 创建使用指南和教程
- 提供代码示例

## 🔍 审查流程

### 1. 创建 Pull Request
```bash
# 推送你的分支
git push origin feature/amazing-feature

# 在 GitHub 上创建 Pull Request
```

### 2. PR 要求
- [ ] 清晰的标题和描述
- [ ] 关联相关 Issues
- [ ] 通过所有 CI 检查
- [ ] 代码审查通过
- [ ] 文档更新完成

### 3. 代码审查
PR 将由维护者审查，包括：
- 代码质量和风格
- 测试覆盖率
- 性能影响
- 文档完整性
- 向后兼容性

### 4. 合并
一旦审查通过，PR 将被合并到主分支。

## 🐛 报告问题

### Bug 报告
请使用 [GitHub Issues](https://github.com/your-repo/sira-ai-gateway/issues) 报告问题。

**好的 Bug 报告包含：**
- 清晰的标题
- 重现步骤
- 期望行为 vs 实际行为
- 环境信息（OS、Node.js 版本等）
- 相关日志或错误信息

### 功能请求
请使用 [GitHub Discussions](https://github.com/your-repo/sira-ai-gateway/discussions) 提出功能请求。

## 💬 沟通渠道

- **GitHub Issues**: 报告问题和缺陷
- **GitHub Discussions**: 功能讨论和技术问题
- **Discord**: 实时聊天和社区交流
- **邮件**: dev@sira-ai-gateway.com

## 📄 许可证

通过贡献代码，您同意您的贡献将根据项目的 Apache 2.0 许可证进行许可。

## 🙏 致谢

感谢所有贡献者让这个项目变得更好！

---

**Sira AI Gateway** - 连接AI时代的智能桥梁 🚀