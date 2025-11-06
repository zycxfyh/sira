# Common Backend (通用后端包)

## 概述

Common Backend是创世星环系统中最重要的共享包，提供所有后端服务共同使用的核心功能和基础设施。它采用模块化设计，包含数据库访问、AI服务、缓存、事件总线、监控等多种功能组件，是整个系统的技术底座。

## 技术栈

- **框架**: NestJS
- **数据库ORM**: Prisma + PostgreSQL
- **缓存**: Redis
- **消息队列**: RabbitMQ (AMQP)
- **向量数据库**: Qdrant + pgvector
- **AI集成**: LangChain + OpenAI/Anthropic
- **监控**: Sentry + 自定义性能监控
- **验证**: Zod
- **测试**: Jest + Vitest

## 架构设计

### 目录结构

```
packages/common-backend/
├── src/
│   ├── ai/                    # AI相关服务
│   │   ├── crew/             # AI智能体编排
│   │   ├── providers/        # AI提供商实现
│   │   └── *.service.ts      # AI核心服务
│   ├── cache/                # 缓存服务
│   ├── config/               # 配置管理
│   ├── dto/                  # 数据传输对象
│   ├── errors/               # 错误处理
│   ├── event-bus/            # 事件总线
│   ├── exceptions/           # 自定义异常
│   ├── health/               # 健康检查
│   ├── middleware/           # 中间件
│   ├── observability/        # 可观测性
│   ├── pipes/                # 管道
│   ├── plugins/              # 插件系统
│   ├── prisma/               # 数据库层
│   ├── prompts/              # 提示词管理
│   ├── rate-limit/           # 限流控制
│   ├── reactive/             # 响应式编程
│   ├── resilience/           # 弹性设计
│   ├── schedule/             # 定时任务
│   ├── security/             # 安全测试
│   ├── types/                # 类型定义
│   ├── validation/           # 验证服务
│   └── vector/               # 向量服务
├── test/                     # 测试文件
└── README.md
```

## 核心模块详解

### 1. 数据库层 (Prisma)

**功能职责**:
- 数据库连接和查询
- 数据迁移管理
- 类型安全的数据访问

**关键组件**:
- **PrismaService**: 数据库服务封装
- **PrismaModule**: 数据库模块配置
- **schema.prisma**: 数据库模式定义

**核心特性**:
```typescript
@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    super({
      log: ['query', 'error', 'warn'],
      errorFormat: 'pretty',
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

### 2. AI服务层

#### Dynamic AI Scheduler (动态AI调度器)

**功能职责**:
- 根据任务类型智能选择AI模型
- 支持多AI提供商切换
- 用户配置管理

**核心逻辑**:
```typescript
@Injectable()
export class DynamicAiSchedulerService {
  async getProviderForRole(user: User, role: AiRole): Promise<AiProvider> {
    // 1. 获取用户AI配置
    const config = await this.getUserAiConfiguration(user.id);

    // 2. 根据角色选择提供商
    const provider = this.selectProviderForRole(config, role);

    // 3. 返回配置的提供商实例
    return this.aiProviderFactory.createProvider(provider);
  }
}
```

#### AI Guard (AI护栏)

**功能职责**:
- 验证AI输出格式正确性
- 自动重试失败的AI调用
- 结构化错误处理

**核心实现**:
```typescript
export async function callAiWithGuard<T>(
  chain: Runnable,
  inputs: Record<string, any>,
  schema: ZodSchema<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await chain.invoke(inputs);
      const parsed = schema.parse(result);
      return parsed;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      // 清理和重试逻辑
    }
  }
}
```

#### 提示词管理器

**功能职责**:
- 动态加载和管理提示词模板
- 变量替换和格式化
- 版本控制和缓存

**支持的提示词**:
- `00_persona_and_framework.md` - AI-GM人格框架
- `01_logic_engine.md` - 逻辑引擎协议
- `02_narrative_engine.md` - 叙事引擎协议
- `03_critic_agent.md` - 审查智能体协议
- `04_planner_agent.md` - 规划智能体协议

### 3. 事件总线 (Event Bus)

**功能职责**:
- 服务间异步通信
- 事件发布订阅模式
- Redis-backed消息队列

**核心实现**:
```typescript
@Injectable()
export class EventBusService {
  constructor(private readonly redisClient: Redis) {}

  async publish(event: string, data: any): Promise<void> {
    await this.redisClient.publish(event, JSON.stringify(data));
  }

  async subscribe(event: string, handler: Function): Promise<void> {
    // 订阅逻辑
  }
}
```

### 4. 缓存服务

**功能职责**:
- 多级缓存策略
- Redis缓存集成
- 装饰器支持的缓存

**使用示例**:
```typescript
@Cache('user:profile', 300) // 缓存5分钟
async getUserProfile(userId: string): Promise<UserProfile> {
  // 缓存未命中时执行的逻辑
  return await this.prisma.user.findUnique({ where: { id: userId } });
}
```

### 5. 可观测性 (Observability)

#### 性能监控

**功能职责**:
- 请求响应时间监控
- 内存使用追踪
- 自定义性能指标

#### Sentry集成

**功能职责**:
- 错误监控和追踪
- 性能 profiling
- 用户行为分析

### 6. 验证和安全

#### Zod验证管道

**功能职责**:
- 请求数据验证
- 自动错误格式化
- 类型安全保证

**使用示例**:
```typescript
@Post()
async createGame(
  @Body(new ZodValidationPipe(createGameSchema))
  dto: CreateGameDto
) {
  // dto已经通过验证并类型安全
}
```

#### 安全中间件

- **内容类型验证**: 防止恶意内容类型
- **编码验证**: 确保正确的字符编码
- **查询参数验证**: 过滤恶意查询参数

### 7. 向量搜索和AI记忆

#### 向量搜索服务

**功能职责**:
- 语义搜索历史对话
- 相似场景检索
- 上下文增强

#### 记忆层次服务

**功能职责**:
- 分层记忆管理
- 重要性评分
- 上下文摘要

**记忆层次结构**:
```
长期记忆 (Long-term Memory)
    ├─ 角色设定 (Character Card)
    ├─ 世界设定 (World Book)
    └─ 重要事件 (Important Events)
    ↓
