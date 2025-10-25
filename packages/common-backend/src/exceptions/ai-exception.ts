// 文件路径: apps/backend/libs/common/src/exceptions/ai-exception.ts

export class AiGenerationException extends Error {
  constructor(message: string, public readonly details?: any) {
    super(message);
    this.name = 'AiGenerationException';
  }
}