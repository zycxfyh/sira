// 文件路径: apps/nexus-engine/src/games/games.service.ts

import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Game, Character, WorldBookEntry } from '@prisma/client';

// [核心修正] 从 @tuheg/common-backend 导入所有需要的共享模块
import { PrismaService, EventBusService, SubmitActionDto } from '@tuheg/common-backend';

// [注释] 只导入本地需要的DTO
import type { CreateNarrativeGameDto } from './dto/create-game.dto';
import type { UpdateCharacterDto } from './dto/update-character.dto';

@Injectable()
export class GamesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * @method createNarrativeDriven
   * @description [核心重构] 接收创世请求，并将其作为事件发布
   */
  public async createNarrativeDriven(
    userId: string,
    dto: CreateNarrativeGameDto,
  ): Promise<{ message: string }> {
    // [核心] 发布一个“请求创建游戏”的事件
    this.eventBus.publish('GAME_CREATION_REQUESTED', {
      userId,
      concept: dto.concept,
    });

    // 立即向前端返回一个“任务已受理”的响应
    return {
      message: 'Game creation request has been accepted and is being processed.',
    };
  }

  /**
   * @method submitAction
   * @description 接收玩家行动，并将其作为事件发布到宇宙广播
   */
  public async submitAction(userId: string, gameId: string, dto: SubmitActionDto): Promise<void> {
    const gameWithIncludes = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { character: true, worldBook: true },
    });

    if (!gameWithIncludes) {
      throw new NotFoundException(`Game with ID "${gameId}" not found.`);
    }
    if (gameWithIncludes.ownerId !== userId) {
      throw new ForbiddenException("You don't have permission to access this game.");
    }

    this.eventBus.publish('PLAYER_ACTION_SUBMITTED', {
      gameId: gameId,
      userId: userId,
      playerAction: dto,
      gameStateSnapshot: gameWithIncludes,
    });
  }

  // --- 以下为标准的CRUD方法 ---

  public async findOne(
    userId: string,
    gameId: string,
  ): Promise<Game & { character: Character | null; worldBook: WorldBookEntry[] }> {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId, ownerId: userId },
      include: { character: true, worldBook: true },
    });
    if (!game) {
      throw new NotFoundException(`Game with ID "${gameId}" not found or you don't have access.`);
    }
    return game;
  }

  public async findAllForUser(
    userId: string,
  ): Promise<{ id: string; name: string | null; updatedAt: Date }[]> {
    return this.prisma.game.findMany({
      where: { ownerId: userId },
      select: { id: true, name: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  public async delete(userId: string, gameId: string): Promise<{ message: string }> {
    const result = await this.prisma.game.deleteMany({
      where: { id: gameId, ownerId: userId },
    });

    if (result.count === 0) {
      throw new NotFoundException(
        `Game with ID "${gameId}" not found or you don't have permission to delete it.`,
      );
    }
    return { message: `Game with ID "${gameId}" deleted successfully.` };
  }

  public async updateCharacterState(
    userId: string,
    gameId: string,
    dto: UpdateCharacterDto,
  ): Promise<Character> {
    // 首先验证用户是否拥有该游戏
    await this.findOne(userId, gameId);

    return this.prisma.character.update({
      where: { gameId: gameId },
      data: dto,
    });
  }
}
