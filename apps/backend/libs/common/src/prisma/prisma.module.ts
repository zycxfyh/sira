// 文件路径: libs/common/src/prisma/prisma.module.ts

import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // [核心] 声明这是一个全局模块，一次导入，处处可用。
@Module({
  providers: [PrismaService], // 声明此模块提供了 PrismaService 这个工具
  exports: [PrismaService], // 将这个工具导出，让其他模块可以使用
})
export class PrismaModule {}
