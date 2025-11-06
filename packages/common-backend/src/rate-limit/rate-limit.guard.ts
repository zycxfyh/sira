// 文件路径: packages/common-backend/src/rate-limit/rate-limit.guard.ts
// 灵感来源: express-rate-limit (https://github.com/express-rate-limit/express-rate-limit)
// 核心理念: API 限流保护，防止滥用和过载

import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request, Response } from "express";
import { RateLimitService } from "./rate-limit.service";

/**
 * @constant RATE_LIMIT_KEY
 * @description 元数据键，用于存储限流配置
 */
export const RATE_LIMIT_KEY = "rate_limit";

/**
 * @interface RateLimitOptions
 * @description 限流选项
 */
export interface RateLimitGuardOptions {
  /** 时间窗口（秒） */
  windowMs?: number;
  /** 最大请求数 */
  max?: number;
  /** 限流键生成器 */
  keyGenerator?: (request: Request) => string;
  /** 是否跳过成功请求 */
  skipSuccessfulRequests?: boolean;
  /** 是否跳过失败请求 */
  skipFailedRequests?: boolean;
  /** 自定义错误消息 */
  message?: string;
}

/**
 * @decorator RateLimit
 * @description 限流装饰器
 * 
 * @example
 * ```typescript
 * @RateLimit({ windowMs: 60, max: 100 })
 * @Get()
 * findAll() {
 *   return this.service.findAll();
 * }
 * ```
 */
export const RateLimit = (options: RateLimitGuardOptions = {}) => {
  return (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(RATE_LIMIT_KEY, options, descriptor.value);
  };
};

/**
 * @guard RateLimitGuard
 * @description 限流守卫
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // 获取限流配置
    const options = this.reflector.get<RateLimitGuardOptions>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    ) || {
      windowMs: 60, // 默认 60 秒
      max: 100, // 默认 100 次请求
    };

    // 生成限流键
    const keyGenerator = options.keyGenerator || this.defaultKeyGenerator;
    const key = keyGenerator(request);

    // 检查限流
    const result = await this.rateLimitService.checkLimit(key, {
      windowMs: options.windowMs!,
      max: options.max!,
    });

    // 设置限流响应头
    response.setHeader("X-RateLimit-Limit", options.max!);
    response.setHeader("X-RateLimit-Remaining", result.remaining);
    response.setHeader("X-RateLimit-Reset", result.resetTime);

    if (!result.allowed) {
      const message =
        options.message ||
        `Rate limit exceeded. Try again in ${Math.ceil(result.retryAfter / 1000)} seconds.`;
      
      this.logger.warn(
        `Rate limit exceeded for key: ${key}, remaining: ${result.remaining}`,
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message,
          retryAfter: Math.ceil(result.retryAfter / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  /**
   * @method defaultKeyGenerator
   * @description 默认限流键生成器（基于 IP 和用户 ID）
   */
  private defaultKeyGenerator(request: Request): string {
    const ip = request.ip || request.socket.remoteAddress || "unknown";
    const userId = (request as { user?: { id?: string } }).user?.id || "anonymous";
    const path = request.path;
    return `rate_limit:${ip}:${userId}:${path}`;
  }
}

