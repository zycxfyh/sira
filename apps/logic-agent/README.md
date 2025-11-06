# Logic Agent (逻辑推理引擎)

## 概述

Logic Agent是创世星环系统中负责游戏逻辑推理的核心AI代理。它接收玩家行动，分析游戏状态，应用游戏规则，并生成结构化的状态变更指令。这些指令随后被传递给Narrative Agent进行叙事生成。

## 技术栈

- **框架**: NestJS + 微服务
- **消息队列**: RabbitMQ (AMQP)
- **AI集成**: LangChain + OpenAI/Anthropic
- **数据验证**: Zod
- **监控**: Sentry
- **测试**: Jest

## 架构设计

### 目录结构

```
apps/logic-agent/
├── src/
│   ├── logic.service.ts         # 核心逻辑服务
│   ├── rule-engine.service.ts   # 规则引擎服务
│   ├── logic-agent.controller.ts # 消息队列控制器
│   ├── logic-agent.module.ts    # 模块定义
│   └── main.ts                  # 应用入口
├── test/                        # 单元测试
├── package.json
└── README.md
```

### 核心组件架构

#### 1. Logic Service (逻辑推理服务)

**功能职责**:
- 接收玩家行动数据
- 调用AI模型进行逻辑推理
- 生成结构化的状态变更指令
- 协调规则引擎执行

**核心流程**:
```typescript
async processLogic(jobData: GameActionJobData): Promise<void> {
  // 1. 生成状态变更指令
  const directives = await this.generateDirectives(jobData, user);

  // 2. 执行规则引擎
  await this.ruleEngine.execute(jobData.gameId, directives);

  // 3. 发布完成事件
  this.eventBus.publish('LOGIC_PROCESSING_COMPLETE', {...});
}
```

#### 2. Rule Engine Service (规则引擎服务)

**功能职责**:
- 执行状态变更指令
- 应用游戏规则逻辑
- 更新数据库状态
- 确保数据一致性

**支持的指令类型**:
- **update_character**: 角色状态更新
  - HP/MP数值操作 (set/increment/decrement)
  - 状态字符串操作 (set/append/prepend)

**指令示例**:
```typescript
const directive: StateChangeDirective = {
  op: 'update_character',
  payload: {
    hp: { op: 'decrement', value: 10 },
    status: { op: 'append', value: 'wounded' }
  }
};
```

#### 3. Message Queue Controller (消息队列控制器)

**功能职责**:
- 监听RabbitMQ消息队列
- 处理玩家行动事件
- 实现消息确认和重试机制
- 错误处理和监控

**消息处理流程**:
```typescript
@MessagePattern('PLAYER_ACTION_SUBMITTED')
async handlePlayerAction(@Payload() data: GameActionJobData) {
  try {
    await this.logicService.processLogic(data);
    channel.ack(originalMsg); // 成功确认
  } catch (error) {
    // 实现重试逻辑和死信队列
    this.handleRetryLogic(channel, originalMsg, error);
  }
}
```

## AI推理机制

### 1. 推理任务定义

Logic Agent使用结构化输出解析器确保AI生成符合预定schema的指令：

```typescript
const parser = StructuredOutputParser.fromZodSchema(directiveSetSchema);
const prompt = new PromptTemplate({
  template: `{system_prompt}\n# 推理任务\n{format_instructions}\n---\n当前世界状态:\n\`\`\`json\n{game_state}\n\`\`\`\n---\n玩家行动:\n\`\`\`json\n{player_action}\n\`\`\``,
  inputVariables: ['game_state', 'player_action', 'system_prompt'],
  partialVariables: {
    format_instructions: parser.getFormatInstructions(),
  },
});
```

### 2. 输入数据结构

**GameActionJobData**:
```typescript
interface GameActionJobData {
  gameId: string;
  userId: string;
  gameStateSnapshot: GameState;
  playerAction: PlayerAction;
}
```

**GameState**: 当前游戏世界的完整状态快照
**PlayerAction**: 玩家的具体行动描述

### 3. 输出指令格式

**DirectiveSet**: 状态变更指令数组
```typescript
type DirectiveSet = StateChangeDirective[];

