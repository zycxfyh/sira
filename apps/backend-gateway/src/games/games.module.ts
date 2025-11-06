// 文件路径: apps/nexus-engine/src/games/games.module.ts

import { Module } from '@nestjs/common';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';

// [核心修正] 从 @tuheg/common-backend 导入共享模块
import { PrismaModule, EventBusModule } from '@tuheg/common-backend';

@Module({
  imports: [
    PrismaModule, // 依赖共享的数据库模块
    EventBusModule, // [核心修正] 依赖共享的事件总线模块，用于发布任务
  ],
  controllers: [GamesController],
  providers: [GamesService],
})
export class GamesModule {}
