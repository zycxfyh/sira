// 文件路径: packages/common-backend/src/errors/message-handler-helper.ts
// 职责: 提供 RabbitMQ 消息处理辅助函数，统一错误处理和重试逻辑
//
// 核心功能:
// 1. 统一的错误处理包装器
// 2. 自动错误分类和重试决策
// 3. 返回正确的 ack/nack/requeue 响应
// 4. 集成 Sentry 错误上报

import type { Logger } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import type { Channel, Message } from 'amqplib';
import { classifyProcessingError } from './error-classification';
import { formatErrorForWebSocket } from './websocket-error-helper';

/**
 * 消息处理结果
 */
export type MessageHandlerResult = 'ack' | 'nack' | 'requeue';

/**
 * 消息处理上下文
 */
export interface MessageHandlerContext {
  correlationId?: string;
  gameId?: string;
  userId?: string;
  operation?: string;
}

/**
 * 消息处理选项
 */
export interface MessageHandlerOptions {
  /** 最大重试次数（默认 2） */
  maxRetries?: number;
  /** 是否记录详细错误日志（默认 true） */
  logDetails?: boolean;
  /** 是否上报到 Sentry（默认 true） */
  reportToSentry?: boolean;
  /** 错误时是否发布 WebSocket 错误事件（默认 false） */
  publishErrorEvent?: boolean;
  /** 错误事件发布器（仅在 publishErrorEvent=true 时使用） */
  errorEventPublisher?: (errorPayload: unknown) => void;
  /** 用户ID（用于错误事件，仅在 publishErrorEvent=true 时使用） */
  userId?: string;
  /** 错误事件名称（默认 'processing_failed'） */
  errorEventName?: string;
  /** Metrics 服务实例（可选，用于记录性能指标） */
  /** 服务名称（用于指标标签，例如 'logic-agent'） */
  serviceName?: string;
  /** 队列名称（用于指标标签） */
  queueName?: string;
}

/**
 * 包装消息处理函数，提供统一的错误处理
 *
 * @param handler - 消息处理函数
 * @param logger - Logger 实例
 * @param context - 消息上下文
 * @param options - 处理选项
 * @returns 包装后的处理函数，返回 'ack' | 'nack' | 'requeue'
 *
 * @remarks
 * 使用示例：
 * ```typescript
 * const wrappedHandler = withErrorHandling(
 *   async (data) => {
 *     await this.service.process(data);
 *   },
 *   this.logger,
 *   { correlationId: data.correlationId, gameId: data.gameId },
 *   { maxRetries: 2 }
 * );
 *
 * const result = await wrappedHandler(data);
 * // result 是 'ack' | 'nack' | 'requeue'
 * ```
 */
export function withErrorHandling<
  T extends { correlationId?: string; gameId?: string; userId?: string },
