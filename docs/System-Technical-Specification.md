创世星环 (Creation Ring) - V1.0 系统技术规格书

文档版本: 1.0

最后更新: 2025-11-07

状态: 正式版 ✅ 工业级验证完成

验证状态: ✅ 工业级测试通过 | ✅ 生产环境就绪 | ✅ 企业级安全合规

1. 引言

1.1. 项目概述

创世星环 (Creation Ring) 是一个采用微服务架构和事件驱动设计的AI驱动交互式叙事游戏生成系统。系统通过专门的AI代理（逻辑、叙事、创世）协同工作，为用户提供一个从简单概念到完整可玩世界的自动化生成平台，并通过实时通信技术提供沉浸式、动态的游戏体验。

1.2. 文档目的

本规格书旨在为创世星环项目的开发、测试、运维和未来迭代提供一个全面、统一的技术基准。它详细定义了系统的架构设计、模块功能、接口协议、数据模型、非功能性需求以及工业级自动化标准，作为所有技术决策和实施工作的核心依据。

1.3. 范围

本规格书涵盖了创世星环项目的全部技术栈，包括：

前端应用: 用户交互界面。

后端服务: API网关及所有AI代理微服务。

基础设施: 数据库、缓存、消息队列等。

DevOps: CI/CD、监控、部署和应急响应。

1.4. 目标读者

开发团队: 了解系统架构、模块职责和接口规范。

测试团队: 制定测试策略和测试用例。

运维团队: 进行系统部署、监控和维护。

架构师: 评估系统设计和未来演进。

项目经理: 理解技术实现和项目边界。

1.5. 术语表

术语	英文	描述

AI-GM	AI Game Master	扮演游戏主持人的AI系统。

观测者	Observer	系统的用户，即玩家。

中枢系统	Nexus	用户在游戏外的管理中心，用于管理游戏存档、设置等。

代理	Agent	负责特定任务（如逻辑、叙事）的AI微服务。

状态变更指令	State Change Directive	由逻辑代理生成的、描述世界状态变化的结构化数据。

快速失败	Fast Failure	一种CI/CD设计哲学，旨在尽早发现并中止有问题的流程。

质量门禁	Quality Gate	CI/CD流水线中用于确保代码质量的自动化检查点。

2. 系统概述

2.1. 核心功能

AI驱动的游戏世界生成: 用户提供一个核心概念，系统自动生成包含背景、角色和基础规则的游戏世界。

动态叙事生成: AI根据玩家的行动和世界状态，实时生成生动的故事描述和后续选项。

事件驱动的实时交互: 采用WebSocket和消息队列，实现低延迟的玩家-AI交互循环。

多Agent协作架构: 专业的AI代理各司其职，确保逻辑的严谨性和叙事的创造性。

工业级自动化: 从代码提交到生产部署的全流程自动化，集成智能监控和快速失败机制。

2.2. 技术栈

领域	技术

前端	Vue 3 (Composition API), Pinia, Vite, Axios, Socket.IO Client, TanStack Query

后端	NestJS, TypeScript, Prisma

数据库	PostgreSQL (with pgvector extension)

缓存/消息队列	Redis

服务间通信	RabbitMQ

AI框架	LangChain, Zod (用于结构化输出)

认证	Clerk, JWT

部署与编排	Docker, Docker Compose, Kubernetes (K8s)

CI/CD	GitHub Actions, Turbo

可观测性	Sentry, Prometheus, Grafana

2.3. 架构原则

职责分离 (Separation of Concerns): 通过微服务架构将系统解耦为独立、高内聚的功能单元（网关、AI代理）。

事件驱动 (Event-Driven): 服务间通过异步消息（RabbitMQ）进行通信，实现松耦合和高可扩展性。

AI优先 (AI-First): 核心业务逻辑由专门的AI代理驱动，系统设计围绕AI的输入、处理和输出进行。

快速失败 (Fast-Failure): 工业级CI/CD流水线在最早阶段捕获错误，阻止问题代码流入生产，节约资源并提高交付质量。

声明式与不可变 (Declarative & Immutable): 游戏状态的变更是通过逻辑代理生成的"状态变更指令"来驱动，保证了流程的确定性和可追溯性。

3. 架构设计

3.1. 系统架构图

