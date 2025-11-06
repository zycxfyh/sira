// 文件路径: packages/common-backend/src/ai/crew/crew.module.ts
// 灵感来源: CrewAI (https://github.com/joaomdmoura/crewAI)
// 核心理念: 模块化导出，方便其他模块使用

import { Module } from '@nestjs/common';
import { Agent } from './agent';
import { Crew } from './crew';
import { Task } from './task';

/**
 * @module CrewModule
 * @description CrewAI 风格的智能体编排模块
 * 提供 Agent、Task、Crew 三个核心组件
 */
@Module({
  providers: [Agent, Task, Crew],
  exports: [Agent, Task, Crew],
})
export class CrewModule {}
