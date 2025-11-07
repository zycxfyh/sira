// 文件路径: apps/nexus-engine/src/settings/settings.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { User, AiConfiguration } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SettingsService } from './settings.service';

// [核心修正] 从 @tuheg/common-backend 导入共享的 ZodValidationPipe
import { ZodValidationPipe } from '@tuheg/common-backend';

// 导入DTO类型和Zod schema
import {
  createAiSettingsSchema,
  updateAiSettingsSchema,
  testAiConnectionSchema,
} from '@tuheg/common-backend';
import type {
  CreateAiSettingsDto,
  UpdateAiSettingsDto,
  TestAiConnectionDto,
} from '@tuheg/common-backend';

@Controller('settings/ai-configurations')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Post('test-connection')
  @HttpCode(HttpStatus.OK)
  public async testConnection(
    @Body(new ZodValidationPipe(testAiConnectionSchema))
    dto: TestAiConnectionDto,
  ): Promise<{ models: string[] }> {
    return this.settingsService.testAndFetchModels(dto);
  }

  @Get()
  public async getAllAiSettings(@Req() req: Request): Promise<AiConfiguration[]> {
    const user = req.user as User;
    return this.settingsService.getAllAiSettingsForUser(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async createAiSetting(
    @Req() req: Request,
    @Body(new ZodValidationPipe(createAiSettingsSchema))
    dto: CreateAiSettingsDto,
  ): Promise<AiConfiguration> {
    const user = req.user as User;
    return this.settingsService.createAiSetting(user.id, dto);
  }

  @Patch(':id')
  public async updateAiSetting(
    @Req() req: Request,
    @Param('id') configId: string,
    @Body(new ZodValidationPipe(updateAiSettingsSchema))
    dto: UpdateAiSettingsDto,
  ): Promise<AiConfiguration> {
    const user = req.user as User;
    return this.settingsService.updateAiSetting(user.id, configId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  public async deleteAiSetting(
    @Req() req: Request,
    @Param('id') configId: string,
  ): Promise<{ message: string }> {
    const user = req.user as User;
    return this.settingsService.deleteAiSetting(user.id, configId);
  }
}
