// 文件路径: apps/nexus-engine/src/gateway/gateway.controller.ts (已更新为 async)

import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { UpdatesGateway } from './updates.gateway';

class SendToUserDto {
  userId!: string;
  event!: string;
  data: unknown;
}

@Controller('gateway')
export class GatewayController {
  constructor(private readonly updatesGateway: UpdatesGateway) {}

  @Post('send-to-user')
  @HttpCode(HttpStatus.OK)
  // [!] 核心改造：将方法标记为 async
  public async sendToUser(@Body() dto: SendToUserDto): Promise<{ success: boolean }> {
    // [!] 核心改造：使用 await 调用
    const sent = await this.updatesGateway.sendToUser(dto.userId, dto.event, dto.data);
    return { success: sent };
  }
}
