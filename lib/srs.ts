import type { ReviewGrade, ReviewState, WordStatus } from "./types";
import { addDays } from "./utils";

const INTERVALS_MINUTES = [5, 30, 12 * 60, 24 * 60, 2 * 24 * 60, 4 * 24 * 60, 7 * 24 * 60, 15 * 24 * 60, 30 * 24 * 60, 60 * 24 * 60, 120 * 24 * 60];

const GRADE_QUALITY: Record<ReviewGrade, number> = {
  again: 0,
  hard: 3,
  good: 4,
  easy: 5,
};

export function createReviewState(wordId: string, bookId: string): ReviewState {
  return {
    wordId,
    bookId,
    status: "new",
    ease: 2.5,
    interval: 0,
    reps: 0,
    lapses: 0,
    due: new Date().toISOString(),
    lastReview: null,
  };
}

function statusFor(state: ReviewState): WordStatus {
  if (state.reps === 0) return "new";
  if (state.interval >= 21) return "mastered";
  if (state.interval >= 1) return "review";
  return "learning";
}

export function schedule(state: ReviewState, grade: ReviewGrade, now: Date = new Date()): ReviewState {
  const quality = GRADE_QUALITY[grade];
  const next: ReviewState = { ...state, reps: state.reps + 1, lastReview: now.toISOString() };

  if (quality < 3) {
    next.lapses = state.lapses + 1;
    next.interval = 0;
    next.due = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
    next.status = "learning";
    return next;
  }

  const easeDelta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  next.ease = Math.max(1.3, Math.min(3.0, state.ease + easeDelta));

  if (state.reps === 0) {
    next.interval = grade === "easy" ? 2 : 1;
  } else if (state.reps === 1) {
    next.interval = grade === "hard" ? 2 : 4;
  } else {
    const factor = grade === "hard" ? 1.2 : grade === "easy" ? next.ease * 1.3 : next.ease;
    next.interval = Math.round(state.interval * factor);
  }

  const minutes = INTERVALS_MINUTES[Math.min(next.interval, INTERVALS_MINUTES.length - 1)];
  next.due = new Date(now.getTime() + minutes * 60 * 1000).toISOString();
  next.status = statusFor(next);
  return next;
}

export function previewIntervals(state: ReviewState): Record<ReviewGrade, string> {
  const grades: ReviewGrade[] = ["again", "hard", "good", "easy"];
  const result = {} as Record<ReviewGrade, string>;
  for (const grade of grades) {
    const next = schedule(state, grade);
    const diffMs = new Date(next.due).getTime() - Date.now();
    result[grade] = humanizeMinutes(diffMs / 60000);
  }
  return result;
}

export function humanizeMinutes(minutes: number): string {
  if (minutes < 1) return "<1 分钟";
  if (minutes < 60) return `${Math.round(minutes)} 分钟`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} 小时`;
  if (minutes < 30 * 24 * 60) return `${Math.round(minutes / (24 * 60))} 天`;
  return `${Math.round(minutes / (30 * 24 * 60))} 个月`;
}

export function isDue(state: ReviewState, now: Date = new Date()): boolean {
  return new Date(state.due).getTime() <= now.getTime();
}

export function nextDueDate(state: ReviewState): string {
  return addDays(new Date(state.due), 0).toISOString();
}