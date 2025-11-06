// 文件路径: packages/common-backend/src/ai/crew/task.types.ts
// 灵感来源: CrewAI (https://github.com/joaomdmoura/crewAI)
// 核心理念: 任务定义，描述需要完成的工作和预期输出

/**
 * @interface TaskConfig
 * @description 任务配置
 */
export interface TaskConfig {
  /** 任务描述 */
  description: string;
  /** 预期输出格式 */
  expectedOutput?: string;
  /** 分配给哪个智能体（可选，如果不指定则自动选择） */
  agent?: string;
  /** 任务依赖的其他任务（任务名称列表） */
  dependencies?: string[];
  /** 任务优先级（1-10，10为最高） */
  priority?: number;
  /** 任务超时时间（毫秒） */
  timeout?: number;
  /** 其他元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * @interface TaskResult
 * @description 任务执行结果
 */
export interface TaskResult {
  /** 任务名称 */
  taskName: string;
  /** 执行是否成功 */
  success: boolean;
  /** 任务输出 */
  output: unknown;
  /** 执行任务的智能体 */
  agent?: string;
  /** 执行时间（毫秒） */
  executionTime?: number;
  /** 错误信息（如果有） */
  error?: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * @interface TaskContext
 * @description 任务执行上下文
 */
export interface TaskContext {
  /** 任务输入数据 */
  input: unknown;
  /** 依赖任务的结果 */
  dependencies?: Record<string, TaskResult>;
  /** 全局上下文数据 */
  globalContext?: Record<string, unknown>;
}

