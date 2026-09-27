import manifest from "../../data/wordbooks/manifest.json";
import type { WordBook, WordBookMeta } from "../types";

type JsonModule = { default: unknown };

// 词书分片映射：基于 manifest 动态生成，新增词书无需手改本文件。
// webpack/Next 会对同目录下 data/wordbooks/*.json 做静态分析以支持动态 import。
const META = manifest as WordBookMeta[];

// 动态 import：Next 在构建期把 data/wordbooks 下所有 .json 拆成独立 chunk，
// 运行时按 id 惰性加载，几万词不会打进首屏包。
async function dynamicLoad(id: string): Promise<JsonModule> {
  return await import(`../../data/wordbooks/${id}.json`);
}

const LOADERS: Record<string, () => Promise<JsonModule>> = {};
for (const meta of META) {
  LOADERS[meta.id] = () => dynamicLoad(meta.id);
}

const cache = new Map<string, WordBook>();

export function bookIds(): string[] {
  return Object.keys(LOADERS);
}

export function isKnownBook(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(LOADERS, id);
}

export async function loadBook(id: string): Promise<WordBook | null> {
  const cached = cache.get(id);
  if (cached) return cached;
  const loader = LOADERS[id];
  if (!loader) return null;
  const mod = await loader();
  const book = mod.default as WordBook;
  if (!book) return null;
  cache.set(id, book);
  return book;
}

export function bookIdFromWordId(wordId: string): string {
  const at = wordId.indexOf("_");
  return at > 0 ? wordId.slice(0, at) : "";
}

export function clearBookCache(): void {
  cache.clear();
}