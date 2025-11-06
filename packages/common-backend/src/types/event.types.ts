// 文件路径: packages/common-backend/src/types/event.types.ts
// 职责: 定义所有跨服务事件消息的类型
//
// 核心功能:
// 1. 统一所有事件消息的类型定义
// 2. 确保事件数据结构的一致性
// 3. 避免在不同模块中重复定义

/**
 * NotifyUserPayload
 * 用于从各个服务（Agent）向 backend-gateway 发送用户通知事件
 *
 * @remarks
 * 这个类型定义了通过 RabbitMQ 'NOTIFY_USER' 事件发送的消息结构
 * GatewayController 会接收这些消息并通过 WebSocket 转发给前端
 */
export interface NotifyUserPayload {
  /** 目标用户 ID */
  userId: string;
  /** 事件名称（如 'creation_completed', 'processing_failed' 等） */
  event: string;
  /** 事件数据（具体内容取决于事件类型） */
  data: Record<string, unknown>; // 使用 Record<string, unknown> 代替 any，符合类型安全要求
}
