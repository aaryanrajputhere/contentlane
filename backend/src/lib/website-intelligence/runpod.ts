import { config } from "../../config";

function withTimeout(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timer };
}

function unwrapRunPodPayload(payload: unknown): unknown {
  if (typeof payload !== "object" || payload === null) return payload;
  const record = payload as Record<string, unknown>;
  for (const key of ["output", "result", "response", "data", "body"] as const) {
    if (key in record && record[key] !== undefined) {
      return record[key];
    }
  }
  return payload;
}

export function extractRunPodText(payload: unknown) {
  const unwrapped = unwrapRunPodPayload(payload);
  if (typeof unwrapped === "string") return unwrapped;
  if (typeof unwrapped === "object" && unwrapped !== null) {
    const record = unwrapped as Record<string, unknown>;
    const nested = record.text ?? record.content ?? record.message;
    if (typeof nested === "string") return nested;
    if (Array.isArray(record.choices)) {
      const choice = record.choices[0] as Record<string, unknown> | undefined;
      const message = choice?.message as Record<string, unknown> | undefined;
      if (typeof message?.content === "string") return message.content;
      if (typeof choice?.text === "string") return choice.text;
    }
    return JSON.stringify(unwrapped);
  }
  return String(unwrapped);
}

export async function callRunPodEndpoint(
  input: Record<string, unknown>,
  options?: { timeoutMs?: number },
) {
  if (!config.RUNPOD_API_KEY || !config.RUNPOD_LLM_ENDPOINT_URL) {
    return null;
  }
  const timeoutMs = options?.timeoutMs ?? config.RUNPOD_LLM_TIMEOUT_MS;
  const endpointUrl = new URL(config.RUNPOD_LLM_ENDPOINT_URL);
  if (endpointUrl.pathname.endsWith("/run")) {
    endpointUrl.pathname = endpointUrl.pathname.replace(/\/run$/, "/runsync");
  }
  const { controller, timer } = withTimeout(timeoutMs);
  try {
    const response = await fetch(endpointUrl.toString(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.RUNPOD_API_KEY}`,
      },
      body: JSON.stringify({ input }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(
        `RunPod request failed with ${response.status}: ${text.slice(0, 240)}`,
      );
    }
    if (!text.trim()) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function runPodJson<T>(
  input: Record<string, unknown>,
  options?: { timeoutMs?: number },
) {
  const payload = await callRunPodEndpoint(input, options);
  if (payload === null) return null;
  return payload as T;
}

export function buildRunPodPrompt(input: { system: string; user: string }) {
  return `${input.system}\n\n${input.user}`;
}

export function hasRunPodConfig() {
  return Boolean(config.RUNPOD_API_KEY && config.RUNPOD_LLM_ENDPOINT_URL);
}
