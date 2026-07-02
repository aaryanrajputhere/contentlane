import { z } from 'zod';

export const idParamsSchema = z.object({ id: z.string().cuid() });
export const authSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(12).max(200) });
export const signupSchema = authSchema.extend({ name: z.string().trim().min(1).max(100).optional() });
export const analyzeSchema = z.object({ website: z.string().url().max(2048), forceRegenerate: z.boolean().default(false), idempotencyKey: z.string().min(8).max(200).optional() });
export const hookJobSchema = z.object({ productId: z.string().cuid(), idempotencyKey: z.string().min(8).max(200).optional() });
export const scriptHookSceneBriefSchema = z.object({
  purpose: z.string().trim().min(1).max(500),
  context: z.string().trim().min(1).max(1000),
  requiredVisualChange: z.string().trim().min(1).max(1000),
  overlayTextDirection: z.string().trim().min(1).max(500),
});
export const scriptHookSpecSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  templateType: z.string().trim().min(1).max(120).optional(),
  sceneDurationSeconds: z.number().int().min(1).max(30).default(2),
  scenes: z.array(scriptHookSceneBriefSchema).min(1).max(20),
});
export const scriptHookInputSchema = z.union([z.string().trim().min(1).max(2000), scriptHookSpecSchema]);
export const hookTemplateQuerySchema = z.object({ includeInactive: z.enum(['true', 'false']).optional().default('false') });
export const hookTemplateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(2000),
  templateType: z.string().trim().min(1).max(120),
  sceneDurationSeconds: z.number().int().min(1).max(30).default(2),
  scenes: z.array(scriptHookSceneBriefSchema).min(1).max(20),
  sortOrder: z.number().int().min(-10000).max(10000).default(0),
  isActive: z.boolean().default(true),
});
export const scriptJobSchema = z.object({ campaignId: z.string().cuid(), productId: z.string().cuid(), hooks: z.array(scriptHookInputSchema).min(1).max(5), character: z.string().max(100).nullable().optional(), characterImageUrl: z.string().url().nullable().optional(), idempotencyKey: z.string().min(8).max(200).optional() });
export const mediaJobSchema = z.object({ characterImageUrl: z.string().url().optional(), productImageUrl: z.string().url().optional(), idempotencyKey: z.string().min(8).max(200).optional() });
export const scriptsQuerySchema = z.object({ productId: z.string().cuid().optional() });

export const sceneSchema = z.object({
  onScreenText: z.string().max(200),
  imagePrompt: z.string().max(4000),
  featuresCharacter: z.boolean().default(false),
  featuresProduct: z.boolean().default(false),
  durationSeconds: z.number().int().min(1).max(30),
  generatedImageUrl: z.string().url().optional(),
  generatedVideoUrl: z.string().url().optional(),
  error: z.string().max(300).optional(),
}).strict();

export const generatedScriptSchema = z.object({ hook: z.string(), templateType: z.string(), scenes: z.array(sceneSchema).min(1).max(20), cta: z.string(), durationSeconds: z.number().int().min(1).max(180) }).strict();
export type ScriptHookSceneBrief = z.infer<typeof scriptHookSceneBriefSchema>;
export type ScriptHookSpecInput = z.infer<typeof scriptHookSpecSchema>;
export type ScriptHookInput = z.infer<typeof scriptHookInputSchema>;
export type HookTemplateInput = z.infer<typeof hookTemplateSchema>;
export type Scene = z.infer<typeof sceneSchema>;
