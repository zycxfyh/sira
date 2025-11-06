// apps/backend/apps/nexus-engine/src/settings/dto/create-ai-settings.dto.ts
import { z } from 'zod';

export const allowedProviders = [
  'DeepSeek',
  'Moonshot',
  'OpenAI',
  'Groq',
  'Ollama',
  'CustomOpenAICompatible',
] as const;

export const providerSchema = z.enum(allowedProviders, {
  message: 'Unsupported provider. Please select a known provider or CustomOpenAICompatible.',
});

export const apiKeySchema = z
  .string()
  .trim()
  .min(16, { message: 'API key must be at least 16 characters long.' })
  .max(200, { message: 'API key must be 200 characters or fewer.' })
  .regex(/^[A-Za-z0-9_\-.+=:/]+$/, {
    message: 'API key contains invalid characters.',
  });

export const modelIdSchema = z
  .string()
  .trim()
  .min(1, { message: 'Model ID is required.' })
  .max(120, { message: 'Model ID must be 120 characters or fewer.' })
  .regex(/^[A-Za-z0-9._\-:/]+$/, {
    message: 'Model ID contains invalid characters.',
  });

export const roleNameSchema = z
  .string()
  .trim()
  .min(1, { message: 'Role name cannot be empty.' })
  .max(40, { message: 'Role name must be 40 characters or fewer.' })
  .regex(/^[A-Za-z0-9:_-]+$/, {
    message: 'Role name can only include letters, numbers, colon, underscore, or hyphen.',
  });

export const baseUrlSchema = z
  .string()
  .trim()
  .url({ message: 'Base URL must be a valid URL.' })
  .max(300, { message: 'Base URL must be 300 characters or fewer.' });

export const createAiSettingsSchema = z.object({
  provider: providerSchema,
  apiKey: apiKeySchema,
  modelId: modelIdSchema,
  baseUrl: baseUrlSchema.optional().nullable(),
  roles: z
    .array(roleNameSchema)
    .max(20, {
      message: 'No more than 20 roles can be assigned to a configuration.',
    })
    .optional(),
});

export type CreateAiSettingsDto = z.infer<typeof createAiSettingsSchema>;
