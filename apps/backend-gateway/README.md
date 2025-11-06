# 后端网关 (Backend Gateway)

## 概述

后端网关是创世星环系统的核心API服务，基于NestJS框架构建的微服务架构中的API网关。它提供统一的REST API接口、WebSocket实时通信支持，并负责请求路由、认证授权、负载均衡和跨域处理。

## 技术栈

- **框架**: NestJS
- **语言**: TypeScript
- **数据库ORM**: Prisma
- **认证**: JWT + Passport
- **实时通信**: Socket.IO + Redis适配器
- **缓存**: Redis
- **监控**: Sentry
- **验证**: Zod
- **文档**: OpenAPI/Swagger (可选)

## 架构设计

### 目录结构

```
apps/backend-gateway/
├── src/
│   ├── auth/              # 认证模块
│   │   ├── dto/           # 数据传输对象
│   │   ├── guards/        # 守卫
│   │   ├── strategies/    # Passport策略
│   │   └── *.controller.ts # 认证控制器
│   ├── games/             # 游戏管理模块
│   │   ├── dto/           # 游戏相关DTO
│   │   └── *.controller.ts # 游戏控制器
│   ├── settings/          # 设置管理模块
│   │   ├── dto/           # 设置相关DTO
│   │   └── *.controller.ts # 设置控制器
│   ├── gateway/           # WebSocket网关
│   │   └── updates.gateway.ts # 实时更新网关
│   ├── webhooks/          # Webhook处理
│   ├── filters/           # 全局异常过滤器
│   ├── guards/            # 全局守卫
│   ├── main.ts            # 应用入口
│   ├── app.module.ts      # 根模块
│   └── sentry.*           # 错误监控
├── test/                  # 单元测试
├── package.json
└── README.md
```

### 核心模块架构

#### 1. 认证模块 (AuthModule)

**功能职责**:
- 用户注册和登录
- JWT令牌生成和管理
- 用户会话验证
- 密码加密存储

**关键文件**:
- `auth/auth.controller.ts` - 认证API端点
- `auth/auth.service.ts` - 认证业务逻辑
- `auth/guards/jwt-auth.guard.ts` - JWT守卫
- `auth/strategies/jwt.strategy.ts` - JWT策略

**API端点**:
```typescript
POST /auth/login       // 用户登录
POST /auth/register    // 用户注册
GET  /auth/profile     // 获取用户信息
```

#### 2. 游戏管理模块 (GamesModule)

**功能职责**:
- 游戏创建和管理
- 玩家行动提交
- 游戏状态查询
- 角色信息更新

**关键文件**:
- `games/games.controller.ts` - 游戏API端点
- `games/games.service.ts` - 游戏业务逻辑

**API端点**:
```typescript
GET    /games                    // 获取用户的所有游戏
POST   /games/narrative-driven   // 创建叙事驱动游戏
GET    /games/:id                // 获取特定游戏详情
POST   /games/:id/actions        // 提交玩家行动
DELETE /games/:id                // 删除游戏
PATCH  /games/:id/character      // 更新角色状态
```

#### 3. 设置管理模块 (SettingsModule)

**功能职责**:
- AI配置管理
- 用户偏好设置
- 连接测试功能

**关键文件**:
- `settings/settings.controller.ts` - 设置API端点
- `settings/settings.service.ts` - 设置业务逻辑

**API端点**:
```typescript
GET    /settings/ai-configurations          // 获取AI配置列表
POST   /settings/ai-configurations          // 创建AI配置
PATCH  /settings/ai-configurations/:id      // 更新AI配置
DELETE /settings/ai-configurations/:id      // 删除AI配置
POST   /settings/ai-configurations/test-connection // 测试连接
```

#### 4. WebSocket网关 (GatewayModule)

**功能职责**:
- 实时消息推送
- 用户房间管理
- Redis集群支持

**关键文件**:
- `gateway/updates.gateway.ts` - WebSocket网关实现

**事件类型**:
```typescript
// 客户端事件
connect    // 连接建立
disconnect // 连接断开

// 服务端事件
game:update  // 游戏状态更新
action:result // 行动结果
```

#### 5. Webhook处理模块

**功能职责**:
- 外部服务集成
- 事件通知处理
- 安全验证

## 核心功能实现

### 1. JWT认证流程

```typescript
// 登录流程
@Post('login')
async login(@Body() loginDto: LoginDto) {
  const user = await this.authService.validateUser(loginDto);
  if (!user) {
    throw new UnauthorizedException('Invalid credentials');
  }
  return this.authService.generateJwtToken(user);
}
```

### 2. 请求验证管道

```typescript
// 使用Zod进行请求验证
@Post('narrative-driven')
async createNarrative(
  @Body(new ZodValidationPipe(createNarrativeGameSchema))
  dto: CreateNarrativeGameDto,
) {
  // 处理验证通过的数据
}
```

