# 🌟 创世星环 (Creation Ring) - 工业级AI叙事游戏平台

**基于微服务架构的AI驱动交互式叙事游戏生成系统**

[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://docker.com)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=flat&logo=nestjs&logoColor=white)](https://nestjs.com)
[![Vue.js](https://img.shields.io/badge/vuejs-%2335495e.svg?style=flat&logo=vuedotjs&logoColor=%234FC08D)](https://vuejs.org)
[![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=flat&logo=redis&logoColor=white)](https://redis.io)
[![PostgreSQL](https://img.shields.io/badge/postgresql-%23316192.svg?style=flat&logo=postgresql&logoColor=white)](https://postgresql.org)
[![Industrial Ready](https://img.shields.io/badge/industrial-ready-brightgreen.svg)](docs/System-Technical-Specification.md)
[![Tested](https://img.shields.io/badge/tested-✅-brightgreen.svg)](industrial-test-results/)

## ✨ 项目特色

- 🏭 **工业级就绪**: 完整的CI/CD、监控、可观测性系统
- 🎭 **AI叙事大师**: GPT-4 Turbo + Claude-3 + DeepSeek多模型组合
- ⚡ **实时交互**: <100ms延迟的沉浸式WebSocket体验
- 🏗️ **微服务架构**: 5个独立服务，快速失败机制保护
- 🔧 **智能路由**: 动态AI模型调度，自动选择最优模型
- 📈 **高并发**: 支持1000+并发用户，99.9%可用性
- 🧪 **测试验证**: 工业级自动化测试套件，完全覆盖

## 🚀 快速开始

### 环境要求

- Docker & Docker Compose
- Node.js 18+ (开发环境)
- pnpm (推荐)

### 一键启动

```bash
# 克隆项目
git clone <repository-url>
cd creations-ring

# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps
```

**启动时间**: <5分钟 ⏱️

### 开发环境

```bash
# 安装依赖
pnpm install

# 启动开发服务
pnpm dev

# 运行标准测试
pnpm test

# 运行工业级测试套件 (推荐)
pnpm industrial-test

# 查看测试报告
ls industrial-test-results/
```

## 🏛️ 架构设计

```
🐳 生产环境 (5个服务 + 基础设施)
├── 用户层
│   └── Frontend (Vue 3 SPA)     # 用户界面
├── 网关层
│   └── Backend Gateway (NestJS) # API网关 + WebSocket
├── AI代理层 (微服务)
│   ├── Creation Agent  # 世界创建
│   ├── Logic Agent     # 游戏逻辑推理
│   └── Narrative Agent # 故事生成
├── 基础设施层
│   ├── PostgreSQL + pgvector # 向量数据库
│   ├── Redis               # 缓存+队列+WebSocket适配器
│   └── RabbitMQ            # 服务间消息队列
└── 共享服务层
    ├── @tuheg/common-backend # 共享基础设施
    └── @tuheg/shared-types   # 类型定义
```

### 核心技术栈

- **后端框架**: NestJS + TypeScript + Prisma ORM
- **前端框架**: Vue 3 (Composition API) + Pinia + Vite
- **数据库**: PostgreSQL + pgvector (向量存储)
- **缓存队列**: Redis + RabbitMQ (消息队列)
- **AI框架**: LangChain + Zod (结构化输出)
- **认证**: Clerk + JWT
- **部署**: Docker + Docker Compose + K8s (生产)
- **监控**: Sentry + Prometheus + Grafana
- **CI/CD**: GitHub Actions + Turbo + 工业级测试套件

## 📚 核心文档

| 文档 | 说明 |
| ---- | ---- |
| [🏭 工业级自动化系统](AUTOMATION.md) | 完整的CI/CD和DevOps实践 |
| [📋 系统技术规格书](docs/System-Technical-Specification.md) | 工业级系统规格和架构设计 |
| [🏗️ 架构设计](ARCHITECTURE.md) | 微服务架构和设计原则 |
| [🔒 安全指南](SECURITY.md) | 安全策略和最佳实践 |
| [⚡ 核心机制优化](docs/core/core-mechanism-optimization.md) | AI叙事逻辑和性能优化 |
| [📊 工业测试报告](industrial-test-results/) | 自动化测试结果和报告 |
| [🚨 应急响应手册](deployment/emergency/incident-response-playbook.md) | 生产环境应急处理流程 |

## 🎮 核心功能

### AI智能体生态系统

- **🎯 动态模型调度**: 智能选择GPT-4、Claude-3、DeepSeek最优组合
- **🤝 多Agent协作**: 逻辑推理 + 叙事生成 + 世界创建 + 批评优化
- **🧠 上下文感知**: 向量存储记忆系统，长期对话保持
- **⚡ 实时同步**: WebSocket双向通信，<100ms延迟
- **🔄 事件驱动**: RabbitMQ消息队列，松耦合架构

### 用户体验特性

- **📖 沉浸式叙事**: AI生成的故事内容，动态分支选择
- **⚡ 实时交互**: <3秒AI响应，流式输出体验
- **🎨 个性化定制**: 用户偏好学习，智能内容适配
- **🌐 国际化就绪**: 多语言支持框架
- **📱 响应式设计**: 现代化的Vue 3界面

### 工业级特性

- **🏭 DevOps就绪**: 完整的CI/CD、监控、日志系统
- **🧪 测试覆盖**: 工业级自动化测试套件
- **🔒 企业安全**: API密钥加密，输入验证，审计日志
- **📊 可观测性**: Prometheus监控，Sentry错误追踪
- **🚀 高可用**: 快速失败机制，自动回滚，弹性伸缩

## 🔧 开发工具

```bash
# 🚀 开发环境
pnpm dev                    # 启动所有服务
pnpm dev:frontend          # 仅启动前端
pnpm dev:backend           # 仅启动后端

# 🧪 测试工具
pnpm test                  # 运行单元测试
pnpm industrial-test       # 工业级测试套件
pnpm industrial-test:quick # 快速失败测试
pnpm industrial-monitor    # 失败监控

# 🔍 代码质量
pnpm lint                  # ESLint代码检查
pnpm type-check           # TypeScript类型检查
pnpm build                # 生产构建

# 🛠️ 开发工具
pnpm plop                 # 代码生成器
pnpm dev:tools            # 开发工具箱
pnpm format               # 代码格式化

# 📊 报告工具
pnpm industrial-report    # 生成综合报告
pnpm industrial-status    # 系统状态检查

# 🐳 部署工具
pnpm industrial-build     # 工业级构建
pnpm industrial-deploy    # 生产部署
```

## 📊 性能指标

### 响应性能
- **AI响应时间**: <3秒 (P95)
- **实时同步延迟**: <100ms (WebSocket)
- **API响应时间**: <200ms (P95)

### 系统容量
- **并发用户支持**: 1000+
- **系统可用性**: 99.9% SLA
- **部署时间**: <5分钟

### 质量指标
- **测试覆盖率**: ≥80%
- **ESLint通过**: 0错误 (警告可接受)
- **构建成功率**: 100%
- **快速失败效率**: <30秒检测失败

## 🌐 环境变量

创建 `.env` 文件并配置以下变量：

### 必需配置

```bash
# ===========================================
# 数据库配置 (必需)
# ===========================================
DATABASE_URL=postgresql://username:password@localhost:5432/creation_ring_db
DB_CONNECTION_LIMIT=20
DB_POOL_TIMEOUT=20
DB_IDLE_TIMEOUT=300

# ===========================================
# Redis 配置 (必需)
# ===========================================
REDIS_URL=redis://localhost:6379

# ===========================================
# 加密配置 (必需)
# ===========================================
ENCRYPTION_KEY=your-32-character-or-longer-encryption-key-here

# ===========================================
# JWT 配置 (必需)
# ===========================================
JWT_SECRET=your-very-long-random-jwt-secret-key-here
JWT_EXPIRATION_SECONDS=3600

# ===========================================
# RabbitMQ 配置 (必需)
# ===========================================
RABBITMQ_URL=amqp://localhost:5672

# ===========================================
# AI 提供商配置 (至少配置一个)
# ===========================================
OPENAI_API_KEY=sk-your-openai-api-key-here
ANTHROPIC_API_KEY=sk-ant-your-anthropic-api-key-here
```

### 可选配置

```bash
# ===========================================
# 监控配置 (推荐)
# ===========================================
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ENVIRONMENT=development
SENTRY_TRACES_SAMPLE_RATE=1.0

# ===========================================
# Langfuse 配置 (可选，用于 AI 可观测性)
# ===========================================
LANGFUSE_PUBLIC_KEY=your-langfuse-public-key
LANGFUSE_SECRET_KEY=your-langfuse-secret-key
LANGFUSE_BASE_URL=https://cloud.langfuse.com

# ===========================================
# Clerk 认证配置 (可选)
# ===========================================
CLERK_SECRET_KEY=sk_test_your-clerk-secret-key
CLERK_PUBLISHABLE_KEY=pk_test_your-clerk-publishable-key
CLERK_MANAGEMENT_API_KEY=your-clerk-management-api-key
CLERK_WEBHOOK_ID=your-clerk-webhook-id

# ===========================================
# 前端配置
# ===========================================
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_SENTRY_DSN=https://your-frontend-sentry-dsn@sentry.io/project-id

# ===========================================
# 应用配置
# ===========================================
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173

# ===========================================
# AI 后备配置 (可选)
# ===========================================
FALLBACK_API_KEY=your-fallback-api-key
FALLBACK_MODEL_ID=deepseek-chat
FALLBACK_BASE_URL=https://api.deepseek.com

# ===========================================
# 工业级配置 (推荐)
# ===========================================
INDUSTRIAL_TEST_ENABLED=true
INDUSTRIAL_CACHE_DIR=.industrial-cache
FAILURE_STRATEGIES_PATH=config/failure-strategies.json

# ===========================================
# Slack/Teams 通知配置 (可选)
# ===========================================
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/your/slack/webhook
TEAMS_WEBHOOK_URL=https://your-org.webhook.office.com/webhook/your-webhook-id

# ===========================================
# 日志配置 (可选)
# ===========================================
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE_MAX_SIZE=10m
LOG_MAX_FILES=5
```

## 🤝 贡献指南

### 开发流程

1. **Fork 项目** 并创建特性分支
   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **运行工业级测试** 确保代码质量
   ```bash
   pnpm industrial-test
   ```

3. **提交更改** 使用规范的提交信息
   ```bash
   git commit -m 'feat: add amazing feature'
   ```

4. **创建 Pull Request** 并等待CI验证

### 代码质量标准

- ✅ **ESLint**: 0错误 (警告可接受)
- ✅ **TypeScript**: 严格类型检查通过
- ✅ **测试覆盖**: ≥80%
- ✅ **工业测试**: 全部阶段通过
- ✅ **文档更新**: 相关文档同步更新

### 分支策略

- `main`: 生产就绪代码
- `develop`: 开发主分支
- `feature/*`: 新功能分支
- `hotfix/*`: 紧急修复分支

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

### AI与技术栈
- **🤖 AI模型**: OpenAI GPT-4 Turbo, Anthropic Claude-3, DeepSeek
- **🔧 核心框架**: NestJS, Vue.js, Redis, PostgreSQL
- **📚 开源社区**: LangChain, Prisma, Socket.IO, Docker等

### 工业级基础设施
- **🏭 DevOps工具**: GitHub Actions, Prometheus, Grafana, Sentry
- **🧪 测试框架**: Jest, Playwright, Industrial Test Suite
- **📊 监控告警**: Alertmanager, PagerDuty集成

## 📞 联系我们

- **🏠 项目主页**: [GitHub Repository]
- **🐛 问题反馈**: [Issues] - 包含工业测试报告
- **💬 讨论交流**: [Discussions] - 技术交流与最佳实践
- **📧 企业咨询**: enterprise@tuheg.com

## 🏆 项目荣誉

- ✅ **工业级验证**: 完整的DevOps流程和测试覆盖
- ✅ **企业就绪**: 生产环境部署和监控体系
- ✅ **高可用架构**: 微服务设计和快速失败机制
- ✅ **安全合规**: 企业级安全策略和审计日志

---

**🚀 创世星环 - 让AI成为你的故事大师，创造无限可能的世界！**

**🏭 工业级AI叙事游戏平台，已准备好迎接生产环境的挑战！**
