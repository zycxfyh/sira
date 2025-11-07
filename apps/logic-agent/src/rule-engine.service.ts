// 文件路径: apps/backend/apps/logic-agent/src/rule-engine.service.ts (已修复 unknown 类型)

import { Injectable, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import {
  PrismaService,
  DirectiveSet,
  StateChangeDirective,
  NumericOperation,
  StringOperation,
  CharacterUpdate,
} from '@tuheg/common-backend';

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  public async execute(gameId: string, directives: DirectiveSet): Promise<void> {
    if (!directives || directives.length === 0) {
      this.logger.warn(`RuleEngine executed with an empty directive set for game ${gameId}.`);
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const transactionClient = tx as Prisma.TransactionClient;

        for (const directive of directives) {
          if (directive.op === 'update_character') {
            await this.handleUpdateCharacter(transactionClient, gameId, directive);
          } else {
            throw new BadRequestException(`Unknown directive operation: ${directive.op}`);
          }
        }
      });

      this.logger.log(`Successfully executed ${directives.length} directives for game ${gameId}.`);
    } catch (error: unknown) {
      // <-- [核心修正] 明确 error 类型为 unknown
      // 如果是BadRequestException，直接重新抛出
      if (error instanceof BadRequestException) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown database error';
      this.logger.error(
        `Transaction failed during rule execution for game ${gameId}`,
        error instanceof Error ? error.stack : error,
      );
      throw new InternalServerErrorException(`Rule engine transaction failed: ${errorMessage}`);
    }
  }

  private async handleUpdateCharacter(
    tx: Prisma.TransactionClient,
    gameId: string,
    directive: StateChangeDirective,
  ) {
    const character = await tx.character.findUniqueOrThrow({
      where: { gameId },
    });
    const payload = directive.payload as CharacterUpdate;
    const updates: Prisma.CharacterUpdateInput = {};

    if (payload.hp) {
      updates.hp = this.applyNumericOperation(character.hp, payload.hp);
    }
    if (payload.mp) {
      updates.mp = this.applyNumericOperation(character.mp, payload.mp);
    }
    if (payload.status) {
      updates.status = this.applyStringOperation(character.status, payload.status);
    }

    if (Object.keys(updates).length > 0) {
      await tx.character.update({ where: { gameId }, data: updates });
    }
  }

  private applyNumericOperation(currentValue: number, op: NumericOperation): number {
    switch (op.op) {
      case 'set':
        return op.value;
      case 'increment':
        return currentValue + op.value;
      case 'decrement':
        return currentValue - op.value;
    }
  }

  private applyStringOperation(currentValue: string, op: StringOperation): string {
    switch (op.op) {
      case 'set':
        return op.value;
      case 'append':
        return currentValue + op.value;
      case 'prepend':
        return op.value + currentValue;
    }
  }
}
