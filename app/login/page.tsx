"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useUser } from "@/components/AppShell";
import { Button, Card } from "@/components/ui";
import { apiSend } from "@/lib/client/api";

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useUser();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (username.trim().length < 3) {
      setError("用户名至少 3 个字符");
      return;
    }
    if (password.length < 6) {
      setError("密码至少 6 位");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await apiSend("/api/auth/login", "POST", { username, password });
      await refresh();
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-8rem)] flex-col justify-center py-4">
      <div className="mb-6 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-500 text-2xl font-bold text-white">
          W
        </div>
        <h1 className="mt-4 text-xl font-semibold">逆行者单词</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">AI 驱动的英语单词学习 · 首次登录将自动注册</p>
      </div>

      <Card className="space-y-4">
        <label className="block">
          <span className="text-sm text-slate-600 dark:text-slate-300">用户名</span>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="请输入用户名"
            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600 dark:text-slate-300">密码</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void submit();
            }}
            placeholder="至少 6 位"
            className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          />
        </label>

        {error ? <p className="text-sm text-rose-500">{error}</p> : null}

        <Button size="lg" className="w-full" disabled={loading} onClick={submit}>
          {loading ? "处理中…" : "登录 / 注册"}
        </Button>
        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          账号数据存储于 EdgeOne KV，密码经 PBKDF2 加盐哈希
        </p>
      </Card>
    </div>
  );
}