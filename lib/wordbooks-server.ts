import manifest from "../data/wordbooks/manifest.json";
import { getBookOverrides, isBookEnabled, type BookOverrides } from "./config/books";
import { bookIdFromWordId, bookIds, loadBook } from "./dicts/loader";
import type { Word, WordBook, WordBookMeta } from "./types";

const META = manifest as WordBookMeta[];

/** 原始清单（未应用管理端覆盖），管理端使用 */
export function listRawWordBooks(): WordBookMeta[] {
  return META;
}

/**
 * 对外的词书清单：合并管理端覆盖（启用/禁用、排序、置顶、自定义分类）。
 * 默认按 分类 → 名称 排序，置顶与权重优先。
 */
export function listWordBooks(overrides?: BookOverrides): WordBookMeta[] {
  const ov = overrides ?? {};
  const merged = META.map((book) => {
    const o = ov[book.id] ?? {};
    return {
      ...book,
      category: o.category ?? book.category,
      enabled: isBookEnabled(ov, book.id),
      pinned: Boolean(o.pinned),
      weight: o.weight ?? 0,
    };
  });

  merged.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.weight !== b.weight) return b.weight - a.weight;
    const ca = a.category ?? "";
    const cb = b.category ?? "";
    if (ca !== cb) return ca.localeCompare(cb, "zh");
    return a.name.localeCompare(b.name, "zh");
  });

  return merged;
}

/** 仅启用的词书（前端选书用） */
export function listEnabledWordBooks(overrides?: BookOverrides): WordBookMeta[] {
  return listWordBooks(overrides).filter((book) => book.enabled !== false);
}

export function getBookMeta(id: string): WordBookMeta | undefined {
  return META.find((item) => item.id === id);
}

export function getBookName(id: string): string {
  return getBookMeta(id)?.name ?? "未知词书";
}

export function getBookLevel(id: string): string {
  return getBookMeta(id)?.level ?? "CET4";
}

export function knownBookIds(): string[] {
  return bookIds();
}

export async function getWordBook(id: string): Promise<WordBook | null> {
  return loadBook(id);
}

export async function getBookWords(bookId: string): Promise<Word[]> {
  const book = await loadBook(bookId);
  return book?.words ?? [];
}

export async function findWord(wordId: string): Promise<{ word: Word; book: WordBook } | null> {
  const bookId = bookIdFromWordId(wordId);
  if (!bookId) return null;
  const book = await loadBook(bookId);
  if (!book) return null;
  const word = book.words.find((item) => item.id === wordId);
  return word ? { word, book } : null;
}

/** 管理端/接口用：读取覆盖层 */
export { getBookOverrides };
