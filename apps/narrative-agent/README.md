# Narrative Agent (叙事生成引擎)

## 概述

Narrative Agent是创世星环系统中负责将冷冰冰的游戏状态变更转换为生动叙事内容的核心AI代理。它接收Logic Agent处理后的状态变更信息，生成引人入胜的故事叙述，并为玩家提供下一步行动选项。

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
apps/narrative-agent/
├── src/
│   ├── narrative.service.ts        # 核心叙事服务
│   ├── narrative-agent.controller.ts # 消息队列控制器
│   ├── narrative-agent.module.ts   # 模块定义
│   └── main.ts                     # 应用入口
├── test/                           # 单元测试
├── package.json
└── README.md
```

### 核心组件架构

#### 1. Narrative Service (叙事生成服务)

**功能职责**:
- 接收逻辑处理完成的事件
- 调用AI模型生成叙事内容
- 协调Synthesizer和Critic Agent
- 通过网关推送结果给前端

**核心流程**:
```typescript
async processNarrative(payload: LogicCompletePayload): Promise<void> {
  // 1. 获取游戏完整状态
  const gameState = await this.prisma.game.findUniqueOrThrow({...});

  // 2. 生成叙事内容 (默认单次AI调用)
  const finalProgression = await this.synthesizeNarrative(
    gameState, payload.playerAction, user
  );

  // 3. 可选：审查和优化 (当前被注释)
  // const finalProgression = await this.reviewWithCritic(...);

  // 4. 通过网关推送给用户
  await this.httpService.post(this.GATEWAY_URL, {
    userId: payload.userId,
    event: 'processing_completed',
    data: { progression: finalProgression }
  });
}
```

#### 2. AI Agent架构

**双Agent协作模式** (当前优化为单Agent模式):

##### Synthesizer Agent (叙事合成器)
- **职责**: 直接生成高质量的叙事内容和行动选项
- **输入**: 游戏状态 + 玩家行动
- **输出**: 完整的ProgressionResponse

##### Critic Agent (审查家) - 预留功能
- **职责**: 审查和优化Synthesizer的初稿
- **输入**: 游戏状态 + 玩家行动 + 初稿
- **输出**: 优化后的ProgressionResponse
- **状态**: 当前工作流中未激活，可通过配置启用

#### 3. Message Queue Controller (消息队列控制器)

**功能职责**:
- 监听Logic Agent完成的消息
- 触发叙事生成流程
- 处理消息确认和错误恢复

**消息处理**:
```typescript
@MessagePattern('LOGIC_PROCESSING_COMPLETE')
async handleLogicComplete(@Payload() data: LogicCompletePayload) {
  try {
    await this.narrativeService.processNarrative(data);
    channel.ack(originalMsg); // 成功确认
  } catch (error) {
    channel.nack(originalMsg); // 失败拒绝
  }
}
```

## AI推理机制

### 1. 推理任务定义

Narrative Agent使用结构化输出确保生成的内容符合预定格式：

```typescript
const progressionResponseSchema = z.object({
  narrative: z.string().describe('对玩家行动结果的生动叙事描述'),
  options: z.array(z.object({
    dimension: z.string(),      // 行动维度 (战斗/社交/探索等)
    check: z.string(),          // 检查类型 (力量/智力/魅力等)
    success_rate: z.string(),   // 成功率估计
    text: z.string(),           // 行动描述
  })).nullable(),
});
```

### 2. 输入数据结构

**LogicCompletePayload**:
```typescript
interface LogicCompletePayload {
  gameId: string;        // 游戏ID
  userId: string;        // 用户ID
  playerAction: any;     // 玩家行动详情
}
```

### 3. 输出数据结构

**ProgressionResponse**:
```typescript
interface ProgressionResponse {
  narrative: string;           // 生动叙事文本
  options: ActionOption[] | null; // 后续行动选项
}

