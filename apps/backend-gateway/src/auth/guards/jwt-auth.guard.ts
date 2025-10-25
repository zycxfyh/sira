// 文件路径: src/auth/guards/jwt-auth.guard.ts

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * 一个实现了JWT认证策略的守卫。
 * 当应用到控制器或路由处理程序时，它会自动调用JwtStrategy来验证请求。
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
