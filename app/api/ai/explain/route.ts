import type { NextRequest } from "next/server";
import { errorMessage, fail, ok } from "@/lib/api";
import { chat, extractJson, isAiConfigured } from "@/lib/ai/client";
import { mockExplanation, wordExplainMessages } from "@/lib/ai/prompts";
import { getKV } from "@/lib/storage";
import type { AiWordExplanation } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | { word?: string; level?: string }
    | null;

  const word = String(body?.word ?? "").trim();
  const level = String(body?.level ?? "CET4");
  if (!word) return fail("缺少单词");

  const cacheKey = `ai:explain:${level}:${word.toLowerCase()}`;
  const kv = getKV();

  const cached = await kv.get<AiWordExplanation>(cacheKey);
  if (cached) {
    return ok({ explanation: cached, cached: true, aiEnabled: await isAiConfigured() });
  }

  if (!(await isAiConfigured())) {
    return ok({ explanation: mockExplanation(word), cached: false, aiEnabled: false });
  }

  try {
    const raw = await chat({
      messages: wordExplainMessages(word, level),
      temperature: 0.5,
      maxTokens: 900,
      json: true,
    });
    const parsed = extractJson<Partial<AiWordExplanation>>(raw);
    const explanation: AiWordExplanation = { ...mockExplanation(word), ...parsed, word };
    await kv.put(cacheKey, explanation);
    return ok({ explanation, cached: false, aiEnabled: true });
  } catch (error) {
    return fail(errorMessage(error, "AI 调用失败"), 502);
  }
}