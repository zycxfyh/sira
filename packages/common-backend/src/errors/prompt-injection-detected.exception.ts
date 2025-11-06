import { BadRequestException } from '@nestjs/common';

export interface PromptInjectionDetails {
  score: number;
  threshold: number;
  preview?: string;
  context?: string;
  correlationId?: string;
  userId?: string;
}

export class PromptInjectionDetectedException extends BadRequestException {
  constructor(
    message: string,
    public readonly details: PromptInjectionDetails,
  ) {
    super(message);
    this.name = 'PromptInjectionDetectedException';
  }
}
