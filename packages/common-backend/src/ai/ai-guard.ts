// 文件路径: packages/common-backend/src/ai/ai-guard.ts

import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { AiGenerationException } from '../exceptions/ai-exception';
import { PromptInjectionDetectedException } from '../errors/prompt-injection-detected.exception';
// [核心修正] 从 runnables 导入通用的 Runnable 类型
import type { Runnable } from '@langchain/core/runnables';

/**
 * 提示注入检查结果类型
 */
export type PromptInjectionCheckResult = {
  allowed: boolean;
  score: number;
  threshold: number;
  reason: string;
  inputPreview?: string;
  details?: {
    preview?: string;
    context?: string;
  };
};

/**
 * 提示注入防护服务
 * 提供AI输入的安全检查功能
 */
@Injectable()
export class PromptInjectionGuard {
  private readonly threshold = 0.7;

  /**
   * 检查输入是否包含提示注入攻击
   * @param input 用户输入
   * @param context 上下文信息
   * @returns 检查结果
   */
  async checkInput(
    input: string,
    context?: { userId?: string; correlationId?: string }
  ): Promise<PromptInjectionCheckResult> {
    // 简单的实现 - 在实际项目中应该使用更复杂的检测逻辑
    const suspiciousPatterns = [
      /ignore.*previous.*instructions/i,
      /system.*prompt/i,
      /override.*settings/i,
      /bypass.*restrictions/i,
    ];

    const score = suspiciousPatterns.some(pattern => pattern.test(input)) ? 0.9 : 0.1;

    if (score >= this.threshold) {
      throw new PromptInjectionDetectedException(
        'Potential prompt injection detected',
        {
          score,
          threshold: this.threshold,
          preview: input.substring(0, 100),
          context: context?.correlationId,
          correlationId: context?.correlationId,
          userId: context?.userId,
        }
      );
    }

    return {
      allowed: true,
      score,
      threshold: this.threshold,
      reason: score < this.threshold ? 'passed' : 'failed',
      details: {
        preview: input.substring(0, 100),
      },
    };
  }

  /**
   * 检查输入并在不安全时抛出异常
   * @param input 用户输入
   * @param context 上下文信息
   */
  async ensureSafeOrThrow(
    input: string,
    context?: { userId?: string; correlationId?: string }
  ): Promise<void> {
    const result = await this.checkInput(input, context);
    if (!result.allowed) {
      throw new PromptInjectionDetectedException(
        'Input failed security check',
        {
          score: result.score,
          threshold: result.threshold,
          preview: result.details?.preview,
          context: context?.correlationId,
          correlationId: context?.correlationId,
          userId: context?.userId,
        }
      );
    }
  }
}

const MAX_RETRIES = 2;

/**
 * [核心护栏] 使用Zod Schema安全地调用LangChain链，并提供自动重试机制。
 * @param chain 要调用的LangChain实例
 * @param params 传递给chain.invoke的参数
 * @param schema 用于验证输出的Zod Schema
 * @returns 一个Promise，成功时解析为符合Schema的类型安全数据
 * @throws {AiGenerationException} 如果AI在多次重试后仍无法生成有效数据
 */
export async function callAiWithGuard<T extends z.ZodType>(
  chain: Runnable, // <-- [核心修正] 使用 Runnable 类型
  params: object,
  schema: T,
): Promise<z.infer<T>> {
  let lastError: any = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await chain.invoke(params);

      // 尝试解析，无论响应是对象还是字符串
      const dataToParse = typeof response === 'string' ? JSON.parse(response) : response;

      const parseResult = await schema.safeParseAsync(dataToParse);

      if (parseResult.success) {
        return parseResult.data;
      } else {
        lastError = parseResult.error;
        console.warn(
          `[AI Guard] Attempt ${attempt + 1} failed validation:`,
          lastError,
        );
      }
    } catch (error) {
      lastError = error;
      console.error(
        `[AI Guard] Attempt ${attempt + 1} failed with invocation error:`,
        error,
      );
    }
  }

  // 如果所有尝试都失败了，则抛出最终的异常
  throw new AiGenerationException(
    `AI failed to generate valid data after ${MAX_RETRIES + 1} attempts.`,
    lastError,
  );
}