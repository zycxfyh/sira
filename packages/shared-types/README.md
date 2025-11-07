# Shared Types (共享类型包)

## 概述

Shared Types是创世星环系统的类型定义共享包，提供前后端通用的TypeScript类型定义。它采用模块化设计，包含API接口类型、业务实体类型、分页参数等，确保类型安全和代码一致性。

## 技术栈

- **语言**: TypeScript
- **验证**: Zod (可选，用于运行时验证)
- **打包**: TypeScript Compiler
- **分发**: npm包

## 架构设计

### 目录结构

```
packages/shared-types/
├── src/
│   ├── api/                 # API相关类型
│   │   └── types.ts        # API响应和请求类型
│   └── index.ts            # 主入口文件
├── package.json
├── tsconfig.json
└── README.md
```

## 核心类型定义

### 1. API基础类型

#### ApiResponse<T> - 统一API响应格式

```typescript
interface ApiResponse<T = unknown> {
  /** 数据 */
  data: T;
  /** 消息 */
  message?: string;
  /** 状态码 */
  status: number;
  /** 时间戳 */
  timestamp?: string;
}
```

**使用示例**:

```typescript
// 成功响应
const response: ApiResponse<User> = {
  data: { id: '1', email: 'user@example.com' },
  message: 'User retrieved successfully',
  status: 200,
  timestamp: '2024-01-01T00:00:00Z',
};

// 错误响应
const errorResponse: ApiResponse<null> = {
  data: null,
  message: 'User not found',
  status: 404,
  timestamp: '2024-01-01T00:00:00Z',
};
```

#### ApiError - API错误响应

```typescript
interface ApiError {
  /** 错误消息 */
  message: string;
  /** 错误代码 */
  code?: string;
  /** 状态码 */
  status: number;
  /** 错误详情 */
  details?: Record<string, unknown>;
  /** 时间戳 */
  timestamp?: string;
}
```

**使用示例**:

```typescript
const validationError: ApiError = {
  message: 'Validation failed',
  code: 'VALIDATION_ERROR',
  status: 400,
  details: {
    email: 'Invalid email format',
    password: 'Password too short',
  },
  timestamp: '2024-01-01T00:00:00Z',
};
```

### 2. 分页类型

#### PaginatedResponse<T> - 分页响应

```typescript
interface PaginatedResponse<T> {
  /** 数据列表 */
  data: T[];
  /** 总数 */
  total: number;
  /** 当前页 */
  page: number;
  /** 每页数量 */
  pageSize: number;
  /** 总页数 */
  totalPages: number;
}
```

#### PaginationParams - 分页参数

```typescript
interface PaginationParams {
  /** 页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 排序字段 */
  sortBy?: string;
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
}
```

**使用示例**:

```typescript
// 分页请求
const params: PaginationParams = {
  page: 1,
  pageSize: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

// 分页响应
const response: PaginatedResponse<Game> = {
  data: [game1, game2, game3],
  total: 150,
  page: 1,
  pageSize: 20,
  totalPages: 8,
};
```

### 3. 业务实体类型

#### Game - 游戏实体

```typescript
interface Game {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}
```

#### GameAction - 游戏行动

```typescript
interface GameAction {
  type: string;
  payload: Record<string, unknown>;
}
```

#### User - 用户实体

```typescript
interface User {
  id: string;
  email: string;
  name?: string;
}
```

#### AiConfiguration - AI配置

```typescript
interface AiConfiguration {
  id: string;
  provider: string;
  modelId: string;
  baseUrl?: string;
}
```

## 类型扩展模式

### 1. 前后端共享

Shared Types包被前端和后端同时依赖：

```json
// 前端 package.json
{
  "dependencies": {
    "@tuheg/shared-types": "workspace:*"
  }
}

// 后端 package.json
{
  "dependencies": {
    "@tuheg/shared-types": "workspace:*"
  }
}
```

### 2. 类型导入

```typescript
// 前端使用
import { ApiResponse, User, PaginationParams } from '@tuheg/shared-types';

// 后端使用
import { ApiResponse, ApiError, PaginatedResponse } from '@tuheg/shared-types';
```

## Zod运行时验证

虽然Shared Types主要用于类型定义，但也可以配合Zod进行运行时验证：

