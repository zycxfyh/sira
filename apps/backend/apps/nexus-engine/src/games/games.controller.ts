// 文件路径: apps/nexus-engine/src/games/games.controller.ts

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  Param,
  Get,
  Delete,
  HttpCode,
  HttpStatus,
  Patch,
} from '@nestjs/common';
import { Request } from 'express';
import { GamesService } from './games.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '@prisma/client';

// [核心修正] 从 @app/common 导入所有共享的 DTO 和管道
import {
  ZodValidationPipe,
  SubmitActionDto,
  submitActionSchema,
} from '@app/common';

// [注释] 本地 DTO 导入保持不变
import {
  CreateNarrativeGameDto,
  createNarrativeGameSchema,
} from './dto/create-game.dto';
import {
  UpdateCharacterDto,
  updateCharacterSchema,
} from './dto/update-character.dto';

@Controller('games')
@UseGuards(JwtAuthGuard)
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get()
  public async findAllForUser(@Req() req: Request) {
    const user = req.user as User;
    return this.gamesService.findAllForUser(user.id);
  }

  @Post('narrative-driven')
  public async createNarrative(
    @Req() req: Request,
    @Body(new ZodValidationPipe(createNarrativeGameSchema))
    dto: CreateNarrativeGameDto,
  ) {
    const user = req.user as User;
    return this.gamesService.createNarrativeDriven(user.id, dto);
  }

  @Post(':id/actions')
  @HttpCode(HttpStatus.ACCEPTED)
  public async submitAction(
    @Req() req: Request,
    @Param('id') gameId: string,
    // [核心修正] 使用从 @app/common 导入的 schema 和 DTO
    @Body(new ZodValidationPipe(submitActionSchema)) dto: SubmitActionDto,
  ): Promise<void> {
    const user = req.user as User;
    await this.gamesService.submitAction(user.id, gameId, dto);
  }

  @Get(':id')
  public async findOne(@Req() req: Request, @Param('id') gameId: string) {
    const user = req.user as User;
    return this.gamesService.findOne(user.id, gameId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  public async delete(@Req() req: Request, @Param('id') gameId: string) {
    const user = req.user as User;
    return this.gamesService.delete(user.id, gameId);
  }

  @Patch(':id/character')
  @HttpCode(HttpStatus.OK)
  public async updateCharacter(
    @Req() req: Request,
    @Param('id') gameId: string,
    @Body(new ZodValidationPipe(updateCharacterSchema))
    dto: UpdateCharacterDto,
  ) {
    const user = req.user as User;
    return this.gamesService.updateCharacterState(user.id, gameId, dto);
  }
}
