// 文件路径: packages/common-backend/src/cache/cache.module.ts
// 核心理念: 统一使用Redis缓存，确保分布式一致性

import { Module } from "@nestjs/common";
import { CacheModule as NestCacheModule } from "@nestjs/cache-manager";
import { redisStore } from "cache-manager-redis-store";
import { ConfigService } from "@nestjs/config";
import { CacheService } from "./cache.service";

/**
 * @module CacheModule
 * @description 缓存模块
 * 统一使用Redis缓存，确保分布式一致性和高性能
 */
@Module({
  imports: [
    NestCacheModule.registerAsync({
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>("REDIS_URL");

        if (!redisUrl) {
          throw new Error(
            "REDIS_URL is required for caching. Please configure Redis connection."
          );
        }

        const url = new URL(redisUrl);

        // 统一使用Redis存储，确保分布式一致性
        return {
          store: redisStore,
          host: url.hostname,
          port: parseInt(url.port || '6379'),
          password: url.password || undefined,
          ttl: 3600, // 默认 1 小时
          max: 1000, // Redis可以处理更多缓存项
        } as any;
      },
    }),
  ],
  providers: [CacheService],
  exports: [CacheService, NestCacheModule],
})
export class CacheModule {}

