import type { ChatMessage } from "../types";
import { getAiConfig, isAiReady, type AiConfig } from "../config/ai";

export class AiNotConfiguredError extends Error {
  constructor() {
    super("AI 未配置：请在管理端配置大模型，或设置 AI_BASE_URL / AI_API_KEY / AI_MODEL 环境变量");
    this.name = "AiNotConfiguredError";
  }
}

export interface ChatOptions {
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  json?: boolean;
  signal?: AbortSignal;
}

function endpoint(baseUrl: string): string {
  const base = (baseUrl || "").replace(/\/+$/, "");
  return `${base}/chat/completions`;
}

function headers(config: AiConfig): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };
}

/** 是否已配置（同时读 KV 与环境变量） */
export async function isAiConfigured(): Promise<boolean> {
  return isAiReady(await getAiConfig());
}

/** 当前生效的模型名，用于前端展示 */
export async function aiModelName(): Promise<string> {
  const config = await getAiConfig();
  return config.model || "unknown";
}

export async function chat(options: ChatOptions): Promise<string> {
  const config = await getAiConfig();
  if (!isAiReady(config)) throw new AiNotConfiguredError();
  const res = await fetch(endpoint(config.baseUrl), {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({
      model: config.model,
      messages: options.messages,
      temperature: options.temperature ?? config.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? config.maxTokens ?? 900,
      ...(options.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: options.signal,
  });
  if (!res.ok) {
    throw new Error(`AI 接口返回 ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content ?? "";
}

export async function* chatStream(options: ChatOptions): AsyncGenerator<string, void, unknown> {
  const config = await getAiConfig();
  if (!isAiReady(config)) throw new AiNotConfiguredError();
  const res = await fetch(endpoint(config.baseUrl), {
    method: "POST",
    headers: headers(config),
    body: JSON.stringify({
      model: config.model,
      messages: options.messages,
      temperature: options.temperature ?? config.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? config.maxTokens ?? 900,
      stream: true,
    }),
    signal: options.signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`AI 流式接口返回 ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const chunk = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        continue;
      }
    }
  }
}

export function extractJson<T>(text: string): T | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const source = fenced ? fenced[1] : text;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(source.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
