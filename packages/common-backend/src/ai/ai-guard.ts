// 文件路径: apps/backend/libs/common/src/ai/ai-guard.ts (已修复导入)

import { z } from 'zod';
import { AiGenerationException } from '../exceptions/ai-exception';
// [核心修正] 从 runnables 导入通用的 Runnable 类型
import type { Runnable } from '@langchain/core/runnables';

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