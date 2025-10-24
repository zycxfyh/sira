import { ChatOpenAI } from '@langchain/openai';
// [核心修正] 修正了类型定义的导入路径
import type { AiProvider, AiGenerationOptions } from '../../types/ai-providers.types';

export class CustomOpenAICompatibleProvider implements AiProvider {
  public readonly model: ChatOpenAI;

  constructor(
    apiKey: string,
    modelId: string,
    baseUrl: string | null,
    defaultOptions: AiGenerationOptions = {},
  ) {
    this.model = new ChatOpenAI({
      apiKey: apiKey,
      modelName: modelId,
      temperature: defaultOptions.temperature ?? 0.7,
      configuration: {
        baseURL: baseUrl || undefined,
      },
    });
  }
}
