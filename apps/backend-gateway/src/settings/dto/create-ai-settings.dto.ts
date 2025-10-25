// apps/backend/apps/nexus-engine/src/settings/dto/create-ai-settings.dto.ts
import { z } from 'zod';

export const createAiSettingsSchema = z.object({
  provider: z.string().min(1),
  apiKey: z.string().min(1),
  modelId: z.string().min(1),
  baseUrl: z.string().url().optional().nullable(),
  // 前端现在会发送 roles: string[]（优于 CSV）
  roles: z.array(z.string()).optional(),
});

export type CreateAiSettingsDto = z.infer<typeof createAiSettingsSchema>;
