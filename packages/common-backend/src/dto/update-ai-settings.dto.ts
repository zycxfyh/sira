// apps/backend/apps/nexus-engine/src/settings/dto/update-ai-settings.dto.ts
import { z } from "zod";
import {
  apiKeySchema,
  baseUrlSchema,
  modelIdSchema,
  providerSchema,
  roleNameSchema,
} from "./create-ai-settings.dto";

export const updateAiSettingsSchema = z.object({
  provider: providerSchema.optional(),
  apiKey: apiKeySchema.optional(),
  modelId: modelIdSchema.optional(),
  baseUrl: baseUrlSchema.optional().nullable(),
  roles: z
    .array(roleNameSchema)
    .max(20, {
      message: "No more than 20 roles can be assigned to a configuration.",
    })
    .optional(),
});

export const testAiConnectionSchema = z.object({
  provider: providerSchema,
  apiKey: apiKeySchema,
  baseUrl: baseUrlSchema.optional().nullable(),
  // modelId 可以可选，用于特定 provider 的探测
  modelId: modelIdSchema.optional(),
});

export type UpdateAiSettingsDto = z.infer<typeof updateAiSettingsSchema>;
export type TestAiConnectionDto = z.infer<typeof testAiConnectionSchema>;
