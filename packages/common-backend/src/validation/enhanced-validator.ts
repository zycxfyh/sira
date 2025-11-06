// 文件路径: packages/common-backend/src/validation/enhanced-validator.ts
// 灵感来源: Pydantic (https://github.com/pydantic/pydantic)
// 核心理念: 类型即文档，运行时验证，友好的错误消息

import { z } from 'zod';
import type { ZodError, ZodSchema } from 'zod';

/**
 * @interface ValidationResult
 * @description 验证结果
 */
export interface ValidationResult<T> {
  /** 验证是否成功 */
  success: boolean;
  /** 验证后的数据（如果成功） */
  data?: T;
  /** 验证错误（如果失败） */
  errors?: ValidationError[];
}

/**
 * @interface ValidationError
 * @description 验证错误详情
 */
export interface ValidationError {
  /** 字段路径 */
  path: (string | number)[];
  /** 错误消息 */
  message: string;
  /** 错误代码 */
  code: string;
  /** 期望的类型或值 */
  expected?: string;
  /** 实际收到的值 */
  received?: unknown;
  /** 嵌套错误（如果有） */
  nested?: ValidationError[];
}

/**
 * @class EnhancedValidator
 * @description 增强的验证器，提供 Pydantic 风格的友好错误消息
 */
export class EnhancedValidator {
  /**
   * @method validate
   * @description 验证数据
   * @param schema - Zod schema
   * @param data - 要验证的数据
   * @returns 验证结果
   */
  public static validate<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
    try {
      const parsed = schema.parse(data);
      return {
        success: true,
        data: parsed,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: this.formatZodErrors(error),
        };
      }

      return {
        success: false,
        errors: [
          {
            path: [],
            message: error instanceof Error ? error.message : String(error),
            code: 'UNKNOWN_ERROR',
          },
        ],
      };
    }
  }

  /**
   * @method validateAsync
   * @description 异步验证数据（支持异步验证规则）
   * @param schema - Zod schema
   * @param data - 要验证的数据
   * @returns 验证结果 Promise
   */
  public static async validateAsync<T>(
    schema: ZodSchema<T>,
    data: unknown,
  ): Promise<ValidationResult<T>> {
    try {
      const parsed = await schema.parseAsync(data);
      return {
        success: true,
        data: parsed,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          errors: this.formatZodErrors(error),
        };
      }

      return {
        success: false,
        errors: [
          {
            path: [],
            message: error instanceof Error ? error.message : String(error),
            code: 'UNKNOWN_ERROR',
          },
        ],
      };
    }
  }

  /**
   * @method safeParse
   * @description 安全解析（不抛出异常）
   * @param schema - Zod schema
   * @param data - 要验证的数据
   * @returns 验证结果
   */
  public static safeParse<T>(schema: ZodSchema<T>, data: unknown): ValidationResult<T> {
    const result = schema.safeParse(data);

    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }

    return {
      success: false,
      errors: this.formatZodErrors(result.error),
    };
  }

  /**
   * @method formatZodErrors
   * @description 格式化 Zod 错误为友好的错误消息
   */
  private static formatZodErrors(error: ZodError): ValidationError[] {
    return error.errors.map((err) => {
      const validationError: ValidationError = {
        path: err.path,
        message: this.formatErrorMessage(err),
        code: err.code,
      };

      // 添加类型信息
      if (err.code === 'invalid_type') {
        validationError.expected = err.expected;
        validationError.received = err.received;
      }

      // 添加约束信息
      if (err.code === 'too_small' || err.code === 'too_big') {
        const tooSmallErr = err as any;
        const tooBigErr = err as any;
        validationError.expected = `minimum: ${tooSmallErr.minimum ?? tooBigErr.minimum ?? 'N/A'}, maximum: ${tooSmallErr.maximum ?? tooBigErr.maximum ?? 'N/A'}`;
        validationError.received = (err as any).received;
      }

      return validationError;
    });
  }

  /**
   * @method formatErrorMessage
   * @description 格式化错误消息，使其更友好
   */
  private static formatErrorMessage(err: z.ZodIssue): string {
    const path = err.path.length > 0 ? err.path.join('.') : 'root';

    switch (err.code) {
      case 'invalid_type':
        return `${path}: 期望类型 "${err.expected}"，但收到类型 "${err.received}"`;

      case 'invalid_string':
        if (err.validation === 'email') {
          return `${path}: 无效的电子邮件地址`;
        }
        if (err.validation === 'url') {
          return `${path}: 无效的 URL`;
        }
        if (err.validation === 'uuid') {
          return `${path}: 无效的 UUID`;
        }
        return `${path}: 字符串验证失败`;

      case 'too_small':
        if (err.type === 'string') {
          return `${path}: 字符串长度至少为 ${err.minimum} 个字符`;
        }
        if (err.type === 'number') {
          return `${path}: 数值必须大于或等于 ${err.minimum}`;
        }
        if (err.type === 'array') {
          return `${path}: 数组至少需要 ${err.minimum} 个元素`;
        }
        return `${path}: 值太小（最小: ${err.minimum}）`;

      case 'too_big':
        if (err.type === 'string') {
          return `${path}: 字符串长度不能超过 ${err.maximum} 个字符`;
        }
        if (err.type === 'number') {
          return `${path}: 数值不能超过 ${err.maximum}`;
        }
        if (err.type === 'array') {
          return `${path}: 数组最多只能包含 ${err.maximum} 个元素`;
        }
        return `${path}: 值太大（最大: ${err.maximum}）`;

      case 'invalid_enum_value':
        return `${path}: 无效的枚举值。允许的值: ${err.options?.join(', ') ?? 'N/A'}`;

      case 'invalid_literal':
        return `${path}: 必须是字面量值 "${err.expected}"`;

      case 'unrecognized_keys':
        return `${path}: 未知的键: ${err.keys.join(', ')}`;

      case 'invalid_union':
        return `${path}: 值不匹配任何联合类型选项`;

      case 'invalid_date':
        return `${path}: 无效的日期格式`;

      case 'custom':
        return err.message ?? `${path}: 自定义验证失败`;

      default:
        return err.message ?? `${path}: 验证失败`;
    }
  }

  /**
   * @method formatErrorsAsString
   * @description 将错误格式化为字符串（用于日志或用户消息）
   */
  public static formatErrorsAsString(errors: ValidationError[]): string {
    return errors
      .map((err) => {
        const path = err.path.length > 0 ? err.path.join('.') : 'root';
        let message = `${path}: ${err.message}`;

        if (err.expected) {
          message += ` (期望: ${err.expected})`;
        }

        if (err.received !== undefined) {
          message += ` (收到: ${JSON.stringify(err.received)})`;
        }

        return message;
      })
      .join('\n');
  }
}
