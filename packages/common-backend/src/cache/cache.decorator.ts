// 文件路径: packages/common-backend/src/cache/cache.decorator.ts
// 灵感来源: NestJS Cache Manager
// 核心理念: 缓存装饰器，简化缓存使用

import { SetMetadata } from '@nestjs/common';

/**
 * @constant CACHE_KEY
 * @description 缓存键元数据键
 */
export const CACHE_KEY = 'cache:key';

/**
 * @constant CACHE_TTL
 * @description 缓存 TTL 元数据键
 */
export const CACHE_TTL = 'cache:ttl';

/**
 * @interface CacheOptions
 * @description 缓存装饰器选项
 */
export interface CacheDecoratorOptions {
  /** 缓存键（支持参数占位符，如 ':id'） */
  key?: string;
  /** TTL（秒） */
  ttl?: number;
  /** 缓存键前缀 */
  prefix?: string;
}

/**
 * @decorator Cache
 * @description 缓存装饰器
 *
 * @example
 * ```typescript
 * @Cache({ key: 'user::id', ttl: 3600 })
 * @Get(':id')
 * async findOne(@Param('id') id: string) {
 *   return this.service.findOne(id);
 * }
 * ```
 */
export const Cache = (options: CacheDecoratorOptions = {}) => {
  return (target: unknown, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(CACHE_KEY, options.key || propertyKey)(target as object, propertyKey, descriptor);
    SetMetadata(CACHE_TTL, options.ttl)(target as object, propertyKey, descriptor);
    SetMetadata('cache:prefix', options.prefix)(target as object, propertyKey, descriptor);
  };
};
