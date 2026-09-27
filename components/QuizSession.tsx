"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge, Button, Card, EmptyState, Progress, Spinner } from "@/components/ui";
import { speak } from "@/components/WordCard";
import { apiGet, apiSend, fetchExample } from "@/lib/client/api";
import type { ReviewState, Word } from "@/lib/types";
import { cn, percent } from "@/lib/utils";

export type QuizType = "spelling" | "dictation" | "cloze";

interface LearnItem {
  word: Word;
  review: ReviewState | null;
}

interface LearnResponse {
  bookId: string;
  items: LearnItem[];
}

interface CheckResponse {
  correct: boolean;
  expected: string;
  meaning: string;
  phonetic: string;
  review: ReviewState;
}

const TYPE_LABEL: Record<QuizType, string> = {
  spelling: "看中文拼写",
  dictation: "听发音拼写",
  cloze: "例句填空",
};

const TYPE_BADGE: Record<QuizType, string> = {
  spelling: "拼写",
  dictation: "听写",
  cloze: "填空",
};

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function targetPattern(word: string, flags = "i"): RegExp {
  return new RegExp(`\\b${escapeRegExp(word)}\\b`, flags);
}

function blankOut(sentence: string, word: string): string {
  return sentence.replace(targetPattern(word, "gi"), "_____");
}

