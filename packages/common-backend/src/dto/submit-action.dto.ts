// 文件路径: libs/common/src/dto/submit-action.dto.ts

import { z } from 'zod';

// 自定义验证函数：检查控制字符
const noControlCharacters = (value: string) => {
  // 检查是否包含控制字符（除了制表符、换行符、回车符）
  return !/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value);
};

// 自定义验证函数：检查字符串长度
const maxLength400 = (value: string) => value.length <= 400;

/**
 * @name submitActionSchema
 * @description [联邦法律] 定义了玩家提交一个"行动"时，其数据包的标准格式。
 */
export const submitActionSchema = z.object({
  // 'type' 字段区分了不同的行动种类
  type: z.enum(['option', 'command', 'meta']),
  // 'payload' 载荷可以是任何东西，具体结构由type决定
  payload: z.any(),
}).superRefine((data, ctx) => {
  // 根据type进行不同的验证
  if (data.type === 'command') {
    // command类型的payload应该是字符串，且不能包含控制字符
    if (typeof data.payload !== 'string') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Command payload must be a string.',
        path: ['payload'],
      });
      return;
    }

    if (!noControlCharacters(data.payload)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Command payload contains invalid control characters.',
        path: ['payload'],
      });
    }
  } else if (data.type === 'option') {
    // option类型的payload应该是一个对象，包含text字段
    if (typeof data.payload !== 'object' || data.payload === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Option payload must be an object.',
        path: ['payload'],
      });
      return;
    }

    const payload = data.payload as any;
    if (typeof payload.text !== 'string') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Option payload text must be a string.',
        path: ['payload', 'text'],
      });
      return;
    }

    if (!maxLength400(payload.text)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Option text must be 400 characters or fewer.',
        path: ['payload', 'text'],
      });
    }
  }
  // meta类型暂不进行额外验证
});

export type SubmitActionDto = z.infer<typeof submitActionSchema>;
