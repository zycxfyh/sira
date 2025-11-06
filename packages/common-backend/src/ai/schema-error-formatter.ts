// 文件路径: packages/common-backend/src/ai/schema-error-formatter.ts
// 职责: 格式化 Zod 验证错误，生成人类可读和 AI 可理解的错误信息
//
// 背景:
// Zod 验证错误包含丰富的信息，但默认格式对 AI 理解不够友好。
// 本模块将这些错误转换为结构化的、易于 AI 修复的格式。
//
// 使用场景:
// 1. 在重试时将错误信息反馈给 AI
// 2. 记录详细的验证失败日志
// 3. 生成用户友好的错误消息

import { z } from "zod";

/**
 * 格式化后的验证错误结构
 */
export interface FormattedValidationError {
  /** 人类可读的错误摘要 */
  summary: string;
  /** 详细的字段级别错误列表 */
  fieldErrors: Array<{
    /** 字段路径（如 'options[0].text'） */
    path: string;
    /** 期望的类型或格式 */
    expected: string;
    /** 实际收到的值 */
    received: string | undefined;
    /** 错误消息 */
    message: string;
  }>;
  /** AI 友好的修复建议（可以附加到 prompt） */
  aiFeedback: string;
}

/**
 * 格式化 Zod 验证错误为结构化的错误信息
 *
 * @param error - Zod 的 ZodError 实例
 * @returns 格式化后的错误信息
 *
 * @remarks
 * 提取以下信息：
 * - 缺失的必需字段
 * - 类型不匹配的字段
 * - 格式错误的字段（如无效的枚举值）
 * - 数组长度不符合要求
 *
 * @example
 * ```typescript
 * const result = schema.safeParse(data);
 * if (!result.success) {
 *   const formatted = formatZodError(result.error);
 *   console.error(formatted.summary);
 *   // 输出: "Validation failed: 3 errors found"
 * }
 * ```
 */
export function formatZodError(error: z.ZodError): FormattedValidationError {
  // 获取原始输入数据（ZodError 的 _def 属性可能包含原始数据）
  // 注意: 这是 Zod 内部 API，可能在未来版本中变化
  const inputData = (error as unknown as { data?: unknown }).data;
  const fieldErrors: FormattedValidationError["fieldErrors"] = [];

  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "root";

    // 确定期望的类型
    let expected = "unknown";
    if (issue.code === z.ZodIssueCode.invalid_type) {
      expected = issue.expected;
    } else if (issue.code === z.ZodIssueCode.invalid_enum_value) {
      expected = `one of: ${issue.options.join(", ")}`;
    } else if (issue.code === z.ZodIssueCode.too_small) {
      if (issue.type === "array") {
        expected = `array with at least ${issue.minimum} items`;
      } else if (issue.type === "string") {
        expected = `string with at least ${issue.minimum} characters`;
      } else if (issue.type === "number") {
        expected = `number >= ${issue.minimum}`;
      }
    } else if (issue.code === z.ZodIssueCode.too_big) {
      if (issue.type === "array") {
        expected = `array with at most ${issue.maximum} items`;
      } else if (issue.type === "string") {
        expected = `string with at most ${issue.maximum} characters`;
      } else if (issue.type === "number") {
        expected = `number <= ${issue.maximum}`;
      }
    } else if (issue.code === z.ZodIssueCode.invalid_string) {
      expected = `valid ${issue.validation} string`;
    }

    // 确定实际收到的值（截断过长的值）
    let received: string | undefined;
    if (issue.path.length > 0 && inputData !== undefined) {
      try {
        // 从原始数据中提取对应字段的值
        const receivedValue = issue.path.reduce((obj: unknown, key) => {
          if (typeof obj === "object" && obj !== null && key in obj) {
            return (obj as Record<string, unknown>)[key];
          }
          return undefined;
        }, inputData);

        if (receivedValue !== undefined) {
          const receivedStr = JSON.stringify(receivedValue);
          // 如果值太长，截断并添加省略号
          received =
            receivedStr.length > 100
              ? `${receivedStr.slice(0, 100)}...`
              : receivedStr;
        }
      } catch {
        // 如果无法访问值，忽略（保持 received 为 undefined）
      }
    }

    fieldErrors.push({
      path,
      expected,
      received,
      message: issue.message,
    });
  }

  // 生成摘要
  // [核心修复] 使用 Array.from() 处理 Set 迭代器，确保 ES2015 兼容性
  const uniquePaths = Array.from(new Set(fieldErrors.map((e) => e.path)));
  const summary =
    `Validation failed: ${error.issues.length} error(s) found. ` +
    `Fields with errors: ${uniquePaths.join(", ")}`;

  // 生成 AI 友好的反馈信息
  const aiFeedback = generateAiFeedback(fieldErrors);

  return {
    summary,
    fieldErrors,
    aiFeedback,
  };
}

/**
 * 生成 AI 友好的错误反馈信息
 *
 * @param fieldErrors - 字段级别的错误列表
 * @returns 格式化的反馈字符串，可以直接附加到 prompt
 *
 * @remarks
 * 生成的结构化反馈：
 * - 明确指出哪些字段有问题
 * - 说明期望的类型或格式
 * - 提供具体的修复建议
 */
function generateAiFeedback(
  fieldErrors: FormattedValidationError["fieldErrors"],
): string {
  if (fieldErrors.length === 0) {
    return "No validation errors found.";
  }

  const sections: string[] = [];
  sections.push("**Validation Errors Detected:**");
  sections.push("");

  // 按字段分组错误
  const errorsByField = new Map<
    string,
    FormattedValidationError["fieldErrors"]
  >();
  for (const error of fieldErrors) {
    const existing = errorsByField.get(error.path) || [];
    existing.push(error);
    errorsByField.set(error.path, existing);
  }

  // 为每个字段生成反馈
  // [核心修复] 使用 Array.from() 处理 Map 迭代器，确保 ES2015 兼容性
  for (const [path, errors] of Array.from(errorsByField.entries())) {
    sections.push(`**Field: ${path}**`);
    for (const error of errors) {
      sections.push(`- Expected: ${error.expected}`);
      if (error.received !== undefined) {
        sections.push(`- Received: ${error.received}`);
      }
      sections.push(`- Issue: ${error.message}`);
    }
    sections.push("");
  }

  sections.push("**Action Required:**");
  sections.push(
    "Please fix the above errors and regenerate the JSON output. " +
      "Ensure all required fields are present, types are correct, and values meet the constraints.",
  );

  return sections.join("\n");
}

/**
 * 将格式化错误转换为 JSON 字符串（用于日志记录）
 *
 * @param formattedError - 格式化后的错误信息
 * @returns JSON 字符串
 */
export function formatZodErrorAsJson(
  formattedError: FormattedValidationError,
): string {
  return JSON.stringify(
    {
      summary: formattedError.summary,
      fieldErrors: formattedError.fieldErrors,
      errorCount: formattedError.fieldErrors.length,
    },
    null,
    2,
  );
}
