// 文件路径: src/auth/dto/login.dto.ts

import { z } from 'zod';

// [核心] 定义登录请求体验证规则
export const loginSchema = z.object({
  email: z.string().email({ message: 'Invalid email format.' }),
  password: z.string().nonempty({ message: 'Password cannot be empty.' }),
});

export type LoginDto = z.infer<typeof loginSchema>;
