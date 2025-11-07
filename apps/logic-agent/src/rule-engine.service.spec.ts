// 文件路径: apps/logic-agent/src/rule-engine.service.spec.ts

import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { Character, Prisma, PrismaClient } from '@prisma/client';
import { type DirectiveSet, PrismaService } from '@tuheg/common-backend';
import { type DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { RuleEngineService } from './rule-engine.service';

describe('RuleEngineService', () => {
  let service: RuleEngineService;
  let prismaMock: DeepMockProxy<PrismaClient>;

  const MOCK_GAME_ID = 'test-game-id';
  const MOCK_CHARACTER: Character = {
    id: 'char-id',
    gameId: MOCK_GAME_ID,
    name: 'Kael',
    hp: 100,
    maxHp: 100,
    mp: 50,
    maxMp: 50,
    status: 'Normal',
    card: {} as Prisma.JsonObject,
  };

  beforeEach(async () => {
    prismaMock = mockDeep<PrismaClient>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [RuleEngineService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get<RuleEngineService>(RuleEngineService);

    // [核心修复] 为 tx 参数提供明确的类型 PrismaClient
    prismaMock.$transaction.mockImplementation(async (fn: any) => {
      return await fn(prismaMock);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should do nothing if directives array is empty', async () => {
    await service.execute(MOCK_GAME_ID, []);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  describe('Character Updates', () => {
    beforeEach(() => {
      prismaMock.character.findUniqueOrThrow.mockResolvedValue(MOCK_CHARACTER);
    });

    it('should correctly apply a single "decrement" hp directive', async () => {
      const directives: DirectiveSet = [
        {
          op: 'update_character',
          targetId: 'player',
          payload: { hp: { op: 'decrement', value: 10 } },
        },
      ];
      await service.execute(MOCK_GAME_ID, directives);
      expect(prismaMock.character.update).toHaveBeenCalledWith({
        where: { gameId: MOCK_GAME_ID },
        data: { hp: 90 },
      });
    });

    it('should correctly apply multiple directives in one transaction', async () => {
      const directives: DirectiveSet = [
        {
          op: 'update_character',
          targetId: 'player',
          payload: {
            hp: { op: 'increment', value: 5 },
            mp: { op: 'set', value: 42 },
            status: { op: 'set', value: 'Energized' },
          },
        },
      ];
      await service.execute(MOCK_GAME_ID, directives);
      expect(prismaMock.character.update).toHaveBeenCalledWith({
        where: { gameId: MOCK_GAME_ID },
        data: {
          hp: 105,
          mp: 42,
          status: 'Energized',
        },
      });
    });

    it('should handle string "append" and "prepend" operations', async () => {
      const initialCharacter = { ...MOCK_CHARACTER };
      prismaMock.character.findUniqueOrThrow.mockResolvedValue(initialCharacter);

      const prependDirective: DirectiveSet = [
        {
          op: 'update_character',
          targetId: 'player',
          payload: { status: { op: 'prepend', value: 'Slightly ' } },
        },
      ];
      await service.execute(MOCK_GAME_ID, prependDirective);
      expect(prismaMock.character.update).toHaveBeenCalledWith({
        where: { gameId: MOCK_GAME_ID },
        data: { status: 'Slightly Normal' },
      });

      const appendedCharacter = {
        ...initialCharacter,
        status: 'Slightly Normal',
      };
      prismaMock.character.findUniqueOrThrow.mockResolvedValue(appendedCharacter);

      const appendDirective: DirectiveSet = [
        {
          op: 'update_character',
          targetId: 'player',
          payload: { status: { op: 'append', value: ' and Confused' } },
        },
      ];
      await service.execute(MOCK_GAME_ID, appendDirective);
      expect(prismaMock.character.update).toHaveBeenCalledWith({
        where: { gameId: MOCK_GAME_ID },
        data: { status: 'Slightly Normal and Confused' },
      });
    });
  });

  describe('Error Handling', () => {
    it('should re-throw transaction failures as a RuleEngineExecutionException', async () => {
      const dbError = new Error('Database connection lost');
      prismaMock.$transaction.mockRejectedValue(dbError);
      const directives: DirectiveSet = [
        {
          op: 'update_character',
          targetId: 'player',
          payload: { hp: { op: 'decrement', value: 10 } },
        },
      ];
      await expect(service.execute(MOCK_GAME_ID, directives)).rejects.toThrow(
        'Rule engine transaction failed: Database connection lost',
      );
    });

    it('should throw BadRequestException for an unknown operation', async () => {
      const directives: DirectiveSet = [
        {
          op: 'unknown_operation', // 使用一个未知的操作
          targetId: 'player',
          payload: {},
        } as any, // Type assertion to bypass type checking
      ];
      await expect(service.execute(MOCK_GAME_ID, directives)).rejects.toThrow(BadRequestException);
    });
  });
});
