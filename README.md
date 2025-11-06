# 🌟 创世星环 (Creation Ring)

**AI驱动的交互式叙事游戏生成系统**

[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://docker.com)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=flat&logo=nestjs&logoColor=white)](https://nestjs.com)
[![Vue.js](https://img.shields.io/badge/vuejs-%2335495e.svg?style=flat&logo=vuedotjs&logoColor=%234FC08D)](https://vuejs.org)
[![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=flat&logo=redis&logoColor=white)](https://redis.io)
[![PostgreSQL](https://img.shields.io/badge/postgresql-%23316192.svg?style=flat&logo=postgresql&logoColor=white)](https://postgresql.org)

## ✨ 项目特色

- 🎭 **AI叙事大师**: GPT-4 Turbo + Claude-3智能组合
- ⚡ **实时交互**: <100ms延迟的沉浸式体验
- 🏗️ **轻量化架构**: 4个Docker服务，5分钟部署
- 🔧 **智能路由**: 自动选择最适合的AI模型
- 📈 **高并发**: 支持1000+并发用户

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

# 运行测试
pnpm test
```

## 🏛️ 架构设计

```
🐳 生产环境 (4个服务)
├── PostgreSQL      # 向量数据库 (pgvector)
├── Redis          # 缓存+队列+PubSub
├── Backend Gateway # API网关 (NestJS)
└── AI Agents      # 3个AI智能体
    ├── Logic Agent    # 游戏逻辑推理
    ├── Narrative Agent # 故事生成
    └── Creation Agent  # 世界创建
```

### 核心技术栈

- **后端**: NestJS + TypeScript + Prisma
- **前端**: Vue 3 + Pinia + TanStack Query
- **数据库**: PostgreSQL + pgvector
- **缓存队列**: Redis BullMQ
- **AI**: OpenAI GPT-4 + Anthropic Claude-3
- **部署**: Docker + Docker Compose

## 📚 核心文档

| 文档 | 说明 |
|------|------|
| [核心机制优化](docs/core/core-mechanism-optimization.md) | AI叙事逻辑设计 |
| [架构分析](docs/architecture/architecture-analysis-and-cleanup.md) | 系统架构设计 |
| [技术评估](docs/architecture/技术融合兼容性评估.md) | 技术选型分析 |
| [EventBus迁移](docs/core/eventbus-redis-migration.md) | 实时通信方案 |
| [安全指南](docs/core/api-key-encryption.md) | API密钥管理 |

## 🎮 核心功能

### AI智能体生态系统
- **智能模型路由**: 根据任务类型自动选择最优AI模型
- **多Agent协作**: 逻辑推理 + 叙事生成 + 世界创建
- **上下文管理**: 长对话记忆 + 重要性分级
- **实时反馈**: WebSocket实时同步用户体验

### 用户体验特性
- **沉浸式叙事**: AI生成的故事内容
- **实时交互**: <3秒AI响应时间
- **个性化体验**: 用户偏好学习
- **多语言支持**: 国际化准备

## 🔧 开发工具

```bash
# 代码生成
pnpm plop

# 数据库迁移
pnpm db:migrate

# 开发工具
pnpm dev:tools

# 代码检查
pnpm lint
pnpm type-check
```

## 📊 性能指标

- **AI响应时间**: <3秒
- **实时同步延迟**: <100ms
- **并发用户支持**: 1000+
- **系统可用性**: 99.9%
- **部署时间**: <5分钟

## 🌐 环境变量

```bash
# 数据库
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# Redis
REDIS_URL=redis://localhost:6379

# AI API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# 其他配置
ENCRYPTION_KEY=32字符密钥
NODE_ENV=production
```

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- **AI模型**: OpenAI GPT-4 Turbo, Anthropic Claude-3
- **开源社区**: NestJS, Vue.js, Redis等优秀项目
- **灵感来源**: SillyTavern等成功AI应用

## 📞 联系我们

- 项目主页: [GitHub Repository]
- 问题反馈: [Issues]
- 讨论交流: [Discussions]

---

**🌟 让AI成为你的故事大师，创造无限可能的世界！**
