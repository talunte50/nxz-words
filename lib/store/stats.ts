import type { DailyStat, ReviewState, UserData } from "../types";
import { todayKey } from "../utils";

export interface StudyDelta {
  newCount?: number;
  reviewCount?: number;
  correct?: number;
  wrong?: number;
  minutes?: number;
}

export function recordStudy(data: UserData, delta: StudyDelta): void {
  const date = todayKey();
  let stat = data.stats.find((item) => item.date === date);
  if (!stat) {
    stat = { date, newCount: 0, reviewCount: 0, correctCount: 0, wrongCount: 0, minutes: 0 };
    data.stats.push(stat);
  }
  stat.newCount += delta.newCount ?? 0;
  stat.reviewCount += delta.reviewCount ?? 0;
  stat.correctCount += delta.correct ?? 0;
  stat.wrongCount += delta.wrong ?? 0;
  stat.minutes += delta.minutes ?? 0;
  data.stats.sort((a, b) => a.date.localeCompare(b.date));
  if (data.stats.length > 400) {
    data.stats = data.stats.slice(-400);
  }
}

export function recentStats(data: UserData, days: number): DailyStat[] {
  const map = new Map(data.stats.map((item) => [item.date, item]));
  const out: DailyStat[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() - (days - 1));
  for (let i = 0; i < days; i += 1) {
    const key = todayKey(cursor);
    out.push(
      map.get(key) ?? {
        date: key,
        newCount: 0,
        reviewCount: 0,
        correctCount: 0,
        wrongCount: 0,
        minutes: 0,
      },
    );
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

export function countLearned(data: UserData): number {
  return Object.values(data.reviews).filter((state) => state.reps > 0).length;
}

export function countMastered(data: UserData): number {
  return Object.values(data.reviews).filter((state) => state.status === "mastered").length;
}

export function dueReviews(data: UserData, now: Date = new Date()): ReviewState[] {
  return Object.values(data.reviews).filter(
    (state) => new Date(state.due).getTime() <= now.getTime(),
  );
}