/**
 * 词库运营配置（存 KV，管理端可改）
 *
 * - 不直接改写 data/wordbooks/manifest.json（构建产物，只读）
 * - 用「覆盖层」记录：启用/禁用、排序权重、自定义分类、置顶
 * - listWordBooks() 合并覆盖层后再输出
 */

import { getKV } from "../storage";

const BOOK_OVERRIDE_KEY = "config:books";

export interface BookOverride {
  enabled?: boolean;
  /** 排序权重，越大越靠前 */
  weight?: number;
  /** 置顶 */
  pinned?: boolean;
  /** 自定义分类（留空用 manifest 原值） */
  category?: string;
}

export interface BookOverrides {
  [bookId: string]: BookOverride;
}

export async function getBookOverrides(): Promise<BookOverrides> {
  try {
    return (await getKV().get<BookOverrides>(BOOK_OVERRIDE_KEY)) ?? {};
  } catch {
    return {};
  }
}

export async function saveBookOverride(
  bookId: string,
  patch: BookOverride,
): Promise<BookOverrides> {
  const all = await getBookOverrides();
  const merged: BookOverride = { ...all[bookId], ...patch };
  // 清理空值，避免 KV 里堆积无意义字段
  if (merged.category === "") delete merged.category;
  all[bookId] = merged;
  await getKV().put(BOOK_OVERRIDE_KEY, all);
  return all;
}

export async function resetBookOverride(bookId: string): Promise<BookOverrides> {
  const all = await getBookOverrides();
  delete all[bookId];
  await getKV().put(BOOK_OVERRIDE_KEY, all);
  return all;
}

export function isBookEnabled(overrides: BookOverrides, bookId: string): boolean {
  const o = overrides[bookId];
  if (!o) return true;
  return o.enabled !== false;
}