```
graph TD

    subgraph "用户层"

        A[前端应用 (Vue 3 SPA)]

    end

    subgraph "网关层"

        B[后端网关 (NestJS API Gateway)]

    end

    subgraph "基础设施"

        C[RabbitMQ (消息队列)]

        D[PostgreSQL (主数据库 + pgvector)]

        E[Redis (缓存 / WebSocket Adapter)]

    end

    subgraph "AI代理层 (微服务)"

        F[创世代理 (Creation Agent)]

        G[逻辑代理 (Logic Agent)]

        H[叙事代理 (Narrative Agent)]

    end

    subgraph "共享服务层 (NPM包)"

        I[@tuheg/common-backend]

        J[@tuheg/shared-types]

    end

    A -- "HTTP / WebSocket" --> B

    B -- "发布任务" --> C

    B -- "读写数据" --> D

    B -- "会话/缓存" --> E

    C -- "消费任务" --> F

    C -- "消费任务" --> G

    C -- "消费任务" --> H

    F -- "通知" --> C

    G -- "通知" --> C

    H -- "通知" --> C

    C -- "推送通知" --> B

    F -- "使用" --> I

    G -- "使用" --> I

    H -- "使用" --> I

    I -- "数据库访问" --> D

    A -- "使用类型" --> J

    B -- "使用类型" --> J
```

3.2. 模块详述

3.2.1. 前端应用 (apps/frontend)

职责: 提供完整的用户交互界面，包括用户认证、游戏创世、游戏交互和设置管理。

核心组件:

视图 (Views): LoginView, NexusHubView, CreationHubView, GameView。

状态管理 (Stores): 使用Pinia进行全局状态管理，模块包括auth, game, realtime, settings, ui。

服务 (Services): api.service.js封装所有HTTP请求；realtime.service.js管理WebSocket连接。

关键逻辑: WebSocket的生命周期与用户认证状态 (auth.store) 绑定，确保登录后自动连接，登出后自动断开，实现全局稳定的实时通信。

3.2.2. 后端网关 (apps/backend-gateway)

职责: 作为系统的统一入口，处理所有外部请求。

核心模块:

AuthModule: 负责用户注册、登录和JWT令牌管理。

GamesModule: 提供游戏管理的RESTful API，接收玩家行动并将其作为任务发布到消息队列。

GatewayModule: 实现WebSocket服务器，负责与前端的实时双向通信，并使用RedisIoAdapter支持水平扩展。

WebhooksController: 处理来自第三方服务（如Clerk）的Webhook事件。

安全: 集成了helmet、速率限制及自定义的输入验证中间件，提供基础的API安全防护。

3.2.3. AI 代理层 (AI Agent Layer)

创世代理 (apps/creation-agent):

触发: 监听GAME_CREATION_REQUESTED消息。

职责: 接收用户的故事概念，调用AI生成游戏名称、角色设定、世界背景，并将生成的游戏世界持久化到数据库。

输出: 发布creation_completed或creation_failed事件通知用户。

逻辑代理 (apps/logic-agent):

触发: 监听PLAYER_ACTION_SUBMITTED消息。

职责: 系统的"左脑"。接收玩家行动，分析当前游戏状态，应用游戏规则，最终生成一组结构化的、确定性的"状态变更指令"（StateChangeDirective）。

输出: 将状态变更指令应用到数据库，并发布LOGIC_PROCESSING_COMPLETE事件。

叙事代理 (apps/narrative-agent):

触发: 监听LOGIC_PROCESSING_COMPLETE消息。

职责: 系统的"右脑"。接收状态变更结果，调用AI将其渲染成生动的故事描述，并为玩家生成下一步的行动选项。

输出: 发布processing_completed或processing_failed事件，通过网关推送给前端。

3.2.4. 共享服务层

@tuheg/common-backend:

职责: 系统的技术基石，提供所有后端服务共享的基础设施。

核心功能: Prisma数据库服务、动态AI模型调度器、callAiWithGuard安全护栏、提示词管理器、基于Redis的事件总线、Zod验证管道、自定义异常、安全中间件等。

@tuheg/shared-types:

职责: 定义了前端和后端共享的TypeScript类型，如API响应格式、业务实体等，确保了整个项目的类型安全和一致性。

3.3. 数据流

游戏创世流程

前端: 用户在CreationHubView提交故事概念。

网关: GamesController接收请求，验证数据后，通过EventBusService向RabbitMQ发布GAME_CREATION_REQUESTED消息。

创世代理: 监听到消息，执行CreationService.createNewWorld方法。

AI调用: 调用AI模型生成世界设定。

数据库: 在一个事务中创建Game, Character, WorldBookEntry等记录。

通知: 通过EventBusService发布NOTIFY_USER消息，内容为creation_completed事件。

网关: GatewayEventsController监听到NOTIFY_USER消息，通过WebSocket将结果推送给前端。

游戏交互循环

前端: 用户在GameView中提交行动（选择选项或输入命令）。

网关: GamesController接收请求，通过EventBusService向RabbitMQ发布PLAYER_ACTION_SUBMITTED消息。

