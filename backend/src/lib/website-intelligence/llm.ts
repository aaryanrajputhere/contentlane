import OpenAI from 'openai';
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

export async function callLLM(
  prompt: LLMPrompt,
  options?: { temperature?: number; maxTokens?: number; responseFormat?: 'json_object' | 'text' }
): Promise<string | null> {
  const client = getOpenAIClient();
  if (!client) return null;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user }
      ],
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? 2000,
      response_format: options?.responseFormat === 'text' ? undefined : { type: 'json_object' }
    });

    return response.choices[0]?.message?.content ?? null;
  } catch (error) {
    console.error('LLM API Error:', error);
    return null;
  }
}
