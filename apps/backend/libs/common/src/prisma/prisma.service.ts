// 文件路径: libs/common/src/prisma/prisma.service.ts

import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    // 在 NestJS 模块初始化时连接到数据库
    await this.$connect();
  }
}
