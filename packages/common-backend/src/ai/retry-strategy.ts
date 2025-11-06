// 文件路径: packages/common-backend/src/ai/retry-strategy.ts
// 职责: 智能重试策略，根据错误类型决定是否重试，并实现指数退避
//
// 设计理念:
// - 不同的错误类型有不同的可重试性
// - 可重试错误：网络错误、超时、临时性 API 错误（429, 503）
// - 不可重试错误：认证失败、参数错误、业务逻辑错误
// - 验证错误：可以重试，但需要反馈错误信息给 AI
//
// 退避策略:
// - 指数退避：每次重试的延迟时间递增
// - 添加随机抖动（jitter）避免雷群效应
// - 最大延迟限制，避免等待时间过长

/**
 * 错误类型分类
 */
export enum ErrorCategory {
  /** 网络错误（连接失败、超时等）- 可重试 */
  NETWORK = 'network',
  /** 临时性 API 错误（429 限流、503 服务不可用等）- 可重试 */
  TEMPORARY_API_ERROR = 'temporary_api_error',
  /** JSON 格式错误 - 可重试（自动修复） */
  JSON_PARSE_ERROR = 'json_parse_error',
  /** Schema 验证错误 - 可重试（带错误反馈） */
  VALIDATION_ERROR = 'validation_error',
  /** 认证错误（401, 403）- 不可重试 */
  AUTHENTICATION_ERROR = 'authentication_error',
  /** 参数错误（400）- 不可重试 */
  INVALID_REQUEST = 'invalid_request',
  /** 业务逻辑错误 - 不可重试 */
  BUSINESS_LOGIC_ERROR = 'business_logic_error',
  /** 未知错误 - 默认可重试 */
  UNKNOWN = 'unknown',
}

/**
 * 错误分类结果
 */
export interface ErrorClassification {
  /** 错误类别 */
  category: ErrorCategory;
  /** 是否应该重试 */
  shouldRetry: boolean;
  /** 错误消息 */
  message: string;
  /** 是否包含错误反馈信息（用于传递给 AI） */
  hasFeedback: boolean;
  /** 错误反馈信息（如果适用） */
  feedback?: string;
}

/**
 * 重试配置
 */
export interface RetryConfig {
  /** 最大重试次数（不包括初始尝试） */
  maxRetries: number;
  /** 初始延迟（毫秒） */
  initialDelayMs: number;
  /** 最大延迟（毫秒） */
  maxDelayMs: number;
  /** 指数退避的底数（默认 2） */
  backoffMultiplier: number;
  /** 是否启用随机抖动 */
  enableJitter: boolean;
  /** 抖动百分比（0-1，默认 0.2 即 ±20%） */
  jitterRatio: number;
}

/** 默认重试配置 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  enableJitter: true,
  jitterRatio: 0.2,
};

/**
 * 分类错误并决定是否应该重试
 *
 * @param error - 要分类的错误
 * @param validationFeedback - 如果是验证错误，提供格式化后的反馈信息
 * @returns 错误分类结果
 *
 * @remarks
 * 分类规则：
 * - 网络错误（ECONNREFUSED, ETIMEDOUT, ENOTFOUND 等）→ 可重试
 * - HTTP 429 (Rate Limit) → 可重试，延迟较长
 * - HTTP 503 (Service Unavailable) → 可重试
 * - HTTP 401/403 → 不可重试（认证问题）
 * - HTTP 400 → 不可重试（参数问题）
 * - JSON 解析错误 → 可重试（自动修复）
 * - Zod 验证错误 → 可重试（带反馈）
 * - 其他错误 → 默认可重试（保守策略）
 */
