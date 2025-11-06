// 文件路径: packages/common-backend/src/ai/json-cleaner.ts
// 职责: 尝试修复并解析可能不规范的 AI JSON 输出
//
// 背景:
// AI 模型（特别是 LLM）在输出 JSON 时经常会出现以下问题：
// - 包裹在 Markdown 代码块中（```json ... ```）
// - 包含 JSON 不支持的单引号或注释
// - 缺少逗号或括号不匹配
// - 前后包含说明文字
//
// 本模块提供自动修复功能，尝试多种策略将"脏 JSON"转换为有效的 JSON 对象或数组。
//
// 修复策略（按优先级）:
// 1. 直接解析（最快的路径）
// 2. 使用 jsonrepair 库修复常见语法错误
// 3. 先修复引号再使用 jsonrepair
// 4. 仅修复引号
//
// 限制:
// - 只接受 JSON 对象或数组，不接受原始值（null, string, number, boolean）
// - 如果所有策略都失败，会抛出 JsonSanitizationError

// 动态导入以避免CommonJS/ESM问题

/**
 * JSON 清理错误
 * 当无法将输入字符串修复为有效 JSON 时抛出
 *
 * @property context - 包含原始输入和最后一次尝试的错误信息
 */
export class JsonSanitizationError extends Error {
  constructor(
    message: string,
    public readonly context?: { raw: string; lastError?: unknown },
  ) {
    super(message);
    this.name = "JsonSanitizationError";
  }
}

/**
 * 类型守卫：检查值是否为可接受的 JSON 结构（对象或数组）
 *
 * @param value - 要检查的值
 * @returns 如果是对象或数组返回 true，否则返回 false
 *
 * @remarks
 * 我们只接受对象和数组，不接受原始值（null, string, number, boolean）
 * 这是因为 AI 输出通常是结构化的数据，而不是单个值
 */
function isAcceptableJsonValue(
  value: unknown,
): value is Record<string, unknown> | unknown[] {
  // null 的类型是 'object'，需要显式排除
  if (value === null) {
    return false;
  }
  // 数组是可接受的
  if (Array.isArray(value)) {
    return true;
  }
  // 对象（但不是 null）是可接受的
  return typeof value === "object";
}

/**
 * 移除 Markdown 代码块包裹，如 ```json ... ```
 */
