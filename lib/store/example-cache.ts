import { getKV } from "../storage";
import type { ExampleCache } from "../types";

const PREFIX = "example:";

function cacheKey(wordId: string): string {
  return `${PREFIX}${wordId}`;
}

export async function getCachedExample(wordId: string): Promise<ExampleCache | null> {
  return getKV().get<ExampleCache>(cacheKey(wordId));
}

export async function setCachedExample(
  wordId: string,
  en: string,
  zh: string,
  model?: string,
): Promise<void> {
  const record: ExampleCache = { en, zh, model, at: new Date().toISOString() };
  await getKV().put(cacheKey(wordId), record);
}