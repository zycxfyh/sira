# 创世星环 (Creation Ring) - 系统架构文档

## 项目概述

创世星环是一个AI驱动的交互式叙事游戏生成系统，采用微服务架构和事件驱动设计。系统通过三个专门的AI代理协同工作，为用户生成沉浸式的游戏体验。

## 核心架构原则

### 1. 微服务架构
- **松耦合**: 各服务独立部署和扩展
- **职责分离**: 每个服务专注特定领域
- **技术多样性**: 允许不同服务使用最适合的技术栈

### 2. 事件驱动架构
- **异步通信**: 服务间通过事件松耦合
- **可扩展性**: 新功能可通过订阅事件轻松集成
- **容错性**: 单个服务失败不影响整个系统

### 3. AI优先设计
- **智能代理**: 三个专门的AI代理处理不同任务
- **动态路由**: 根据任务类型智能选择AI模型
- **质量保证**: 多层护栏确保AI输出质量

## 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                    前端层 (Frontend Layer)                       │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                Vue 3 SPA (Frontend App)                     │ │
│  │  ┌─────────────────┬─────────────────┬─────────────────┐   │ │
│  │  │   WelcomeView   │   NexusHubView  │  CreationHubView │   │ │
│  │  │                 │                 │                 │   │ │
│  │  │   LoginView     │   GameView      │                 │   │ │
│  │  └─────────────────┴─────────────────┴─────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   │ HTTP/WebSocket
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                   API网关层 (API Gateway Layer)                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │            NestJS API Gateway (Backend Gateway)            │ │
│  │  ┌─────────┬─────────┬─────────┬─────────┬─────────┐       │ │
│  │  │  Auth   │  Games  │ Settings│ Gateway │ Webhook │       │ │
│  │  │ Module  │ Module  │ Module  │ Module  │ Module  │       │ │
│  │  └─────────┴─────────┴─────────┴─────────┴─────────┘       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
          ┌─────────▼────────┐    │    ┌─────────▼────────┐
          │   RabbitMQ       │    │    │   PostgreSQL     │
          │  Message Queue   │    │    │   Database       │
          └─────────┬────────┘    │    └─────────┬────────┘
                    │              │              │
                    │              │              │
                    ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 AI代理层 (AI Agents Layer)                      │
│  ┌─────────────────┬─────────────────┬─────────────────┐       │
│  │ Logic Agent     │ Narrative Agent │ Creation Agent  │       │
│  │                 │                 │                 │       │
│  │ 游戏逻辑推理    │ 叙事内容生成    │ 世界设定创建    │       │
│  │                 │                 │                 │       │
│  └─────────────────┴─────────────────┴─────────────────┘       │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│               共享服务层 (Shared Services Layer)                │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │           Common Backend Package                           │ │
│  │  ┌─────────┬─────────┬─────────┬─────────┬─────────┐       │ │
│  │  │ Prisma  │  AI     │  Cache  │ Event   │ Sentry  │       │ │
│  │  │ Service │ Service │ Service │ Bus     │ Monitor │       │ │
│  │  └─────────┴─────────┴─────────┴─────────┴─────────┘       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 模块详细架构

### 1. 前端应用 (Frontend App)

**技术栈**: Vue 3 + Vite + Pinia + Socket.IO Client

**职责**:
- 用户界面和交互
- 状态管理和路由
- 实时通信处理
- 响应式设计

**关键组件**:
- **视图层**: WelcomeView, NexusHubView, CreationHubView, GameView
- **状态管理**: auth.store, game.store, realtime.store, settings.store
- **服务层**: api.service, realtime.service

### 2. 后端网关 (Backend Gateway)

**技术栈**: NestJS + TypeScript + Prisma + Socket.IO

**职责**:
- API请求路由和验证
- 用户认证和授权
- WebSocket连接管理
- 请求限流和安全

**核心模块**:
- **AuthModule**: 用户认证 (JWT, Passport)
- **GamesModule**: 游戏管理API
- **SettingsModule**: AI配置管理
- **GatewayModule**: WebSocket网关
- **RedisIoAdapter**: Redis集群WebSocket适配器

### 3. AI代理生态系统

#### Logic Agent (逻辑推理引擎)

**职责**: 解析玩家行动，计算游戏状态变更

**核心流程**:
```
玩家行动 → AI推理 → 状态变更指令 → 规则引擎执行 → 事件发布
```

**关键组件**:
- **LogicService**: 核心推理逻辑
- **RuleEngineService**: 游戏规则执行
- **MessageQueueController**: RabbitMQ消息处理

#### Narrative Agent (叙事生成引擎)

**职责**: 将状态变更转换为生动叙事内容

