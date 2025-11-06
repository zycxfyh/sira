// 文件路径: apps/creation-agent/src/creation.service.spec.ts (最终无瑕疵版)

import { Test, type TestingModule } from '@nestjs/testing';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { Game } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import {
  AiGenerationException,
  callAiWithGuard,
  DynamicAiSchedulerService,
  EventBusService,
  PrismaService,
  PromptInjectionDetectedException,
  PromptInjectionGuard,
  PromptManagerService,
} from '@tuheg/common-backend';
import { type DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { CreationService } from './creation.service';

jest.mock('@tuheg/common-backend', () => ({
  ...jest.requireActual('@tuheg/common-backend'),
  callAiWithGuard: jest.fn(),
}));

describe('CreationService', () => {
  let service: CreationService;
  let prismaMock: DeepMockProxy<PrismaClient>;
  let schedulerMock: DeepMockProxy<DynamicAiSchedulerService>;
  let promptManagerMock: DeepMockProxy<PromptManagerService>;
  let eventBusMock: DeepMockProxy<EventBusService>;
  let promptInjectionGuardMock: DeepMockProxy<PromptInjectionGuard>;
  const mockedCallAiWithGuard = callAiWithGuard as jest.Mock;

  const MOCK_CHAT_MODEL = {} as unknown as BaseChatModel;

  const MOCK_PAYLOAD = {
    userId: 'user-123',
    concept: 'A cyberpunk city ruled by sentient cats.',
  };

  const MOCK_AI_RESPONSE = {
    gameName: 'Neko-Kyoto Prime',
    character: {
      name: 'Jax',
      card: {
        coreIdentity: 'A rogue street samurai cat',
        personality: ['cynical', 'agile'],
        appearance: 'A sleek black cat with a robotic eye.',
      },
    },
    worldBook: [{ key: 'Neko-Kyoto', content: { description: 'The main city.' } }],
  };

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();
    schedulerMock = mockDeep<DynamicAiSchedulerService>();
    promptManagerMock = mockDeep<PromptManagerService>();
    eventBusMock = mockDeep<EventBusService>();
    promptInjectionGuardMock = mockDeep<PromptInjectionGuard>();
    promptInjectionGuardMock.ensureSafeOrThrow.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreationService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: DynamicAiSchedulerService, useValue: schedulerMock },
        { provide: PromptManagerService, useValue: promptManagerMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: PromptInjectionGuard, useValue: promptInjectionGuardMock },
      ],
    }).compile();

    service = module.get<CreationService>(CreationService);

    prismaMock.$transaction.mockImplementation((fn: any) => fn(prismaMock));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Happy Path', () => {
    it('should create a new world, save it, and publish completion event', async () => {
      schedulerMock.getProviderForRole.mockResolvedValue({ model: MOCK_CHAT_MODEL });
      promptManagerMock.getPrompt.mockReturnValue('persona prompt');
      mockedCallAiWithGuard.mockResolvedValue(MOCK_AI_RESPONSE);
      const mockGame: Game = {
        id: 'game-456',
        name: MOCK_AI_RESPONSE.gameName,
        ownerId: MOCK_PAYLOAD.userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaMock.game.create.mockResolvedValue(mockGame);

      await service.createNewWorld(MOCK_PAYLOAD);

      expect(promptInjectionGuardMock.ensureSafeOrThrow).toHaveBeenCalledWith(
        MOCK_PAYLOAD.concept,
        {
          source: 'creation-agent.concept',
          userId: MOCK_PAYLOAD.userId,
        },
      );
      expect(mockedCallAiWithGuard).toHaveBeenCalledTimes(1);
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(prismaMock.game.create).toHaveBeenCalled();
      expect(prismaMock.character.create).toHaveBeenCalled();
      expect(prismaMock.worldBookEntry.createMany).toHaveBeenCalled();
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        'NOTIFY_USER',
        expect.objectContaining({
          event: 'creation_completed',
        }),
      );
    });
  });

  describe('Error Handling', () => {
    it('should throw and not publish event if AI generation fails', async () => {
      const aiError = new AiGenerationException('AI failed');
      schedulerMock.getProviderForRole.mockResolvedValue({ model: MOCK_CHAT_MODEL });
      promptManagerMock.getPrompt.mockReturnValue('persona prompt');
      mockedCallAiWithGuard.mockRejectedValue(aiError);

      await expect(service.createNewWorld(MOCK_PAYLOAD)).rejects.toThrow(AiGenerationException);

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(eventBusMock.publish).not.toHaveBeenCalled();
    });

    it('should throw and not publish event if database transaction fails', async () => {
      const dbError = new Error('DB connection lost');
      schedulerMock.getProviderForRole.mockResolvedValue({ model: MOCK_CHAT_MODEL });
      promptManagerMock.getPrompt.mockReturnValue('persona prompt');
      mockedCallAiWithGuard.mockResolvedValue(MOCK_AI_RESPONSE);
      prismaMock.$transaction.mockRejectedValue(dbError);

      // [核心修复] 修正错别字 MOCK_PAYPAYLOAD -> MOCK_PAYLOAD
      await expect(service.createNewWorld(MOCK_PAYLOAD)).rejects.toThrow(dbError);

      expect(eventBusMock.publish).not.toHaveBeenCalled();
    });

    it('should propagate prompt injection errors before invoking AI', async () => {
      const guardError = new PromptInjectionDetectedException('blocked', {
        score: 0.95,
        threshold: 0.75,
      });
      promptInjectionGuardMock.ensureSafeOrThrow.mockRejectedValueOnce(guardError);

      await expect(service.createNewWorld(MOCK_PAYLOAD)).rejects.toThrow(
        PromptInjectionDetectedException,
      );

      expect(mockedCallAiWithGuard).not.toHaveBeenCalled();
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
      expect(eventBusMock.publish).not.toHaveBeenCalled();
    });
  });
});
