"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button } from "@/components/ui";
import { AiExplainPanel } from "@/components/AiExplainPanel";
import { createReviewState, previewIntervals } from "@/lib/srs";
import type { ReviewGrade, ReviewState, Word } from "@/lib/types";
import { cn } from "@/lib/utils";
import { fetchExample } from "@/lib/client/api";

const GRADE_BUTTONS: { grade: ReviewGrade; label: string; tone: string }[] = [
  { grade: "again", label: "忘记", tone: "bg-rose-500 hover:bg-rose-600" },
  { grade: "hard", label: "模糊", tone: "bg-amber-500 hover:bg-amber-600" },
  { grade: "good", label: "记得", tone: "bg-brand-500 hover:bg-brand-600" },
  { grade: "easy", label: "简单", tone: "bg-emerald-500 hover:bg-emerald-600" },
];

export function speak(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.92;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

export function WordCard({
  word,
  review,
  favorited,
  onGrade,
  onToggleFavorite,
}: {
  word: Word;
  review: ReviewState | null;
  favorited: boolean;
  onGrade: (grade: ReviewGrade) => void;
  onToggleFavorite: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [aiExample, setAiExample] = useState<{ en: string; zh: string } | null>(null);
  const [exampleBusy, setExampleBusy] = useState(false);
  const requested = useRef(false);

  // 卡片背面首次显示时，若无静态例句，按需生成并缓存
  const loadExample = useCallback(async () => {
    if (requested.current || word.example) return;
    requested.current = true;
    setExampleBusy(true);
    try {
      const ex = await fetchExample(word.id);
      setAiExample({ en: ex.en, zh: ex.zh });
    } catch {
      // AI 未配置/失败：静默降级，不阻塞学习
    } finally {
      setExampleBusy(false);
    }
  }, [word.id, word.example]);

  useEffect(() => {
    if (flipped) void loadExample();
  }, [flipped, loadExample]);

  const exampleEn = word.example || aiExample?.en || "";
  const exampleZh = word.exampleZh || aiExample?.zh || "";

  const intervals = useMemo(
    () => previewIntervals(review ?? createReviewState(word.id, word.bookId)),
    [review, word.id, word.bookId],
  );

  return (
    <div className="space-y-4">
      <div className="flip-scene">
        <div className={cn("flip-card", flipped && "is-flipped", "min-h-[19rem]")}>
          <div
            className={cn(
              "flip-face flex min-h-[19rem] cursor-pointer flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800 text-center shadow-sm",
            )}
            onClick={() => setFlipped((prev) => !prev)}
          >
            <div className="absolute right-4 top-4 flex items-center gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleFavorite();
                }}
                className="grid h-11 w-11 place-items-center rounded-full text-2xl transition"
                aria-label="收藏"
              >
                {favorited ? "⭐" : "☆"}
              </button>
            </div>
            <h2 className="text-4xl font-bold tracking-tight">{word.word}</h2>
            <p className="mt-3 text-sm text-slate-400 dark:text-slate-500">{word.phonetic}</p>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                speak(word.word);
              }}
              className="mt-4 rounded-full bg-brand-50 px-4 py-2.5 text-sm text-brand-600"
            >
              🔊 朗读
            </button>
            <p className="mt-6 text-xs text-slate-300 dark:text-slate-500">点击卡片查看释义</p>
          </div>

          <div
            className="flip-face flip-face--back flex min-h-[19rem] cursor-pointer flex-col rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800 shadow-sm"
            onClick={() => setFlipped((prev) => !prev)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge tone="brand">{word.pos}</Badge>
                {word.tags?.slice(0, 2).map((tag) => (
                  <Badge key={tag} tone="slate">
                    {tag}
                  </Badge>
                ))}
              </div>
              <span className="text-sm text-slate-400 dark:text-slate-500">{word.word}</span>
            </div>

            <p className="mt-4 text-xl font-semibold text-slate-900 dark:text-slate-100">{word.meaning}</p>

            {exampleEn ? (
              <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-700/60 p-4">
                <p className="text-sm text-slate-700 dark:text-slate-200">{exampleEn}</p>
                {exampleZh ? (
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{exampleZh}</p>
                ) : null}
                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      speak(exampleEn);
                    }}
                    className="grid h-10 min-w-10 place-items-center rounded-lg px-2 text-xs text-brand-600"
                  >
                    🔊 朗读例句
                  </button>
                  {aiExample && !word.example ? (
                    <span className="text-[10px] text-slate-300 dark:text-slate-500">AI 生成</span>
                  ) : null}
                </div>
              </div>
            ) : exampleBusy ? (
              <div className="mt-4 rounded-2xl bg-slate-50 dark:bg-slate-700/60 p-4">
                <p className="text-xs text-slate-400 dark:text-slate-500">正在生成例句…</p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowAi(true);
              }}
              className="mt-4 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700"
            >
              🧠 AI 精讲这个词
            </button>
          </div>
        </div>
      </div>

      {flipped ? (
        <div className="grid grid-cols-4 gap-2">
          {GRADE_BUTTONS.map((item) => (
            <button
              key={item.grade}
              type="button"
              onClick={() => onGrade(item.grade)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-sm font-medium text-white transition",
                item.tone,
              )}
            >
              <span>{item.label}</span>
              <span className="text-[10px] font-normal text-white/80">
                {intervals[item.grade]}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">翻面后选择记忆程度，系统按遗忘曲线排期</p>
      )}

      {showAi ? (
        <AiExplainPanel word={word.word} level={word.bookId.toUpperCase()} onClose={() => setShowAi(false)} />
      ) : null}
    </div>
  );
}