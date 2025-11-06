// 文件路径: packages/shared-types/src/index.ts
// 灵感来源: T3 Stack (https://github.com/t3-oss/create-t3-app)
// 核心理念: 类型共享包的入口文件

// API 类型
export * from './api/types';

// 游戏相关类型（示例）
export interface Game {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface GameAction {
  type: string;
  payload: Record<string, unknown>;
}

// 用户相关类型（示例）
export interface User {
  id: string;
  email: string;
  name?: string;
}

// 设置相关类型（示例）
export interface AiConfiguration {
  id: string;
  provider: string;
  modelId: string;
  baseUrl?: string;
}
