// 文件路径: src/games/dto/create-game.dto.ts

import { z } from 'zod';

// [核心] 定义叙事驱动创世的请求体验证规则
export const createNarrativeGameSchema = z.object({
  concept: z
    .string()
    .min(10, { message: 'Concept must be at least 10 characters long.' })
    .max(500, { message: 'Concept must be 500 characters or less.' }),

  // [未来扩展] 可以在这里加入世界参数，如
  // params: z.object({ chaos: z.number().min(0).max(100), ... }).optional()
});

export type CreateNarrativeGameDto = z.infer<typeof createNarrativeGameSchema>;
