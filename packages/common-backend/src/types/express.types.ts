// 文件路径: libs/common/src/types/express.d.ts

import type { User } from '@prisma/client';

// 扩展 Express 的全局命名空间
declare global {
  namespace Express {
    // 将我们自己的 User 类型（不含密码）合并到 Request 接口中
    export interface Request {
      user?: Omit<User, 'password'>;
    }
  }
}

// 添加一个空的 export 语句，将此文件标记为一个模块，使其能被正确识别
export {};