**核心流程**:
```
逻辑完成事件 → AI叙事生成 → 推送给前端 → 可选审查优化
```

**关键组件**:
- **NarrativeService**: 叙事生成服务
- **Synthesizer**: 叙事合成器
- **Critic**: 审查智能体 (预留)

#### Creation Agent (世界创建引擎)

**职责**: 从用户概念生成完整的游戏世界

**核心流程**:
```
用户概念 → AI架构设计 → 数据库存储 → 通知前端
```

**关键组件**:
- **CreationService**: 创世服务
- **Architect AI**: 建筑师AI代理

### 4. 共享服务包

#### Common Backend (通用后端包)

**职责**: 提供所有后端服务共享的基础设施

**核心模块**:
- **AI服务**: DynamicAiScheduler, AiGuard, PromptManager
- **数据库**: PrismaService, 数据迁移
- **缓存**: Redis缓存服务
- **事件总线**: Redis-backed事件发布订阅
- **监控**: Sentry错误追踪和性能监控
- **验证**: Zod验证管道和中间件

#### Shared Types (共享类型包)

**职责**: 提供前后端共享的TypeScript类型定义

**核心类型**:
- **API类型**: ApiResponse, ApiError, PaginatedResponse
- **业务类型**: Game, User, AiConfiguration
- **分页类型**: PaginationParams

## 数据流架构

### 1. 游戏创建流程

```
1. 用户在前端输入游戏概念
2. 前端 → 后端网关 (HTTP POST /games/narrative-driven)
3. 网关 → RabbitMQ (GAME_CREATION_REQUESTED)
4. Creation Agent接收消息
5. Creation Agent → AI生成游戏世界
6. Creation Agent → PostgreSQL存储游戏数据
7. Creation Agent → 网关推送 (creation_completed)
8. 网关 → 前端WebSocket推送
9. 前端更新UI显示新游戏
```

### 2. 游戏交互流程

```
1. 用户在前端提交行动
2. 前端 → 后端网关 (HTTP POST /games/:id/actions)
3. 网关 → PostgreSQL存储行动记录
4. 网关 → RabbitMQ (PLAYER_ACTION_SUBMITTED)
5. Logic Agent接收消息
6. Logic Agent → AI推理状态变更
7. Logic Agent → PostgreSQL执行状态变更
8. Logic Agent → RabbitMQ (LOGIC_PROCESSING_COMPLETE)
9. Narrative Agent接收消息
10. Narrative Agent → AI生成叙事内容
11. Narrative Agent → 网关推送 (processing_completed)
12. 网关 → 前端WebSocket推送
13. 前端显示AI生成的叙事和选项
```

## 技术栈详解

### 前端技术栈

```json
{
  "framework": "Vue 3 (Composition API)",
  "build": "Vite",
  "state": "Pinia",
  "router": "Vue Router 4",
  "http": "Axios",
  "realtime": "Socket.IO Client",
  "styling": "CSS + Flexbox/Grid",
  "testing": "Vitest + Vue Test Utils"
}
```

### 后端技术栈

```json
{
  "framework": "NestJS",
  "language": "TypeScript",
  "database": {
    "primary": "PostgreSQL + Prisma",
    "cache": "Redis",
    "queue": "RabbitMQ",
    "vector": "Qdrant + pgvector"
  },
  "ai": {
    "providers": ["OpenAI", "Anthropic", "DeepSeek"],
    "framework": "LangChain"
  },
  "monitoring": "Sentry",
  "validation": "Zod",
  "testing": "Jest"
}
```

## 部署架构

### 生产环境部署

```
┌─────────────────────────────────────────────────────────────┐
│                    Load Balancer (Nginx)                     │
└─────────────────────┬───────────────────────────────────────┘
                      │
           ┌──────────┼──────────┐
           │          │          │
    ┌──────▼────┐    │    ┌──────▼────┐
    │ Frontend  │    │    │ Frontend  │
    │  (Static) │    │    │  (Static) │
    └──────┬────┘    │    └──────┬────┘
           │          │          │
           └──────────┼──────────┘
                      │
           ┌──────────▼──────────┐
           │     API Gateway     │
           │   (Backend Gateway) │
           └──────────┬──────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
┌───────▼─────┐ ┌─────▼─────┐ ┌─────▼─────┐
│ Logic Agent │ │ Narrative │ │ Creation  │
│             │ │  Agent    │ │  Agent    │
└───────┬─────┘ └─────┬─────┘ └─────┬─────┘
        │             │             │
        └─────────────┼─────────────┘
                      │
        ┌─────────────▼─────────────┐
        │     Shared Services       │
        │  ┌─────────┬─────────┐    │
        │  │ Postgre │  Redis  │    │
        │  │ SQL     │         │    │
        │  └─────────┴─────────┘    │
        └───────────────────────────┘
```

