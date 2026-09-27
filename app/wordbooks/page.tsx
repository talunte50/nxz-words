"use client";

import Link from "next/link";
import { useState } from "react";
import { useUser } from "@/components/AppShell";
import { Badge, Button, Card, EmptyState, Progress, Spinner } from "@/components/ui";
import { apiSend } from "@/lib/client/api";
import { useApi } from "@/lib/client/hooks";
import { percent } from "@/lib/utils";

interface Book {
  id: string;
  name: string;
  description: string;
  level: string;
  cover: string;
  wordCount: number;
  learned: number;
}

interface WordBooksResponse {
  books: Book[];
  currentBookId: string;
}

export default function WordBooksPage() {
  const { profile, ready, updateProfile } = useUser();
  const { data, loading, reload } = useApi<WordBooksResponse>(profile ? "/api/wordbooks" : null);
  const [busy, setBusy] = useState<string | null>(null);

  async function select(bookId: string) {
    setBusy(bookId);
    try {
      await updateProfile({ currentBookId: bookId });
      await reload();
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return <Spinner />;
  if (!profile) {
    return (
      <EmptyState
        icon="🔐"
        title="请先登录"
        action={
          <Link href="/login">
            <Button>去登录</Button>
          </Link>
        }
      />
    );
  }
  if (loading && !data) return <Spinner />;
  if (!data) return <EmptyState icon="⚠️" title="词书加载失败" action={<Button onClick={reload}>重试</Button>} />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">词书管理</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">选择一本词书作为当前学习目标</p>
      </div>

      {data.books.map((book) => {
        const active = book.id === data.currentBookId;
        return (
          <Card key={book.id} className={active ? "border-brand-400 ring-1 ring-brand-200" : ""}>
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-50 dark:bg-slate-700/60 text-2xl">
                {book.cover}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="truncate font-semibold">{book.name}</h2>
                  <Badge tone="slate">{book.level}</Badge>
                  {active ? <Badge tone="brand">当前</Badge> : null}
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{book.description}</p>
                <div className="mt-3">
                  <Progress value={percent(book.learned, book.wordCount)} />
                  <div className="mt-1 flex justify-between text-[11px] text-slate-400 dark:text-slate-500 dark:text-slate-400">
                    <span>
                      已学 {book.learned} / {book.wordCount}
                    </span>
                    <span>{percent(book.learned, book.wordCount)}%</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button
                variant={active ? "ghost" : "primary"}
                disabled={busy === book.id}
                onClick={() => void select(book.id)}
                className="w-full sm:flex-1"
              >
                {active ? "已选择" : busy === book.id ? "切换中…" : "设为当前词书"}
              </Button>
              {active ? (
                <Link href="/learn?mode=new" className="w-full sm:flex-1">
                  <Button variant="outline" className="w-full">
                    开始学习
                  </Button>
                </Link>
              ) : null}
            </div>
          </Card>
        );
      })}
    </div>
  );
}