export function classifyError(error: unknown, validationFeedback?: string): ErrorClassification {
  // Zod 验证错误
  if (error && typeof error === 'object' && 'issues' in error) {
    return {
      category: ErrorCategory.VALIDATION_ERROR,
      shouldRetry: true,
      message: 'Schema validation failed',
      hasFeedback: true,
      feedback: validationFeedback,
    };
  }

  // Error 对象
  if (error instanceof Error) {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    // 网络错误
    if (
      errorName.includes('network') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('etimedout') ||
      errorMessage.includes('enotfound') ||
      errorMessage.includes('socket') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection')
    ) {
      return {
        category: ErrorCategory.NETWORK,
        shouldRetry: true,
        message: `Network error: ${error.message}`,
        hasFeedback: false,
      };
    }

    // HTTP 错误（如果有 status 属性）
    const statusCode =
      (error as { status?: number; statusCode?: number }).status ||
      (error as { status?: number; statusCode?: number }).statusCode;

    if (statusCode) {
      if (statusCode === 429) {
        return {
          category: ErrorCategory.TEMPORARY_API_ERROR,
          shouldRetry: true,
          message: 'Rate limit exceeded (429)',
          hasFeedback: false,
        };
      }
      if (statusCode === 503 || statusCode === 502 || statusCode === 504) {
        return {
          category: ErrorCategory.TEMPORARY_API_ERROR,
          shouldRetry: true,
          message: `Service unavailable (${statusCode})`,
          hasFeedback: false,
        };
      }
      if (statusCode === 401 || statusCode === 403) {
        return {
          category: ErrorCategory.AUTHENTICATION_ERROR,
          shouldRetry: false,
          message: `Authentication failed (${statusCode})`,
          hasFeedback: false,
        };
      }
      if (statusCode === 400) {
        return {
          category: ErrorCategory.INVALID_REQUEST,
          shouldRetry: false,
          message: `Invalid request (${statusCode})`,
          hasFeedback: false,
        };
      }
    }

    // JSON 解析错误
    if (
      errorName.includes('json') ||
      errorName.includes('syntax') ||
      errorMessage.includes('json') ||
      errorMessage.includes('parse')
    ) {
      return {
        category: ErrorCategory.JSON_PARSE_ERROR,
        shouldRetry: true,
        message: `JSON parse error: ${error.message}`,
        hasFeedback: false,
      };
    }

    // 业务逻辑错误（特定错误名称）
    if (
      errorName.includes('business') ||
      errorName.includes('logic') ||
      errorMessage.includes('business logic')
    ) {
      return {
        category: ErrorCategory.BUSINESS_LOGIC_ERROR,
        shouldRetry: false,
        message: `Business logic error: ${error.message}`,
        hasFeedback: false,
      };
    }
  }

  // 字符串错误
  if (typeof error === 'string') {
    const lowerError = error.toLowerCase();
    if (lowerError.includes('timeout') || lowerError.includes('network')) {
      return {
        category: ErrorCategory.NETWORK,
        shouldRetry: true,
        message: `Network error: ${error}`,
        hasFeedback: false,
      };
    }
  }

  // 默认：未知错误，保守策略（可重试）
  return {
    category: ErrorCategory.UNKNOWN,
    shouldRetry: true,
    message: error instanceof Error ? error.message : String(error),
    hasFeedback: false,
  };
}

/**
 * 计算重试延迟时间（指数退避 + 抖动）
 *
 * @param attemptNumber - 当前尝试次数（从 0 开始，0 是第一次尝试）
 * @param config - 重试配置
 * @returns 延迟时间（毫秒）
 *
 * @remarks
 * 公式：
 * - baseDelay = initialDelayMs * (backoffMultiplier ^ attemptNumber)
 * - delay = min(baseDelay, maxDelayMs)
 * - if enableJitter: delay = delay * (1 + random(-jitterRatio, +jitterRatio))
 *
 * 示例（initialDelayMs=500, backoffMultiplier=2, maxDelayMs=5000）:
 * - attempt 0: 500ms
 * - attempt 1: 1000ms (500 * 2)
 * - attempt 2: 2000ms (500 * 4)
 * - attempt 3: 4000ms (500 * 8)
 * - attempt 4: 5000ms (500 * 16, capped at maxDelayMs)
 */
export function calculateRetryDelay(
  attemptNumber: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): number {
  // 计算基础延迟（指数退避）
  const baseDelay = Math.min(
    config.initialDelayMs * config.backoffMultiplier ** attemptNumber,
    config.maxDelayMs,
  );

  // 添加随机抖动（如果启用）
  if (config.enableJitter) {
    const jitter = baseDelay * config.jitterRatio * (Math.random() - 0.5) * 2;
    return Math.max(0, Math.round(baseDelay + jitter));
  }

  return Math.round(baseDelay);
}

/**
 * 根据错误类别获取建议的延迟时间
 *
 * @param category - 错误类别
 * @param attemptNumber - 当前尝试次数
 * @param config - 重试配置
 * @returns 建议的延迟时间（毫秒）
 *
 * @remarks
 * 不同错误类型的特殊处理：
 * - Rate Limit (429): 使用更长的初始延迟
 * - Network Error: 标准指数退避
 * - Validation Error: 较短延迟（AI 修复应该很快）
 */
export function getRecommendedDelay(
  category: ErrorCategory,
  attemptNumber: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
): number {
  // Rate Limit 错误需要更长的延迟
  if (category === ErrorCategory.TEMPORARY_API_ERROR) {
    const rateLimitConfig = {
      ...config,
      initialDelayMs: 2000, // Rate limit 需要更长延迟
      maxDelayMs: 10000,
    };
    return calculateRetryDelay(attemptNumber, rateLimitConfig);
  }

  // 验证错误使用较短延迟（AI 应该能快速修复）
  if (category === ErrorCategory.VALIDATION_ERROR) {
    const validationConfig = {
      ...config,
      initialDelayMs: 200, // 验证错误修复应该很快
    };
    return calculateRetryDelay(attemptNumber, validationConfig);
  }

  // 其他错误使用标准延迟
  return calculateRetryDelay(attemptNumber, config);
}

/**
 * 延迟函数（Promise 包装的 setTimeout）
 *
 * @param ms - 延迟毫秒数
 * @returns Promise，在指定时间后 resolve
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
