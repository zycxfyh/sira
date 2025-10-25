// 文件路径: apps/backend/apps/logic-agent/src/logic.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { LogicService } from './logic.service';
import { RuleEngineService } from './rule-engine.service';
import {
  DynamicAiSchedulerService,
  EventBusService,
  PrismaService,
  PromptManagerService,
  callAiWithGuard,
  GameActionJobData,
  DirectiveSet,
} from '@tuheg/common-backend';
import { mock, MockProxy } from 'jest-mock-extended';

// [核心] 模拟 @tuheg/common-backend 模块，特别是 callAiWithGuard 函数
jest.mock('@tuheg/common-backend', () => ({
  ...jest.requireActual('@tuheg/common-backend'), // 保留其他真实导出
  callAiWithGuard: jest.fn(), // 将 callAiWithGuard 替换为一个 Jest 模拟函数
}));

describe('LogicService', () => {
  let logicService: LogicService;
  let ruleEngineService: RuleEngineService;
  let eventBusService: MockProxy<EventBusService>;

  // 将模拟函数类型化，便于在测试中进行类型提示
  const mockedCallAiWithGuard = callAiWithGuard as jest.Mock;

  beforeEach(async () => {
    // 使用 jest-mock-extended 创建所有依赖的深度模拟对象
    const eventBusMock = mock<EventBusService>();
    const prismaMock = mock<PrismaService>();
    const schedulerMock = mock<DynamicAiSchedulerService>();
    const promptManagerMock = mock<PromptManagerService>();
    const ruleEngineMock = mock<RuleEngineService>({
      // 模拟 execute 方法为一个空的 resolved Promise
      execute: jest.fn().mockResolvedValue(undefined),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogicService,
        // 提供真实的 RuleEngineService，但其依赖 PrismaService 是模拟的
        RuleEngineService,
        { provide: EventBusService, useValue: eventBusMock },
        { provide: PrismaService, useValue: prismaMock },
        { provide: DynamicAiSchedulerService, useValue: schedulerMock },
        { provide: PromptManagerService, useValue: promptManagerMock },
      ],
    })
      // 覆盖 RuleEngineService 的实例，以便我们可以监视它的方法
      .overrideProvider(RuleEngineService)
      .useValue(ruleEngineMock)
      .compile();

    logicService = module.get<LogicService>(LogicService);
    ruleEngineService = module.get<RuleEngineService>(RuleEngineService);
    eventBusService = module.get(EventBusService);

    // 在每个测试前重置模拟函数的状态
    mockedCallAiWithGuard.mockClear();
    eventBusService.publish.mockClear();
    (ruleEngineService.execute as jest.Mock).mockClear();
  });

  it('should be defined', () => {
    expect(logicService).toBeDefined();
  });

  describe('processLogic', () => {
    it('should correctly process a player action, execute directives, and publish a completion event', async () => {
      // 1. 准备 (Arrange)
      const mockJobData: GameActionJobData = {
        gameId: 'test-game-id',
        userId: 'test-user-id',
        playerAction: { type: 'command', payload: 'test command' },
        gameStateSnapshot: {} as any, // 在此测试中我们不关心快照的具体内容
      };

      const mockDirectives: DirectiveSet = [
        {
          op: 'update_character',
          targetId: 'player',
          payload: { hp: { op: 'decrement', value: 10 } },
        },
      ];

      // 设置 callAiWithGuard 的模拟行为：当它被调用时，返回我们预设的指令集
      mockedCallAiWithGuard.mockResolvedValue(mockDirectives);

      // 2. 行动 (Act)
      await logicService.processLogic(mockJobData);

      // 3. 断言 (Assert)
      // 验证AI护栏函数是否被调用过1次
      expect(mockedCallAiWithGuard).toHaveBeenCalledTimes(1);

      // 验证 RuleEngineService 的 execute 方法是否被调用，并且传入了正确的 gameId 和 AI 生成的指令
      expect(ruleEngineService.execute).toHaveBeenCalledTimes(1);
      expect(ruleEngineService.execute).toHaveBeenCalledWith(
        mockJobData.gameId,
        mockDirectives,
      );

      // 验证 EventBusService 的 publish 方法是否被调用，以通知下一个微服务
      expect(eventBusService.publish).toHaveBeenCalledTimes(1);
      expect(eventBusService.publish).toHaveBeenCalledWith(
        'LOGIC_PROCESSING_COMPLETE',
        {
          gameId: mockJobData.gameId,
          userId: mockJobData.userId,
          playerAction: mockJobData.playerAction,
        },
      );
    });

    it('should throw an error if AI guard fails', async () => {
      // 1. 准备 (Arrange)
      const mockJobData: GameActionJobData = {} as any;
      const errorMessage = 'AI failed to generate valid data';
      // 设置 callAiWithGuard 的模拟行为：当它被调用时，抛出一个错误
      mockedCallAiWithGuard.mockRejectedValue(new Error(errorMessage));
      
      // 2. & 3. 行动与断言 (Act & Assert)
      // 验证当 generateDirectives 失败时，processLogic 会向上抛出异常
      await expect(logicService.processLogic(mockJobData)).rejects.toThrow(
        expect.objectContaining({
          message: expect.stringContaining(errorMessage),
        }),
      );

      // 验证在这种失败情况下，RuleEngine 和 EventBus 都不会被调用
      expect(ruleEngineService.execute).not.toHaveBeenCalled();
      expect(eventBusService.publish).not.toHaveBeenCalled();
    });
  });
});