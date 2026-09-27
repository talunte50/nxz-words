import type { NextRequest } from "next/server";
import { currentUser, fail, ok } from "@/lib/api";
import { saveUserData } from "@/lib/store/user-store";
import { findWord } from "@/lib/wordbooks-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await currentUser();
  if (!context) return fail("未登录", 401);

  const resolved = await Promise.all(context.data.favorites.map((id) => findWord(id)));
  const words = resolved
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({ ...item.word, bookName: item.book.name }));

  return ok({ favorites: words });
}

export async function POST(request: NextRequest) {
  const context = await currentUser();
  if (!context) return fail("未登录", 401);

  const body = (await request.json().catch(() => null)) as
    | { wordId?: string; action?: "add" | "remove" | "toggle" }
    | null;

  const wordId = String(body?.wordId ?? "");
  if (!wordId || !(await findWord(wordId))) return fail("单词不存在", 404);

  const { data } = context;
  const set = new Set(data.favorites);
  const exists = set.has(wordId);
  const action = body?.action ?? "toggle";
  const shouldAdd = action === "add" ? true : action === "remove" ? false : !exists;

  if (shouldAdd) set.add(wordId);
  else set.delete(wordId);

  data.favorites = Array.from(set);
  await saveUserData(data);

  return ok({ favorited: data.favorites.includes(wordId), total: data.favorites.length });
}