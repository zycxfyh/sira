// 文件路径: packages/common-backend/src/reactive/event-stream.ts
// 灵感来源: RxJS (https://github.com/ReactiveX/rxjs)
// 核心理念: 响应式数据流，使用 Observable 处理异步事件

import { Injectable, Logger } from "@nestjs/common";
import { Subject, Observable, mergeMap, catchError } from "rxjs";

/**
 * @interface EventStreamConfig
 * @description 事件流配置
 */
export interface EventStreamConfig {
  /** 事件名称 */
  eventName: string;
  /** 是否自动重试 */
  autoRetry?: boolean;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 重试延迟（毫秒） */
  retryDelay?: number;
}

/**
 * @class EventStream
 * @description RxJS 风格的事件流处理器
 * 用于处理异步事件流，支持操作符组合和错误处理
 */
@Injectable()
export class EventStream {
  private readonly logger = new Logger(EventStream.name);
  private readonly streams = new Map<string, Subject<any>>();

  /**
   * @method createStream
   * @description 创建事件流
   */
  public createStream<T = unknown>(
    eventName: string,
  ): Observable<T> {
    if (!this.streams.has(eventName)) {
      this.streams.set(eventName, new Subject<any>());
    }

    return this.streams.get(eventName) as Observable<T>;
  }

  /**
   * @method emit
   * @description 发送事件到流
   */
  public emit<T = unknown>(eventName: string, data: T): void {
    const stream = this.streams.get(eventName);
    if (stream) {
      stream.next(data);
      this.logger.debug(`Emitted event "${eventName}"`);
    } else {
      this.logger.warn(`Stream "${eventName}" not found`);
    }
  }

  /**
   * @method subscribe
   * @description 订阅事件流
   */
  public subscribe<T = unknown>(
    eventName: string,
    handler: (data: T) => void | Promise<void>,
    config?: EventStreamConfig,
  ): () => void {
    const stream = this.createStream<T>(eventName);

    const subscription = stream.subscribe({
      next: async (data) => {
        try {
          await handler(data);
        } catch (error) {
          this.logger.error(
            `Error handling event "${eventName}":`,
            error instanceof Error ? error.message : String(error),
          );

          if (config?.autoRetry) {
            await this.retryHandler(eventName, handler, data, config);
          }
        }
      },
      error: (error) => {
        this.logger.error(
          `Stream error for "${eventName}":`,
          error instanceof Error ? error.message : String(error),
        );
      },
    });

    return () => subscription.unsubscribe();
  }

  /**
   * @method pipe
   * @description 管道操作符（简化版）
   */
  public pipe<T, R>(
    eventName: string,
    transform: (data: T) => R | Promise<R>,
  ): Observable<R> {
    const stream = this.createStream<T>(eventName);

    return stream.pipe(
      mergeMap(async (data) => {
        try {
          return await transform(data);
        } catch (error) {
          this.logger.error(
            `Error in pipe for "${eventName}":`,
            error instanceof Error ? error.message : String(error),
          );
          throw error;
        }
      }),
      catchError((error) => {
        this.logger.error(
          `Pipe error for "${eventName}":`,
          error instanceof Error ? error.message : String(error),
        );
        throw error;
      }),
    );
  }

  /**
   * @method retryHandler
   * @description 重试处理器
   */
  private async retryHandler<T>(
    eventName: string,
    handler: (data: T) => void | Promise<void>,
    data: T,
    config: EventStreamConfig,
  ): Promise<void> {
    const maxRetries = config.maxRetries ?? 3;
    const retryDelay = config.retryDelay ?? 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));

      try {
        await handler(data);
        this.logger.log(
          `Successfully retried event "${eventName}" after ${attempt} attempts`,
        );
        return;
      } catch (error) {
        if (attempt === maxRetries) {
          this.logger.error(
            `Failed to handle event "${eventName}" after ${maxRetries} attempts`,
            error instanceof Error ? error.message : String(error),
          );
          throw error;
        }
      }
    }
  }

  /**
   * @method close
   * @description 关闭事件流
   */
  public close(eventName: string): void {
    const stream = this.streams.get(eventName);
    if (stream) {
      stream.complete();
      this.streams.delete(eventName);
      this.logger.debug(`Closed stream "${eventName}"`);
    }
  }

  /**
   * @method closeAll
   * @description 关闭所有事件流
   */
  public closeAll(): void {
    for (const [eventName, stream] of this.streams.entries()) {
      stream.complete();
      this.logger.debug(`Closed stream "${eventName}"`);
    }
    this.streams.clear();
  }
}

