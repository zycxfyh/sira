// 文件路径: packages/common-backend/src/errors/error-classification.ts
// 职责: 统一错误分类和错误响应格式，用于 RabbitMQ 消息处理
//
// 核心功能:
// 1. 将错误分类为可重试 vs 不可重试
// 2. 生成统一的错误响应格式
// 3. 提供错误码和建议操作

import { ZodError } from 'zod';
import { AiGenerationException } from '../exceptions/ai-exception';
import { PromptInjectionDetectedException } from './prompt-injection-detected.exception';

/**
 * 错误类型枚举
 */
export enum ProcessingErrorType {
  /** 验证错误 - 不可重试（消息格式错误） */
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  /** AI 生成错误 - 可重试（AI 可能临时故障） */
  AI_GENERATION_ERROR = 'AI_GENERATION_ERROR',
  /** 业务逻辑错误 - 不可重试（数据冲突等） */
  BUSINESS_LOGIC_ERROR = 'BUSINESS_LOGIC_ERROR',
  /** 网络错误 - 可重试（临时网络问题） */
  NETWORK_ERROR = 'NETWORK_ERROR',
  /** 数据库错误 - 可重试（连接问题等） */
  DATABASE_ERROR = 'DATABASE_ERROR',
  /** 未知错误 - 默认可重试（保守策略） */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * 错误响应格式
 */
export interface ProcessingErrorResponse {
  /** 错误类型 */
  errorType: ProcessingErrorType;
  /** 是否可重试 */
  retryable: boolean;
  /** 错误码 */
  errorCode: string;
  /** 用户友好的错误消息 */
  message: string;
  /** 详细错误信息（仅用于日志） */
  details?: unknown;
  /** 建议的用户操作 */
  suggestedAction?: string;
}

/**
 * 分类处理错误并生成统一的错误响应
 *
 * @param error - 捕获的错误
 * @param context - 上下文信息（可选）
 * @returns 标准化的错误响应
 *
 * @remarks
 * 分类规则：
 * - ZodError → VALIDATION_ERROR (不可重试)
 * - AiGenerationException → AI_GENERATION_ERROR (可重试)
 * - 网络错误 → NETWORK_ERROR (可重试)
 * - 数据库连接错误 → DATABASE_ERROR (可重试)
 * - 其他业务逻辑错误 → BUSINESS_LOGIC_ERROR (不可重试)
 */
export function classifyProcessingError(
  error: unknown,
  context?: { operation?: string; gameId?: string; userId?: string },
): ProcessingErrorResponse {
  // context 参数保留用于未来扩展（如基于上下文的错误分类）
  void context; // 标记为已使用，避免 lint 错误
  // Zod 验证错误 - 不可重试（消息格式错误）
  if (error instanceof ZodError) {
    return {
      errorType: ProcessingErrorType.VALIDATION_ERROR,
      retryable: false,
      errorCode: 'INVALID_MESSAGE_FORMAT',
      message: 'Message validation failed. The message format is incorrect.',
      details: error.issues,
      suggestedAction: 'Check the message format and resend with correct structure.',
    };
  }

  if (error instanceof PromptInjectionDetectedException) {
    return {
      errorType: ProcessingErrorType.VALIDATION_ERROR,
      retryable: false,
      errorCode: 'PROMPT_INJECTION_DETECTED',
      message: 'Potential prompt injection detected. The input has been rejected.',
      details: error.details,
      suggestedAction:
        'Revise the input to remove system override or malicious patterns before retrying.',
    };
  }

  // AI 生成错误 - 可重试
  if (error instanceof AiGenerationException) {
    return {
      errorType: ProcessingErrorType.AI_GENERATION_ERROR,
      retryable: true,
      errorCode: 'AI_GENERATION_FAILED',
      message: 'AI failed to generate valid output. The operation can be retried.',
      details: error.details,
      suggestedAction:
        'Retry the operation. If the issue persists, check AI provider configuration.',
    };
  }

  // 网络错误 - 可重试
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    if (
      errorName.includes('network') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('etimedout') ||
      errorMessage.includes('enotfound') ||
      errorMessage.includes('socket') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection')
    ) {
      return {
        errorType: ProcessingErrorType.NETWORK_ERROR,
        retryable: true,
        errorCode: 'NETWORK_CONNECTION_FAILED',
        message: 'Network connection failed. The operation can be retried.',
        details: error.message,
        suggestedAction: 'Retry the operation. Check network connectivity if the issue persists.',
      };
    }

    // 数据库错误 - 可重试
    if (
      errorName.includes('prisma') ||
      errorMessage.includes('database') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('query')
    ) {
      return {
        errorType: ProcessingErrorType.DATABASE_ERROR,
        retryable: true,
        errorCode: 'DATABASE_OPERATION_FAILED',
        message: 'Database operation failed. The operation can be retried.',
        details: error.message,
        suggestedAction: 'Retry the operation. Check database connection if the issue persists.',
      };
    }

    // 业务逻辑错误（特定错误名称）
    if (
      errorName.includes('business') ||
      errorName.includes('logic') ||
      errorMessage.includes('business logic') ||
      errorMessage.includes('conflict') ||
      errorMessage.includes('duplicate')
    ) {
      return {
        errorType: ProcessingErrorType.BUSINESS_LOGIC_ERROR,
        retryable: false,
        errorCode: 'BUSINESS_RULE_VIOLATION',
        message: 'Business logic validation failed. The operation cannot be retried.',
        details: error.message,
        suggestedAction: 'Review the request data and ensure it complies with business rules.',
      };
    }
  }

  // 默认：未知错误 - 保守策略（可重试）
  return {
    errorType: ProcessingErrorType.UNKNOWN_ERROR,
    retryable: true,
    errorCode: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred. The operation can be retried.',
    details: error instanceof Error ? error.message : String(error),
    suggestedAction: 'Retry the operation. Contact support if the issue persists.',
  };
}

/**
 * 判断错误是否应该重试
 *
 * @param error - 错误对象
 * @returns 是否应该重试
 */
export function shouldRetryError(error: unknown): boolean {
  const classification = classifyProcessingError(error);
  return classification.retryable;
}

/**
 * 获取错误的人类可读消息
 *
 * @param error - 错误对象
 * @returns 用户友好的错误消息
 */
export function getErrorMessage(error: unknown): string {
  const classification = classifyProcessingError(error);
  return classification.message;
}

// ProcessingErrorResponse 已经在上面定义并导出，不需要重复导出