interface ActionOption {
  dimension: string;     // 行动分类
  check: string;         // 所需能力
  success_rate: string;  // 成功概率
  text: string;          // 行动描述
}
```

### 4. AI护栏机制

```typescript
const response = await callAiWithGuard(
  chain,
  {
    currentState: JSON.stringify(gameState),
    playerAction: JSON.stringify(playerAction),
    system_prompt: systemPrompt,
  },
  progressionResponseSchema,
);
```

- **格式验证**: 确保输出结构完整
- **内容审核**: 验证叙事质量和选项合理性
- **自动重试**: 输出不符合要求时重试

## 叙事生成流程

### 1. 当前优化流程 (单Agent模式)

```
Logic Agent完成 → Narrative Agent接收 → Synthesizer直接生成 → 推送结果
```

**优势**:
- 响应速度快
- 资源消耗少
- 维护简单

### 2. 完整双Agent流程 (预留)

```
Logic Agent完成 → Narrative Agent接收 → Synthesizer初稿 → Critic审查 → 推送结果
```

**优势**:
- 叙事质量更高
- 内容更连贯
- 错误率更低

**启用方式**:
```typescript
// 在 synthesizeNarrative 后添加
if (this.needsCriticReview(finalProgression, gameState)) {
  finalProgression = await this.reviewWithCritic(...);
}
```

## 提示词管理系统

### 1. Synthesizer提示词

使用 `02_narrative_engine.md`，包含：
- AI-GM人格设定
- 叙事生成指南
- 行动选项设计原则
- 格式化输出要求

### 2. Critic提示词 (预留)

使用 `03_critic_agent.md`，包含：
- 内容质量评估标准
- 叙事优化策略
- 一致性检查规则

## 错误处理和监控

### 1. 错误处理策略

```typescript
try {
  // 正常处理流程
  await this.narrativeService.processNarrative(data);
  channel.ack(originalMsg);
} catch (error) {
  // 记录错误
  this.logger.error(`Failed to process narrative task`, error);

  // 尝试发送错误消息给用户
  try {
    await this.httpService.post(this.GATEWAY_URL, {
      userId: payload.userId,
      event: 'processing_failed',
      data: { error: error.message }
    });
  } catch (gatewayError) {
    // 网关通信失败的最后防线
    this.logger.error('CRITICAL: Failed to send error via gateway', gatewayError);
  }

  channel.nack(originalMsg);
}
```

### 2. 监控指标

- **处理延迟**: 从接收消息到推送结果的耗时
- **成功率**: 叙事生成成功率
- **质量指标**: 叙事长度、选项数量等
- **错误率**: 各类错误发生频率

## 消息队列集成

### 1. RabbitMQ配置

```typescript
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'NARRATIVE_AGENT_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL],
          queue: 'narrative_agent_queue',
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
Logic Agent → RabbitMQ(LOGIC_PROCESSING_COMPLETE) → Narrative Agent → 网关推送
```

## 依赖关系

### 内部依赖

- **@tuheg/common-backend**: 共享的AI服务、数据库访问、提示词管理
- **PrismaService**: 游戏状态查询
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

# 网关配置
GATEWAY_URL=http://nexus-engine:3000/gateway/send-to-user

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

- **单Agent模式**: 减少API调用次数，提升响应速度
- **提示词缓存**: 预加载和缓存提示词文件
- **连接池**: 复用AI API连接

### 2. 异步处理

- 消息队列异步处理
- HTTP请求异步执行
- 错误处理异步记录

### 3. 内存管理

- 大对象及时释放
- 避免内存泄漏
- 监控内存使用情况

## 测试策略

### 1. 单元测试

```typescript
describe('NarrativeService', () => {
  let service: NarrativeService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [NarrativeService],
    }).compile();
    service = module.get<NarrativeService>(NarrativeService);
  });

  it('should generate valid progression response', async () => {
    const payload = createMockPayload();
    const progression = await service.generateNarrative(payload);
    expect(progression.narrative).toBeDefined();
    expect(progression.options).toBeDefined();
  });
});
```

### 2. 集成测试

- AI生成内容质量评估
- 网关通信测试
- 消息队列集成测试

### 3. 端到端测试

- 完整叙事生成流程测试
- 前端接收测试
- 性能基准测试

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
- **共享配置**: 环境变量统一管理

### 资源配置

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: narrative-agent
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: narrative-agent
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
```

## 故障排查

### 常见问题

1. **AI生成失败**
   - 检查AI API密钥和额度
   - 验证提示词文件完整性
   - 查看AI服务响应日志

2. **网关通信失败**
   - 检查GATEWAY_URL配置
   - 验证网关服务可用性
   - 查看网络连接状态

3. **消息积压**
   - 检查RabbitMQ连接
   - 监控队列长度
   - 调整消费者实例数量

## 扩展规划

### 计划功能

- **Critic Agent激活**: 启用双Agent审查流程
- **叙事质量评估**: 自动评估生成内容质量
- **个性化叙事**: 根据用户偏好调整叙事风格
- **多语言支持**: 支持多种语言的叙事生成
- **缓存优化**: 缓存常用叙事模式

### 架构演进

当前架构可以演进为：
- **多模型集成**: 支持多种AI模型组合
- **流式生成**: 实时流式输出叙事内容
- **交互式叙事**: 支持玩家中途干预
- **叙事记忆**: 学习用户偏好和模式
- **A/B测试**: 不同叙事策略的效果对比

## 相关文档

- [Logic Agent文档](../logic-agent/README.md)
- [Creation Agent文档](../creation-agent/README.md)
- [AI服务文档](../../packages/ai-services/README.md)
- [核心机制文档](../../docs/core/core-mechanism-optimization.md)
