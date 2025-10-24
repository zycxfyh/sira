// 文件路径: apps/backend/libs/common/src/health/health.controller.ts

import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  @HttpCode(HttpStatus.OK)
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}