>(
  handler: (data: T) => Promise<void>,
  logger: Logger,
  context?: MessageHandlerContext,
  options: MessageHandlerOptions = {},
): (data: T, channel: Channel, message: Message) => Promise<MessageHandlerResult> {
  const {
    maxRetries = 2,
    logDetails = true,
    reportToSentry = true,
    publishErrorEvent = false,
    errorEventPublisher,
    userId,
    errorEventName = 'processing_failed',
  } = options;

  return async (data: T, _channel: Channel, message: Message): Promise<MessageHandlerResult> => {
    const correlationId = context?.correlationId || data.correlationId || 'unknown';
    const gameId = context?.gameId || data.gameId || 'unknown';
    const operation = context?.operation || 'process_message';
    const startTime = Date.now();

    try {
      await handler(data);
      const duration = Date.now() - startTime;

      logger.log(
        `[${correlationId}] ${operation} completed successfully for game: ${gameId} (${duration}ms)`,
      );
      return 'ack';
    } catch (error) {
      const errorResponse = classifyProcessingError(error, {
        operation,
        gameId,
        userId: context?.userId || data.userId,
      });

      // 上报到 Sentry
      if (reportToSentry) {
        Sentry.captureException(error, {
          tags: {
            correlationId,
            gameId,
            errorType: errorResponse.errorType,
            errorCode: errorResponse.errorCode,
            retryable: String(errorResponse.retryable),
          },
          extra: {
            jobData: data,
            errorDetails: errorResponse.details,
          },
        });
      }

      // 记录错误日志
      if (logDetails) {
        logger.error(
          `[${correlationId}] ${operation} failed for game ${gameId}: ${errorResponse.message}`,
          error instanceof Error ? error.stack : undefined,
          errorResponse.details,
        );
      } else {
        logger.error(`[${correlationId}] ${operation} failed: ${errorResponse.errorCode}`);
      }

      // [核心新增] 发布增强的错误事件到 WebSocket（如果启用）
      if (publishErrorEvent && errorEventPublisher) {
        const effectiveUserId = userId || context?.userId || data.userId;
        if (effectiveUserId) {
          try {
            const errorPayload = formatErrorForWebSocket(
              errorResponse,
              correlationId,
              error instanceof Error ? error.message : 'Unknown error',
            );
            errorEventPublisher({
              userId: effectiveUserId,
              event: errorEventName,
              data: errorPayload,
            });
            logger.debug(`[${correlationId}] Published enhanced error event: ${errorEventName}`);
          } catch (eventError) {
            // 错误事件发布失败不应影响主要错误处理流程
            logger.warn(
              `[${correlationId}] Failed to publish error event: ${eventError instanceof Error ? eventError.message : String(eventError)}`,
            );
          }
        }
      }

      // 不可重试的错误，直接丢弃
      if (!errorResponse.retryable) {
        logger.warn(
          `[${correlationId}] Error is not retryable (${errorResponse.errorType}). Discarding message.`,
        );
        return 'nack';
      }

      // 检查重试次数
      const retryCount = (message.properties.headers?.['x-death'] || []).length;

      if (retryCount < maxRetries) {
        logger.warn(
          `[${correlationId}] ${operation} failed. Will retry (${retryCount + 1}/${maxRetries + 1}). Error: ${errorResponse.errorCode}`,
        );
        return 'requeue';
      } else {
        logger.error(
          `[${correlationId}] ${operation} failed after ${maxRetries + 1} attempts. Sending to DLQ. Error: ${errorResponse.errorCode}`,
        );
        // 超过最大重试次数，发送到死信队列
        return 'nack';
      }
    }
  };
}

/**
 * 处理 RabbitMQ 消息并返回正确的响应
 * 用于使用 @nestjs/microservices 的场景（手动管理 channel）
 *
 * @param handler - 消息处理函数
 * @param channel - RabbitMQ Channel
 * @param message - RabbitMQ Message
 * @param logger - Logger 实例
 * @param context - 消息上下文
 * @param options - 处理选项
 */
export async function handleRabbitMQMessage<
  T extends { correlationId?: string; gameId?: string; userId?: string },
>(
  handler: (data: T) => Promise<void>,
  channel: Channel,
  message: Message,
  logger: Logger,
  context?: MessageHandlerContext,
  options: MessageHandlerOptions = {},
): Promise<void> {
  const wrappedHandler = withErrorHandling(handler, logger, context, options);
  const result = await wrappedHandler(message.content as unknown as T, channel, message);

  // 根据结果执行相应的 RabbitMQ 操作
  if (result === 'ack') {
    channel.ack(message);
  } else if (result === 'requeue') {
    channel.nack(message, false, true); // requeue
  } else {
    channel.nack(message, false, false); // 发送到 DLQ
  }
}

/**
 * 处理 nestjs-rmq 消息处理器的返回值
 * 用于使用 @RMQRoute 的场景（自动管理 ack/nack）
 *
 * @param handler - 消息处理函数
 * @param logger - Logger 实例
 * @param context - 消息上下文
 * @param options - 处理选项
 * @returns 包装后的处理函数，返回 'ack' | 'nack' | 'requeue'
 *
 * @remarks
 * 使用示例：
 * ```typescript
 * @RMQRoute('action.player.submitted', {...})
 * public async handlePlayerAction(data: GameActionJobData): Promise<'ack' | 'nack' | 'requeue'> {
 *   return withRMQErrorHandling(
 *     async () => {
 *       await this.service.process(data);
 *     },
 *     this.logger,
 *     { correlationId: data.correlationId, gameId: data.gameId },
 *     { maxRetries: 2 }
 *   );
 * }
 * ```
 */
