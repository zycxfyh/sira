// 文件路径: libs/common/src/types/state-change-directive.dto.ts

import { z } from 'zod';

// --- 原子操作定义 ---
// 定义了可以对数值进行的原子操作
const numericOperationSchema = z.object({
  op: z.enum(['set', 'increment', 'decrement']),
  value: z.number(),
});
export type NumericOperation = z.infer<typeof numericOperationSchema>;

// 定义了可以对字符串进行的操作
const stringOperationSchema = z.object({
  op: z.enum(['set', 'append', 'prepend']),
  value: z.string(),
});
export type StringOperation = z.infer<typeof stringOperationSchema>;

// --- 实体更新指令 ---
// 定义了针对一个角色的具体更新操作
const characterUpdateSchema = z.object({
  hp: numericOperationSchema.optional(),
  mp: numericOperationSchema.optional(),
  status: stringOperationSchema.optional(),
});
export type CharacterUpdate = z.infer<typeof characterUpdateSchema>;

// --- 状态变更指令核心定义 ---
/**
 * 定义了一条单独的、完整的状态变更指令。
 * 这是我们系统中“确定性操作”的最小单元。
 */
export const stateChangeDirectiveSchema = z.object({
  op: z.enum(['update_character', 'update_world_book']),
  targetId: z.string(),
  payload: z.union([characterUpdateSchema, z.record(z.string(), z.any())]),
});
export type StateChangeDirective = z.infer<typeof stateChangeDirectiveSchema>;

/**
 * 定义了一个指令集，它是一个指令数组。
 * “逻辑AI”的最终输出，就是一个符合此 Schema 的JSON对象。
 */
export const directiveSetSchema = z.array(stateChangeDirectiveSchema);
export type DirectiveSet = z.infer<typeof directiveSetSchema>;
