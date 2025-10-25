// 文件路径: apps/nexus-engine/src/sentry.filter.ts

import { Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

@Catch()
export class SentryExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // 只上报非HTTP异常和服务器内部错误 (5xx)
    const isHttpException = exception instanceof HttpException;
    const isInternalServerError = isHttpException && exception.getStatus() >= HttpStatus.INTERNAL_SERVER_ERROR;

    if (!isHttpException || isInternalServerError) {
      Sentry.captureException(exception);
    }
    
    // 调用基类方法，以确保NestJS的默认错误处理行为继续执行
    super.catch(exception, host);
  }
}