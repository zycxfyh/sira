// 文件路径: packages/common-backend/src/errors/websocket-error-helper.ts
// 职责: 将处理错误转换为 WebSocket 友好的错误事件载荷
//
// 核心功能:
// 1. 将 ProcessingErrorResponse 转换为 WebSocket 事件数据
// 2. 生成用户友好的错误消息
// 3. 提供前端错误处理的标准化格式

import { type ProcessingErrorResponse, ProcessingErrorType } from './error-classification';

/**
 * WebSocket processing_failed 事件的标准载荷
 *
 * @property errorCode - 错误分类码（前端可根据此显示不同UI）
 * @property errorMessage - 用户友好的错误信息
 * @property retryable - 是否可重试
 * @property suggestedAction - 建议的用户操作
 * @property correlationId - 关联ID（用于追踪）
 * @property errorType - 错误类型（用于调试）
 */
export interface ProcessingFailedEventPayload {
  /** 错误分类码 */
  errorCode: string;
  /** 用户友好的错误信息 */
  errorMessage: string;
  /** 是否可重试 */
  retryable: boolean;
  /** 建议的用户操作 */
  suggestedAction?: string;
  /** 关联ID（用于追踪） */
  correlationId?: string;
  /** 错误类型（用于调试和日志） */
  errorType?: ProcessingErrorType;
  /** 原始错误消息（用于调试，可选） */
  originalError?: string;
}

/**
 * 将 ProcessingErrorResponse 转换为 WebSocket 事件载荷
 *
 * @param errorResponse - 标准化的错误响应
 * @param correlationId - 关联ID（可选）
 * @returns WebSocket 友好的错误事件载荷
 *
 * @remarks
 * 此函数确保：
 * 1. 错误信息对用户友好
 * 2. 前端可以根据 errorCode 显示不同的 UI
 * 3. 用户知道是否应该重试以及如何操作
 *
 * @example
 * ```typescript
 * const errorResponse = classifyProcessingError(error);
 * const eventPayload = formatErrorForWebSocket(errorResponse, correlationId);
 *
 * eventBus.publish('NOTIFY_USER', {
 *   userId,
 *   event: 'processing_failed',
 *   data: eventPayload,
 * });
 * ```
 */
export function formatErrorForWebSocket(
  errorResponse: ProcessingErrorResponse,
  correlationId?: string,
  originalError?: string,
): ProcessingFailedEventPayload {
  // 根据错误类型生成更友好的消息
  const friendlyMessage = getFriendlyErrorMessage(errorResponse);

  return {
    errorCode: errorResponse.errorCode,
    errorMessage: friendlyMessage,
    retryable: errorResponse.retryable,
    suggestedAction: errorResponse.suggestedAction,
    correlationId,
    errorType: errorResponse.errorType,
    originalError,
  };
}

/**
 * 根据错误类型生成用户友好的错误消息
 *
 * @param errorResponse - 错误响应
 * @returns 用户友好的错误消息
 *
 * @remarks
 * 不同错误类型对应不同的用户消息：
 * - VALIDATION_ERROR: "输入格式错误"
 * - AI_GENERATION_ERROR: "AI 生成失败，请重试"
 * - NETWORK_ERROR: "网络连接失败，请检查网络后重试"
 * - DATABASE_ERROR: "数据服务暂时不可用，请稍后重试"
 * - BUSINESS_LOGIC_ERROR: "处理失败，请检查输入"
 */
function getFriendlyErrorMessage(errorResponse: ProcessingErrorResponse): string {
  // 如果已经有建议的操作，优先使用原始消息
  if (errorResponse.suggestedAction) {
    return errorResponse.message;
  }

  // 根据错误类型返回本地化的友好消息
  switch (errorResponse.errorType) {
    case ProcessingErrorType.VALIDATION_ERROR:
      return '输入格式错误，请检查后重试';

    case ProcessingErrorType.AI_GENERATION_ERROR:
      return 'AI 处理失败，系统将自动重试。如果问题持续，请联系支持';

    case ProcessingErrorType.NETWORK_ERROR:
      return '网络连接失败，请检查网络连接后重试';

    case ProcessingErrorType.DATABASE_ERROR:
      return '数据服务暂时不可用，请稍后重试';

    case ProcessingErrorType.BUSINESS_LOGIC_ERROR:
      return '处理失败，请检查输入是否正确';

    default:
      return errorResponse.message || '处理失败，请稍后重试';
  }
}
