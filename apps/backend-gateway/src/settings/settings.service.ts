// apps/backend/apps/nexus-engine/src/settings/settings.service.ts

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@tuheg/common-backend'; // 你提供的共享 PrismaService
import { HttpService } from '@nestjs/axios';
import { lastValueFrom, firstValueFrom } from 'rxjs';
import { CreateAiSettingsDto } from './dto/create-ai-settings.dto';
import { UpdateAiSettingsDto, TestAiConnectionDto } from './dto/update-ai-settings.dto';
import { createAiSettingsSchema } from './dto/create-ai-settings.dto';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
  ) {}

  // Helper: ensure role records exist and return their objects (id + name)
  private async ensureRoles(roleNames: string[]) {
    if (!Array.isArray(roleNames)) return [];

    const normalized = Array.from(
      new Set(
        roleNames.map((r) => (typeof r === 'string' ? r.trim() : '')).filter((r) => r.length > 0),
      ),
    );

    const results = [];
    for (const name of normalized) {
      // Upsert role by name (Role.name has unique constraint)
      const role = await this.prisma.role.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      results.push(role);
    }
    return results;
  }

  // Create AI configuration for a user
  public async createAiSetting(userId: string, payload: any) {
    // validate minimal shape
    const parsed = createAiSettingsSchema.safeParse(payload);
    if (!parsed.success) {
      throw new BadRequestException('Invalid payload for createAiSetting');
    }
    const dto = parsed.data as CreateAiSettingsDto;

    // If roles provided, ensure they exist
    const roleRecords = dto.roles && dto.roles.length > 0 ? await this.ensureRoles(dto.roles) : [];

    const created = await this.prisma.aiConfiguration.create({
      data: {
        owner: { connect: { id: userId } },
        provider: dto.provider,
        apiKey: dto.apiKey,
        modelId: dto.modelId,
        baseUrl: dto.baseUrl ?? null,
        roles:
          roleRecords.length > 0 ? { connect: roleRecords.map((r) => ({ id: r.id })) } : undefined,
      },
      include: {
        roles: true,
      },
    });

    // Normalize returned object (frontend expects roles array)
    return this.normalizeAiConfiguration(created);
  }

  // Update AI configuration (only owner can update)
  public async updateAiSetting(
    userId: string,
    configId: string,
    payload: Partial<UpdateAiSettingsDto>,
  ) {
    // Check existence and ownership
    const existing = await this.prisma.aiConfiguration.findUnique({
      where: { id: configId },
      include: { roles: true },
    });
    if (!existing) {
      throw new NotFoundException('AI configuration not found');
    }
    if (existing.ownerId !== userId) {
      throw new BadRequestException('Not authorized to update this configuration');
    }

    const dataToUpdate: any = {};
    if (payload.provider !== undefined) dataToUpdate.provider = payload.provider;
    if (payload.apiKey !== undefined) dataToUpdate.apiKey = payload.apiKey;
    if (payload.modelId !== undefined) dataToUpdate.modelId = payload.modelId;
    if (payload.baseUrl !== undefined) dataToUpdate.baseUrl = payload.baseUrl ?? null;

    // Handle roles: if provided, upsert roles and set relation to exactly this list
    if (payload.roles) {
      const roleRecords = await this.ensureRoles(payload.roles);
      // Use 'set' to replace existing relation with new ones
      dataToUpdate.roles = { set: roleRecords.map((r) => ({ id: r.id })) };
    }

    const updated = await this.prisma.aiConfiguration.update({
      where: { id: configId },
      data: dataToUpdate,
      include: { roles: true },
    });

    return this.normalizeAiConfiguration(updated);
  }

  // Delete AI configuration (only owner can delete)
  public async deleteAiSetting(userId: string, configId: string) {
    const existing = await this.prisma.aiConfiguration.findUnique({ where: { id: configId } });
    if (!existing) {
      throw new NotFoundException('AI configuration not found');
    }
    if (existing.ownerId !== userId) {
      throw new BadRequestException('Not authorized to delete this configuration');
    }

    await this.prisma.aiConfiguration.delete({ where: { id: configId } });
    return { message: 'deleted' };
  }

  // Get all AI configurations for a user
  public async getAllAiSettingsForUser(userId: string) {
    const configs = await this.prisma.aiConfiguration.findMany({
      where: { ownerId: userId },
      include: {
        roles: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return configs.map((c) => this.normalizeAiConfiguration(c));
  }

  // Normalize DB record to API shape: includes roles: string[]
  private normalizeAiConfiguration(record: any) {
    const roles =
      Array.isArray(record.roles) && record.roles.length > 0
        ? record.roles.map((r: any) => (r.name ? r.name : r.id))
        : [];

    return {
      id: record.id,
      ownerId: record.ownerId,
      provider: record.provider,
      apiKey: record.apiKey ? '***REDACTED***' : '', // don't leak key in API responses (return empty string instead of null)
      modelId: record.modelId,
      baseUrl: record.baseUrl ?? null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      roles, // string[]
      // legacy compatibility for frontends expecting assignedRoles CSV:
      assignedRoles: roles.join(','),
    };
  }

  /**
   * Test AI connection and try to fetch available models.
   * This supports 'openai' provider as first-class example.
   * For other providers we attempt a GET on baseUrl (if provided) and return JSON keys if possible.
   */
  public async testAndFetchModels(dto: TestAiConnectionDto): Promise<{ models: string[] }> {
    const provider = dto.provider?.toLowerCase?.() ?? '';
    const apiKey = dto.apiKey;
    const baseUrl = dto.baseUrl ?? null;

    if (!apiKey) {
      throw new BadRequestException('apiKey is required');
    }

    try {
      if (provider.includes('openai')) {
        // call OpenAI list models endpoint
        const url = (baseUrl || 'https://api.openai.com').replace(/\/+$/, '') + '/v1/models';
        const resp$ = this.httpService.get(url, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
        });

        const resp = await lastValueFrom(resp$);
        const models = Array.isArray(resp.data?.data)
          ? resp.data.data.map((m: any) => m.id).filter(Boolean)
          : [];

        return { models };
      } else {
        // Generic probe: if baseUrl provided, call it and try extract model list from common shapes
        if (!baseUrl) {
          return { models: [] };
        }
        const url = baseUrl;
        const resp$ = this.httpService.get(url, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
        });

        const resp = await lastValueFrom(resp$);
        // Try a few heuristics
        if (Array.isArray(resp.data?.models)) {
          return {
            models: resp.data.models
              .map((m: any) => (typeof m === 'string' ? m : m.id))
              .filter(Boolean),
          };
        }
        if (Array.isArray(resp.data)) {
          return {
            models: resp.data.map((m: any) => (typeof m === 'string' ? m : m.id)).filter(Boolean),
          };
        }
        // fallback: return keys if object with keys looks like model map
        if (resp.data && typeof resp.data === 'object') {
          const keys = Object.keys(resp.data).slice(0, 50);
          return { models: keys };
        }
        return { models: [] };
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.warn('testAndFetchModels failed', errorMessage);
      // Bubble up user-friendly error
      throw new BadRequestException(`Failed to connect to provider: ${errorMessage}`);
    }
  }
}
