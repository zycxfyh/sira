# 核心机制优化 - AI叙事逻辑设计

## 概述

本文档详细描述了创世星环（Creation Ring）系统中AI叙事逻辑的核心机制设计，包括多Agent协作架构、智能模型路由、上下文管理等关键组件。

## 1. AI智能体生态系统

### 1.1 多Agent架构

系统采用三层AI智能体协作架构：

```
用户提交行动
    ↓
Logic Agent (逻辑推理层)
    ├─ 解析玩家意图
    ├─ 评估行动合理性
    ├─ 计算世界状态变更
    └─ 生成状态变更指令
    ↓
Narrative Agent (叙事生成层)
    ├─ 接收状态变更
    ├─ 规划叙事要点
    ├─ 合成叙事文本
    └─ 生成玩家选项
    ↓
Creation Agent (世界创建层)
    ├─ 初始化游戏世界
    ├─ 生成角色卡
    └─ 构建世界设定
```

### 1.2 Logic Agent - 逻辑推理引擎

**职责**：
- 解析玩家行动意图
- 验证行动在游戏规则下的有效性
- 计算世界状态变更（HP、位置、物品等）
- 生成结构化的状态变更指令

**核心流程**：
```typescript
1. 接收玩家行动 (playerAction)
2. 加载当前游戏状态 (gameState)
3. 应用游戏规则引擎 (rule-engine.service)
4. 生成状态变更指令 (directives)
5. 触发 Narrative Agent 处理
```

**关键文件**：
- `apps/logic-agent/src/logic.service.ts`
- `apps/logic-agent/src/rule-engine.service.ts`

### 1.3 Narrative Agent - 叙事生成引擎

**职责**：
- 将冰冷的状态变更转换为生动的叙事文本
- 规划叙事要点（因果、感官、内心、世界反应）
- 合成流畅的叙事文本
- 生成玩家下一步行动选项

**两阶段思维过程**：

#### 阶段一：规划 (Planning)
```markdown
1. 分析输入
   - 理解 previous_state 和 current_state 的差异
   - 理解 player_action 的意图

2. 构思渲染计划
   - 因果解释：为什么会发生这些状态变化？
   - 感官描写：主角看到了什么？听到了什么？
   - 内心独白：主角的内在反应、情感变化
   - 世界反应：环境或其他NPC有何反应？
   - 未来展望：构思接下来可能发生的2-3个行动方向
```

#### 阶段二：合成 (Synthesis)
```markdown
1. 执行渲染计划
   - 将所有要点无缝地、文笔流畅地"缝合"成最终叙事文本

2. 生成选项
   - 将"未来展望"转化为结构化的玩家选项
```

**关键文件**：
- `apps/narrative-agent/src/narrative.service.ts`
- `packages/common-backend/src/prompts/assets/02_narrative_engine.md`

### 1.4 Creation Agent - 世界创建引擎

**职责**：
- 根据用户概念生成游戏世界
- 创建角色卡（Character Card）
- 构建世界设定（World Book）
- 初始化游戏状态

**关键文件**：
- `apps/creation-agent/src/creation.service.ts`

## 2. 智能模型路由系统

### 2.1 动态AI调度器

系统通过 `DynamicAiSchedulerService` 实现智能模型路由：

```typescript
// 根据用户配置和任务角色选择最优AI模型
const provider = await dynamicAiScheduler.getProviderForRole(user, AiRole.LOGIC);
```

**路由策略**：
1. 查询用户配置的AI设置（`AiConfiguration`）
2. 根据任务角色（`AiRole`）匹配配置
3. 支持多模型配置（不同角色使用不同模型）
4. 自动降级和容错处理

**支持的AI提供商**：
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude-3)
- DeepSeek, Groq, Moonshot
- 自定义OpenAI兼容API

**关键文件**：
- `packages/common-backend/src/ai/dynamic-ai-scheduler.service.ts`
- `packages/common-backend/src/ai/ai-provider.factory.ts`

### 2.2 AI Provider Factory

统一的AI提供商工厂，支持多种AI服务：

```typescript
// 创建AI提供商实例
const provider = aiProviderFactory.createProvider(aiConfig);
```

**支持的提供商类型**：
- OpenAI兼容：OpenAI, DeepSeek, Groq, Google, Moonshot等
- 自定义：支持任意OpenAI兼容API

## 3. 上下文管理系统

### 3.1 记忆层次结构

系统实现了分层的记忆管理机制：

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

**关键服务**：
- `packages/common-backend/src/ai/memory-hierarchy.service.ts`
- `packages/common-backend/src/ai/context-summarizer.service.ts`

### 3.2 上下文摘要

为了避免上下文过长导致的问题，系统实现了智能摘要：

```typescript
// 当上下文超过阈值时，自动生成摘要
const summary = await contextSummarizer.summarize(longContext);
```

**摘要策略**：
1. 保留关键信息（角色状态、重要事件）
2. 压缩冗余描述
3. 维护叙事连贯性

## 4. 提示词管理系统

### 4.1 Prompt Manager

统一的提示词管理服务，支持：
- 动态加载提示词模板
- 变量替换
- 版本管理

**提示词资产**：
- `00_persona_and_framework.md` - AI-GM人格与思维框架
- `01_logic_engine.md` - 逻辑引擎协议
- `02_narrative_engine.md` - 叙事引擎协议
- `03_critic_agent.md` - 审查智能体协议
- `04_planner_agent.md` - 规划智能体协议

**关键文件**：
- `packages/common-backend/src/prompts/prompt-manager.service.ts`

## 5. 错误处理与重试机制

### 5.1 重试策略

系统实现了智能重试机制：

```typescript
// 自动重试失败的AI调用
const result = await retryStrategy.executeWithRetry(
  () => aiProvider.generate(prompt),
  { maxRetries: 3, backoff: 'exponential' }
);
```

**重试策略**：
- 指数退避
- 最大重试次数限制
- 错误分类（可重试 vs 不可重试）

**关键文件**：
- `packages/common-backend/src/ai/retry-strategy.ts`

### 5.2 错误格式化

系统提供了专门的错误格式化服务，用于处理AI返回的格式错误：

```typescript
// 自动修复JSON格式错误
const cleaned = jsonCleaner.clean(malformedJson);
```

**关键文件**：
- `packages/common-backend/src/ai/json-cleaner.ts`
- `packages/common-backend/src/ai/schema-error-formatter.ts`

## 6. 性能优化

### 6.1 响应时间目标

- **AI响应时间**: <3秒
- **实时同步延迟**: <100ms
- **并发用户支持**: 1000+

### 6.2 优化策略

1. **异步处理**：使用消息队列异步处理AI任务
2. **缓存机制**：缓存常用提示词和配置
3. **批量处理**：支持批量AI调用
4. **连接池**：复用AI API连接

## 7. 未来优化方向

### 7.1 多Agent并行处理

当前系统采用串行处理，未来可优化为：
- Logic Agent 和 Narrative Agent 并行处理
- 使用工作流引擎（如Temporal）编排任务

### 7.2 向量搜索集成

利用pgvector实现：
- 语义搜索历史对话
- 相似场景检索
- 上下文增强

### 7.3 流式响应

支持流式AI响应，提升用户体验：
- 实时显示生成过程
- 降低感知延迟

## 8. 总结

创世星环的AI叙事逻辑设计采用了：
- **分层架构**：清晰的职责划分
- **智能路由**：自动选择最优AI模型
- **上下文管理**：高效的记忆系统
- **错误处理**：健壮的重试机制

这些机制共同确保了系统能够生成高质量、连贯的叙事内容，同时保持高性能和可扩展性。

