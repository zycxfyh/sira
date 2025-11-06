// 文件路径: packages/common-backend/src/rate-limit/rate-limit.module.ts
// 灵感来源: express-rate-limit
// 核心理念: 模块化导出限流功能

import { Module } from '@nestjs/common';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';

/**
 * @module RateLimitModule
 * @description 限流模块
 * 提供 API 限流保护功能
 */
@Module({
  providers: [RateLimitService, RateLimitGuard],
  exports: [RateLimitService, RateLimitGuard],
})
export class RateLimitModule {}
