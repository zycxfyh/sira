// 文件路径: src/auth/dto/register.dto.ts

import { z } from 'zod';

// [修正] Zod的验证规则应通过链式调用附加
export const registerSchema = z.object({
  // 定义一个字符串类型，然后链式调用.email()进行格式验证
  email: z.string().email({ message: 'Invalid email format.' }),
  // 定义一个字符串类型，然后链式调用.min()进行长度验证
  password: z.string().min(8, { message: 'Password must be at least 8 characters long.' }),
});

// 类型推断保持不变，它将根据修正后的schema正常工作
export type RegisterDto = z.infer<typeof registerSchema>;