中期记忆 (Mid-term Memory)
    ├─ 最近对话历史
    └─ 上下文摘要
    ↓
短期记忆 (Short-term Memory)
    ├─ 当前对话轮次
    └─ 即时状态
```

### 8. 插件系统

**功能职责**:
- 动态插件加载
- 扩展功能注册
- 热插拔支持

**插件类型**:
- AI提供商插件
- 游戏规则插件
- 监控插件
- 缓存插件

### 9. 弹性设计

#### 熔断器 (Circuit Breaker)

**功能职责**:
- 防止级联故障
- 自动故障恢复
- 降级处理

#### 重试策略

**功能职责**:
- 指数退避重试
- 最大重试次数限制
- 错误类型分类

## 数据库设计

### 核心数据模型

```prisma
// 用户和认证
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  games     Game[]
  settings  AiConfiguration[]
}

// 游戏世界
model Game {
  id        String   @id @default(cuid())
  name      String
  ownerId   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  owner     User     @relation(fields: [ownerId], references: [id])
  character Character?
  worldBook WorldBookEntry[]
  actions   GameAction[]
}

// 角色系统
model Character {
  id        String   @id @default(cuid())
  gameId    String   @unique
  name      String
  card      Json     // 角色卡数据
  hp        Int      @default(100)
  mp        Int      @default(100)
  status    String   @default("normal")

  game      Game     @relation(fields: [gameId], references: [id])
}

// 世界书系统
model WorldBookEntry {
  id        String   @id @default(cuid())
  gameId    String
  key       String
  content   Json     // 世界书条目内容

  game      Game     @relation(fields: [gameId], references: [id])
}
```

### 向量扩展

```sql
-- 启用向量扩展
CREATE EXTENSION IF NOT EXISTS vector;

-- 对话历史向量索引
CREATE INDEX ON game_action USING ivfflat (embedding vector_cosine_ops)
WHERE embedding IS NOT NULL;
```

## 配置管理

### 环境变量

```bash
# 数据库配置
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# Redis配置
REDIS_URL=redis://localhost:6379

# RabbitMQ配置
RABBITMQ_URL=amqp://localhost:5672

# AI提供商配置
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Sentry配置
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# 向量数据库
QDRANT_URL=http://localhost:6333
```

### 配置验证

```typescript
export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  RABBITMQ_URL: z.string().url().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  QDRANT_URL: z.string().url().optional(),
});
```

## 测试策略

### 单元测试

```typescript
describe('DynamicAiSchedulerService', () => {
  let service: DynamicAiSchedulerService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [DynamicAiSchedulerService],
    }).compile();
    service = module.get<DynamicAiSchedulerService>(DynamicAiSchedulerService);
  });

  it('should select appropriate provider for role', async () => {
    const provider = await service.getProviderForRole(mockUser, AiRole.LOGIC);
    expect(provider).toBeDefined();
  });
});
```

### 集成测试

- 数据库集成测试
- Redis缓存测试
- RabbitMQ消息队列测试
- AI服务集成测试

### E2E测试

- 完整业务流程测试
- 性能基准测试
- 故障恢复测试

## 部署和扩展

### Docker构建

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### 依赖关系

Common Backend被所有后端服务依赖：

```
Frontend
    ↓
Backend Gateway → Common Backend ← Logic Agent
    ↓                    ↓           ↓
   Redis           Prisma Service   Narrative Agent
    ↓                    ↓           ↓
 RabbitMQ          PostgreSQL     Creation Agent
    ↓
  AI Agents
```

## 性能优化

### 1. 缓存策略

- **多级缓存**: 内存缓存 + Redis缓存
- **智能失效**: 基于时间和事件的缓存失效
- **缓存预热**: 启动时预加载热点数据

### 2. 数据库优化

- **连接池**: Prisma连接池管理
- **查询优化**: N+1问题解决
- **索引策略**: 基于查询模式的索引设计

### 3. AI调用优化

- **批量处理**: 支持批量AI推理
- **连接复用**: AI API连接池
- **响应缓存**: 相似请求的结果缓存

## 监控和告警

### 指标收集

- **业务指标**: 请求量、成功率、响应时间
- **系统指标**: CPU、内存、磁盘使用率
- **AI指标**: 调用次数、成功率、平均响应时间
- **队列指标**: 消息积压、处理速度

### 告警规则

- AI服务调用失败率 > 5%
- 队列消息积压 > 1000
- 数据库连接池使用率 > 90%
- 内存使用率 > 85%

## 扩展规划

### 计划功能

- **多租户支持**: 租户数据隔离
- **国际化**: 多语言提示词支持
- **A/B测试**: AI模型效果对比
- **实时监控**: 更细粒度的性能指标
- **自动扩缩容**: 基于负载的自动扩展

### 架构演进

当前架构可以演进为：
- **微服务网格**: Service Mesh集成 (Istio/Linkerd)
- **事件驱动**: 完全的事件驱动架构
- **多云部署**: 支持多云环境部署
- **边缘计算**: 边缘节点AI推理
- **联邦学习**: 分布式AI模型训练

## 相关文档

- [后端网关文档](../../apps/backend-gateway/README.md)
- [AI代理文档](../../apps/logic-agent/README.md)
- [数据库迁移](./src/prisma/migrations/)
- [API类型定义](../shared-types/README.md)
