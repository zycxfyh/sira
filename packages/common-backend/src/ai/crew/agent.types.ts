// 文件路径: packages/common-backend/src/ai/crew/agent.types.ts
// 灵感来源: CrewAI (https://github.com/joaomdmoura/crewAI)
// 核心理念: 角色驱动的智能体系统，每个智能体有明确的角色、目标和工具

import type { AiProvider } from "../../types/ai-providers.types";

/**
 * @interface AgentRole
 * @description 智能体的角色定义，定义智能体在系统中的职责
 */
export interface AgentRole {
  /** 角色名称 */
  name: string;
  /** 角色描述 */
  description: string;
  /** 角色的目标 */
  goal: string;
  /** 角色的背景信息 */
  backstory?: string;
}

/**
 * @interface AgentTool
 * @description 智能体可以使用的工具
 */
export interface AgentTool {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 工具执行函数 */
  execute: (input: unknown) => Promise<unknown> | unknown;
}

/**
 * @interface AgentConfig
 * @description 智能体配置
 */
export interface AgentConfig {
  /** 角色定义 */
  role: AgentRole;
  /** 可用的工具列表 */
  tools?: AgentTool[];
  /** AI Provider（用于 LLM 调用） */
  provider?: AiProvider;
  /** 是否允许自主决策 */
  allowDelegation?: boolean;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 其他元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * @interface AgentExecutionResult
 * @description 智能体执行结果
 */
export interface AgentExecutionResult {
  /** 执行是否成功 */
  success: boolean;
  /** 执行结果 */
  output: unknown;
  /** 错误信息（如果有） */
  error?: string;
  /** 执行时间（毫秒） */
  executionTime?: number;
  /** 使用的工具（如果有） */
  toolsUsed?: string[];
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

