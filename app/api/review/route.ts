import type { NextRequest } from "next/server";
import { currentUser, fail, ok } from "@/lib/api";
import { createReviewState, schedule } from "@/lib/srs";
import { recordStudy } from "@/lib/store/stats";
import { saveUserData } from "@/lib/store/user-store";
import type { ReviewGrade } from "@/lib/types";
import { findWord } from "@/lib/wordbooks-server";

export const dynamic = "force-dynamic";

const GRADES: ReviewGrade[] = ["again", "hard", "good", "easy"];

export async function POST(request: NextRequest) {
  const context = await currentUser();
  if (!context) return fail("未登录", 401);

  const body = (await request.json().catch(() => null)) as
    | { wordId?: string; grade?: ReviewGrade; minutes?: number }
    | null;

  const wordId = String(body?.wordId ?? "");
  const grade = body?.grade;
  if (!wordId || !grade || !GRADES.includes(grade)) return fail("参数不合法");

  const found = await findWord(wordId);
  if (!found) return fail("单词不存在", 404);

  const { data } = context;
  const currentState = data.reviews[wordId] ?? createReviewState(wordId, found.book.id);
  const isFirstTime = currentState.reps === 0;
  const nextState = schedule(currentState, grade);

  data.reviews[wordId] = nextState;

  const correct = grade !== "again";
  recordStudy(data, {
    newCount: isFirstTime ? 1 : 0,
    reviewCount: isFirstTime ? 0 : 1,
    correct: correct ? 1 : 0,
    wrong: correct ? 0 : 1,
    minutes: Number(body?.minutes ?? 0) || 0,
  });

  await saveUserData(data);

  return ok({
    review: nextState,
    isFirstTime,
  });
}