function stripCodeFences(raw: string): string {
  let result = raw.trim();

  if (result.startsWith("```")) {
    // 移除开头的 ``` 或 ```json
    result = result.replace(/^```[a-zA-Z]*\s*/i, "");
  }
  if (result.endsWith("```")) {
    result = result.replace(/```$/i, "");
  }

  return result.trim();
}

/**
 * 尝试提取字符串中的 JSON 主体（去掉说明文字、前后缀）。
 */
function extractJsonCore(raw: string): string {
  const firstBrace = raw.indexOf("{");
  const firstBracket = raw.indexOf("[");

  let start = -1;
  if (firstBrace !== -1 && firstBracket !== -1) {
    start = Math.min(firstBrace, firstBracket);
  } else {
    start = Math.max(firstBrace, firstBracket);
  }

  if (start === -1) {
    return raw;
  }

  const lastBrace = raw.lastIndexOf("}");
  const lastBracket = raw.lastIndexOf("]");
  const endCandidates = [lastBrace, lastBracket].filter(
    (index) => index !== -1,
  );
  const end =
    endCandidates.length > 0 ? Math.max(...endCandidates) : raw.length - 1;

  if (end <= start) {
    return raw.slice(start);
  }

  return raw.slice(start, end + 1);
}

/**
 * 尝试替换常见的单引号 JSON 格式为双引号。
 */
function normalizeQuotes(raw: string): string {
  const hasDoubleQuotes = raw.includes('"');
  const hasSingleQuotes = raw.includes("'");

  if (!hasDoubleQuotes && hasSingleQuotes) {
    return raw.replace(/'/g, '"');
  }

  return raw;
}

/**
 * 清理并解析 JSON 字符串
 *
 * @param raw - 可能是"脏"的 JSON 字符串，或已经是对象/数组的值
 * @returns 解析后的 JSON 对象或数组
 * @throws {JsonSanitizationError} 如果无法修复为有效 JSON
 *
 * @remarks
 * 修复流程：
 * 1. 如果不是字符串，直接返回（可能已经是解析过的对象）
 * 2. 移除 Markdown 代码块包裹
 * 3. 提取 JSON 核心部分（去掉前后说明文字）
 * 4. 尝试多种修复策略：
 *    a. 直接解析（最快的路径）
 *    b. 使用 jsonrepair 修复语法错误
 *    c. 先修复引号再使用 jsonrepair
 *    d. 仅修复引号
 * 5. 验证结果是对象或数组（不接受原始值）
 * 6. 如果所有策略都失败，抛出错误
 *
 * @example
 * ```typescript
 * // 处理包裹在 Markdown 中的 JSON
 * const result = cleanAndParseJson('```json\n{"key": "value"}\n```');
 * // => { key: "value" }
 *
 * // 处理单引号 JSON
 * const result2 = cleanAndParseJson("{'status': 'ok'}");
 * // => { status: "ok" }
 *
 * // 处理包含注释的 JSON
 * const result3 = cleanAndParseJson('{"name": "test", // comment\n}');
 * // => { name: "test" }
 * ```
 */
export function cleanAndParseJson(raw: unknown): unknown {
  // 如果已经是对象或数组，直接返回（避免不必要的处理）
  if (typeof raw !== "string") {
    return raw;
  }

  // 步骤 1: 移除 Markdown 代码块包裹
  let working = stripCodeFences(raw);
  // 步骤 2: 提取 JSON 核心部分（去掉前后说明文字）
  working = extractJsonCore(working);
  // 步骤 3: 去除首尾空白
  working = working.trim();

  // 步骤 4: 按优先级尝试多种修复策略
  // 从最快到最慢，从简单到复杂
  const attempts: Array<() => unknown | Promise<unknown>> = [
    // 策略 1: 直接解析（最快的路径，适用于已经是有效 JSON 的情况）
    () => JSON.parse(working),
    // 策略 2: 使用 jsonrepair 修复常见语法错误（如缺少逗号、括号不匹配等）
    async () => {
      try {
        // @ts-ignore - 动态导入，忽略TypeScript类型检查
        const { jsonrepair } = await import('jsonrepair');
        return JSON.parse(jsonrepair(working));
      } catch (error) {
        // 如果jsonrepair不可用，跳过此策略
        throw new Error('jsonrepair not available');
      }
    },
    // 策略 3: 先修复引号再使用 jsonrepair（处理单引号 JSON）
    async () => {
      try {
        // @ts-ignore - 动态导入，忽略TypeScript类型检查
        const { jsonrepair } = await import('jsonrepair');
        return JSON.parse(jsonrepair(normalizeQuotes(working)));
      } catch (error) {
        // 如果jsonrepair不可用，跳过此策略
        throw new Error('jsonrepair not available');
      }
    },
    // 策略 4: 仅修复引号（如果 jsonrepair 也不起作用）
    () => JSON.parse(normalizeQuotes(working)),
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const parsed = attempt();
      // 验证结果是对象或数组（不接受原始值）
      if (isAcceptableJsonValue(parsed)) {
        return parsed;
      }
      // 如果解析成功但不是对象/数组，记录错误但继续尝试其他策略
      lastError = new Error("Sanitized output was not a JSON object or array.");
    } catch (error) {
      // 解析失败，记录错误并尝试下一个策略
      lastError = error;
    }
  }

  // 所有策略都失败，抛出详细的错误信息
  throw new JsonSanitizationError(
    "Failed to sanitize AI output into valid JSON.",
    {
      raw,
      lastError,
    },
  );
}
