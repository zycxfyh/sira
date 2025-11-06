import { Module } from '@nestjs/common';
import { UpdatesGateway } from './updates.gateway';
import { GatewayController } from './gateway.controller'; // <-- 引入新成员

@Module({
  controllers: [GatewayController], // <-- 注册新成员
  providers: [UpdatesGateway],
  exports: [UpdatesGateway],
})
export class GatewayModule {}
