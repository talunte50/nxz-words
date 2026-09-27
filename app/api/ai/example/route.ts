import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api";
import { chat, extractJson, isAiConfigured } from "@/lib/ai/client";
import { exampleMessages } from "@/lib/ai/prompts";
import { findWord } from "@/lib/wordbooks-server";
import { getCachedExample, setCachedExample } from "@/lib/store/example-cache";
import { aiModelName } from "@/lib/ai/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ParsedExample {
  en?: string;
  zh?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { wordId?: string } | null;
  const wordId = String(body?.wordId ?? "").trim();
  if (!wordId) return fail("缺少 wordId");

  const found = await findWord(wordId);
  if (!found) return fail("单词不存在", 404);
  const { word } = found;

  // 1. 查全局缓存
  const cached = await getCachedExample(wordId);
  if (cached?.en) {
    return ok({ wordId, en: cached.en, zh: cached.zh || "", cached: true });
  }

  // 2. 词本身带静态例句 → 回填缓存，免调 AI
  if (word.example?.trim()) {
    const en = word.example.trim();
    const zh = (word.exampleZh || "").trim();
    await setCachedExample(wordId, en, zh, "static");
    return ok({ wordId, en, zh, cached: true });
  }

  // 3. 调 AI 生成
  if (!(await isAiConfigured())) {
    return fail("AI 未配置，无法生成例句", 400);
  }

  try {
    const raw = await chat({
      messages: exampleMessages(word.word, word.meaning),
      temperature: 0.3,
      maxTokens: 300,
      json: true,
    });
    const parsed = extractJson<ParsedExample>(raw);
    const en = (parsed?.en || "").trim();
    const zh = (parsed?.zh || "").trim();
    if (!en) return fail("AI 未返回有效例句", 502);
    await setCachedExample(wordId, en, zh, await aiModelName());
    return ok({ wordId, en, zh, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail(`AI 例句生成失败：${message}`, 502);
  }
}