interface StateChangeDirective {
  op: 'update_character' | 'update_world' | ...;
  payload: CharacterUpdate | WorldUpdate | ...;
}
```

### 4. AI护栏机制

系统实现了AI生成结果的护栏验证：

```typescript
const response = await callAiWithGuard(
  chain,
  inputVariables,
  directiveSetSchema, // Zod验证schema
);
```

- **格式验证**: 确保输出符合预定结构
- **类型安全**: 验证所有必需字段存在
- **错误重试**: AI输出不符合要求时自动重试

## 规则引擎详解

### 1. 事务处理

所有状态变更都在数据库事务中执行，确保原子性：

```typescript
await this.prisma.$transaction(async (tx) => {
  for (const directive of directives) {
    await this.executeDirective(tx, gameId, directive);
  }
});
```

### 2. 数值操作

支持多种数值修改操作：
- **set**: 直接设置为指定值
- **increment**: 增加指定值
- **decrement**: 减少指定值

```typescript
private applyNumericOperation(currentValue: number, op: NumericOperation): number {
  switch (op.op) {
    case 'set': return op.value;
    case 'increment': return currentValue + op.value;
    case 'decrement': return currentValue - op.value;
  }
}
```

### 3. 字符串操作

支持字符串拼接和替换：
- **set**: 直接替换
- **append**: 追加到末尾
- **prepend**: 添加到开头

## 消息队列集成

### 1. RabbitMQ配置

```typescript
// 消费者配置
@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'LOGIC_AGENT_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL],
          queue: 'logic_agent_queue',
          queueOptions: {
            durable: true,
            deadLetterExchange: 'logic_agent_dlx',
            deadLetterRoutingKey: 'logic_agent_dlq',
          },
        },
      },
    ]),
  ],
})
```

### 2. 死信队列处理

实现消息重试和失败处理：
- **最大重试次数**: 2次
- **死信队列**: logic_agent_dlq
- **错误监控**: 集成Sentry异常追踪

### 3. 消息确认机制

```typescript
// 成功处理
channel.ack(originalMsg);

// 重试处理
channel.nack(originalMsg, false, true);

// 发送到死信队列
channel.nack(originalMsg, false, false);
```

## 依赖关系

### 内部依赖

- **@tuheg/common-backend**: 共享的AI服务、事件总线、数据模型
- **PrismaService**: 数据库访问
- **DynamicAiSchedulerService**: AI模型调度
- **EventBusService**: 事件发布

### 外部依赖

- **@nestjs/microservices**: 微服务支持
- **@langchain/core**: AI推理框架
- **amqplib**: RabbitMQ客户端
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

### 队列配置

```typescript
// 队列选项
const queueOptions = {
  durable: true,                    // 队列持久化
  deadLetterExchange: 'logic_agent_dlx', // 死信交换器
  deadLetterRoutingKey: 'logic_agent_dlq', // 死信路由键
  messageTtl: 24 * 60 * 60 * 1000,   // 消息TTL: 24小时
};
```

## 性能优化

### 1. 异步处理

- 消息队列异步处理，避免阻塞
- AI调用异步执行
- 数据库操作批量处理

### 2. 错误处理

- 结构化错误日志
- Sentry异常监控
- 优雅降级策略

### 3. 资源管理

- 连接池复用
- 内存使用监控
- 超时控制

## 测试策略

### 1. 单元测试

```typescript
describe('LogicService', () => {
  let service: LogicService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [LogicService],
    }).compile();
    service = module.get<LogicService>(LogicService);
  });

  it('should generate valid directives', async () => {
    const jobData = createMockJobData();
    const directives = await service.generateDirectives(jobData, mockUser);
    expect(directives).toBeDefined();
    expect(Array.isArray(directives)).toBe(true);
  });
});
```

### 2. 集成测试

- AI推理结果验证
- 数据库事务测试
- 消息队列集成测试

### 3. 性能测试

- AI响应时间监控
- 并发处理能力测试
- 内存使用分析

## 监控和可观测性

### 1. 指标收集

- **处理延迟**: 从接收消息到完成处理的耗时
- **成功率**: 消息处理成功率统计
- **重试率**: 消息重试频率监控
- **错误率**: 各类错误发生频率

### 2. 日志记录

```typescript
this.logger.log(`Processing logic for game ${jobData.gameId}`);
this.logger.log(`Generated ${directives.length} directives`);
this.logger.error(`Failed to process logic task`, error);
```

### 3. 健康检查

```typescript
@Injectable()
export class LogicAgentHealthIndicator {
  async isHealthy(): Promise<HealthIndicatorResult> {
    // 检查RabbitMQ连接
    // 检查数据库连接
    // 检查AI服务可用性
  }
}
```

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
- **配置一致性**: 环境变量集中管理

### 资源配置

```yaml
# Kubernetes部署配置
apiVersion: apps/v1
kind: Deployment
metadata:
  name: logic-agent
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: logic-agent
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

## 故障排查

### 常见问题

1. **AI推理失败**
   - 检查AI API密钥配置
   - 验证提示词文件存在
   - 查看AI服务响应日志

2. **消息积压**
   - 检查消费者实例数量
   - 监控队列长度
   - 分析处理瓶颈

3. **数据库死锁**
   - 优化事务顺序
   - 减少事务范围
   - 实现重试机制

## 扩展规划

### 计划功能

- **复杂规则引擎**: 支持更复杂的游戏逻辑
- **缓存层**: Redis缓存常用状态
- **批量处理**: 支持多个行动的批量推理
- **A/B测试**: AI模型效果对比
- **实时监控**: 推理质量实时评估

### 架构演进

当前架构可以演进为：
- **多模型支持**: 同时支持多种AI推理策略
- **规则即代码**: 动态加载游戏规则
- **事件驱动**: 更细粒度的事件处理
- **分布式推理**: 分片处理大规模推理任务

## 相关文档

- [后端网关文档](../backend-gateway/README.md)
- [Narrative Agent文档](../narrative-agent/README.md)
- [AI服务文档](../../packages/ai-services/README.md)
- [核心机制文档](../../docs/core/core-mechanism-optimization.md)
