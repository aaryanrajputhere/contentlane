import OpenAI from 'openai';
import { AsyncLocalStorage } from 'node:async_hooks';
import { config } from "../../config";

let openai: OpenAI | null = null;
function getOpenAIClient() {
  if (!openai && config.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
  }
  return openai;
}

export function hasLLMConfig() {
  return Boolean(config.OPENAI_API_KEY);
}

export interface LLMPrompt {
  system: string;
  user: string;
}

export interface LLMTelemetryRecord {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  cachedTokens: number | null;
  totalTokens: number | null;
  estimatedUsd: number | null;
  responseFormat: 'json_object' | 'text';
  maxTokens: number;
  temperature: number;
  durationMs: number;
  projectId?: string;
  jobId?: string;
}

const llmTelemetry = new AsyncLocalStorage<LLMTelemetryRecord[]>();

export async function withLLMTelemetry<T>(fn: () => Promise<T>) {
  return llmTelemetry.run([], async () => {
    const result = await fn();
    return { result, telemetry: llmTelemetry.getStore() ?? [] };
  });
}

function isReasoningModel(model: string) {
  return model.startsWith('gpt-5') || model.startsWith('o');
}

function estimateUsd(model: string, inputTokens?: number | null, outputTokens?: number | null) {
  if (inputTokens == null || outputTokens == null) return null;
  const normalized = model.toLowerCase();
  const rates =
    normalized.includes('nano') || normalized.includes('luna')
      ? { input: 0.05, output: 0.4 }
      : normalized.includes('mini')
        ? { input: 0.15, output: 0.6 }
        : normalized.startsWith('gpt-5')
          ? { input: 1.25, output: 10 }
          : normalized.startsWith('gpt-4o')
            ? { input: 2.5, output: 10 }
            : null;
  if (!rates) return null;
  return Number((((inputTokens / 1_000_000) * rates.input) + ((outputTokens / 1_000_000) * rates.output)).toFixed(6));
}

function pickNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function recordTelemetry(record: LLMTelemetryRecord) {
  llmTelemetry.getStore()?.push(record);
}

export async function callLLM(
  prompt: LLMPrompt,
  options?: { model?: string; temperature?: number; maxTokens?: number; responseFormat?: 'json_object' | 'text'; projectId?: string; jobId?: string }
): Promise<string | null> {
  const client = getOpenAIClient();
  if (!client) return null;

  const model = options?.model ?? 'gpt-4o-mini';
  const temperature = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens ?? 2000;
  const format = options?.responseFormat === 'text' ? 'text' : 'json_object';

  console.log(`[llm] request model=${model} temp=${temperature} max_tokens=${maxTokens} format=${format}`);

  const start = Date.now();

  try {
    if (isReasoningModel(model)) {
      const response = await client.responses.create({
        model,
        instructions: prompt.system,
        input: prompt.user,
        max_output_tokens: maxTokens,
        reasoning: { effort: 'low' },
        text: {
          format: format === 'text' ? { type: 'text' } : { type: 'json_object' },
          verbosity: 'low',
        },
      });

      const content = response.output_text?.trim() || null;
      const usage = response.usage as Record<string, unknown> | undefined;
      const inputTokens = pickNumber(usage?.input_tokens);
      const outputTokens = pickNumber(usage?.output_tokens);
      const totalTokens = pickNumber(usage?.total_tokens);
      const outputDetails = usage?.output_tokens_details as Record<string, unknown> | undefined;
      const inputDetails = usage?.input_tokens_details as Record<string, unknown> | undefined;
      const reasoningTokens = pickNumber(outputDetails?.reasoning_tokens);
      const cachedTokens = pickNumber(inputDetails?.cached_tokens);
      const ms = Date.now() - start;
      const estimatedUsd = estimateUsd(model, inputTokens, outputTokens);

      console.log(
        `[llm] response ${ms}ms status=${response.status ?? '?'} incomplete=${response.incomplete_details?.reason ?? 'none'} input=${inputTokens ?? '?'} output=${outputTokens ?? '?'} cached=${cachedTokens ?? '?'} reasoning=${reasoningTokens ?? '?'} est_usd=${estimatedUsd ?? '?'} chars=${content?.length ?? 0}`,
      );
      recordTelemetry({ model, inputTokens, outputTokens, reasoningTokens, cachedTokens, totalTokens, estimatedUsd, responseFormat: format, maxTokens, temperature, durationMs: ms, projectId: options?.projectId, jobId: options?.jobId });

      return content;
    }

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: format === 'text' ? undefined : { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content ?? null;
    const usage = response.usage as Record<string, unknown> | undefined;
    const promptDetails = usage?.prompt_tokens_details as Record<string, unknown> | undefined;
    const completionDetails = usage?.completion_tokens_details as Record<string, unknown> | undefined;
    const inputTokens = pickNumber(usage?.prompt_tokens);
    const outputTokens = pickNumber(usage?.completion_tokens);
    const totalTokens = pickNumber(usage?.total_tokens);
    const cachedTokens = pickNumber(promptDetails?.cached_tokens);
    const reasoningTokens = pickNumber(completionDetails?.reasoning_tokens);
    const ms = Date.now() - start;
    const estimatedUsd = estimateUsd(model, inputTokens, outputTokens);

    console.log(`[llm] response ${ms}ms finish=${response.choices[0]?.finish_reason} input=${inputTokens ?? '?'} output=${outputTokens ?? '?'} cached=${cachedTokens ?? '?'} reasoning=${reasoningTokens ?? '?'} est_usd=${estimatedUsd ?? '?'} chars=${content?.length ?? 0}`);
    recordTelemetry({ model, inputTokens, outputTokens, reasoningTokens, cachedTokens, totalTokens, estimatedUsd, responseFormat: format, maxTokens, temperature, durationMs: ms, projectId: options?.projectId, jobId: options?.jobId });

    return content;
  } catch (error) {
    console.error(`[llm] error after ${Date.now() - start}ms:`, error instanceof Error ? error.message : error);
    return null;
  }
}
