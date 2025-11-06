// 文件路径: packages/common-backend/src/types/queue-message-schemas.ts
// 职责: 定义所有队列消息的 Zod Schema，用于运行时验证
//
// 核心功能:
// 1. 为所有跨服务消息定义严格的 Schema
// 2. 确保消息格式在运行时被验证
// 3. 无效消息被立即丢弃，避免下游错误

import { z } from "zod";
import { submitActionSchema } from "../dto/submit-action.dto";
import { directiveSetSchema } from "./state-change-directive.dto";

/**
 * GameCreationPayload Schema
 * 用于验证从 backend-gateway 发往 creation-agent 的创世消息
 */
export const gameCreationPayloadSchema = z.object({
  userId: z.string().min(1, "UserId must not be empty"),
  concept: z
    .string()
    .min(10, "Concept must be at least 10 characters long")
    .max(500, "Concept must be 500 characters or less"),
});

export type GameCreationPayload = z.infer<typeof gameCreationPayloadSchema>;

/**
 * GameActionJobData Schema
 * 用于验证从 backend-gateway 发往 logic-agent 的玩家行动消息
 *
 * 注意：gameStateSnapshot 是一个复杂的 Prisma 类型，这里只验证基本结构
 * 详细的结构验证在业务逻辑层进行
 */
export const gameActionJobDataSchema = z.object({
  gameId: z.string().uuid("GameId must be a valid UUID"),
  userId: z.string().min(1, "UserId must not be empty"),
  playerAction: submitActionSchema,
  gameStateSnapshot: z.object({
    id: z.string(),
    name: z.string(),
    ownerId: z.string(),
    createdAt: z.union([z.date(), z.string()]), // 支持 Date 对象和 ISO 字符串
    updatedAt: z.union([z.date(), z.string()]),
    character: z
      .object({
        id: z.string(),
        gameId: z.string(),
        name: z.string(),
        card: z.unknown(), // Prisma Json 类型
        createdAt: z.union([z.date(), z.string()]),
        updatedAt: z.union([z.date(), z.string()]),
      })
      .nullable()
      .optional(),
    worldBook: z
      .array(
        z.object({
          id: z.string(),
          gameId: z.string(),
          key: z.string(),
          content: z.unknown(), // Prisma Json 类型
          createdAt: z.union([z.date(), z.string()]),
          updatedAt: z.union([z.date(), z.string()]),
        }),
      )
      .optional(),
  }),
  correlationId: z.string().optional(),
});

/**
 * NarrativeRenderingPayload Schema
 * 用于验证从 logic-agent 发往 narrative-agent 的叙事渲染消息
 */
export const narrativeRenderingPayloadSchema = z.object({
  gameId: z.string().uuid("GameId must be a valid UUID"),
  userId: z.string().min(1, "UserId must not be empty"),
  playerAction: submitActionSchema,
  executedDirectives: directiveSetSchema,
  correlationId: z.string().min(1, "CorrelationId must not be empty"),
});

export type NarrativeRenderingPayload = z.infer<typeof narrativeRenderingPayloadSchema>;
