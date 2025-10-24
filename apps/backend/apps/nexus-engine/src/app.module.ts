// 文件路径: apps/backend/apps/nexus-engine/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from '@app/common'; // <-- 导入
import { AuthModule } from './auth/auth.module';
import { GamesModule } from './games/games.module';
import { SettingsModule } from './settings/settings.module';
import { GatewayModule } from './gateway/gateway.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule, // <-- 添加到 imports 数组
    AuthModule,
    GamesModule,
    SettingsModule,
    GatewayModule,
  ],
})
export class AppModule {}