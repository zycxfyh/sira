// 文件路径: apps/logic-agent/src/logic.service.integration.spec.ts (真正完整版)

import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { User } from '@prisma/client';
import {
  AiGenerationException,
  callAiWithGuard,
  type DirectiveSet,
  DynamicAiSchedulerService,
  type GameActionJobData,
  LangfuseService,
  type PromptInjectionCheckResult,
  PromptInjectionGuard,
  PromptManagerService,
} from '@tuheg/common-backend';
import { type MockProxy, mock } from 'jest-mock-extended';
import { LogicService } from './logic.service';

// 测试子类，用于访问protected方法
class TestLogicService extends LogicService {
  public async testGenerateDirectives(jobData: GameActionJobData, user: any) {
    return this.generateDirectives(jobData, user);
  }
}

// 模拟 @tuheg/common-backend, 只替换 callAiWithGuard
jest.mock('@tuheg/common-backend', () => ({
  ...jest.requireActual('@tuheg/common-backend'), // 保留所有真实导出
  callAiWithGuard: jest.fn(), // 将 callAiWithGuard 替换为一个 Jest 模拟函数
}));

describe('LogicService (Integration)', () => {
  let service: TestLogicService;
  let schedulerMock: MockProxy<DynamicAiSchedulerService>;
  let promptManagerMock: MockProxy<PromptManagerService>;
  let promptInjectionGuardMock: MockProxy<PromptInjectionGuard>;
  let langfuseServiceMock: MockProxy<LangfuseService>;

  // 将模拟函数进行类型转换
  const mockedCallAiWithGuard = callAiWithGuard as jest.Mock;

  const MOCK_CHAT_MODEL = {} as unknown as BaseChatModel;
  // [核心修复] 为模拟数据补上 correlationId 字段
  const MOCK_JOB_DATA: GameActionJobData = {
    gameId: 'game-123',
    userId: 'user-abc',
    playerAction: { type: 'command', payload: 'Attack the goblin' },
    gameStateSnapshot: {
      id: 'game-123',
      name: 'Mock Game',
      ownerId: 'user-abc',
      createdAt: new Date(),
      updatedAt: new Date(),
      character: null,
      worldBook: [],
    },
    correlationId: 'test-correlation-id-integration-456', // <-- 加上这一行
  };

  const MOCK_DIRECTIVES: DirectiveSet = [
    { op: 'update_character', targetId: 'player', payload: {} },
  ];

  const SAFE_GUARD_RESULT: PromptInjectionCheckResult = {
    allowed: true,
    score: 0.1,
    threshold: 0.75,
    reason: 'passed',
  };

  beforeEach(async () => {
    // 使用 jest-mock-extended 创建所有依赖的深度模拟对象
    schedulerMock = mock<DynamicAiSchedulerService>();
    promptManagerMock = mock<PromptManagerService>();
    promptInjectionGuardMock = mock<PromptInjectionGuard>();
    promptInjectionGuardMock.checkInput.mockResolvedValue(SAFE_GUARD_RESULT);
    promptInjectionGuardMock.ensureSafeOrThrow.mockResolvedValue(undefined);
    langfuseServiceMock = mock<LangfuseService>();
    langfuseServiceMock.createTrace.mockResolvedValue({
      id: 'mock-trace-id',
      name: 'mock-trace',
      metadata: {},
    });
    langfuseServiceMock.createSpan.mockResolvedValue({
      id: 'mock-span-id',
      name: 'mock-span',
      traceId: 'mock-trace-id',
      startTime: new Date(),
      metadata: {},
    });
    langfuseServiceMock.logGeneration.mockResolvedValue(undefined);
    langfuseServiceMock.flush.mockResolvedValue(undefined);
    langfuseServiceMock.isEnabled.mockReturnValue(false);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TestLogicService,
        // 为所有依赖项提供我们的模拟实例
        { provide: DynamicAiSchedulerService, useValue: schedulerMock },
        { provide: PromptManagerService, useValue: promptManagerMock },
        { provide: LangfuseService, useValue: langfuseServiceMock },
        { provide: PromptInjectionGuard, useValue: promptInjectionGuardMock },
      ],
    }).compile();

    service = module.get<TestLogicService>(TestLogicService);
  });

  afterEach(() => {
    // 在每个测试后重置所有模拟
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Happy Path: Successful Directive Generation', () => {
    beforeEach(() => {
      // 预设所有模拟依赖的行为
      schedulerMock.getProviderForRole.mockResolvedValue({
        model: MOCK_CHAT_MODEL,
      });
      promptManagerMock.getPrompt.mockReturnValue('This is a system prompt.');
      mockedCallAiWithGuard.mockResolvedValue(MOCK_DIRECTIVES);
    });

    it('should call dependencies with correct parameters and return directives', async () => {
      // 调用被测试的方法
      const mockUser = { id: MOCK_JOB_DATA.userId } as any;
      const result = await service.testGenerateDirectives(MOCK_JOB_DATA, mockUser);

      // 验证交互和结果
      expect(promptInjectionGuardMock.checkInput).toHaveBeenCalledWith(
        JSON.stringify(MOCK_JOB_DATA.playerAction),
        {
          userId: MOCK_JOB_DATA.userId,
          gameId: MOCK_JOB_DATA.gameId,
          correlationId: MOCK_JOB_DATA.correlationId,
          source: 'logic-agent:playerAction',
        },
      );
      expect(schedulerMock.getProviderForRole).toHaveBeenCalledTimes(1);
      expect(schedulerMock.getProviderForRole).toHaveBeenCalledWith(
        { id: MOCK_JOB_DATA.userId } as User,
        'logic_parsing',
      );

      expect(promptManagerMock.getPrompt).toHaveBeenCalledTimes(1);
      expect(promptManagerMock.getPrompt).toHaveBeenCalledWith('01_logic_engine.md');

      expect(mockedCallAiWithGuard).toHaveBeenCalledTimes(1);

      const aiGuardArgs = mockedCallAiWithGuard.mock.calls[0];
      const params = aiGuardArgs[1];
      expect(params.system_prompt).toBe('This is a system prompt.');
      expect(params.game_state).toBe(JSON.stringify(MOCK_JOB_DATA.gameStateSnapshot));
      expect(params.player_action).toBe(JSON.stringify(MOCK_JOB_DATA.playerAction));

      expect(result).toEqual(MOCK_DIRECTIVES);
    });
  });

  describe('Error Handling: AI Guard Failure', () => {
    it('should throw an InternalServerErrorException when callAiWithGuard fails', async () => {
      const aiError = new AiGenerationException('AI failed validation', {});

      schedulerMock.getProviderForRole.mockResolvedValue({
        model: MOCK_CHAT_MODEL,
      });
      promptManagerMock.getPrompt.mockReturnValue('prompt');
      mockedCallAiWithGuard.mockRejectedValue(aiError);

      const mockUser = { id: MOCK_JOB_DATA.userId } as any;
      await expect(service.testGenerateDirectives(MOCK_JOB_DATA, mockUser)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should throw BadRequestException when prompt injection guard blocks input', async () => {
      promptInjectionGuardMock.checkInput.mockResolvedValueOnce({
        allowed: false,
        score: 0.99,
        threshold: 0.75,
        reason: 'threshold-exceeded',
      });

      const mockUser = { id: MOCK_JOB_DATA.userId } as any;
      await expect(service.testGenerateDirectives(MOCK_JOB_DATA, mockUser)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockedCallAiWithGuard).not.toHaveBeenCalled();
    });
  });
});
