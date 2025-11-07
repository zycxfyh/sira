// 文件路径: packages/common-backend/src/dto/update-character.dto.ts

import { z } from 'zod';

// [核心] 定义"织世者控制台"更新角色状态的请求体验证规则
export const updateCharacterSchema = z
  .object({
    hp: z.number().int().min(0).optional(),
    mp: z.number().int().min(0).optional(),
    maxHp: z.number().int().min(1).optional(),
    maxMp: z.number().int().min(0).optional(),
    status: z.string().max(50).optional(),
  })
  .strict() // .strict() 确保不会传入任何未在此定义的字段
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Request body cannot be empty.',
  }); // 确保请求体至少包含一个有效字段

export type UpdateCharacterDto = z.infer<typeof updateCharacterSchema>;
