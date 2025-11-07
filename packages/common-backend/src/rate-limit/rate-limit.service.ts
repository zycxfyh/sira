// 文件路径: packages/common-backend/src/rate-limit/rate-limit.service.ts
// 核心理念: 滑动窗口限流算法，支持内存和 Redis 存储

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
// import type { RedisClientType } from "redis"; // 暂时不需要
import { Redis } from 'ioredis';

/**
 * @interface RateLimitOptions
 * @description 限流选项
 */
export interface RateLimitOptions {
  /** 时间窗口（毫秒） */
  windowMs: number;
  /** 最大请求数 */
  max: number;
}

/**
 * @interface RateLimitResult
 * @description 限流检查结果
 */
export interface RateLimitResult {
  /** 是否允许请求 */
  allowed: boolean;
  /** 剩余请求数 */
  remaining: number;
  /** 重置时间（Unix 时间戳，毫秒） */
  resetTime: number;
  /** 重试延迟（毫秒） */
  retryAfter: number;
}

/**
 * @service RateLimitService
 * @description 限流服务
 * 支持内存存储（开发环境）和 Redis 存储（生产环境）
 */
@Injectable()
export class RateLimitService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);

  // 内存存储（用于开发环境或单实例部署）
  private readonly memoryStore = new Map<string, { count: number; resetTime: number }>();

  // Redis 客户端（可选，用于分布式部署）
  private redisClient?: Redis;

  // 清理定时器
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    // 尝试连接 Redis（如果配置了）
    this.initRedis();

    // 启动内存存储清理定时器
    this.startCleanup();
  }

  /**
   * @method initRedis
   * @description 初始化 Redis 客户端（可选）
   */
  private initRedis(): void {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      try {
        this.redisClient = new Redis(redisUrl, {
          maxRetriesPerRequest: 3,
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
        });

        this.redisClient.on('error', (error) => {
          this.logger.warn('Redis connection error, falling back to memory store:', error);
          this.redisClient = undefined;
        });

        this.logger.log('Rate limiting using Redis storage');
      } catch (error) {
        this.logger.warn('Failed to initialize Redis, using memory store:', error);
      }
    } else {
      this.logger.log('Rate limiting using memory store (REDIS_URL not configured)');
    }
  }

  /**
   * @method checkLimit
   * @description 检查限流
   *
   * @example
   * ```typescript
   * const result = await rateLimitService.checkLimit('user:123', {
   *   windowMs: 60000,
   *   max: 100,
   * });
   *
   * if (!result.allowed) {
   *   throw new Error(`Rate limit exceeded. Retry after ${result.retryAfter}ms`);
   * }
   * ```
   */
  async checkLimit(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
    if (this.redisClient) {
      return this.checkLimitRedis(key, options);
    }
    return this.checkLimitMemory(key, options);
  }

  /**
   * @method checkLimitRedis
   * @description 使用 Redis 检查限流（滑动窗口）
   */
  private async checkLimitRedis(key: string, options: RateLimitOptions): Promise<RateLimitResult> {
    const { windowMs, max } = options;
    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `rate_limit:${key}`;

    try {
      // 使用 Redis 的 Sorted Set 实现滑动窗口
      const pipeline = this.redisClient!.pipeline();

      // 移除过期的时间戳
      pipeline.zremrangebyscore(redisKey, '-inf', String(windowStart));

      // 添加当前时间戳
      pipeline.zadd(redisKey, now, String(now));

      // 获取当前窗口内的请求数
      pipeline.zcard(redisKey);

      // 设置过期时间
      pipeline.expire(redisKey, Math.ceil(windowMs / 1000));

      const results = await pipeline.exec();
      const count = (results?.[2]?.[1] as number) || 0;

      const allowed = count < max;
      const remaining = Math.max(0, max - count);
      const resetTime = now + windowMs;
      const retryAfter = allowed ? 0 : resetTime - now;

      return {
        allowed,
        remaining,
        resetTime,
        retryAfter,
      };
    } catch (error) {
      this.logger.error(`Redis rate limit check failed, falling back to memory:`, error);
      return this.checkLimitMemory(key, options);
    }
  }

  /**
   * @method checkLimitMemory
   * @description 使用内存检查限流（固定窗口）
   */
  private checkLimitMemory(key: string, options: RateLimitOptions): RateLimitResult {
    const { windowMs, max } = options;
    const now = Date.now();
    const record = this.memoryStore.get(key);

    if (!record || now > record.resetTime) {
      // 新窗口或窗口已过期
      this.memoryStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });

      return {
        allowed: true,
        remaining: max - 1,
        resetTime: now + windowMs,
        retryAfter: 0,
      };
    }

    // 窗口内
    const allowed = record.count < max;
    record.count++;

    return {
      allowed,
      remaining: Math.max(0, max - record.count),
      resetTime: record.resetTime,
      retryAfter: allowed ? 0 : record.resetTime - now,
    };
  }

  /**
   * @method startCleanup
   * @description 启动内存存储清理定时器
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.memoryStore.entries()) {
        if (now > record.resetTime) {
          this.memoryStore.delete(key);
        }
      }
    }, 60000); // 每分钟清理一次
  }

  /**
   * @method onModuleDestroy
   * @description 模块销毁时清理资源
   */
  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.redisClient) {
      this.redisClient.quit();
    }
  }
}
