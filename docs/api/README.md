# 🔧 Sira AI Gateway API Documentation

## 🌐 多语言API文档

Sira AI Gateway 提供完整的多语言API文档支持。请选择您偏好的语言查看详细的API文档：

### 📚 可用语言版本

| 语言 | 文档链接 | 状态 |
|------|----------|------|
| 🇨🇳 **中文 (简体)** | [API-DOCS-zh-CN.md](./API-DOCS-zh-CN.md) | ✅ 完整 |
| 🇺🇸 **English** | [API-DOCS-en-US.md](./API-DOCS-en-US.md) | ✅ 完整 |
| 🇯🇵 **日本語** | [API-DOCS-ja-JP.md](./API-DOCS-ja-JP.md) | ✅ 完整 |
| 🇰🇷 **한국어** | [API-DOCS-ko-KR.md](./API-DOCS-ko-KR.md) | ✅ 完整 |
| 🇩🇪 **Deutsch** | [API-DOCS-de-DE.md](./API-DOCS-de-DE.md) | ✅ 完整 |

## 🚀 快速开始

### 1. 启动服务
```bash
# 克隆项目
git clone https://github.com/your-repo/sira-ai-gateway.git
cd sira-ai-gateway

# 安装依赖
npm install

# 启动服务
npm start
```

### 2. 获取API密钥
访问管理面板获取您的API密钥：
- 本地开发: http://localhost:8080/admin
- 生产环境: https://your-domain.com/admin

### 3. 发送第一个请求
```bash
curl -X POST http://localhost:8080/api/v1/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your_api_key" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "Hello, World!"}
    ]
  }'
```

## 📖 API 概述

### 核心功能
- **🤖 AI Chat Completions**: 支持多种AI模型的对话完成
- **🎯 智能路由**: 基于性能和成本的自动模型选择
- **💾 多层缓存**: L1/L2/L3缓存提升响应速度
- **📊 实时监控**: 系统状态和业务指标监控
- **🌐 国际化**: 多语言API响应支持

### 支持的AI提供商
- OpenAI (GPT-3.5, GPT-4)
- Anthropic (Claude)
- Google (Gemini)
- DeepSeek
- 更多提供商持续添加中...

## 🛠️ 开发工具

### API文档生成
```bash
# 生成所有语言的API文档
npm run docs:api

# 生成特定语言的API文档
npm run docs:api:lang zh-CN
```

### API测试工具
- **Postman**: 导入 [Sira API Collection](./postman/Sira-API.postman_collection.json)
- **Insomnia**: 使用提供的 [Insomnia Workspace](./insomnia/Sira-API-Workspace.json)
- **cURL**: 参考各语言文档中的示例

## 🔧 客户端SDK

### 官方SDK
- **JavaScript/TypeScript**: [sira-js-sdk](https://github.com/your-repo/sira-js-sdk)
- **Python**: [sira-python-sdk](https://github.com/your-repo/sira-python-sdk)
- **Java**: [sira-java-sdk](https://github.com/your-repo/sira-java-sdk)

### 社区SDK
- **Go**: [sira-go-client](https://github.com/community/sira-go-client)
- **PHP**: [sira-php-sdk](https://github.com/community/sira-php-sdk)
- **.NET**: [sira-dotnet-sdk](https://github.com/community/sira-dotnet-sdk)

## 📊 性能指标

| 指标 | 目标值 | 当前状态 |
|------|--------|----------|
| 响应时间 (P95) | < 500ms | ✅ 符合 |
| 并发处理能力 | > 10,000 RPS | ✅ 符合 |
| 可用性 | > 99.9% | ✅ 符合 |
| 缓存命中率 | > 85% | ✅ 符合 |

## 🆘 故障排除

### 常见问题

#### 认证错误
**问题**: \`401 Unauthorized\`
**解决**: 检查API密钥是否正确设置在请求头中

#### 限流错误
**问题**: \`429 Rate Limited\`
**解决**: 降低请求频率或升级服务等级

#### 服务不可用
**问题**: \`503 Service Unavailable\`
**解决**: 检查服务状态，稍后重试

### 获取帮助
- 📧 **邮件支持**: dev@sira-ai-gateway.com
- 💬 **社区论坛**: [GitHub Discussions](https://github.com/your-repo/sira-ai-gateway/discussions)
- 📖 **故障排除指南**: [TROUBLESHOOTING.md](../../TROUBLESHOOTING.md)

## 🔄 更新日志

查看最新的API变更和功能更新：
- [CHANGELOG.md](../../CHANGELOG.md)
- [GitHub Releases](https://github.com/your-repo/sira-ai-gateway/releases)

## 🤝 贡献

欢迎为API文档做出贡献！

### 改进文档
1. Fork 本项目
2. 创建特性分支: \`git checkout -b improve-api-docs\`
3. 提交更改: \`git commit -m 'Improve API documentation'\`
4. 推送分支: \`git push origin improve-api-docs\`
5. 创建 Pull Request

### 添加新语言支持
1. 在 \`scripts/generate-api-docs.js\` 中添加翻译
2. 运行 \`npm run docs:api\` 生成新文档
3. 提交更改并创建 Pull Request

---

**Sira AI Gateway** - 连接AI时代的桥梁 🚀

*让AI集成变得简单、高效、经济*
