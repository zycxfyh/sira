// 文件路径: packages/common-backend/src/ai/langfuse.service.ts
// 职责: Langfuse AI观测和监控服务

import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Langfuse } from 'langfuse';

export interface LangfuseTrace {
  id: string;
  name: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface LangfuseSpan {
  id: string;
  name: string;
  traceId: string;
  startTime: Date;
  endTime?: Date;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class LangfuseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LangfuseService.name);
  private langfuse: Langfuse | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const publicKey = this.configService.get<string>('LANGFUSE_PUBLIC_KEY');
    const secretKey = this.configService.get<string>('LANGFUSE_SECRET_KEY');
    const baseUrl = this.configService.get<string>('LANGFUSE_BASE_URL');

    if (publicKey && secretKey) {
      this.langfuse = new Langfuse({
        publicKey,
        secretKey,
        baseUrl: baseUrl || 'https://cloud.langfuse.com',
      });

      this.langfuse.on('error', (error) => {
        this.logger.error('Langfuse error:', error);
      });

      this.logger.log('Langfuse client initialized');
    } else {
      this.logger.warn('Langfuse credentials not found, service will be disabled');
    }
  }

  async onModuleDestroy() {
    if (this.langfuse) {
      await this.langfuse.flushAsync();
      this.langfuse = null;
      this.logger.log('Langfuse client shutdown');
    }
  }

  /**
   * 创建新的追踪
   */
  async createTrace(name: string, metadata?: Record<string, any>, tags?: string[]): Promise<LangfuseTrace> {
    if (!this.langfuse) {
      return this.createMockTrace(name, metadata, tags);
    }

    try {
      const trace = this.langfuse.trace({
        name,
        metadata,
        tags,
      });

      this.logger.debug(`Created trace: ${trace.id} - ${name}`);
      return {
        id: trace.id,
        name,
        metadata,
        tags,
      };
    } catch (error) {
      this.logger.error('Failed to create Langfuse trace:', error);
      return this.createMockTrace(name, metadata, tags);
    }
  }

  /**
   * 创建Span
   */
  async createSpan(
    name: string,
    traceId: string,
    metadata?: Record<string, any>,
  ): Promise<LangfuseSpan> {
    if (!this.langfuse) {
      return this.createMockSpan(name, traceId, metadata);
    }

    try {
      const trace = this.langfuse.trace({ id: traceId });
      const span = trace.span({
        name,
        metadata,
      });

      this.logger.debug(`Created span: ${span.id} - ${name} in trace ${traceId}`);
      return {
        id: span.id,
        name,
        traceId,
        startTime: new Date(),
        metadata,
      };
    } catch (error) {
      this.logger.error('Failed to create Langfuse span:', error);
      return this.createMockSpan(name, traceId, metadata);
    }
  }

  /**
   * 完成Span
   */
  async endSpan(spanId: string, output?: any): Promise<void> {
    if (!this.langfuse) {
      this.logger.debug(`Mock ended span: ${spanId}`, { output });
      return;
    }

    try {
      // Langfuse自动处理span的结束
      this.logger.debug(`Span ${spanId} will be ended automatically by Langfuse`, { output });
    } catch (error) {
      this.logger.error('Failed to end Langfuse span:', error);
    }
  }

  /**
   * 记录事件
   */
  async recordEvent(name: string, traceId: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.langfuse) {
      this.logger.debug(`Mock recorded event: ${name} in trace ${traceId}`, metadata);
      return;
    }

    try {
      const trace = this.langfuse.trace({ id: traceId });
      trace.event({
        name,
        metadata,
      });
      this.logger.debug(`Recorded event: ${name} in trace ${traceId}`, metadata);
    } catch (error) {
      this.logger.error('Failed to record Langfuse event:', error);
    }
  }

  /**
   * 记录模型调用
   */
  async recordModelCall(
    traceId: string,
    modelName: string,
    input: any,
    output: any,
    metadata?: Record<string, any>,
  ): Promise<void> {
    if (!this.langfuse) {
      this.logger.debug(`Mock recorded model call: ${modelName} in trace ${traceId}`, {
        input,
        output,
        metadata,
      });
      return;
    }

    try {
      const trace = this.langfuse.trace({ id: traceId });
      const generation = trace.generation({
        name: `model-call-${modelName}`,
        model: modelName,
        input,
        output,
        metadata,
      });
      this.logger.debug(`Recorded model call generation: ${generation.id} for model ${modelName} in trace ${traceId}`);
    } catch (error) {
      this.logger.error('Failed to record Langfuse model call:', error);
    }
  }

  /**
   * 获取追踪统计
   */
  async getTraceStats(traceId: string): Promise<any> {
    if (!this.langfuse) {
      return {
        traceId,
        spans: [],
        events: [],
        duration: 0,
        isMock: true,
      };
    }

    try {
      // Langfuse SDK doesn't provide direct stats API, return basic info
      return {
        traceId,
        isMock: false,
        note: 'Use Langfuse dashboard for detailed statistics',
      };
    } catch (error) {
      this.logger.error('Failed to get Langfuse trace stats:', error);
      return {
        traceId,
        error: error instanceof Error ? error.message : String(error),
        isMock: false,
      };
    }
  }

  /**
   * 记录生成事件
   */
  async logGeneration(
    traceId: string,
    modelName: string,
    input: any,
    output: any,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.recordModelCall(traceId, modelName, input, output, metadata);
  }

  /**
   * 刷新数据
   */
  async flush(): Promise<void> {
    if (!this.langfuse) {
      this.logger.debug('Mock flushed Langfuse data');
      return;
    }

    try {
      await this.langfuse.flushAsync();
      this.logger.debug('Flushed Langfuse data');
    } catch (error) {
      this.logger.error('Failed to flush Langfuse data:', error);
    }
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.langfuse !== null;
  }

  /**
   * 创建模拟追踪（当Langfuse不可用时）
   */
  private createMockTrace(name: string, metadata?: Record<string, any>, tags?: string[]): LangfuseTrace {
    const trace: LangfuseTrace = {
      id: `mock-trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      metadata,
      tags,
    };

    this.logger.debug(`Created mock trace: ${trace.id} - ${name}`);
    return trace;
  }

  /**
   * 创建模拟Span（当Langfuse不可用时）
   */
  private createMockSpan(name: string, traceId: string, metadata?: Record<string, any>): LangfuseSpan {
    const span: LangfuseSpan = {
      id: `mock-span_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      traceId,
      startTime: new Date(),
      metadata,
    };

    this.logger.debug(`Created mock span: ${span.id} - ${name} in trace ${traceId}`);
    return span;
  }
}
