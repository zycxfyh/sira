// 文件路径: libs/common/src/types/queue.d.ts

import type { Game, Character, WorldBookEntry } from '@prisma/client';
// [核心修正] 从 @tuheg/common-backend 的总出口导入共享的 SubmitActionDto 类型
import type { SubmitActionDto } from '@tuheg/common-backend';

/**
 * @name GameActionJobData
 * @description “玩家行动包裹”的格式。
 * 这是从 主网关 -> 逻辑智能体 的事件载荷。
 */
export interface GameActionJobData {
  gameId: string;
  userId: string;
  playerAction: SubmitActionDto;
  gameStateSnapshot: Game & {
    character: Character | null;
    worldBook: WorldBookEntry[];
  };
  correlationId?: string;
}

/**
 * @name LogicCompletePayload
 * @description “逻辑完成包裹”的格式。
 * 这是从 逻辑智能体 -> 叙事智能体 的事件载荷。
 */
export interface LogicCompletePayload {
  gameId: string;
  userId: string;
  playerAction: SubmitActionDto;
}
