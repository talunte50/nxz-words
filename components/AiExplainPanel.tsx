"use client";

import { useState } from "react";
import { Badge, Button, Card, Spinner } from "@/components/ui";
import { speak } from "@/components/WordCard";
import { apiSend } from "@/lib/client/api";
import type { AiWordExplanation } from "@/lib/types";

interface ExplainResponse {
  explanation: AiWordExplanation;
  cached: boolean;
  aiEnabled: boolean;
}

export function AiExplainPanel({
  word,
  level,
  onClose,
}: {
  word: string;
  level: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExplainResponse | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiSend<ExplainResponse>("/api/ai/explain", "POST", { word, level });
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 调用失败");
    } finally {
      setLoading(false);
    }
  }

  const explanation = result?.explanation;

  return (
    <Card className="animate-fade-up border-brand-200 bg-brand-50/40">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-brand-700">🧠 AI 精讲 · {word}</span>
          {result ? (
            <Badge tone={result.aiEnabled ? "green" : "amber"}>
              {result.aiEnabled ? (result.cached ? "缓存" : "实时生成") : "演示模式"}
            </Badge>
          ) : null}
        </div>
        <button type="button" onClick={onClose} className="grid h-10 min-w-10 place-items-center rounded-lg px-2 text-sm text-slate-400 dark:text-slate-500">
          收起
        </button>
      </div>

      {!result && !loading ? (
        <Button className="mt-4" onClick={load}>
          生成讲解
        </Button>
      ) : null}

      {loading ? <Spinner label="AI 正在讲解…" /> : null}
      {error ? <p className="mt-3 text-sm text-rose-500">{error}</p> : null}

      {explanation ? (
        <div className="mt-4 space-y-4 text-sm">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{explanation.translation}</p>
              {explanation.phonetic ? (
                <span className="text-xs text-slate-400 dark:text-slate-500">{explanation.phonetic}</span>
              ) : null}
            </div>
            {explanation.partOfSpeech ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">{explanation.partOfSpeech}</p>
            ) : null}
          </div>

          {explanation.examples?.length ? (
            <div>
              <p className="mb-1 font-medium text-slate-700 dark:text-slate-200">例句</p>
              <ul className="space-y-2">
                {explanation.examples.map((item, index) => (
                  <li key={index} className="rounded-xl bg-white p-3 dark:bg-slate-700/60">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-slate-700 dark:text-slate-200">{item.en}</p>
                      <button
                        type="button"
                        onClick={() => speak(item.en)}
                        className="grid h-10 min-w-10 shrink-0 place-items-center rounded-lg text-brand-600"
                        aria-label="朗读例句"
                      >
                        🔊
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{item.zh}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {explanation.roots ? (
            <div>
              <p className="mb-1 font-medium text-slate-700 dark:text-slate-200">词根词缀</p>
              <p className="rounded-xl bg-white p-3 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">{explanation.roots}</p>
            </div>
          ) : null}

          {explanation.collocations?.length ? (
            <div>
              <p className="mb-1 font-medium text-slate-700 dark:text-slate-200">常见搭配</p>
              <div className="flex flex-wrap gap-2">
                {explanation.collocations.map((item) => (
                  <Badge key={item} tone="slate">
                    {item}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          {explanation.confusions ? (
            <div>
              <p className="mb-1 font-medium text-slate-700 dark:text-slate-200">易混辨析</p>
              <p className="rounded-xl bg-white p-3 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">{explanation.confusions}</p>
            </div>
          ) : null}

          {explanation.mnemonic ? (
            <div>
              <p className="mb-1 font-medium text-slate-700 dark:text-slate-200">记忆法</p>
              <p className="rounded-xl bg-white p-3 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">{explanation.mnemonic}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}