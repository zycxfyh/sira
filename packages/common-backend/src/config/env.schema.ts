// 文件路径: packages/common-backend/src/config/env.schema.ts
// 核心理念: 类型安全的环境变量验证，启动时验证所有配置

import { z } from 'zod';

/**
 * @description 环境变量 Schema
 * 使用 Zod 验证所有环境变量，确保类型安全和配置完整
 */
export const envSchema = z.object({
  // 数据库配置
  DATABASE_URL: z.string().url('DATABASE_URL 必须是有效的 URL'),
  // 数据库连接池配置
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(20),
  DB_POOL_TIMEOUT: z.coerce.number().int().min(1).max(300).default(20), // 秒
  DB_IDLE_TIMEOUT: z.coerce.number().int().min(1).max(3600).default(300), // 秒

  // Redis 配置
  REDIS_URL: z.string().url('REDIS_URL 必须是有效的 URL').optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  // 加密配置
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY 至少需要 32 个字符'),
  ENCRYPTION_USE_SALT: z
    .string()
    .transform((val) => ['true', '1', 'yes'].includes(val.toLowerCase()))
    .pipe(z.boolean())
    .default('false'),
  ENCRYPTION_ALGORITHM: z.string().default('aes-256-gcm'),

  // Sentry 配置
  SENTRY_DSN: z.string().url('SENTRY_DSN 必须是有效的 URL').optional(),
  SENTRY_ENVIRONMENT: z.string().default('development'),
  SENTRY_TRACES_SAMPLE_RATE: z
    .string()
    .transform((val) => Number.parseFloat(val))
    .pipe(z.number().min(0).max(1))
    .default('1.0'),

  // AI Provider 后备配置
  FALLBACK_API_KEY: z.string().optional(),
  FALLBACK_MODEL_ID: z.string().default('deepseek-chat'),
  FALLBACK_BASE_URL: z.string().url().optional(),

  // 应用配置
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().url().default('http://localhost:5173'),

  // Qdrant 配置（向量数据库）
  QDRANT_URL: z.string().url().default('http://localhost:6333'),
  QDRANT_API_KEY: z.string().optional(),

  // Clerk 配置
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
});

/**
 * @type Env
 * @description 验证后的环境变量类型
 */
export type Env = z.infer<typeof envSchema>;

/**
 * @function validateEnv
 * @description 验证环境变量
 * @returns 验证后的环境变量
 * @throws {Error} 如果验证失败
 */
export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors.map((err) => {
        const path = err.path.join('.');
        return `${path}: ${err.message}`;
      });

      throw new Error(
        `环境变量验证失败:\n${errorMessages.join('\n')}\n\n请检查 .env 文件或环境变量配置。`,
      );
    }
    throw error;
  }
}
