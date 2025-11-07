// 文件路径: packages/common-backend/src/observability/sentry.module.ts
// 核心理念: 模块化导出，方便使用

import { Module } from '@nestjs/common';

/**
 * @module SentryModule
 * @description Sentry 错误追踪和性能监控模块
 * 提供增强的 Sentry 配置和使用工具
 */
@Module({
  providers: [],
  exports: [],
})
export class SentryModule {}
