# Creation Agent (世界创建引擎)

## 概述

Creation Agent是创世星环系统中负责从用户概念生成完整游戏世界的核心AI代理。它接收用户的故事概念，调用AI模型创建游戏名称、角色设定、世界背景，并将生成的游戏世界持久化到数据库中。

## 技术栈

- **框架**: NestJS + 微服务
- **消息队列**: RabbitMQ (AMQP)
- **AI集成**: LangChain + OpenAI/Anthropic
- **HTTP客户端**: Axios
- **数据验证**: Zod
- **监控**: Sentry
- **测试**: Jest

## 架构设计

### 目录结构

```
apps/creation-agent/
├── src/
│   ├── creation.service.ts          # 核心创世服务
│   ├── creation-agent.controller.ts # 消息队列控制器
│   ├── creation-agent.module.ts     # 模块定义
│   └── main.ts                      # 应用入口
├── test/                            # 单元测试
├── package.json
└── README.md
```

### 核心组件架构

#### 1. Creation Service (创世服务)

**功能职责**:

- 接收游戏创建请求
- 调用AI生成游戏世界设定
- 在数据库中创建游戏记录
- 通过网关通知前端创建结果

**核心流程**:

```typescript
async createNewWorld(payload: GameCreationPayload): Promise<void> {
  // 1. 调用AI生成初始世界
  const initialWorld = await this.generateInitialWorld(concept, user);

  // 2. 数据库事务：创建游戏、角色、世界书
  const newGame = await this.prisma.$transaction(async (tx) => {
    // 创建游戏记录
    const game = await tx.game.create({...});

    // 创建角色卡
    await tx.character.create({...});

    // 创建世界书条目
    if (initialWorld.worldBook?.length > 0) {
      await tx.worldBookEntry.createMany({...});
    }

    return game;
  });

  // 3. 发布游戏创建完成事件
  await this.eventBus.publish('GAME_CREATION_COMPLETED', {
    userId: userId,
    gameId: newGame.id,
    gameData: newGame
  });
}
```

#### 2. AI Architect (建筑师)

**功能职责**:

- 基于用户概念生成完整的游戏设定
- 创建富有想象力的游戏名称
- 设计角色卡 (Character Card)
- 构建世界书 (World Book)

**生成内容结构**:

```typescript
interface ArchitectResponse {
  gameName: string; // 游戏标题
  character: {
    // 玩家角色
    name: string; // 角色名称
    card: {
      // 角色卡
      coreIdentity: string; // 核心身份
      personality: string[]; // 性格关键词
      appearance: string; // 外貌描述
    };
  };
  worldBook: Array<{
    // 世界设定
    key: string; // 条目关键字
    content: {
      // 条目内容
      description: string; // 详细描述
    };
  }>;
}
```

#### 3. Message Queue Controller (消息队列控制器)

**功能职责**:

- 监听游戏创建请求消息
- 触发创世流程
- 处理消息确认和错误记录

**消息处理**:

```typescript
@MessagePattern('GAME_CREATION_REQUESTED')
async handleGameCreation(@Payload() data: GameCreationPayload) {
  try {
    await this.creationService.createNewWorld(data);
    channel.ack(originalMsg); // 成功确认
  } catch (error) {
    // 记录错误但仍确认消息（避免死信队列循环）
    this.logger.error(`Failed to process creation task`, error);
    channel.ack(originalMsg);
  }
}
```

## AI推理机制

### 1. 推理任务定义

Creation Agent使用结构化输出确保生成的游戏设定符合预定格式：

```typescript
const architectResponseSchema = z.object({
  gameName: z.string().describe('一个富有想象力的游戏名称'),
  character: z.object({
    name: z.string().describe('角色的名字'),
    card: z.object({
      coreIdentity: z.string().describe('角色的核心身份或概念'),
      personality: z.array(z.string()).describe('描述角色性格的关键词列表'),
      appearance: z.string().describe('角色的外貌描述'),
    }),
  }),
  worldBook: z.array(
    z.object({
      key: z.string().describe('世界书条目的唯一关键字'),
      content: z.object({
        description: z.string().describe('该条目的详细描述'),
      }),
    }),
  ),
});
```

### 2. 输入数据结构

**GameCreationPayload**:

```typescript
interface GameCreationPayload {
  userId: string; // 用户ID
  concept: string; // 用户提供的游戏概念描述
}
```

### 3. AI护栏机制

```typescript
const response = await callAiWithGuard(
  chain,
  {
    concept: concept,
    system_prompt: systemPrompt,
  },
  architectResponseSchema,
);
```

- **格式验证**: 确保输出包含所有必需字段
- **内容审核**: 验证生成内容的完整性和合理性
- **自动重试**: 输出不符合要求时自动重试

## 数据库事务管理

### 1. 原子性操作

所有游戏创建操作都在数据库事务中执行，确保数据一致性：

```typescript
const newGame = await this.prisma.$transaction(async (tx) => {
  // 1. 创建游戏记录
  const game = await tx.game.create({
    data: {
      name: initialWorld.gameName,
      ownerId: userId,
    },
  });

  // 2. 创建角色记录
  await tx.character.create({
    data: {
      gameId: game.id,
      name: initialWorld.character.name,
      card: initialWorld.character.card,
    },
  });

  // 3. 批量创建世界书条目
  if (initialWorld.worldBook?.length > 0) {
    await tx.worldBookEntry.createMany({
      data: initialWorld.worldBook.map((entry) => ({
        gameId: game.id,
        key: entry.key,
        content: entry.content,
      })),
    });
  }

  return game;
});
```

### 2. 数据关系

- **Game**: 主游戏记录
- **Character**: 隶属于游戏的角色信息
- **WorldBookEntry**: 隶属于游戏的世界设定条目

## 提示词管理系统

