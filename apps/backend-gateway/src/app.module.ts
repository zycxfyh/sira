import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
// 1. 明确导入所有需要的“联邦服务”
import { PrismaModule, HealthModule } from '@tuheg/common-backend';

// 2. 明确导入所有本应用的“内部模块”
import { AuthModule } from './auth/auth.module';
import { GamesModule } from './games/games.module';
import { SettingsModule } from './settings/settings.module';
import { GatewayModule } from './gateway/gateway.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    // 3. 在 imports 数组中，清晰地列出所有依赖
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule, // <-- [核心修复] 我们现在明确声明：此应用依赖数据库
    HealthModule,
    AuthModule,
    GamesModule,
    SettingsModule,
    GatewayModule,
  ],
  controllers: [AppController], // 确保 AppController 还在
  providers: [AppService],     // 确保 AppService 还在
})
export class AppModule {}