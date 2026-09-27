import type { NextRequest } from "next/server";
import { currentUser, fail, ok } from "@/lib/api";
import {
  countLearned,
  countMastered,
  dueReviews,
  recentStats,
} from "@/lib/store/stats";
import { streakDays } from "@/lib/utils";
import { getBookMeta, getBookName } from "@/lib/wordbooks-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const context = await currentUser();
  if (!context) return fail("未登录", 401);

  const { data } = context;
  const rawDays = Number(request.nextUrl.searchParams.get("days") ?? 30);
  const days = Math.min(Math.max(Number.isFinite(rawDays) ? rawDays : 30, 7), 90);

  const totals = data.stats.reduce(
    (acc, item) => ({
      newCount: acc.newCount + item.newCount,
      reviewCount: acc.reviewCount + item.reviewCount,
      correctCount: acc.correctCount + item.correctCount,
      wrongCount: acc.wrongCount + item.wrongCount,
      minutes: acc.minutes + item.minutes,
    }),
    { newCount: 0, reviewCount: 0, correctCount: 0, wrongCount: 0, minutes: 0 },
  );

  const activeDates = data.stats
    .filter((item) => item.newCount + item.reviewCount > 0)
    .map((item) => item.date);

  return ok({
    recent: recentStats(data, days),
    totals,
    learned: countLearned(data),
    mastered: countMastered(data),
    dueCount: dueReviews(data).length,
    streak: streakDays(activeDates),
    favorites: data.favorites.length,
    totalWords: getBookMeta(data.profile.currentBookId)?.wordCount ?? 0,
    currentBookId: data.profile.currentBookId, currentBookName: getBookName(data.profile.currentBookId),
    dailyGoal: data.profile.dailyGoal,
  });
}