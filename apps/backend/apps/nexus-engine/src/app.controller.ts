// 文件路径: apps/nexus-engine/src/app.controller.ts (已植入Sentry测试端点)

import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * 默认的 NestJS 欢迎路由
   */
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /**
   * [Sentry验证端点]
   * 这是一个临时的路由，专门用于测试Sentry集成。
   * 当GET请求访问 /sentry-test-backend 时，此方法会立即抛出一个错误。
   * 这个未被捕获的错误将被我们注册的 SentryExceptionFilter 拦截，
   * 并作为一次事件上报到Sentry平台。
   */
  @Get('/sentry-test-backend')
  sentryTestBackend() {
    throw new Error('Sentry Backend Test - ' + new Date().toISOString());
  }
}