```typescript
import { z } from 'zod';

// API响应验证schema
export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    data: dataSchema,
    message: z.string().optional(),
    status: z.number(),
    timestamp: z.string().optional(),
  });

// 使用示例
const userResponseSchema = apiResponseSchema(
  z.object({
    id: z.string(),
    email: z.string().email(),
    name: z.string().optional(),
  }),
);

// 验证函数
export function validateApiResponse<T>(response: unknown, schema: z.ZodSchema<T>): T {
  return schema.parse(response);
}
```

## 最佳实践

### 1. 类型命名约定

- 使用PascalCase命名接口和类型
- 使用camelCase命名属性
- 添加详细的JSDoc注释
- 使用英文描述，清晰明了

### 2. 可选属性处理

```typescript
interface UserProfile {
  id: string;
  name?: string; // 可选属性
  avatar?: string; // 可选属性
  bio: string; // 必需属性
}
```

### 3. 泛型使用

```typescript
// 通用CRUD操作类型
interface CrudOperations<T> {
  create(data: Omit<T, 'id'>): Promise<T>;
  read(id: string): Promise<T | null>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

// 使用示例
const userCrud: CrudOperations<User> = {
  // 实现...
};
```

### 4. 联合类型和枚举

```typescript
// 状态枚举
type GameStatus = 'active' | 'paused' | 'completed' | 'abandoned';

// 联合类型
type ActionResult = { success: true; data: any } | { success: false; error: string };
```

## 版本管理和兼容性

### 1. 语义化版本

Shared Types遵循语义化版本控制：

- **MAJOR**: 破坏性变更 (如删除或重命名类型)
- **MINOR**: 新功能 (如添加新类型或属性)
- **PATCH**: 修复 (如修复类型定义错误)

### 2. 向后兼容

- 避免删除现有类型
- 新增属性设为可选
- 使用联合类型扩展枚举

```typescript
// 版本1
interface Game {
  id: string;
  name: string;
}

// 版本2 (向后兼容)
interface Game {
  id: string;
  name: string;
  description?: string; // 新增可选属性
}
```

## 测试策略

### 1. 类型测试

使用`tsd`进行类型定义测试：

```typescript
// types.test-d.ts
import { expectType, expectError } from 'tsd';
import { ApiResponse, User } from '@tuheg/shared-types';

// 正确类型
expectType<ApiResponse<User>>({
  data: { id: '1', email: 'test@example.com' },
  status: 200,
});

// 错误类型 (应该报错)
expectError<ApiResponse<User>>({
  data: { id: '1', email: 'test@example.com', invalidProp: true },
  status: 200,
});
```

### 2. 运行时验证测试

```typescript
describe('Shared Types Validation', () => {
  it('should validate API response', () => {
    const response = {
      data: { id: '1', email: 'test@example.com' },
      status: 200,
    };

    expect(() => validateApiResponse(response, userSchema)).not.toThrow();
  });
});
```

## 构建和发布

### 1. TypeScript编译

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "declaration": true,
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

### 2. 包配置

```json
// package.json
{
  "name": "@tuheg/shared-types",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "tsd",
    "prepublishOnly": "npm run build && npm test"
  }
}
```

## 使用指南

### 1. 安装依赖

```bash
# 在monorepo中
pnpm add @tuheg/shared-types --workspace-root

# 或在单独项目中
npm install @tuheg/shared-types
```

### 2. 导入类型

```typescript
// 导入所有类型
import * as Types from '@tuheg/shared-types';

// 按需导入
import { ApiResponse, User, PaginatedResponse } from '@tuheg/shared-types';

// 在Vue组件中使用
import type { ApiResponse } from '@tuheg/shared-types';

interface ComponentData {
  response: ApiResponse<User>;
}
```

### 3. 扩展类型

```typescript
// 扩展现有类型
import { User } from '@tuheg/shared-types';

interface ExtendedUser extends User {
  avatar?: string;
  preferences: UserPreferences;
}

// 创建新类型
export interface GameSession {
  id: string;
  gameId: string;
  userId: string;
  startedAt: string;
  endedAt?: string;
}
```

## 相关文档

- [前端应用文档](../../apps/frontend/README.md)
- [后端网关文档](../../apps/backend-gateway/README.md)
- [Common Backend文档](../common-backend/README.md)
- [TypeScript手册](https://www.typescriptlang.org/docs/)
