import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_URL: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.string().default("info"),
  JWT_SECRET: z.string().min(32),
  COOKIE_NAME: z.string().min(1).default("ContentLane_session"),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(14),
  FIRECRAWL_API_KEY: z.string().trim().default(""),
  FIRECRAWL_BASE_URL: z.string().url().default("https://api.firecrawl.dev/v2"),
  FIRECRAWL_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(300_000)
    .default(120_000),
  OPENAI_API_KEY: z.string().trim().default(""),
  OPENAI_SYNTHESIS_MODEL: z.string().trim().default("gpt-4o-mini"),
  OPENAI_HOOK_MODEL: z.string().trim().default("gpt-5.4-nano"),
  OPENAI_USE_BATCH_OR_FLEX: z.string().trim().default(""),
  RUNPOD_API_KEY: z.string().trim().default(""),
  RUNPOD_LLM_ENDPOINT_URL: z.string().trim().default(""),
  RUNPOD_LLM_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(300_000)
    .default(120_000),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  throw new Error(
    `Invalid environment configuration: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`,
  );
}

export const config = parsed.data;
