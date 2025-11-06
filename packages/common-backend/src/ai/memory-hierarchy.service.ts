// 文件路径: packages/common-backend/src/ai/memory-hierarchy.service.ts
// 职责: 记忆管理服务，管理游戏记忆的基本操作（简化版）

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Memory } from '@prisma/client';

/**
 * 记忆管理服务
 * 提供基本的记忆操作功能
 */
@Injectable()
export class MemoryHierarchyService {
  private readonly logger = new Logger(MemoryHierarchyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取游戏的记忆列表
   *
   * @param gameId - 游戏 ID
   * @param limit - 限制数量
   * @returns 记忆列表
   */
  async getMemories(gameId: string, limit?: number): Promise<Memory[]> {
    return this.prisma.memory.findMany({
      where: { gameId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * 获取活跃记忆
   * 返回游戏中最近的活跃记忆，用于AI上下文
   *
   * @param gameId - 游戏 ID
   * @param limit - 限制数量，默认为20
   * @returns 活跃记忆列表
   */
  async getActiveMemories(gameId: string, limit: number = 20): Promise<Memory[]> {
    return this.prisma.memory.findMany({
      where: { gameId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * 创建新记忆
   *
   * @param gameId - 游戏 ID
   * @param content - 记忆内容
   * @returns 创建的记忆
   */
  async createMemory(gameId: string, content: string): Promise<Memory> {
    return this.prisma.memory.create({
      data: {
        gameId,
        content,
      },
    });
  }

  /**
   * 删除记忆
   *
   * @param memoryId - 记忆 ID
   * @returns 删除的记忆
   */
  async deleteMemory(memoryId: string): Promise<Memory> {
    return this.prisma.memory.delete({
      where: { id: memoryId },
    });
  }

  /**
   * 获取记忆数量统计
   *
   * @param gameId - 游戏 ID
   * @returns 统计信息
   */
  async getMemoryStats(gameId: string): Promise<{ total: number }> {
    const count = await this.prisma.memory.count({
      where: { gameId },
    });

    return { total: count };
  }

  /**
   * 清理旧记忆（保留最近的N条）
   *
   * @param gameId - 游戏 ID
   * @param keepCount - 保留数量
   * @returns 清理的记忆数量
   */
  async cleanupOldMemories(gameId: string, keepCount: number = 100): Promise<number> {
    // 获取需要删除的记忆ID
    const memoriesToDelete = await this.prisma.memory.findMany({
      where: { gameId },
      orderBy: { createdAt: 'desc' },
      skip: keepCount,
      select: { id: true },
    });

    if (memoriesToDelete.length === 0) {
      return 0;
    }

    // 批量删除
    const result = await this.prisma.memory.deleteMany({
      where: {
        id: { in: memoriesToDelete.map((m) => m.id) },
      },
    });

    this.logger.log(`Cleaned up ${result.count} old memories for game ${gameId}`);
    return result.count;
  }
}
