// 文件路径: apps/narrative-agent/src/narrative.service.spec.ts
// 描述: NarrativeService 的单元测试套件，涵盖叙事生成逻辑和错误处理

import { NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { Test, type TestingModule } from '@nestjs/testing';
import type { PrismaClient } from '@prisma/client';
import {
  AiGenerationException,
  ContextSummarizerService,
  callAiWithGuard,
  DynamicAiSchedulerService,
  EventBusService,
  MemoryHierarchyService,
  type NarrativeRenderingPayload,
  PrismaService,
  type PromptInjectionCheckResult,
  PromptInjectionGuard,
  PromptManagerService,
} from '@tuheg/common-backend';
import { type DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { NarrativeService } from './narrative.service';

jest.mock('@tuheg/common-backend', () => ({
  ...jest.requireActual('@tuheg/common-backend'),
  callAiWithGuard: jest.fn(),
}));

describe('NarrativeService', () => {
  let service: NarrativeService;
  let prismaMock: DeepMockProxy<PrismaClient>;
  let schedulerMock: DeepMockProxy<DynamicAiSchedulerService>;
  let promptManagerMock: DeepMockProxy<PromptManagerService>;
  let httpServiceMock: DeepMockProxy<HttpService>;
  let eventBusMock: DeepMockProxy<EventBusService>;
  let contextSummarizerMock: DeepMockProxy<ContextSummarizerService>;
  let memoryHierarchyMock: DeepMockProxy<MemoryHierarchyService>;
  let promptInjectionGuardMock: DeepMockProxy<PromptInjectionGuard>;
  const mockedCallAiWithGuard = callAiWithGuard as jest.Mock;

  const MOCK_CHAT_MODEL = {} as unknown as BaseChatModel;
  const MOCK_PAYLOAD: NarrativeRenderingPayload = {
    gameId: 'game-123',
    userId: 'user-abc',
    playerAction: { type: 'command', payload: 'Look around' },
    executedDirectives: [],
    correlationId: 'test-narrative-corr-id',
  };

  const MOCK_GAME_STATE = {
    id: MOCK_PAYLOAD.gameId,
    character: { id: 'char-1', name: 'Hero' },
    worldBook: { id: 'wb-1', entries: {} },
  };

  const MOCK_AI_RESPONSE = {
    narrative: 'You look around and see a vast, empty room.',
    options: [],
  };

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();
    schedulerMock = mockDeep<DynamicAiSchedulerService>();
    promptManagerMock = mockDeep<PromptManagerService>();
    httpServiceMock = mockDeep<HttpService>();
    eventBusMock = mockDeep<EventBusService>();
    contextSummarizerMock = mockDeep<ContextSummarizerService>();
    memoryHierarchyMock = mockDeep<MemoryHierarchyService>();
    promptInjectionGuardMock = mockDeep<PromptInjectionGuard>();

    const guardSafeResult: PromptInjectionCheckResult = {
      allowed: true,
      score: 0.1,
      threshold: 0.75,
      reason: 'passed',
    };
    promptInjectionGuardMock.checkInput.mockResolvedValue(guardSafeResult);
    memoryHierarchyMock.getActiveMemories.mockResolvedValue([]);

    // Mock HttpService post method to return an Observable
    const mockObservable = {
      pipe: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockImplementation((observer) => {
        // Simulate successful HTTP response
        if (observer.next) {
          observer.next({ data: 'success' });
        }
        if (observer.complete) {
          observer.complete();
        }
        return { unsubscribe: jest.fn() };
      }),
      toPromise: jest.fn().mockResolvedValue({ data: 'success' }),
    };
    httpServiceMock.post.mockReturnValue(mockObservable as any);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NarrativeService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: DynamicAiSchedulerService, useValue: schedulerMock },
        { provide: PromptManagerService, useValue: promptManagerMock },
        { provide: HttpService, useValue: httpServiceMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: ContextSummarizerService, useValue: contextSummarizerMock },
        { provide: MemoryHierarchyService, useValue: memoryHierarchyMock },
        { provide: PromptInjectionGuard, useValue: promptInjectionGuardMock },
      ],
    }).compile();

    service = module.get<NarrativeService>(NarrativeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processNarrative (Happy Path)', () => {
    beforeEach(() => {
      prismaMock.game.findUniqueOrThrow.mockResolvedValue(MOCK_GAME_STATE as never);
      // 模拟3次AI调用都成功
      mockedCallAiWithGuard.mockResolvedValue(MOCK_AI_RESPONSE);
      promptManagerMock.getPrompt.mockReturnValue('A mock prompt');
      schedulerMock.getProviderForRole.mockResolvedValue({
        model: MOCK_CHAT_MODEL,
      });
    });

    it('should generate narrative and publish a completion event', async () => {
      await service.processNarrative(MOCK_PAYLOAD);

      expect(prismaMock.game.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: MOCK_PAYLOAD.gameId },
        include: { character: true, worldBook: true },
      });
      expect(promptInjectionGuardMock.checkInput).toHaveBeenCalledWith(
        JSON.stringify(MOCK_PAYLOAD.playerAction),
        {
          userId: MOCK_PAYLOAD.userId,
        },
      );
      expect(mockedCallAiWithGuard).toHaveBeenCalledTimes(1);
      expect(eventBusMock.publish).toHaveBeenCalledWith('NOTIFY_USER', {
          userId: MOCK_PAYLOAD.userId,
          event: 'processing_completed',
          data: expect.objectContaining({
            message: 'AI response received.',
            progression: MOCK_AI_RESPONSE,
          }),
      });
    });
  });

  describe('processNarrative (Error Handling)', () => {
    it('should handle NotFoundException and send failure via gateway', async () => {
      prismaMock.game.findUniqueOrThrow.mockRejectedValue(new NotFoundException());
      await service.processNarrative(MOCK_PAYLOAD);
      expect(eventBusMock.publish).toHaveBeenCalledWith('NOTIFY_USER', {
          userId: MOCK_PAYLOAD.userId,
          event: 'processing_failed',
          data: expect.objectContaining({
            message: 'An error occurred during narrative generation.',
            error: 'Not Found',
          }),
      });
    });

    it('should handle AI error and send failure via gateway', async () => {
      const aiError = new AiGenerationException('AI failed');
      prismaMock.game.findUniqueOrThrow.mockResolvedValue(MOCK_GAME_STATE as never);

      // [核心修复] 即使在失败场景下，我们也要先告诉 schedulerMock 该做什么
      schedulerMock.getProviderForRole.mockResolvedValue({
        model: MOCK_CHAT_MODEL,
      });
      promptManagerMock.getPrompt.mockReturnValue('A mock prompt');

      // 然后，我们再模拟 AI 调用本身失败
      mockedCallAiWithGuard.mockRejectedValueOnce(aiError);

      await service.processNarrative(MOCK_PAYLOAD);

      expect(eventBusMock.publish).toHaveBeenCalledWith('NOTIFY_USER', {
          userId: MOCK_PAYLOAD.userId,
          event: 'processing_failed',
          data: expect.objectContaining({
            message: 'An error occurred during narrative generation.',
            error: 'AI failed',
          }),
      });
    });

    it('should reject promptly when prompt injection guard blocks input', async () => {
      promptInjectionGuardMock.checkInput.mockResolvedValueOnce({
        allowed: false,
        score: 0.98,
        threshold: 0.75,
        reason: 'threshold-exceeded',
        inputPreview: 'malicious',
      });

      await service.processNarrative(MOCK_PAYLOAD);

      expect(mockedCallAiWithGuard).not.toHaveBeenCalled();
      expect(eventBusMock.publish).toHaveBeenCalledWith('NOTIFY_USER', {
          userId: MOCK_PAYLOAD.userId,
          event: 'processing_failed',
          data: expect.objectContaining({
            message: 'An error occurred during narrative generation.',
          }),
      });
    });
  });
});