### Kubernetes部署架构

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: creation-ring

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-gateway
  namespace: creation-ring
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: backend-gateway
        image: creation-ring/backend-gateway:latest

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: logic-agent
  namespace: creation-ring
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: logic-agent
        image: creation-ring/logic-agent:latest

# ... 其他服务的部署配置
```

## 监控和可观测性

### 指标收集

- **应用指标**: 请求量、响应时间、错误率
- **业务指标**: 游戏创建数、用户活跃度、AI响应质量
- **系统指标**: CPU、内存、磁盘、网络
- **AI指标**: 调用次数、成功率、模型性能对比

### 日志聚合

- **结构化日志**: 所有服务使用统一日志格式
- **集中收集**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **错误追踪**: Sentry集成所有服务

### 告警系统

- **阈值告警**: 响应时间 > 3秒、错误率 > 5%
- **业务告警**: AI服务不可用、队列积压严重
- **系统告警**: 资源使用率过高、服务宕机

## 扩展性和性能

### 水平扩展策略

1. **无状态服务**: API网关、AI代理都设计为无状态
2. **消息队列**: RabbitMQ支持多消费者负载均衡
3. **缓存层**: Redis集群提供高可用缓存
4. **数据库**: PostgreSQL读写分离和分库分表

### 性能优化

1. **AI调用优化**:
   - 批量推理减少API调用
   - 智能缓存相似请求
   - 异步处理非关键任务

2. **数据库优化**:
   - 连接池和查询优化
   - 索引策略和分区表
   - 向量搜索加速语义查询

3. **缓存策略**:
   - 多级缓存 (内存 → Redis)
   - 智能失效和预热
   - CDN加速静态资源

## 安全架构

### 认证和授权

- **JWT令牌**: 无状态认证
- **角色权限**: 基于角色的访问控制
- **API密钥**: AI服务安全调用

### 数据保护

- **传输加密**: HTTPS和WSS强制使用
- **数据加密**: 敏感数据加密存储
- **输入验证**: 多层输入验证和清理

### AI安全

- **提示词过滤**: 防止恶意提示注入
- **输出审核**: AI生成内容安全检查
- **速率限制**: 防止API滥用

## 开发和部署流程

### CI/CD流程

```
代码提交 → Lint检查 → 单元测试 → 集成测试 → 构建镜像 → 部署到测试环境 → E2E测试 → 生产部署
```

### 环境管理

- **开发环境**: 本地Docker Compose
- **测试环境**: Kubernetes测试集群
- **生产环境**: 高可用Kubernetes集群

### 配置管理

- **环境变量**: 不同环境的配置分离
- **密钥管理**: HashiCorp Vault或AWS Secrets Manager
- **配置验证**: 启动时验证必需配置

## 风险和缓解策略

### 高风险项目

1. **AI服务依赖**
   - **风险**: AI服务不可用或响应质量下降
   - **缓解**: 多AI提供商切换、降级策略、缓存层

2. **消息队列积压**
   - **风险**: 高并发导致消息处理延迟
   - **缓解**: 自动扩缩容、死信队列、监控告警

3. **数据库性能**
   - **风险**: 大量并发查询影响性能
   - **缓解**: 读写分离、索引优化、查询缓存

### 业务连续性

- **备份策略**: 数据库定时备份、多区域复制
- **故障恢复**: RTO < 4小时、RPO < 1小时
- **灾备演练**: 定期进行故障恢复演练

## 未来演进规划

### 短期目标 (3-6个月)

- [ ] AI服务性能优化
- [ ] 多语言支持
- [ ] 高级用户界面
- [ ] 移动端适配

### 中期目标 (6-12个月)

- [ ] 插件系统完善
- [ ] 多租户架构
- [ ] 实时协作功能
- [ ] 高级AI模型集成

### 长期愿景 (1-2年)

- [ ] 云原生架构全面升级
- [ ] AI模型自学习和进化
- [ ] 跨平台客户端支持
- [ ] 生态系统开放平台

## 总结

创世星环采用现代化的微服务架构，将复杂的AI驱动游戏生成系统解耦为多个职责明确的模块。通过事件驱动的设计和共享服务包的支撑，系统具备了高可扩展性、高可用性和高性能的特点。

每个模块都遵循单一职责原则，通过清晰的接口和事件通信，实现松耦合的系统设计。这种架构不仅支持当前的功能需求，也为未来的功能扩展和性能优化提供了坚实的基础。

---

**文档版本**: 1.0
**最后更新**: 2024年12月
**维护者**: 创世星环开发团队
