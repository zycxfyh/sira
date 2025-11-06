// 文件路径: packages/common-backend/src/reactive/reactive.module.ts
// 灵感来源: RxJS (https://github.com/ReactiveX/rxjs)
// 核心理念: 模块化导出，方便使用

import { Module } from '@nestjs/common';
import { EventStream } from './event-stream';

/**
 * @module ReactiveModule
 * @description RxJS 风格的响应式编程模块
 * 提供事件流处理功能
 */
@Module({
  providers: [EventStream],
  exports: [EventStream],
})
export class ReactiveModule {}
