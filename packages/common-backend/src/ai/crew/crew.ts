// 文件路径: packages/common-backend/src/ai/crew/crew.ts
// 灵感来源: CrewAI (https://github.com/joaomdmoura/crewAI)
// 核心理念: 工作流编排，组织智能体和任务，实现复杂的协作流程

import { Injectable, Logger } from '@nestjs/common';
import type { Agent } from './agent';
import type { Task } from './task';
import type { TaskResult } from './task.types';

/**
 * @interface CrewConfig
 * @description Crew 配置
 */
export interface CrewConfig {
  /** Crew 描述 */
  description?: string;
  /** 执行模式：sequential（顺序）或 parallel（并行） */
  executionMode?: 'sequential' | 'parallel';
  /** 是否在任务失败时继续执行 */
  continueOnError?: boolean;
  /** 最大并发数（并行模式） */
  maxConcurrency?: number;
  /** 其他元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * @interface CrewExecutionResult
 * @description Crew 执行结果
 */
export interface CrewExecutionResult {
  /** 执行是否成功 */
  success: boolean;
  /** 所有任务的结果 */
  results: TaskResult[];
  /** 总执行时间（毫秒） */
  totalExecutionTime: number;
  /** 错误信息（如果有） */
  error?: string;
  /** 元数据 */
  metadata?: Record<string, unknown>;
}

/**
 * @class Crew
 * @description CrewAI 风格的 Crew 实现
 * 负责编排智能体和任务，实现复杂的协作流程
 */
@Injectable()
export class Crew {
  private readonly logger = new Logger(Crew.name);
  private readonly agents = new Map<string, Agent>();
  private readonly tasks = new Map<string, Task>();

  constructor(
    private readonly name: string,
    private readonly config: CrewConfig = {},
  ) {}

  /**
   * @method addAgent
   * @description 添加智能体到 Crew
   */
  public addAgent(name: string, agent: Agent): void {
    this.agents.set(name, agent);
    this.logger.debug(`Added agent "${name}" to crew "${this.name}"`);
  }

  /**
   * @method addTask
   * @description 添加任务到 Crew
   */
  public addTask(name: string, task: Task): void {
    this.tasks.set(name, task);
    this.logger.debug(`Added task "${name}" to crew "${this.name}"`);
  }

  /**
   * @method getAgent
   * @description 获取智能体
   */
  public getAgent(name: string): Agent | undefined {
    return this.agents.get(name);
  }

  /**
   * @method getTask
   * @description 获取任务
   */
  public getTask(name: string): Task | undefined {
    return this.tasks.get(name);
  }

