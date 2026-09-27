"use client";

import Link from "next/link";
import { useState } from "react";
import { useUser } from "@/components/AppShell";
import { Badge, Button, Card, EmptyState, SectionTitle, Spinner, StatTile } from "@/components/ui";
import { apiSend } from "@/lib/client/api";
import { useApi } from "@/lib/client/hooks";
import type { Word } from "@/lib/types";
import { cn, formatDuration, streakDays } from "@/lib/utils";

interface StatsResponse {
  recent: { date: string; newCount: number; reviewCount: number; correctCount: number; wrongCount: number; minutes: number }[];
  totals: { newCount: number; reviewCount: number; correctCount: number; wrongCount: number; minutes: number };
  learned: number;
  mastered: number;
  dueCount: number;
  streak: number;
  favorites: number;
  totalWords: number;
}

const AVATARS = ["🙂", "😎", "🦊", "🐼", "🐧", "🚀", "🌟", "📚"];
const TONES: { value: "encouraging" | "strict" | "humorous"; label: string }[] = [
  { value: "encouraging", label: "鼓励型" },
  { value: "strict", label: "严格型" },
  { value: "humorous", label: "幽默型" },
];

export default function ProfilePage() {
  const { profile, ready, updateProfile, logout } = useUser();
  const { data, loading } = useApi<StatsResponse>(profile ? "/api/stats?days=30" : null);
  const { data: favData, reload: reloadFav } = useApi<{ favorites: (Word & { bookName: string })[] }>(
    profile ? "/api/favorites" : null,
  );
  const [nickname, setNickname] = useState("");

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

  const stats = data;
  const heatmapDays = stats?.recent ?? [];
  const activeDates = heatmapDays.filter((d) => d.newCount + d.reviewCount > 0).map((d) => d.date);
  const maxHeat = Math.max(1, ...heatmapDays.map((d) => d.newCount + d.reviewCount));
  const accuracy =
    stats && stats.totals.correctCount + stats.totals.wrongCount > 0
      ? Math.round((stats.totals.correctCount / (stats.totals.correctCount + stats.totals.wrongCount)) * 100)
      : 0;

  async function removeFavorite(wordId: string) {
    await apiSend("/api/favorites", "POST", { wordId, action: "remove" });
    await reloadFav();
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-3xl">
            {profile.avatar || "🙂"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-semibold">{profile.nickname}</h1>
              <Badge tone="brand">🔥 {streakDays(activeDates)} 天</Badge>
              {profile.role === "admin" ? <Badge tone="amber">管理员</Badge> : null}
            </div>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              @{profile.username} · 加入于 {profile.createdAt.slice(0, 10)}
            </p>
          </div>
        </div>

        {profile.role === "admin" ? (
          <Link
            href="/admin"
            className="mt-4 flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700 transition hover:bg-brand-100 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300"
          >
            <span className="flex items-center gap-2">
              <span>🛠️</span> 进入管理后台
            </span>
            <span>→</span>
          </Link>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {AVATARS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => void updateProfile({ avatar: emoji })}
              className={cn(
                "grid h-11 w-11 place-items-center rounded-xl border text-lg transition",
                profile.avatar === emoji ? "border-brand-400 bg-brand-50" : "border-slate-200 dark:border-slate-700",
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      </Card>

      {loading && !stats ? (
        <Spinner />
      ) : stats ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="累计新学" value={stats.totals.newCount} icon="📖" />
            <StatTile label="累计复习" value={stats.totals.reviewCount} icon="🔁" />
            <StatTile label="已掌握" value={stats.mastered} hint={`待复习 ${stats.dueCount}`} icon="🏆" />
            <StatTile
              label="学习时长"
              value={formatDuration(stats.totals.minutes)}
              hint={`正确率 ${accuracy}%`}
              icon="⏱️"
            />
          </div>

          <Card>
            <SectionTitle title="近 30 天打卡" extra={<span className="text-xs text-slate-400 dark:text-slate-500">{activeDates.length} 天有学习</span>} />
            <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10">
              {heatmapDays.map((day) => {
                const total = day.newCount + day.reviewCount;
                const level = total === 0 ? 0 : Math.ceil((total / maxHeat) * 4);
                const shades = ["bg-slate-100 dark:bg-slate-700/60", "bg-brand-100 dark:bg-brand-500/30", "bg-brand-300 dark:bg-brand-400", "bg-brand-400 dark:bg-brand-500", "bg-brand-600"];
                return (
                  <div
                    key={day.date}
                    title={`${day.date}：${total} 词`}
                    className={cn("aspect-square rounded-md", shades[level])}
                  />
                );
              })}
            </div>
          </Card>
        </>
      ) : null}

      <Card>
        <SectionTitle title="学习设置" />
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm text-slate-600 dark:text-slate-300">昵称</span>
            <div className="mt-1 flex gap-2">
              <input
                value={nickname || profile.nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-slate-600 dark:bg-slate-800"
              />
              <Button
                onClick={() => void updateProfile({ nickname: nickname || profile.nickname })}
              >
                保存
              </Button>
            </div>
          </label>

          <label className="block">
            <span className="text-sm text-slate-600 dark:text-slate-300">每日目标：{profile.dailyGoal} 词</span>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={profile.dailyGoal}
              onChange={(event) => void updateProfile({ dailyGoal: Number(event.target.value) })}
              className="mt-2 w-full accent-brand-500"
            />
          </label>

          <div>
            <span className="text-sm text-slate-600 dark:text-slate-300">AI 陪练语气</span>
            <div className="mt-2 flex gap-2">
              {TONES.map((tone) => (
                <button
                  key={tone.value}
                  type="button"
                  onClick={() => void updateProfile({ aiTone: tone.value })}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-sm transition",
                    profile.aiTone === tone.value
                      ? "border-brand-400 bg-brand-50 text-brand-700"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300",
                  )}
                >
                  {tone.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-sm text-slate-600 dark:text-slate-300">每日提醒时间</span>
            <input
              type="time"
              value={profile.reminderTime}
              onChange={(event) => void updateProfile({ reminderTime: event.target.value })}
              className="mt-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-slate-600 dark:bg-slate-800"
            />
          </label>

          <div>
            <span className="text-sm text-slate-600 dark:text-slate-300">界面主题</span>
            <div className="mt-2 flex gap-2">
              {(["light", "dark"] as const).map((theme) => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => void updateProfile({ theme })}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-sm transition",
                    profile.theme === theme
                      ? "border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
                      : "border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300",
                  )}
                >
                  {theme === "light" ? "☀️ 浅色" : "🌙 深色"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle
          title="我的收藏"
          extra={<span className="text-xs text-slate-400 dark:text-slate-500">{favData?.favorites.length ?? 0} 词</span>}
        />
        {!favData?.favorites.length ? (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">还没有收藏单词，学习中点 ⭐ 即可</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {favData.favorites.map((item) => (
              <li key={item.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.word}</p>
                  <p className="truncate text-xs text-slate-400 dark:text-slate-500">
                    {item.pos} {item.meaning}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeFavorite(item.id)}
                  className="grid h-10 min-w-10 shrink-0 place-items-center rounded-lg px-2 text-sm text-slate-400 dark:text-slate-500 hover:text-rose-500"
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Button variant="danger" className="w-full" onClick={() => void logout()}>
        退出登录
      </Button>
    </div>
  );
}