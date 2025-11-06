// 文件路径: packages/common-backend/src/observability/observability.module.ts
// 职责: 可观测性模块，整合所有监控和追踪功能

import { Module } from '@nestjs/common';
import { ScheduleModule } from '../schedule/schedule.module';
import { SentryModule } from './sentry.module';
import { PerformanceMonitorService } from './performance-monitor.service';

/**
 * @module ObservabilityModule
 * @description 可观测性模块
 * 整合Sentry错误追踪、性能监控、分布式追踪等功能
 */
@Module({
  imports: [
    ScheduleModule, // 定时任务依赖
    SentryModule,
  ],
  providers: [PerformanceMonitorService],
  exports: [SentryModule, PerformanceMonitorService],
})
export class ObservabilityModule {}
