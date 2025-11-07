// 文件路径: packages/common-backend/src/ai/crew/task.ts
// 核心理念: 任务定义，描述需要完成的工作和预期输出

import { Injectable, Logger } from '@nestjs/common';
import type { TaskConfig, TaskContext, TaskResult } from './task.types';
import type { Agent } from './agent';

/**
 * @class Task
 * @description CrewAI 风格的任务实现
 * 每个任务都有明确的描述、预期输出和依赖关系
 */
@Injectable()
export class Task {
  private readonly logger = new Logger(Task.name);

  constructor(
    private readonly name: string,
    private readonly config: TaskConfig,
  ) {}

  /**
   * @method getName
   * @description 获取任务名称
   */
  public getName(): string {
    return this.name;
  }

  /**
   * @method getConfig
   * @description 获取任务配置
   */
  public getConfig(): TaskConfig {
    return this.config;
  }

  /**
   * @method getDependencies
   * @description 获取任务依赖
   */
  public getDependencies(): string[] {
    return this.config.dependencies ?? [];
  }

  /**
   * @method getPriority
   * @description 获取任务优先级
   */
  public getPriority(): number {
    return this.config.priority ?? 5;
  }

  /**
   * @method execute
   * @description 执行任务
   * @param agent - 执行任务的智能体
   * @param context - 任务上下文
   * @returns 任务执行结果
   */
  public async execute(agent: Agent, context: TaskContext): Promise<TaskResult> {
    const startTime = Date.now();

    try {
      this.logger.debug(`Task "${this.name}" executing with agent "${agent.getName()}"`);

      // 检查超时
      if (this.config.timeout) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Task "${this.name}" timed out after ${this.config.timeout}ms`));
          }, this.config.timeout);
        });

        const executionPromise = agent.execute(this.config.description, {
          ...context.globalContext,
          taskContext: context.input,
          dependencies: context.dependencies,
        });

        const result = await Promise.race([executionPromise, timeoutPromise]);

        if (!result.success) {
          throw new Error(result.error ?? 'Task execution failed');
        }

        const executionTime = Date.now() - startTime;

        return {
          taskName: this.name,
          success: true,
          output: result.output,
          agent: agent.getName(),
          executionTime,
          metadata: {
            ...this.config.metadata,
            toolsUsed: result.toolsUsed,
          },
        };
      }

      // 正常执行（无超时）
      const result = await agent.execute(this.config.description, {
        ...context.globalContext,
        taskContext: context.input,
        dependencies: context.dependencies,
      });

      if (!result.success) {
        throw new Error(result.error ?? 'Task execution failed');
      }

      const executionTime = Date.now() - startTime;

      return {
        taskName: this.name,
        success: true,
        output: result.output,
        agent: agent.getName(),
        executionTime,
        metadata: {
          ...this.config.metadata,
          toolsUsed: result.toolsUsed,
        },
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Task "${this.name}" execution failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      return {
        taskName: this.name,
        success: false,
        output: null,
        agent: agent.getName(),
        executionTime,
        error: errorMessage,
        metadata: this.config.metadata,
      };
    }
  }

  /**
   * @method canExecute
   * @description 检查任务是否可以执行（依赖是否满足）
   */
  public canExecute(completedTasks: Set<string>): boolean {
    const dependencies = this.getDependencies();
    return dependencies.every((dep) => completedTasks.has(dep));
  }
}