逻辑代理: 监听到消息，执行LogicService.processLogic。

AI调用: 调用AI推理模型，生成"状态变更指令集"。

规则引擎: RuleEngineService在数据库事务中精确地执行指令集，更新角色HP、状态等。

通知: 逻辑代理发布LOGIC_PROCESSING_COMPLETE消息。

叙事代理: 监听到消息，执行NarrativeService.processNarrative。

AI调用: 调用AI叙事模型，将状态变更渲染成故事文本和新选项。

通知: 叙事代理发布NOTIFY_USER消息，内容为processing_completed事件。

网关: GatewayEventsController监听到通知，通过WebSocket将故事文本和新选项推送给前端。

4. 数据模型设计

数据模型由packages/common-backend/src/prisma/schema.prisma文件唯一定义。

4.1. 核心实体详述

User: 存储用户信息，与Clerk等身份提供商同步。

Game: 游戏的核心实体，关联一个所有者(User)和游戏内的所有其他数据。

Character: 代表玩家在游戏中的化身，包含HP、MP、状态以及定义其核心设定的card (JSONB)字段。

WorldBookEntry: 存储世界设定的条目，如地点、NPC、传说等，以键值对形式（key, content）存在。

Memory: 存储游戏过程中的关键记忆，embedding字段用于向量化存储，支持语义搜索。

AiConfiguration: 存储用户的AI模型配置，包括提供商、API密钥（加密存储）和模型ID。

Role: 定义AI在系统中的能力角色（如logic_parsing, narrative_synthesis），通过多对多关系与AiConfiguration关联，实现了灵活的AI模型调度。

4.2. 数据库约束与验证

数据库层面通过add_data_validation_constraints.sql等迁移文件，对VARCHAR长度、非空等进行了严格约束，构成了数据验证的最后一道防线。

4.3. 向量数据存储

Memory表的embedding字段使用vector(1536)类型（由pgvector扩展提供），专门用于存储OpenAI text-embedding-ada-002模型生成的1536维向量。

20241201000000_add_vector_index/migration.sql迁移文件为embedding字段创建了HNSW索引，极大地提升了高维向量相似度搜索的性能。

5. 核心功能规格

5.1. AI推理机制

动态模型调度: DynamicAiSchedulerService根据任务所需的AiRole（如logic_parsing）和用户配置，智能选择并实例化最合适的AI模型。

结构化输出: 所有AI调用都强制使用Zod Schema定义输出格式，并通过StructuredOutputParser和callAiWithGuard护栏函数进行解析和验证，确保AI返回的数据类型安全、结构正确。

提示词管理: PromptManagerService在服务启动时从/prompts/assets目录加载所有.md格式的提示词模板，实现了提示词与业务逻辑的解耦。

智能重试与修复: retry-strategy.ts定义了基于错误类型的智能重试逻辑（如网络错误可重试，认证错误不可重试）。json-cleaner.ts能够自动修复AI返回的常见非标准JSON（如包含注释、尾随逗号、Markdown代码块等）。

5.2. 实时通信

技术栈: 使用Socket.IO，并通过@socket.io/redis-adapter实现多实例间的消息广播，确保水平扩展能力。

连接管理: WebSocket连接的建立与断开与用户的登录状态绑定。用户通过userId加入一个同名房间，实现了向特定用户推送消息的逻辑。

事件驱动: 后端微服务通过RabbitMQ的NOTIFY_USER主题向网关发送通知，网关再通过WebSocket将事件推送给指定用户，完全解耦。

6. API接口规格

API由apps/backend-gateway提供，所有需要认证的端点均由JwtAuthGuard保护。所有请求体都通过ZodValidationPipe进行严格验证。

POST /auth/register: 用户注册。

POST /auth/login: 用户登录，返回JWT。

GET /auth/profile: 获取当前用户信息。

GET /games: 获取用户的所有游戏列表。

POST /games/narrative-driven: 提交一个故事概念，异步创建新游戏。

GET /games/:id: 获取特定游戏的详细信息。

POST /games/:id/actions: 提交玩家行动。

PATCH /games/:id/character: 更新角色状态（用于织世者控制台）。

GET /settings/ai-configurations: 获取用户的所有AI配置。

POST /settings/ai-configurations: 创建新的AI配置。

POST /settings/ai-configurations/test-connection: 测试AI配置的连通性并获取可用模型。

POST /webhooks/clerk: 接收Clerk的用户事件通知。

7. 非功能性需求

7.1. 性能

P95响应时间: 普通API请求 < 200ms；AI相关操作（交互循环）< 3秒。

并发能力: 系统设计支持1000+并发用户。

