// 文件路径: apps/nexus-engine/src/gateway/updates.gateway.ts (已改造为使用 Redis-backed Rooms)

import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  namespace: 'updates',
  cors: { origin: '*' },
})
export class UpdatesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(UpdatesGateway.name);
  
  // [!] 核心改造：不再需要 userSocketMap
  // private readonly userSocketMap = new Map<string, string>();

  public handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;

    if (!userId) {
      this.logger.warn(`Client connected without userId. Disconnecting...`);
      client.disconnect();
      return;
    }

    // [!] 核心改造：让客户端加入以其 userId 命名的房间
    client.join(userId);
    this.logger.log(`Client connected: ${client.id}, UserID: ${userId} joined room: ${userId}`);
  }

  public handleDisconnect(client: Socket) {
    // [!] 核心改造：逻辑大大简化。Socket.IO 和 Redis Adapter 会自动处理房间的离开。
    // 我们只需要记录日志即可。
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /**
   * [!] 核心改造：向指定用户的房间广播事件，而不是向单个 socket ID 发送。
   * Redis Adapter 会确保消息被路由到正确的服务器实例上的正确客户端。
   */
  public async sendToUser(userId: string, event: string, data: any): Promise<boolean> {
    // 检查该房间是否存在（即用户是否在线）
    const sockets = await this.server.in(userId).fetchSockets();

    if (sockets && sockets.length > 0) {
      this.server.to(userId).emit(event, data);
      this.logger.log(`Sent event '${event}' to room: ${userId}`);
      return true;
    } else {
      this.logger.warn(
        `Attempted to send event '${event}' to UserID: ${userId}, but no active socket found in room.`,
      );
      return false;
    }
  }
}