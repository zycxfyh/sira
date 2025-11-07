// 文件路径: packages/common-backend/src/config/config.module.ts
// 核心理念: 类型安全的环境配置模块

import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validateEnv } from './env.schema';
import { EnvLoader } from './env-loader';

/**
 * @module ConfigModule
 * @description 类型安全的环境配置模块
 * 提供环境变量验证和加载功能
 */
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      validationOptions: {
        allowUnknown: false,
        abortEarly: false,
      },
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule implements OnModuleInit {
  onModuleInit() {
    // 加载环境变量（支持扩展）
    EnvLoader.load({
      env: process.env.NODE_ENV || 'development',
    });
  }
}