WebSocket延迟: 消息从服务器推送到客户端 < 100ms。

7.2. 可靠性与弹性

服务解耦: 单个AI代理的故障不应导致整个系统瘫痪。

消息队列: RabbitMQ确保了消息的持久化和可靠传递，支持死信队列（DLQ）处理失败任务。

数据库: 使用Prisma进行类型安全的数据库操作，并通过事务保证数据一致性。

熔断机制: circuit-breaker.service.ts提供了熔断器服务，防止对故障服务的级联调用。

7.3. 安全性

认证与授权: 使用JWT进行无状态认证；Clerk用于身份管理。

输入验证: 在API网关层使用Zod和自定义中间件（QueryParamsValidationMiddleware等）对所有输入进行严格验证，防御SQL注入、XSS等攻击。

依赖安全: 通过GitHub Actions中的dependency-review-action和audit-ci对依赖项进行持续的安全漏洞扫描。

配置安全: 敏感信息（API密钥、数据库URL）通过环境变量管理，绝不硬编码。tools/scripts/migrate-api-keys-to-encrypted.mjs脚本用于将明文API密钥加密存储。

网络策略: 生产K8s配置中包含NetworkPolicy，严格限制Pod间的网络访问。

8. 工业级自动化与 DevOps

本项目的核心竞争力之一是其高度集成化的工业级CI/CD基础设施，详见AUTOMATION.md。

8.1. CI/CD 流水线

核心工作流 (ci.yml): 这是一个编排工作流，它实现了分阶段、带重试和超时的快速失败逻辑。

质量门禁:

静态分析: ESLint, TypeScript类型检查, Biome代码格式化。

单元测试: Vitest/Jest，要求代码覆盖率不低于80%。

安全扫描: npm audit和Trivy扫描依赖和文件系统漏洞。

PR审查 (pr-review.yml): 自动化检查PR标题、分支命名、PR大小，并执行所有质量门禁。

打包分析 (bundle-analysis.yml): 自动分析前端打包体积，防止意外引入大型依赖。

性能审计 (lighthouse.yml): 自动对前端应用进行Lighthouse性能测试，确保核心Web指标达标。

8.2. 快速失败机制

理念: 尽早发现问题，立即停止有问题的流程，避免资源浪费。

实现:

industrial-test-runner.sh: 结构化的多阶段测试执行引擎，支持超时控制和状态跟踪。

industrial-failure-monitor.sh: 自动检测和分析日志中的失败模式，基于.industrial-cache/failure-patterns.json中的正则表达式进行匹配，并根据严重性决定策略（立即停止、警告继续、重试）。

配置: 所有失败策略均在config/failure-strategies.json中进行统一配置。

8.3. 部署策略

多环境部署: deploy-staging.yml和deploy.yml分别处理到预发布和生产环境的部署。

高级部署模式:

蓝绿部署 (blue-green-deployment.yml): 支持零停机部署和快速回滚。

金丝雀部署 (canary-deploy.sh): 通过canary-strategy.json配置，支持按百分比逐步将流量切到新版本。

自动化回滚: rollback.sh脚本提供了标准化的回滚流程。auto-rollback.yml定义了基于Prometheus监控指标的自动回滚触发条件。

8.4. 监控与告警

技术栈: Prometheus负责指标收集，Alertmanager负责告警，Grafana负责可视化。

配置文件:

prometheus.yml: 定义了所有服务和基础设施的监控目标。

alert_rules.yml: 定义了从传统阈值告警到基于SLO和异常检测的智能告警规则。

grafana-dashboard.json: 定义了核心业务和系统指标的可视化仪表盘。

演练与报告: monitoring-drill.sh用于定期演练监控系统的有效性；slo-report.sh用于自动生成SLO合规报告。

8.5. 应急响应与恢复

应急手册 (incident-response-playbook.md): 定义了从P0到P2不同级别事件的响应流程、职责分配和通信模板。

自动化演练 (test-incident-response.sh): 用于模拟数据库故障、服务崩溃等场景，测试团队的应急响应能力。

恢复脚本 (industrial-recovery.sh): 提供了标准化的自动恢复流程。

9. 附录

9.1. 环境变量配置

所有必需的环境变量均在项目根目录的.env.example文件中定义，包括：

POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD

JWT_SECRET, JWT_EXPIRATION_SECONDS

REDIS_URL, RABBITMQ_URL

SENTRY_DSN, CORS_ORIGIN

9.2. 构建与部署命令

开发启动: pnpm dev

生产构建: pnpm build

运行测试: pnpm test

工业级测试: pnpm industrial-test

启动所有服务 (Docker): docker-compose up -d

停止所有服务 (Docker): docker-compose down
