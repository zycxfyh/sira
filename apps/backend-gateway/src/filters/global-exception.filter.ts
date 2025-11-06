import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let details: Record<string, unknown> | string | null = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        // [核心修复] 使用类型守卫代替 any
        const responseObj = exceptionResponse as {
          message?: string;
          error?: unknown;
        };
        message = responseObj.message || message;
        details =
          responseObj.error !== undefined
            ? typeof responseObj.error === 'object' && responseObj.error !== null
              ? (responseObj.error as Record<string, unknown>)
              : String(responseObj.error)
            : null;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.stack);
    }

    const errorResponse = {
      statusCode: status,
      message,
      details,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(errorResponse);
  }
}
