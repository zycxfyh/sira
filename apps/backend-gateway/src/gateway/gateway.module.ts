import { Module } from '@nestjs/common';
import { UpdatesGateway } from './updates.gateway';
import { GatewayController } from './gateway.controller';
import { GatewayEventsController } from './gateway.events.controller';
import { EventBusModule } from '@tuheg/common-backend';

@Module({
  imports: [EventBusModule],
  controllers: [GatewayController, GatewayEventsController],
  providers: [UpdatesGateway],
  exports: [UpdatesGateway],
})
export class GatewayModule {}
