// 文件路径: apps/backend/apps/nexus-engine/src/sentry.interceptor.ts (已修复)

import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import * as Sentry from '@sentry/node';
import { Scope } from '@sentry/node'; // <-- [核心修正] 从 @sentry/node 导入 Scope 类型

@Injectable()
export class SentryInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { user, params, route } = request;

    // [核心修正] 使用 withScope API，它更安全地处理作用域
    // 并为 scope 参数提供明确的类型
    Sentry.withScope((scope: Scope) => {
      if (user) {
        scope.setUser({ id: user.id, email: user.email });
      }

      if (params) {
        Object.keys(params).forEach((key) => {
          scope.setTag(`param_${key}`, params[key]);
        });
      }

      if (route) {
        scope.setTag('path', route.path);
        scope.setTag('method', request.method);
      }
    });

    // 对于拦截器，通常不需要 tap，除非您想在响应返回后执行某些操作。
    // 为了设置请求上下文，在 next.handle() 之前执行即可。
    return next.handle();
  }
}
