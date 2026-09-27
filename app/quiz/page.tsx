"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useUser } from "@/components/AppShell";
import { QuizSession, type QuizType } from "@/components/QuizSession";
import { Button, Card, EmptyState, SectionTitle, Spinner } from "@/components/ui";

const MODES: { type: QuizType; label: string }[] = [
  { type: "spelling", label: "看中文拼写" },
  { type: "dictation", label: "听发音拼写" },
  { type: "cloze", label: "例句填空" },
];

function resolveType(value: string | null): QuizType {
  if (value === "dictation" || value === "cloze") return value;
  return "spelling";
}

export default function QuizPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <QuizInner />
    </Suspense>
  );
}

function QuizInner() {
  const searchParams = useSearchParams();
  const { profile, ready } = useUser();
  const type = resolveType(searchParams.get("type"));

  if (!ready) return <Spinner />;

  if (!profile) {
    return (
      <EmptyState
        icon="🔐"
        title="请先登录"
        description="登录后即可进行拼写、听写与例句填空测试"
        action={
          <Link href="/login">
            <Button>去登录</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <SectionTitle title="测试模式" />
        <div className="flex flex-col gap-2 sm:flex-row">
          {MODES.map((mode) => (
            <Link key={mode.type} href={`/quiz?type=${mode.type}`} className="w-full sm:flex-1">
              <Button
                variant={type === mode.type ? "primary" : "ghost"}
                className="w-full px-2 text-xs sm:text-sm"
              >
                {mode.label}
              </Button>
            </Link>
          ))}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          答错会按遗忘曲线缩短复习间隔，答对则延长间隔，与卡片学习共用同一套进度
        </p>
      </Card>

      <QuizSession key={type} type={type} />
    </div>
  );
}