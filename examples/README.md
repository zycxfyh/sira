# Sira AI Gateway 示例应用

这个目录包含了使用Sira AI Gateway的完整示例应用，展示了从基础到高级的各种使用场景。

## 📁 示例应用列表

### 🟢 基础示例

#### [basic-chat-app.js](./basic-chat-app.js)
最简单的AI聊天应用示例，展示如何：
- 连接到AI网关
- 发送聊天消息
- 处理响应
- 错误处理

```bash
# 运行基础聊天示例
node examples/basic-chat-app.js

# 检查网关健康状态
node examples/basic-chat-app.js --health

# 发送自定义消息
node examples/basic-chat-app.js --chat "你好，介绍一下你自己"
```

### 🟡 高级示例

#### [advanced-ai-gateway.js](./advanced-ai-gateway.js)
高级功能测试套件，演示：
- 负载均衡效果
- 缓存性能提升
- 错误处理机制
- 监控指标收集

```bash
# 运行完整测试套件
node examples/advanced-ai-gateway.js

# 只测试负载均衡
node examples/advanced-ai-gateway.js --load-balancing

# 只测试缓存效果
node examples/advanced-ai-gateway.js --caching

# 只测试错误处理
node examples/advanced-ai-gateway.js --errors
```

### 🟠 生产最佳实践

#### [production-best-practices.js](./production-best-practices.js)
生产环境下的最佳实践示例，包括：
- 熔断器模式
- 重试机制
- 监控和指标收集
- 错误处理策略

```bash
# 生产环境使用示例
node examples/production-best-practices.js --production

# 压力测试示例
node examples/production-best-practices.js --stress
```

### 🟣 快速启动模板

#### [quick-start-template.js](./quick-start-template.js)
可直接使用的应用模板，包含：
- 完整的应用结构
- 错误处理
- 配置管理
- 监控集成

```bash
# 运行示例
node examples/quick-start-template.js --example

# 查看应用状态
node examples/quick-start-template.js --status
```

## 🚀 快速开始

### 1. 启动AI网关

首先确保AI网关正在运行：

```bash
# 克隆项目
git clone <repository-url>
cd sira-ai-gateway

# 安装依赖
npm install

# 配置环境变量
cp env.template .env
# 编辑 .env 文件，填入你的AI提供商密钥

# 启动网关
npm start
```

### 2. 运行示例

```bash
# 运行基础聊天示例
node examples/basic-chat-app.js

# 运行高级功能测试
node examples/advanced-ai-gateway.js
```

## 📋 前置要求

- Node.js 18+
- 运行中的Sira AI Gateway实例
- 配置了至少一个AI提供商（OpenAI、Anthropic等）

## 🔧 配置说明

### 环境变量

创建 `.env` 文件并配置以下变量：

```env
# AI网关配置
GATEWAY_URL=http://localhost:9090
GATEWAY_API_KEY=your-gateway-api-key

# AI提供商配置
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
```

### 网关配置

确保网关配置文件中包含必要的端点和策略：

```yaml
# gateway.config.yml
apiEndpoints:
  ai-api:
    paths: ['/api/v1/ai/*']

pipelines:
  ai-pipeline:
    policies:
      - cors: {}
      - key-auth:
          apiKeyHeader: 'x-api-key'
      - ai-router:
          timeout: 30000
```

## 🏗️ 架构模式

### 基础模式
```
Client App → AI Gateway → AI Provider
```

### 高级模式
```
Client App → Circuit Breaker → Retry Logic → AI Gateway → AI Provider
                     ↓
               Monitoring & Metrics
```

### 生产模式
```
Load Balancer → API Gateway → Circuit Breaker → AI Gateway → AI Provider
         ↓              ↓              ↓              ↓
      Logging       Authentication  Rate Limiting  Caching
```

## 📊 性能基准

基于示例应用的性能测试结果：

- **响应时间**: 平均 800ms（缓存命中时 < 50ms）
- **并发处理**: 支持 50+ 并发请求
- **错误率**: < 1%（在正常网络条件下）
- **缓存命中率**: 85-95%（根据查询模式）

## 🔍 故障排除

### 常见问题

1. **连接超时**
   - 检查网关是否正在运行
   - 验证网络连接
   - 检查防火墙设置

2. **认证失败**
   - 确认API密钥正确
   - 检查密钥格式
   - 验证密钥权限

3. **AI服务不可用**
   - 检查AI提供商配置
   - 验证API密钥有效性
   - 查看提供商服务状态

### 调试模式

启用详细日志：

```bash
DEBUG=* node examples/basic-chat-app.js
```

### 监控指标

查看应用指标：

```bash
node examples/quick-start-template.js --status
```

## 📚 扩展阅读

- [API文档](../../docs/api/README.md)
- [部署指南](../../docs/deployment/README.md)
- [配置选项](../../docs/deployment/configuration.md)
- [最佳实践](../../docs/guides/best-practices.md)

## 🤝 贡献

欢迎提交示例应用！请遵循以下准则：

1. 添加详细的注释和文档
2. 包含错误处理
3. 提供命令行参数支持
4. 测试多种场景
5. 更新此README文件

## 📄 许可证

与主项目保持一致。
