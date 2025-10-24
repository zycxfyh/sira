// 文件路径: libs/common/src/types/ai-providers.d.ts

import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

/**
 * @name AiRole
 * @description [架构升级] 定义了AI在生态系统中所能扮演的所有“能力”标签。
 */
export type AiRole =
  // == 主循环智能体能力 ==
  | 'logic_parsing' // 核心：逻辑解析
  | 'narrative_synthesis' // 核心：叙事合成
  | 'planner' // 高级：任务规划与分解
  | 'critic' // 高级：输出审查与反馈

  // == 背景循环智能体能力 ==
  | 'summarizer' // 背景：事件整理与摘要
  | 'converter' // 背景：结构化数据转化
  | 'novelist' // 背景：世界背景故事创作
  | 'supervisor' // 元：AI性能监管

  // == 专家能力（未来扩展） ==
  | 'specialist_dialogue' // 专家：对话生成
  | 'specialist_description' // 专家：环境描写
  | 'specialist_options' // 专家：选项生成
  | 'image_generation'; // 专家：图像生成

/**
 * @interface AiGenerationOptions
 * @description 定义了在调用AI模型生成内容时，可以传入的通用配置选项。
 */
export interface AiGenerationOptions {
  temperature?: number;
  maxTokens?: number;
}

/**
 * @interface AiProvider
 * @description [核心契约] 强制每个AI Provider都必须暴露一个
 * 与LangChain的.pipe()方法兼容的 BaseChatModel 实例。
 */
export interface AiProvider {
  model: BaseChatModel;
}
