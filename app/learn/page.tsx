"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useUser } from "@/components/AppShell";
import { WordCard } from "@/components/WordCard";
import { Button, Card, EmptyState, Progress, Spinner } from "@/components/ui";
import { apiGet, apiSend } from "@/lib/client/api";
import type { ReviewGrade, ReviewState, Word } from "@/lib/types";
import { percent } from "@/lib/utils";

interface LearnItem {
  word: Word;
  review: ReviewState | null;
}

interface LearnResponse {
  bookId: string;
  mode: string;
  total: number;
  newCount: number;
  dueCount: number;
  items: LearnItem[];
}

export default function LearnPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LearnSession />
    </Suspense>
  );
}

function LearnSession() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") ?? "mixed";
  const { profile, ready, refresh } = useUser();

  const [queue, setQueue] = useState<LearnItem[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [score, setScore] = useState({ done: 0, right: 0 });
  const [finished, setFinished] = useState(false);
  const [startedAt, setStartedAt] = useState(() => Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<LearnResponse>(`/api/learn?mode=${mode}`);
      setQueue(res.items);
      setIndex(0);
      setFinished(res.items.length === 0);
      setScore({ done: 0, right: 0 });
      setStartedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    if (profile) void load();
  }, [profile, load]);

  useEffect(() => {
    if (!profile) return;
    apiGet<{ favorites: Word[] }>("/api/favorites")
      .then((res) => setFavorites(res.favorites.map((item) => item.id)))
      .catch(() => undefined);
  }, [profile]);

  const current = queue[index];

  async function grade(value: ReviewGrade) {
    if (!current) return;
    const elapsed = Math.max(0, (Date.now() - startedAt) / 60000);
    const minutes = elapsed / Math.max(1, score.done + 1);
    try {
      const res = await apiSend<{ review: ReviewState }>("/api/review", "POST", {
        wordId: current.word.id,
        grade: value,
        minutes,
      });
      setScore((prev) => ({
        done: prev.done + 1,
        right: prev.right + (value === "again" ? 0 : 1),
      }));

      const remaining = queue.length - index - 1;

      setQueue((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], review: res.review };
        if (value === "again") next.push({ word: current.word, review: res.review });
        return next;
      });

      if (value === "again") {
        setIndex((prev) => prev + 1);
      } else if (remaining <= 0) {
        setFinished(true);
        void refresh();
      } else {
        setIndex((prev) => prev + 1);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    }
  }

  async function toggleFavorite(wordId: string) {
    const res = await apiSend<{ favorited: boolean }>("/api/favorites", "POST", { wordId });
    setFavorites((prev) =>
      res.favorited ? [...new Set([...prev, wordId])] : prev.filter((id) => id !== wordId),
    );
  }

  if (!ready) return <Spinner />;

  if (!profile) {
    return (
      <EmptyState
        icon="🔐"
        title="请先登录"
        description="登录后即可开始按遗忘曲线学习单词"
        action={
          <Link href="/login">
            <Button>去登录</Button>
          </Link>
        }
      />
    );
  }

  if (loading) return <Spinner label="正在准备学习队列…" />;
  if (error) return <EmptyState icon="⚠️" title="出错了" description={error} action={<Button onClick={load}>重试</Button>} />;

  if (finished || !current) {
    const accuracy = score.done ? Math.round((score.right / score.done) * 100) : 100;
    return (
      <Card className="space-y-4 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="text-xl font-semibold">本轮学习完成</h1>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-700/60 p-3">
            <div className="text-2xl font-semibold">{score.done}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500">作答次数</div>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-700/60 p-3">
            <div className="text-2xl font-semibold">{score.right}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500">记住</div>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-700/60 p-3">
            <div className="text-2xl font-semibold">{accuracy}%</div>
            <div className="text-xs text-slate-400 dark:text-slate-500">正确率</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={load}>
            再来一轮
          </Button>
          <Link href="/profile" className="flex-1">
            <Button variant="ghost" className="w-full">
              查看统计
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
        <span>
          {mode === "review" ? "复习模式" : mode === "new" ? "新词模式" : "混合模式"} ·{" "}
          {Math.min(index + 1, queue.length)} / {queue.length}
        </span>
        <Link href="/wordbooks" className="text-brand-600">
          切换词书
        </Link>
      </div>
      <Progress value={percent(index, queue.length)} />

      <WordCard
        key={`${current.word.id}-${index}`}
        word={current.word}
        review={current.review}
        favorited={favorites.includes(current.word.id)}
        onGrade={grade}
        onToggleFavorite={() => void toggleFavorite(current.word.id)}
      />
    </div>
  );
}