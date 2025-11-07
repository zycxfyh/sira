// 文件路径: packages/common-backend/src/ai/crew/agent.ts
// 核心理念: 角色驱动的智能体，具备明确的角色、目标和工具

import { Injectable, Logger } from '@nestjs/common';
import type { AiProvider } from '../../types/ai-providers.types';
import type { AgentConfig, AgentExecutionResult, AgentRole, AgentTool } from './agent.types';

/**
 * @class Agent
 * @description CrewAI 风格的智能体实现
 * 每个智能体都有明确的角色、目标和可用的工具
 */
@Injectable()
export class Agent {
  private readonly logger = new Logger(Agent.name);

  constructor(
    private readonly config: AgentConfig,
    private readonly name: string,
  ) {}

  /**
   * @method getRole
   * @description 获取智能体的角色定义
   */
  public getRole(): AgentRole {
    return this.config.role;
  }

  /**
   * @method getName
   * @description 获取智能体名称
   */
  public getName(): string {
    return this.name;
  }

  /**
   * @method getProvider
   * @description 获取智能体的 AI Provider
   */
  public getProvider(): AiProvider | undefined {
    return this.config.provider;
  }

  /**
   * @method getTools
   * @description 获取智能体可用的工具列表
   */
  public getTools(): AgentTool[] {
    return this.config.tools ?? [];
  }

  /**
   * @method canDelegate
   * @description 检查智能体是否允许委派任务
   */
  public canDelegate(): boolean {
    return this.config.allowDelegation ?? false;
  }

  /**
   * @method execute
   * @description 执行任务
   * @param taskDescription - 任务描述
   * @param context - 执行上下文
   * @returns 执行结果
   */
  public async execute(
    taskDescription: string,
    context: Record<string, unknown> = {},
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now();
    const toolsUsed: string[] = [];

    try {
      this.logger.debug(`Agent "${this.name}" executing task: ${taskDescription}`);

      // 如果没有 Provider，只能使用工具
      if (!this.config.provider) {
        throw new Error(`Agent "${this.name}" has no AI provider configured`);
      }

      // 构建系统提示词
      const systemPrompt = this.buildSystemPrompt(taskDescription, context);

      // 调用 AI Provider
      const response = await this.config.provider.model.invoke(systemPrompt);

      // 提取响应内容
      const output =
        typeof response === 'string'
          ? response
          : (response.content?.toString() ?? JSON.stringify(response));

      // 检查是否需要使用工具
      const toolCalls = this.extractToolCalls(output);
      if (toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          const toolResult = await this.executeTool(toolCall.toolName, toolCall.input);
          toolsUsed.push(toolCall.toolName);
          context[`tool_result_${toolCall.toolName}`] = toolResult;
        }
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        output,
        executionTime,
        toolsUsed,
        metadata: {
          agent: this.name,
          role: this.config.role.name,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Agent "${this.name}" execution failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      return {
        success: false,
        output: null,
        error: errorMessage,
        executionTime,
        toolsUsed,
        metadata: {
          agent: this.name,
          role: this.config.role.name,
        },
      };
    }
  }

  /**
   * @method buildSystemPrompt
   * @description 构建系统提示词
   */
  private buildSystemPrompt(taskDescription: string, context: Record<string, unknown>): string {
    const role = this.config.role;
    const tools = this.getTools();

    let prompt = `You are ${role.name}, ${role.description}\n\n`;
    prompt += `Your goal: ${role.goal}\n\n`;

    if (role.backstory) {
      prompt += `Background: ${role.backstory}\n\n`;
    }

    if (tools.length > 0) {
      prompt += `Available tools:\n`;
      for (const tool of tools) {
        prompt += `- ${tool.name}: ${tool.description}\n`;
      }
      prompt += `\nYou can use these tools by calling them with the format: TOOL_CALL(name, input)\n\n`;
    }

    if (Object.keys(context).length > 0) {
      prompt += `Context:\n${JSON.stringify(context, null, 2)}\n\n`;
    }

    prompt += `Task: ${taskDescription}\n\n`;
    prompt += `Please provide your response.`;

    return prompt;
  }

  /**
   * @method extractToolCalls
   * @description 从输出中提取工具调用
   */
  private extractToolCalls(output: string): Array<{ toolName: string; input: unknown }> {
    const toolCalls: Array<{ toolName: string; input: unknown }> = [];
    const toolCallRegex = /TOOL_CALL\(([^,]+),\s*([^)]+)\)/g;

    let match;
    while ((match = toolCallRegex.exec(output)) !== null) {
      const toolName = match[1].trim();
      const inputStr = match[2].trim();

      try {
        const input = JSON.parse(inputStr);
        toolCalls.push({ toolName, input });
      } catch {
        // 如果不是 JSON，直接使用字符串
        toolCalls.push({ toolName, input: inputStr });
      }
    }

    return toolCalls;
  }

  /**
   * @method executeTool
   * @description 执行工具
   */
  private async executeTool(toolName: string, input: unknown): Promise<unknown> {
    const tool = this.config.tools?.find((t) => t.name === toolName);

    if (!tool) {
      throw new Error(`Tool "${toolName}" not found for agent "${this.name}"`);
    }

    try {
      return await tool.execute(input);
    } catch (error) {
      this.logger.error(
        `Tool "${toolName}" execution failed:`,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }
}