### 1. AI-GM框架提示词

使用 `00_persona_and_framework.md`，包含：

- AI-GM人格设定和思维框架
- 创世任务的具体指导原则
- 角色和世界设计的质量标准
- 格式化输出要求

### 2. 提示词模板

```typescript
const prompt = new PromptTemplate({
  template: `{system_prompt}\n# 创世任务指令\n根据以下用户概念，为一次新的游戏人生生成初始设定。\n{format_instructions}\n---\n用户概念: "{concept}"`,
  inputVariables: ['concept', 'system_prompt'],
  partialVariables: {
    format_instructions: parser.getFormatInstructions(),
  },
});
```

## 错误处理和监控

### 1. 多层错误处理

```typescript
try {
  // AI生成和数据库操作
  const initialWorld = await this.generateInitialWorld(concept, user);
  const newGame = await this.prisma.$transaction(...);

  // 发布成功事件
  await this.eventBus.publish('GAME_CREATION_COMPLETED', {
    userId, gameId: newGame.id, gameData: newGame
  });
} catch (error) {
  // 详细错误记录
  this.logger.error(`Failed to create world`, error);

  // 发布失败事件
  try {
    await this.eventBus.publish('GAME_CREATION_FAILED', {
      userId, error: error.message, concept
    });
  } catch (eventError) {
    // 事件发布失败的最后防线
    this.logger.error('CRITICAL: Failed to publish error event', eventError);
  }
}
```

### 2. 监控指标

- **创建成功率**: 游戏创建成功率统计
- **AI响应时间**: 从请求到生成完成的耗时
- **数据库操作延迟**: 事务执行时间
- **错误分类**: AI错误 vs 数据库错误 vs 网络错误

## 消息队列集成

### 1. RabbitMQ配置

```typescript
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'CREATION_AGENT_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL],
          queue: 'creation_agent_queue',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
})
```

### 2. 消息流

```
前端请求 → Gateway → RabbitMQ(GAME_CREATION_REQUESTED) → Creation Agent → RabbitMQ(GAME_CREATION_COMPLETED/FAILED) → Gateway → WebSocket推送
```

## 依赖关系

### 内部依赖

- **@tuheg/common-backend**: 共享的AI服务、数据库访问、提示词管理
- **PrismaService**: 数据库操作
- **DynamicAiSchedulerService**: AI模型调度
- **PromptManagerService**: 提示词加载

### 外部依赖

- **@nestjs/microservices**: 微服务支持
- **@nestjs/axios**: HTTP客户端
- **@langchain/core**: AI推理框架
- **zod**: 数据验证

## 配置管理

### 环境变量

```bash
# RabbitMQ配置
RABBITMQ_URL=amqp://localhost:5672

# AI配置
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# 数据库
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# 监控
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

## 性能优化

### 1. AI调用优化

- **提示词缓存**: 预加载系统提示词
- **连接复用**: 复用AI API连接
- **并发控制**: 避免过多并发创建请求

### 2. 数据库优化

- **事务优化**: 批量操作减少事务数量
- **索引利用**: 利用现有数据库索引
- **连接池**: 使用Prisma连接池

### 3. 异步处理

- 消息队列异步处理
- HTTP请求异步执行
- 错误处理异步记录

## 测试策略

### 1. 单元测试

```typescript
describe('CreationService', () => {
  let service: CreationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CreationService],
    }).compile();
    service = module.get<CreationService>(CreationService);
  });

  it('should create a valid game world', async () => {
    const payload = { userId: 'test-user', concept: 'fantasy adventure' };
    const world = await service.generateInitialWorld(payload.concept, mockUser);
    expect(world.gameName).toBeDefined();
    expect(world.character).toBeDefined();
    expect(world.worldBook).toBeDefined();
  });
});
```

### 2. 集成测试

- AI生成内容验证
- 数据库事务完整性测试
- 消息队列集成测试

### 3. 端到端测试

- 完整游戏创建流程测试
- 前端接收通知测试
- 错误场景处理测试

## 部署和扩展

### Docker部署

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

### 水平扩展

- **无状态设计**: 支持多实例部署
- **消息队列负载均衡**: RabbitMQ自动分配任务
- **数据库连接池**: 支持多实例并发访问

### 资源配置

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: creation-agent
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: creation-agent
          resources:
            requests:
              memory: '256Mi'
              cpu: '200m'
            limits:
              memory: '512Mi'
              cpu: '500m'
```

## 故障排查

### 常见问题

1. **AI生成失败**
   - 检查AI API密钥和额度
   - 验证提示词文件存在
   - 查看AI服务响应日志

2. **数据库事务失败**
   - 检查数据库连接
   - 验证数据约束
   - 查看事务日志

3. **事件发布失败**
   - 检查RabbitMQ连接配置
   - 验证消息队列可用性
   - 查看事件总线连接状态

## 扩展规划

### 计划功能

- **多模板支持**: 不同类型游戏的世界模板
- **渐进式创建**: 分步骤引导用户创建世界
- **预设世界**: 提供预设的世界模板
- **世界验证**: AI验证世界设定的合理性
- **协作创建**: 支持多人协作创建世界

### 架构演进

当前架构可以演进为：

- **多阶段创建**: 将创建过程分解为多个步骤
- **世界预览**: 生成世界后提供预览和修改功能
- **版本控制**: 支持世界设定的版本历史
- **共享世界**: 允许用户分享和复用世界设定
- **AI迭代优化**: 基于用户反馈优化生成结果

## 相关文档

- [后端网关文档](../backend-gateway/README.md)
- [AI服务文档](../../packages/ai-services/README.md)
- [数据库schema](../../packages/common-backend/src/prisma/schema.prisma)
- [核心机制文档](../../docs/core/core-mechanism-optimization.md)
