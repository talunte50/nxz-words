import manifest from "../data/wordbooks/manifest.json";
import { bookIdFromWordId, bookIds, loadBook } from "./dicts/loader";
import type { Word, WordBook, WordBookMeta } from "./types";

const META = manifest as WordBookMeta[];

export function listWordBooks(): WordBookMeta[] {
  return META;
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