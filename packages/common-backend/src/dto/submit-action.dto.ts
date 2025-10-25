// 文件路径: libs/common/src/dto/submit-action.dto.ts

import { z } from 'zod';

/**
 * @name submitActionSchema
 * @description [联邦法律] 定义了玩家提交一个“行动”时，其数据包的标准格式。
 */
export const submitActionSchema = z.object({
  // 'type' 字段区分了不同的行动种类
  type: z.enum(['option', 'command', 'meta']),
  // 'payload' 载荷可以是任何东西，具体结构由type决定
  payload: z.any(),
});

export type SubmitActionDto = z.infer<typeof submitActionSchema>;