export function withRMQErrorHandling<
  T extends { correlationId?: string; gameId?: string; userId?: string },
>(
  handler: (data: T) => Promise<void>,
  logger: Logger,
  context?: MessageHandlerContext,
  options: MessageHandlerOptions = {},
): (data: T) => Promise<MessageHandlerResult> {
  const {
    maxRetries: _maxRetries = 2, // eslint-disable-line @typescript-eslint/no-unused-vars
    logDetails = true,
    reportToSentry = true,
    publishErrorEvent = false,
    errorEventPublisher,
    userId,
    errorEventName = 'processing_failed',
  } = options;

  return async (data: T): Promise<MessageHandlerResult> => {
    const correlationId = context?.correlationId || data.correlationId || 'unknown';
    const gameId = context?.gameId || data.gameId || 'unknown';
    const operation = context?.operation || 'process_message';
    const startTime = Date.now();

    try {
      await handler(data);
      const duration = Date.now() - startTime;

      logger.log(
        `[${correlationId}] ${operation} completed successfully for game: ${gameId} (${duration}ms)`,
      );
      return 'ack';
    } catch (error) {
      const errorResponse = classifyProcessingError(error, {
        operation,
        gameId,
        userId: context?.userId || data.userId,
      });

      // 上报到 Sentry
      if (reportToSentry) {
        Sentry.captureException(error, {
          tags: {
            correlationId,
            gameId,
            errorType: errorResponse.errorType,
            errorCode: errorResponse.errorCode,
            retryable: String(errorResponse.retryable),
          },
          extra: {
            jobData: data,
            errorDetails: errorResponse.details,
          },
        });
      }

      // 记录错误日志
      if (logDetails) {
        logger.error(
          `[${correlationId}] ${operation} failed for game ${gameId}: ${errorResponse.message}`,
          error instanceof Error ? error.stack : undefined,
          errorResponse.details,
        );
      } else {
        logger.error(`[${correlationId}] ${operation} failed: ${errorResponse.errorCode}`);
      }

      // [核心新增] 发布增强的错误事件到 WebSocket（如果启用）
      if (publishErrorEvent && errorEventPublisher) {
        const effectiveUserId = userId || context?.userId || data.userId;
        if (effectiveUserId) {
          try {
            const errorPayload = formatErrorForWebSocket(
              errorResponse,
              correlationId,
              error instanceof Error ? error.message : 'Unknown error',
            );
            errorEventPublisher({
              userId: effectiveUserId,
              event: errorEventName,
              data: errorPayload,
            });
            logger.debug(`[${correlationId}] Published enhanced error event: ${errorEventName}`);
          } catch (eventError) {
            // 错误事件发布失败不应影响主要错误处理流程
            logger.warn(
              `[${correlationId}] Failed to publish error event: ${eventError instanceof Error ? eventError.message : String(eventError)}`,
            );
          }
        }
      }

      // 不可重试的错误，直接丢弃
      if (!errorResponse.retryable) {
        logger.warn(
          `[${correlationId}] Error is not retryable (${errorResponse.errorType}). Discarding message.`,
        );
        return 'nack';
      }

      // 注意：在 nestjs-rmq 中，重试次数由 RabbitMQ 配置管理
      // 我们只需要返回 'requeue'，让 RabbitMQ 处理重试
      // maxRetries 参数在这里不适用，因为重试由 RabbitMQ 管理
      logger.warn(
        `[${correlationId}] ${operation} failed. Will be requeued by RabbitMQ. Error: ${errorResponse.errorCode}`,
      );
      return 'requeue';
    }
  };
}