### 3. Redis WebSocket适配器

```typescript
// Redis集群支持的WebSocket适配器
export class RedisIoAdapter extends IoAdapter {
  async connectToRedis(): Promise<void> {
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();
    await Promise.all([pubClient.connect(), subClient.connect()]);
    this.adapterConstructor = createAdapter(pubClient, subClient);
  }
}
```

### 4. 全局异常处理

```typescript
// 统一的错误响应格式
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    // 标准化错误响应
  }
}
```

## 依赖关系

### 内部依赖

- **@tuheg/common-backend**: 共享的业务逻辑、DTO和数据库模型
- **PrismaModule**: 数据库访问层
- **HealthModule**: 健康检查

### 外部依赖

- **@nestjs/common**: NestJS核心功能
- **@nestjs/jwt**: JWT令牌处理
- **@nestjs/websockets**: WebSocket支持
- **@nestjs/config**: 配置管理
- **@socket.io/redis-adapter**: Redis WebSocket适配器
- **redis**: Redis客户端
- **bcryptjs**: 密码加密
- **zod**: 数据验证

## 配置管理

### 环境变量

```bash
# 数据库配置
DATABASE_URL=postgresql://user:pass@localhost:5432/db

# JWT配置
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h

# Redis配置
REDIS_URL=redis://localhost:6379

# 应用配置
NODE_ENV=production
PORT=3000

# Sentry监控
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

### 配置文件

```typescript
// config/database.config.ts
export const databaseConfig = {
  url: process.env.DATABASE_URL,
  // 其他数据库配置
};
```

## 部署和扩展

### Docker部署

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

### 负载均衡

- 支持多实例水平扩展
- Redis适配器确保WebSocket消息路由正确
- Session共享通过Redis实现

### 监控和日志

- **Sentry**: 错误监控和性能追踪
- **健康检查**: `/health` 端点
- **结构化日志**: Winston日志框架

## 安全性考虑

### 认证和授权

- JWT令牌验证
- 请求频率限制
- CORS配置
- 输入验证和清理

### 数据保护

- 密码bcrypt加密
- 敏感数据加密存储
- HTTPS强制使用
- API密钥安全管理

## 性能优化

### 缓存策略

- Redis缓存热点数据
- 数据库查询结果缓存
- JWT令牌黑名单缓存

### 数据库优化

- 连接池管理
- 查询优化和索引
- 读写分离 (可选)

### API优化

- 请求压缩
- 响应缓存头
- 分页查询支持

## 测试策略

### 单元测试

```typescript
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AuthService],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should validate user credentials', async () => {
    // 测试逻辑
  });
});
```

### 集成测试

- API端点测试
- 数据库集成测试
- WebSocket测试

### E2E测试

- 完整用户流程测试
- 性能测试

## 开发指南

### 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 运行测试
pnpm test

# 代码检查
pnpm lint
```

### 数据库迁移

```bash
# 生成迁移
npx prisma migrate dev

# 推送schema变更
npx prisma db push

# 生成Prisma客户端
npx prisma generate
```

## API文档

### OpenAPI规范

使用`@nestjs/swagger`生成API文档：

```typescript
// main.ts
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const config = new DocumentBuilder()
  .setTitle('创世星环 API')
  .setDescription('AI驱动的交互式叙事游戏生成系统API')
  .setVersion('1.0')
  .addTag('auth', '认证相关接口')
  .addTag('games', '游戏管理接口')
  .build();

const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api', app, document);
```

## 故障排查

### 常见问题

1. **WebSocket连接失败**
   - 检查Redis连接配置
   - 确认防火墙设置
   - 查看服务器日志

2. **数据库连接超时**
   - 检查DATABASE_URL配置
   - 确认数据库服务运行状态
   - 调整连接池大小

3. **JWT令牌过期**
   - 检查JWT_EXPIRES_IN设置
   - 实现令牌刷新机制

## 扩展规划

### 计划功能

- **API版本控制**: 实现v1, v2等版本
- **限流和熔断**: 集成Hystrix或类似机制
- **消息队列**: 集成RabbitMQ或Kafka
- **分布式追踪**: 集成Jaeger或Zipkin
- **配置中心**: 集成Consul或etcd

### 微服务拆分

当前单体架构可以进一步拆分为：
- **认证服务**: 独立的认证微服务
- **游戏服务**: 游戏逻辑微服务
- **通知服务**: 推送通知微服务
- **分析服务**: 数据分析微服务

## 相关文档

- [前端应用文档](../frontend/README.md)
- [AI代理文档](../logic-agent/README.md)
- [数据库schema](../../packages/common-backend/src/prisma/schema.prisma)
- [部署指南](../../deployment/)
