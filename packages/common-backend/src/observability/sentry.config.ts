// 文件路径: packages/common-backend/src/observability/sentry.config.ts
// 灵感来源: Sentry (https://github.com/getsentry/sentry-javascript)
// 核心理念: 增强的错误追踪和性能监控配置

import * as Sentry from '@sentry/node';
import type { NodeOptions } from '@sentry/node';

/**
 * @interface SentryConfigOptions
 * @description Sentry 配置选项
 */
export interface SentryConfigOptions {
  /** 环境名称 */
  environment?: string;
  /** 发布版本 */
  release?: string;
  /** DSN */
  dsn?: string;
  /** 采样率 */
  tracesSampleRate?: number;
  /** 性能监控采样率 */
  profilesSampleRate?: number;
  /** 是否启用性能监控 */
  enablePerformanceMonitoring?: boolean;
  /** 自定义标签 */
  tags?: Record<string, string>;
  /** 忽略的错误 */
  ignoreErrors?: string[];
}

/**
 * @function configureSentry
 * @description 配置 Sentry，增强错误追踪和性能监控
 *
 * @example
 * ```typescript
 * configureSentry({
 *   environment: 'production',
 *   release: '1.0.0',
 *   enablePerformanceMonitoring: true,
 *   tags: {
 *     service: 'backend-gateway',
 *   },
 * });
 * ```
 */
export function configureSentry(options: SentryConfigOptions = {}): void {
  const {
    environment = process.env.NODE_ENV || 'development',
    release = process.env.APP_VERSION || '1.0.0',
    dsn = process.env.SENTRY_DSN,
    tracesSampleRate = environment === 'production' ? 0.1 : 1.0,
    profilesSampleRate = environment === 'production' ? 0.1 : 1.0,
    enablePerformanceMonitoring = true,
    tags = {},
    ignoreErrors = [
      // 忽略常见的网络错误
      'NetworkError',
      'Network request failed',
      // 忽略已知的第三方库错误
      'ResizeObserver loop limit exceeded',
    ],
  } = options;

  if (!dsn) {
    console.warn('Sentry DSN not configured, skipping Sentry initialization');
    return;
  }

  const sentryOptions: NodeOptions = {
    dsn,
    environment,
    release,
    tracesSampleRate,
    profilesSampleRate: enablePerformanceMonitoring ? profilesSampleRate : 0,
    // 忽略的错误
    ignoreErrors,
    // 自定义标签
    initialScope: {
      tags: {
        ...tags,
        environment,
        release,
      },
    },
    // 性能监控配置
    integrations: [
      // HTTP 请求追踪
      Sentry.httpIntegration(),
      // Express 追踪
      Sentry.expressIntegration(),
    ],
    // 在开发环境中启用调试
    debug: environment === 'development',
    // 自动会话追踪
    autoSessionTracking: true,
    // 发送默认 PII（个人可识别信息）
    sendDefaultPii: false,
  };

  Sentry.init(sentryOptions);

  console.log(`Sentry initialized for environment: ${environment}, release: ${release}`);
}

/**
 * @function setSentryUser
 * @description 设置 Sentry 用户上下文
 */
export function setSentryUser(user: { id: string; email?: string; username?: string }): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
}

/**
 * @function setSentryContext
 * @description 设置 Sentry 上下文
 */
export function setSentryContext(key: string, context: Record<string, unknown>): void {
  Sentry.setContext(key, context);
}

/**
 * @function setSentryTag
 * @description 设置 Sentry 标签
 */
export function setSentryTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

/**
 * @function captureException
 * @description 捕获异常（增强版）
 */
export function captureException(
  error: Error,
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
    user?: { id: string; email?: string };
  },
): void {
  if (context?.tags) {
    for (const [key, value] of Object.entries(context.tags)) {
      Sentry.setTag(key, value);
    }
  }

  if (context?.extra) {
    Sentry.setExtra('context', context.extra);
  }

  if (context?.user) {
    setSentryUser(context.user);
  }

  Sentry.captureException(error);
}

/**
 * @function captureMessage
 * @description 捕获消息（增强版）
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  },
): void {
  if (context?.tags) {
    for (const [key, value] of Object.entries(context.tags)) {
      Sentry.setTag(key, value);
    }
  }

  if (context?.extra) {
    Sentry.setExtra('context', context.extra);
  }

  Sentry.captureMessage(message, level);
}