export function QuizSession({ type }: { type: QuizType }) {
  const [queue, setQueue] = useState<LearnItem[]>([]);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState({ done: 0, right: 0 });
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<LearnResponse>("/api/learn?mode=mixed&limit=15");
      let items = res.items;
      if (type === "cloze") {
        // 无静态例句的词按需生成例句（命中全局缓存则秒回），限并发 2
        const need = items.filter((item) => !item.word.example);
        const extra: Record<string, { en: string; zh: string }> = {};
        const queueIds = need.map((n) => n.word.id);
        for (let i = 0; i < queueIds.length; i += 2) {
          const chunk = queueIds.slice(i, i + 2);
          const settled = await Promise.all(
            chunk.map(async (id) => {
              try {
                return await fetchExample(id);
              } catch {
                return null;
              }
            }),
          );
          settled.forEach((ex, j) => {
            if (ex) extra[chunk[j]] = { en: ex.en, zh: ex.zh };
          });
        }
        items = items
          .map((item) => {
            const generated = extra[item.word.id];
            if (generated) {
              return {
                ...item,
                word: { ...item.word, example: generated.en, exampleZh: generated.zh },
              };
            }
            return item;
          })
          .filter(
            (item) => item.word.example && targetPattern(item.word.word).test(item.word.example),
          );
      }
      setQueue(items);
      setIndex(0);
      setAnswer("");
      setResult(null);
      setScore({ done: 0, right: 0 });
      setStartedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    void load();
  }, [load]);

  const current = queue[index];

  useEffect(() => {
    if (!current) return;
    setAnswer("");
    setResult(null);
    if (type === "dictation") {
      const timer = setTimeout(() => speak(current.word.word), 350);
      return () => clearTimeout(timer);
    }
    inputRef.current?.focus();
  }, [current, type]);

  async function submit() {
    if (!current || result || busy) return;
    const elapsed = Math.max(0, (Date.now() - startedAt) / 60000);
    setBusy(true);
    try {
      const res = await apiSend<CheckResponse>("/api/quiz/check", "POST", {
        wordId: current.word.id,
        answer,
        type,
        minutes: elapsed / Math.max(1, score.done + 1),
      });
      setResult(res);
      setScore((prev) => ({ done: prev.done + 1, right: prev.right + (res.correct ? 1 : 0) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setBusy(false);
    }
  }

  function next() {
    setIndex((prev) => prev + 1);
  }

  if (loading) return <Spinner label="正在出题…" />;
  if (error) {
    return <EmptyState icon="⚠️" title="出错了" description={error} action={<Button onClick={load}>重试</Button>} />;
  }
  if (!queue.length) {
    return (
      <EmptyState
        icon="📭"
        title={type === "cloze" ? "当前词书暂无可用例句" : "当前词书没有可练习的单词"}
        description={
          type === "cloze"
            ? "例句填空需要词库包含例句，可切换词书或先用其他题型"
            : "请先切换词书或等待复习到期"
        }
        action={
          <Link href="/wordbooks">
            <Button>去选词书</Button>
          </Link>
        }
      />
    );
  }

  if (index >= queue.length || !current) {
    const accuracy = score.done ? Math.round((score.right / score.done) * 100) : 100;
    return (
      <Card className="space-y-4 text-center">
        <div className="text-5xl">{accuracy >= 80 ? "🏅" : "💪"}</div>
        <h1 className="text-xl font-semibold">测试完成</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
          {TYPE_LABEL[type]} · 共 {score.done} 题
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-700/60 p-3">
            <div className="text-2xl font-semibold">{score.right}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500">答对</div>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-700/60 p-3">
            <div className="text-2xl font-semibold">{score.done - score.right}</div>
            <div className="text-xs text-slate-400 dark:text-slate-500">答错</div>
          </div>
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-700/60 p-3">
            <div className="text-2xl font-semibold">{accuracy}%</div>
            <div className="text-xs text-slate-400 dark:text-slate-500">正确率</div>
          </div>
        </div>
        <Button className="w-full" onClick={load}>
          再来一组
        </Button>
      </Card>
    );
  }

  const masked = `${current.word.word[0]}${"·".repeat(Math.max(0, current.word.word.length - 1))}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">
        <span>
          第 {index + 1} / {queue.length} 题 · {TYPE_LABEL[type]}
        </span>
        <span className="text-emerald-600">✓ {score.right}</span>
      </div>
      <Progress value={percent(index, queue.length)} />

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge tone="brand">{TYPE_BADGE[type]}</Badge>
          <Badge tone="slate">{current.word.pos}</Badge>
          <span className="text-xs text-slate-400 dark:text-slate-500">{current.word.word.length} 个字母</span>
        </div>

        {type === "dictation" ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <button
              type="button"
              onClick={() => speak(current.word.word)}
              className="pulse-ring grid h-20 w-20 place-items-center rounded-full bg-brand-500 text-3xl text-white"
            >
              🔊
            </button>
            <p className="text-sm text-slate-400 dark:text-slate-500">点击喇叭重复播放，然后拼写你听到的单词</p>
          </div>
        ) : type === "cloze" ? (
          <div className="space-y-3 py-2">
            <p className="text-lg leading-relaxed text-slate-900 dark:text-slate-100">
              {blankOut(current.word.example ?? "", current.word.word)}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">释义：{current.word.meaning}</p>
          </div>
        ) : (
          <div className="space-y-2 py-2">
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{current.word.meaning}</p>
            <p className="text-sm text-slate-400 dark:text-slate-500">{current.word.phonetic}</p>
            <p className="text-sm text-slate-400 dark:text-slate-500">提示：{masked}</p>
          </div>
        )}

        <input
          ref={inputRef}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              if (result) next();
              else void submit();
            }
          }}
          disabled={Boolean(result)}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="输入英文单词后回车"
          className={cn(
            "w-full rounded-xl border px-4 py-3 text-center text-lg tracking-wide outline-none",
            result
              ? result.correct
                ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                : "border-rose-400 bg-rose-50 text-rose-700"
              : "border-slate-300 dark:border-slate-600 focus:border-brand-500",
          )}
        />

        {result ? (
          <div className="animate-fade-up space-y-3 rounded-2xl bg-slate-50 dark:bg-slate-700/60 p-4">
            <div className="flex items-center justify-between">
              <span className={cn("font-medium", result.correct ? "text-emerald-600" : "text-rose-600")}>
                {result.correct ? "✓ 回答正确" : "✗ 回答错误"}
              </span>
              <button
                type="button"
                onClick={() => speak(result.expected)}
                className="text-xs text-brand-600"
              >
                🔊 朗读
              </button>
            </div>
            {!result.correct ? (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                正确答案：<span className="font-semibold text-slate-900 dark:text-slate-100">{result.expected}</span>
              </p>
            ) : null}
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {result.phonetic} {result.meaning}
            </p>
            {type === "cloze" && current.word.example ? (
              <p className="rounded-xl bg-white p-3 dark:bg-slate-700/60 text-sm text-slate-600 dark:text-slate-300">{current.word.example}</p>
            ) : null}
          </div>
        ) : null}

        {result ? (
          <Button className="w-full" onClick={next}>
            {index + 1 >= queue.length ? "查看结果" : "下一题"}
          </Button>
        ) : (
          <Button className="w-full" size="lg" disabled={busy || !answer.trim()} onClick={() => void submit()}>
            {busy ? "判分中…" : "提交答案"}
          </Button>
        )}
      </Card>
    </div>
  );
}