  /**
   * @method execute
   * @description 执行 Crew 工作流
   * @param context - 全局上下文
   * @returns 执行结果
   */
  public async execute(context: Record<string, unknown> = {}): Promise<CrewExecutionResult> {
    const startTime = Date.now();
    const results: TaskResult[] = [];
    const completedTasks = new Set<string>();
    const executionMode = this.config.executionMode ?? 'sequential';
    const continueOnError = this.config.continueOnError ?? false;

    this.logger.log(`Starting crew "${this.name}" execution (mode: ${executionMode})`);

    try {
      if (executionMode === 'sequential') {
        // 顺序执行
        const sortedTasks = this.sortTasksByDependencies();
        for (const task of sortedTasks) {
          if (!task.canExecute(completedTasks)) {
            const error = `Task "${task.getName()}" dependencies not met`;
            this.logger.error(error);
            if (!continueOnError) {
              throw new Error(error);
            }
            continue;
          }

          const agent = this.selectAgentForTask(task);
          if (!agent) {
            const error = `No agent available for task "${task.getName()}"`;
            this.logger.error(error);
            if (!continueOnError) {
              throw new Error(error);
            }
            continue;
          }

          const result = await task.execute(agent, {
            input: context,
            dependencies: this.getDependencyResults(task.getName(), results),
            globalContext: context,
          });

          results.push(result);
          completedTasks.add(task.getName());

          if (!result.success && !continueOnError) {
            throw new Error(result.error ?? 'Task execution failed');
          }
        }
      } else {
        // 并行执行
        const maxConcurrency = this.config.maxConcurrency ?? 3;
        const sortedTasks = this.sortTasksByDependencies();
        const taskQueue = [...sortedTasks];
        const executingTasks = new Set<string>();

        while (taskQueue.length > 0 || executingTasks.size > 0) {
          // 启动新任务
          while (taskQueue.length > 0 && executingTasks.size < maxConcurrency) {
            const task = taskQueue[0];
            if (!task.canExecute(completedTasks)) {
              taskQueue.shift();
              continue;
            }

            const agent = this.selectAgentForTask(task);
            if (!agent) {
              taskQueue.shift();
              continue;
            }

            const taskName = task.getName();
            executingTasks.add(taskName);
            taskQueue.shift();

            // 异步执行任务
            task
              .execute(agent, {
                input: context,
                dependencies: this.getDependencyResults(taskName, results),
                globalContext: context,
              })
              .then((result) => {
                results.push(result);
                completedTasks.add(taskName);
                executingTasks.delete(taskName);

                if (!result.success && !continueOnError) {
                  throw new Error(result.error ?? 'Task execution failed');
                }
              })
              .catch((error) => {
                executingTasks.delete(taskName);
                if (!continueOnError) {
                  throw error;
                }
              });
          }

          // 等待一段时间再检查
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      const totalExecutionTime = Date.now() - startTime;
      const allSuccess = results.every((r) => r.success);

      this.logger.log(
        `Crew "${this.name}" execution completed in ${totalExecutionTime}ms (success: ${allSuccess})`,
      );

      return {
        success: allSuccess,
        results,
        totalExecutionTime,
        metadata: {
          ...this.config.metadata,
          executionMode,
          crewName: this.name,
        },
      };
    } catch (error) {
      const totalExecutionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `Crew "${this.name}" execution failed: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );

      return {
        success: false,
        results,
        totalExecutionTime,
        error: errorMessage,
        metadata: {
          ...this.config.metadata,
          executionMode,
          crewName: this.name,
        },
      };
    }
  }

  /**
   * @method sortTasksByDependencies
   * @description 根据依赖关系排序任务
   */
  private sortTasksByDependencies(): Task[] {
    const tasks = Array.from(this.tasks.values());
    const sorted: Task[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (task: Task) => {
      if (visiting.has(task.getName())) {
        throw new Error(`Circular dependency detected in crew "${this.name}"`);
      }

      if (visited.has(task.getName())) {
        return;
      }

      visiting.add(task.getName());

      const dependencies = task.getDependencies();
      for (const depName of dependencies) {
        const depTask = this.tasks.get(depName);
        if (depTask) {
          visit(depTask);
        }
      }

      visiting.delete(task.getName());
      visited.add(task.getName());
      sorted.push(task);
    };

    for (const task of tasks) {
      if (!visited.has(task.getName())) {
        visit(task);
      }
    }

    return sorted;
  }

  /**
   * @method selectAgentForTask
   * @description 为任务选择合适的智能体
   */
  private selectAgentForTask(task: Task): Agent | undefined {
    const taskConfig = task.getConfig();

    // 如果任务指定了智能体，使用指定的
    if (taskConfig.agent) {
      return this.agents.get(taskConfig.agent);
    }

    // 否则返回第一个可用的智能体
    return Array.from(this.agents.values())[0];
  }

  /**
   * @method getDependencyResults
   * @description 获取依赖任务的结果
   */
  private getDependencyResults(
    taskName: string,
    results: TaskResult[],
  ): Record<string, TaskResult> {
    const task = this.tasks.get(taskName);
    if (!task) {
      return {};
    }

    const dependencies = task.getDependencies();
    const dependencyResults: Record<string, TaskResult> = {};

    for (const depName of dependencies) {
      const depResult = results.find((r) => r.taskName === depName);
      if (depResult) {
        dependencyResults[depName] = depResult;
      }
    }

    return dependencyResults;
  }
}
