"use client";

import Link from "next/link";
import { useUser } from "@/components/AppShell";
import { ChatPanel } from "@/components/ChatPanel";
import { Button, Card, EmptyState, SectionTitle, Spinner } from "@/components/ui";
import { useApi } from "@/lib/client/hooks";
import type { Word } from "@/lib/types";

export default function ChatPage() {
  const { profile, ready } = useUser();
  const { data: favData } = useApi<{ favorites: (Word & { bookName: string })[] }>(
    profile ? "/api/favorites" : null,
  );

  if (!ready) return <Spinner />;
  if (!profile) {
    return (
      <EmptyState
        icon="🔐"
        title="请先登录"
        description="登录后即可与 AI 进行英文对话陪练"
        action={
          <Link href="/login">
            <Button>去登录</Button>
          </Link>
        }
      />
    );
  }

  const focusWords = (favData?.favorites ?? []).slice(0, 6).map((item) => item.word);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">AI 对话陪练</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          用英文聊天，AI 会用你收藏的单词帮你巩固，并纠正表达
        </p>
      </div>

      <ChatPanel words={focusWords} />

      <Card>
        <SectionTitle title="练习建议" />
        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
          <li>· 试着用「{focusWords[0] ?? "abandon"}」造一个句子发给 AI</li>
          <li>· 描述你今天做了什么，AI 会给出地道表达</li>
          <li>· 让 AI 出题考你某个词的含义与用法</li>
        </ul>
      </Card>
    </div>
  );
}