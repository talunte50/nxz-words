import type { NextRequest } from "next/server";
import { currentUser, fail, ok } from "@/lib/api";
import { isDue } from "@/lib/srs";
import { getBookWords } from "@/lib/wordbooks-server";
import type { Word } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const context = await currentUser();
  if (!context) return fail("未登录", 401);

  const { data } = context;
  const params = request.nextUrl.searchParams;
  const bookId = params.get("bookId") ?? data.profile.currentBookId;
  const mode = params.get("mode") ?? "mixed";
  const limit = Number(params.get("limit") ?? data.profile.dailyGoal);

  const words = await getBookWords(bookId);
  if (!words.length) return fail("词书不存在", 404);

  const reviews = data.reviews;
  const newWords = words.filter((word) => (reviews[word.id]?.reps ?? 0) === 0);
  const dueWords = words.filter(
    (word) => (reviews[word.id]?.reps ?? 0) > 0 && isDue(reviews[word.id]),
  );

  let queue: Word[];
  if (mode === "new") queue = newWords;
  else if (mode === "review") queue = dueWords;
  else queue = [...dueWords, ...newWords];

  const size = Math.max(1, Math.min(Number.isFinite(limit) ? limit : 20, 100));

  return ok({
    bookId,
    mode,
    total: words.length,
    newCount: newWords.length,
    dueCount: dueWords.length,
    items: queue.slice(0, size).map((word) => ({
      word,
      review: reviews[word.id] ?? null,
    })),
  });
}