import { z } from 'zod';

const emptyToUndefined = (value: unknown) => value === '' ? undefined : value;

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  AI_PROVIDER_MODE: z.enum(['mock', 'live']).default('mock'),
  SCRIPT_GENERATION_PROVIDER: z.enum(['huggingface', 'runpod']).default('runpod'),
  SCRIPT_GENERATION_MODEL: z.string().min(1).default('Qwen/Qwen2.5-7B-Instruct'),
  LOG_LEVEL: z.string().default('info'),
  FIRECRAWL_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  HF_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  RUNPOD_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  RUNPOD_LLM_ENDPOINT_ID: z.preprocess(emptyToUndefined, z.string().default('phausv7n2ezt9w')),
  RUNPOD_LLM_ENDPOINT_URL: z.preprocess(emptyToUndefined, z.string().url().default('https://api.runpod.ai/v2/phausv7n2ezt9w/run')),
  RUNPOD_ENDPOINT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  RUNPOD_VIDEO_ENDPOINT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  CLOUDINARY_CLOUD_NAME: z.preprocess(emptyToUndefined, z.string().optional()),
  CLOUDINARY_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  CLOUDINARY_API_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  MEDIA_DOWNLOAD_HOSTS: z.string().default(''),
}).superRefine((value, context) => {
  if (value.AI_PROVIDER_MODE !== 'live') return;
  for (const key of ['FIRECRAWL_API_KEY', 'HF_TOKEN', 'RUNPOD_API_KEY', 'RUNPOD_ENDPOINT_ID', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] as const) {
    if (!value[key]) context.addIssue({ code: 'custom', path: [key], message: `${key} is required in live mode` });
  }
  if (value.SCRIPT_GENERATION_PROVIDER === 'runpod' && !value.RUNPOD_LLM_ENDPOINT_ID && !value.RUNPOD_LLM_ENDPOINT_URL) {
    context.addIssue({ code: 'custom', path: ['RUNPOD_LLM_ENDPOINT_ID'], message: 'RUNPOD_LLM_ENDPOINT_ID or RUNPOD_LLM_ENDPOINT_URL is required for RunPod script generation' });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
}

export const config = parsed.data;
