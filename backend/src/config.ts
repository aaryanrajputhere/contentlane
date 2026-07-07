import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.string().default('info'),
  JWT_SECRET: z.string().min(32),
  COOKIE_NAME: z.string().min(1).default('reelswarm_session'),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
}

export const config = parsed.data;
