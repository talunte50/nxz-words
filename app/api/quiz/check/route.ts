import type { NextRequest } from "next/server";
import { currentUser, fail, ok } from "@/lib/api";
import { createReviewState, schedule } from "@/lib/srs";
import { recordStudy } from "@/lib/store/stats";
import { saveUserData } from "@/lib/store/user-store";
import type { ReviewGrade } from "@/lib/types";
import { findWord } from "@/lib/wordbooks-server";

export const dynamic = "force-dynamic";

export type QuizType = "spelling" | "dictation" | "cloze";

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function POST(request: NextRequest) {
  const context = await currentUser();
  if (!context) return fail("未登录", 401);

  const body = (await request.json().catch(() => null)) as
    | { wordId?: string; answer?: string; type?: QuizType; minutes?: number }
    | null;

  const wordId = String(body?.wordId ?? "");
  const answer = String(body?.answer ?? "");
  if (!wordId) return fail("缺少单词 id");

  const found = await findWord(wordId);
  if (!found) return fail("单词不存在", 404);

  const expected = found.word.word;
  const correct = normalize(answer) === normalize(expected);

  const { data } = context;
  const state = data.reviews[wordId] ?? createReviewState(wordId, found.book.id);
  const isFirstTime = state.reps === 0;
  const grade: ReviewGrade = correct ? "good" : "again";
  const nextState = schedule(state, grade);
  data.reviews[wordId] = nextState;

  recordStudy(data, {
    newCount: isFirstTime ? 1 : 0,
    reviewCount: isFirstTime ? 0 : 1,
    correct: correct ? 1 : 0,
    wrong: correct ? 0 : 1,
    minutes: Number(body?.minutes ?? 0) || 0,
  });

  await saveUserData(data);

  return ok({
    correct,
    expected,
    meaning: found.word.meaning,
    phonetic: found.word.phonetic,
    review: nextState,
  });
}