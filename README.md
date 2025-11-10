# Sira AI Gateway

[![CI](https://github.com/zycxfyh/sira/workflows/CI/badge.svg)](https://github.com/zycxfyh/sira/actions)
[![codecov](https://codecov.io/gh/zycxfyh/sira/branch/main/graph/badge.svg)](https://codecov.io/gh/zycxfyh/sira)
[![npm version](https://badge.fury.io/js/sira-ai-gateway.svg)](https://badge.fury.io/js/sira-ai-gateway)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

> 🚀 企业级AI网关，支持多AI服务商智能路由、负载均衡、监控和性能优化

## ✨ 特性

- 🤖 **多AI服务商支持** - 统一接口调用OpenAI、Anthropic、Google等AI服务
- 🧠 **智能路由** - 基于模型能力、成本和性能的智能请求路由
- ⚡ **高性能** - 多级缓存、连接池和异步处理
- 🛡️ **容错设计** - 熔断器、限流、重试和降级策略
- 📊 **全面监控** - 实时指标收集、告警和性能分析
- 🔧 **易于扩展** - 插件化架构，支持自定义中间件和服务
- 🐳 **容器化** - 开箱即用的Docker支持
- 📚 **国际化** - 多语言支持

## 📦 安装

```bash
# 使用npm
npm install sira-ai-gateway

# 使用yarn
yarn add sira-ai-gateway

# 使用pnpm
pnpm add sira-ai-gateway
```

## 🚀 快速开始

### 基本使用

```javascript
const { SiraApplication } = require('sira-ai-gateway');

const app = new SiraApplication({
  port: 3000,
  // 配置你的AI服务商
  ai: {
    providers: {
      openai: {
        apiKey: 'your-openai-api-key'
      },
      anthropic: {
        apiKey: 'your-anthropic-api-key'
      }
    }
  }
});

app.start().catch(console.error);
```

### Docker部署

```bash
# 构建镜像
docker build -t sira-ai-gateway .

# 运行容器
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=your-key \
  -e ANTHROPIC_API_KEY=your-key \
  sira-ai-gateway
```

### 使用CLI

```bash
# 全局安装CLI
npm install -g sira-ai-gateway

# 启动服务
sira start --port 3000

# 查看状态
sira status

# 停止服务
sira stop
```

## 📖 API文档

### Chat Completions API

```bash
POST /api/v1/chat/completions
Content-Type: application/json

{
  "model": "gpt-3.5-turbo",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ]
}
```

### 响应格式

```json
{
  "id": "chatcmpl-1234567890",
  "object": "chat.completion",
  "created": 1677652288,
  "model": "gpt-3.5-turbo",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! I'm doing well, thank you for asking."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 13,
    "completion_tokens": 20,
    "total_tokens": 33
  }
}
```

## 🏗️ 架构

Sira采用模块化微服务架构：

```
sira-ai-gateway/
├── packages/                 # 核心模块包
│   ├── core/                # 基础服务
│   │   ├── cache/          # 缓存服务
│   │   ├── logger/         # 日志服务
│   │   ├── metrics/        # 指标监控
│   │   ├── events/         # 事件总线
│   │   ├── errors/         # 错误处理
│   │   └── container/      # 服务容器
│   ├── utils/              # 工具函数
│   ├── config-manager/     # 配置管理
│   ├── data-access/        # 数据访问层
│   └── services/           # 业务服务
├── src/                    # 主应用
├── tests/                  # 测试文件
├── docs/                   # 文档
├── tools/                  # 开发工具
└── scripts/                # 构建脚本
```

## 🔧 配置

### 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `NODE_ENV` | 运行环境 | `development` |
| `LOG_LEVEL` | 日志级别 | `info` |
| `REDIS_URL` | Redis连接URL | `redis://localhost:6379` |

### 配置文件

```yaml
# config/gateway.yml
ai:
  providers:
    openai:
      apiKey: "your-openai-api-key"
      models: ["gpt-3.5-turbo", "gpt-4"]
    anthropic:
      apiKey: "your-anthropic-api-key"
      models: ["claude-2"]

routing:
  strategy: "intelligent"
  rules:
    - condition: "cost"
      provider: "openai"
    - condition: "performance"
      provider: "anthropic"

cache:
  enabled: true
  ttl: 300000
  maxSize: 1000

monitoring:
  enabled: true
  metrics: true
  alerts: true
```

## 📊 监控

### 健康检查

```bash
GET /health
```

### 指标收集

```bash
GET /metrics
```

支持Prometheus格式的指标导出。

### 日志

```bash
# 查看应用日志
sira monitor logs --follow

# 查看指标
sira monitor metrics
```

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm run test:packages

# 运行集成测试
npm run test:integration

# 生成覆盖率报告
npm run test:coverage
```

## 📚 开发

### 项目结构

```
├── packages/          # 模块化包
├── src/              # 主应用代码
├── tests/            # 测试文件
├── docs/             # 文档
├── tools/            # 开发工具
├── scripts/          # 构建脚本
└── .github/          # GitHub配置
```

### 开发命令

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run start:dev

# 代码检查
npm run lint

# 格式化代码
npm run format

# 清理缓存
npm run dev:clean

# 重新安装依赖
npm run dev:reinstall

# 生成项目报告
npm run dev:report
```

### 贡献指南

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建Pull Request

## 📄 许可证

本项目采用Apache 2.0许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Express Gateway](https://github.com/ExpressGateway/express-gateway) - 原始框架
- [OpenAI](https://openai.com/) - AI服务支持
- [Anthropic](https://anthropic.com/) - Claude AI支持

## 📞 联系我们

- 项目主页: https://github.com/zycxfyh/sira
- 问题反馈: https://github.com/zycxfyh/sira/issues
- 邮箱: 1666384464@qq.com

---

<p align="center">
  <strong>由Sira AI Team精心打造</strong>
  <br>
  <em>让AI服务更智能、更可靠</em>
</p>