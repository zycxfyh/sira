// 文件路径: apps/nexus-engine/src/auth/auth.module.ts

import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ConfigModule, ConfigService } from '@nestjs/config';

// [核心修正] 放弃旧的 '@/' 别名，从 @tuheg/common-backend 导入共享的 PrismaModule
import { PrismaModule } from '@tuheg/common-backend';

@Module({
  imports: [
    PrismaModule, // [注释] 使用共享的数据库模块
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          // [注释] 从环境变量读取JWT过期时间
          expiresIn: parseInt(configService.get<string>('JWT_EXPIRATION_SECONDS', '3600'), 10),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
