// apps/backend/apps/nexus-engine/src/settings/dto/update-ai-settings.dto.ts
import { z } from 'zod';

export const updateAiSettingsSchema = z.object({
  provider: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
  modelId: z.string().min(1).optional(),
  baseUrl: z.string().url().optional().nullable(),
  // 更新也接受 roles 数组
  roles: z.array(z.string()).optional(),
});

export const testAiConnectionSchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional().nullable(),
  // modelId 可以可选，用于特定 provider 的探测
  modelId: z.string().optional(),
});

export type UpdateAiSettingsDto = z.infer<typeof updateAiSettingsSchema>;
export type TestAiConnectionDto = z.infer<typeof testAiConnectionSchema>;
