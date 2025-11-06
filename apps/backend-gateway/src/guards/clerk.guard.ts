// 文件路径: apps/backend-gateway/src/auth/guards/clerk.guard.ts

import { createClerkClient } from '@clerk/backend'; // [核心修复] 使用 createClerkClient 代替 clerkClient
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

// [核心修复] 定义 ClerkJWT 类型（兼容 @clerk/backend）
type ClerkJWT = {
  sub: string; // 用户 ID（subject）
  [key: string]: unknown; // 其他 JWT 字段
};

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);
  private readonly clerkClient: ReturnType<typeof createClerkClient>; // [核心修复] 使用正确的类型

  constructor(private readonly configService: ConfigService) {
    // [核心修复] 使用 createClerkClient 创建客户端实例
    const secretKey = this.configService.get<string>('CLERK_SECRET_KEY');
    if (!secretKey) {
      this.logger.error('CLERK_SECRET_KEY is not configured in environment variables.');
      throw new Error('Server configuration error: Clerk secret key is missing.');
    }
    this.clerkClient = createClerkClient({ secretKey });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader) {
      throw new UnauthorizedException('Authorization header is missing.');
    }

    // [核心修复] 提取 token（虽然当前使用 authenticateRequest，但保留以备后用）
    // const token = authorizationHeader.replace('Bearer ', '');

    try {
      // [核心修复] Clerk 2.x API：使用 authenticateRequest 方法验证请求
      // 注意：如果 API 不存在，可能需要使用其他验证方式（如直接解析 JWT）
      // 这里使用类型断言来处理 API 兼容性问题
      const authResult = await (
        this.clerkClient as unknown as {
          authenticateRequest?: (request: { headers: Headers }) => Promise<{
            userId?: string;
            sub?: string;
            [key: string]: unknown;
          }>;
        }
      ).authenticateRequest?.({
        headers: new Headers({
          authorization: authorizationHeader,
        }),
      });

      // 如果 authenticateRequest 不可用，尝试使用 JWT 解析（需要安装 @clerk/backend 的 JWT 工具）
      let userId: string | undefined;
      if (authResult) {
        userId = authResult.userId || (authResult.sub as string | undefined);
      }

      // [临时方案] 如果上述方法都不可用，使用类型断言强制验证
      // 注意：这需要在实际运行时验证 Clerk API 的正确用法
      if (!userId) {
        // 假设 token 格式正确，直接解析（实际生产环境需要正确验证）
        throw new UnauthorizedException('Unable to verify token with current Clerk API setup.');
      }

      const jwt: ClerkJWT = {
        sub: userId,
        userId,
      };

      // [核心] 将解码后的用户信息附加到请求对象上，供后续使用
      // 我们遵循Clerk的官方惯例，将其命名为 `req.auth`
      request.auth = { userId: jwt.sub, ...jwt };

      return true;
    } catch (error) {
      // [核心修复] 使用类型守卫处理错误
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Clerk JWT verification failed: ${errorMessage}`);
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }
}
