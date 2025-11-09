# 🚀 Sira AI Gateway 快速开始指南

## 5分钟内完成AI网关搭建

### 步骤1: 克隆项目

```bash
git clone <repository-url>
cd sira-ai-gateway
```

### 步骤2: 安装依赖

```bash
npm install
```

### 步骤3: 运行配置向导

```bash
node scripts/setup-config.js
```

按照提示配置你的AI提供商和安全设置。

### 步骤4: 启动网关

```bash
npm start
```

### 步骤5: 测试网关

```bash
# 测试健康检查
curl http://localhost:9090/health

# 测试AI请求 (替换 YOUR_API_KEY 为你的密钥)
curl -X POST http://localhost:9090/api/v1/ai/chat/completions \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "你好，测试一下AI网关"
      }
    ],
    "model": "auto"
  }'
```

### 步骤6: 访问管理界面

打开浏览器访问: http://localhost:9999

---

## 🎯 配置选项

### 必需配置

- **AI提供商**: 至少配置一个AI提供商 (OpenAI, Anthropic, 或 Azure OpenAI)
- **API密钥**: 用于网关认证的安全密钥

### 可选配置

- **Redis缓存**: 提高性能和降低成本
- **监控**: Sentry错误追踪
- **数据库**: PostgreSQL用于高级功能

---

## 🔧 手动配置 (可选)

如果你不想使用配置向导，可以手动创建 `.env` 文件：

```bash
cp env.template .env
# 编辑 .env 文件，填入你的配置
```

---

## 📚 更多信息

- [完整文档](./docs/README.md)
- [API文档](./docs/api/README.md)
- [部署指南](./docs/deployment/README.md)

---

## 🆘 遇到问题？

1. 检查端口是否被占用
2. 确认AI提供商配置正确
3. 查看日志文件: `tail -f logs/gateway.log`
4. 查看故障排除指南: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
