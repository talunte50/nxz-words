"use client";

import Link from "next/link";
import { useUser } from "@/components/AppShell";
import { Button, Card, EmptyState, Progress, SectionTitle, Spinner, StatTile } from "@/components/ui";
import { useApi } from "@/lib/client/hooks";
import { cn, percent, todayKey } from "@/lib/utils";

interface StatsResponse {
  recent: { date: string; newCount: number; reviewCount: number; correctCount: number; wrongCount: number; minutes: number }[];
  totals: { newCount: number; reviewCount: number; correctCount: number; wrongCount: number; minutes: number };
  learned: number;
  mastered: number;
  dueCount: number;
  streak: number;
  favorites: number;
  totalWords: number;
  currentBookId: string;
  currentBookName: string;
  dailyGoal: number;
}

const FEATURES = [
  {
    icon: "📇",
    title: "翻转卡片 × 记忆曲线",
    desc: "3D 翻转卡片，四档评分驱动艾宾浩斯排期，到点自动提醒复习",
    href: "/learn",
    cta: "去背单词",
    accent: "from-brand-500 to-brand-700",
  },
  {
    icon: "🧠",
    title: "AI 一键精讲",
    desc: "词根词缀 · 易混辨析 · 联想记忆 · 自动例句，复杂词也能秒懂",
    href: "/learn",
    cta: "体验精讲",
    accent: "from-violet-500 to-brand-600",
  },
  {
    icon: "💬",
    title: "AI 口语陪练",
    desc: "SSE 流式对话，自动带入你刚学的词，边聊边练发音",
    href: "/chat",
    cta: "开始对话",
    accent: "from-emerald-500 to-teal-600",
  },
];

export default function HomePage() {
  const { profile, ready } = useUser();
  const { data, loading } = useApi<StatsResponse>(profile ? "/api/stats?days=30" : null);

  if (!ready) return <Spinner />;

  if (!profile) {
    return (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-violet-600 text-white shadow-lg">
          <div className="px-5 pb-6 pt-8 sm:px-8 sm:pt-10">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium tracking-wide">
              ✦ WordLeap 词跃
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">
              让每一个单词
              <br />
              都被 <span className="text-amber-300">记住</span>
            </h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-white/85">
              AI 精讲 + 记忆曲线 + 口语陪练，从小学到考研 13 本词库，
              在你指尖完成「学 · 测 · 聊」闭环。
            </p>
            <Link href="/login" className="mt-6 inline-block">
              <Button size="lg" className="w-full bg-white text-brand-700 shadow-md hover:bg-white/90 sm:w-auto">
                免费开始 →
              </Button>
            </Link>
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/70">
              <span>4.5 万词</span>
              <span>13 本词书</span>
              <span>无需注册资料</span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <Link
              key={feature.title}
              href={feature.href}
              className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
            >
              <div
                className={cn(
                  "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
                  feature.accent,
                )}
              />
              <span className="text-2xl">{feature.icon}</span>
              <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{feature.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400 dark:text-slate-500">{feature.desc}</p>
              <span className="mt-3 inline-block text-xs font-medium text-brand-600">
                {feature.cta} →
              </span>
            </Link>
          ))}
        </div>

        <Card>
          <SectionTitle title="测试模式 · 学完马上练" />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href="/quiz?type=spelling" className="w-full sm:flex-1">
              <Button variant="outline" className="w-full">✍️ 看中文拼写</Button>
            </Link>
            <Link href="/quiz?type=dictation" className="w-full sm:flex-1">
              <Button variant="outline" className="w-full">🎧 听发音拼写</Button>
            </Link>
            <Link href="/quiz?type=cloze" className="w-full sm:flex-1">
              <Button variant="outline" className="w-full">📝 例句填空</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (loading && !data) return <Spinner />;
  if (!data) return <EmptyState icon="⚠️" title="统计数据加载失败" />;

  const today = data.recent.find((item) => item.date === todayKey());
  const todayDone = (today?.newCount ?? 0) + (today?.reviewCount ?? 0);
  const accuracy =
    data.totals.correctCount + data.totals.wrongCount > 0
      ? Math.round((data.totals.correctCount / (data.totals.correctCount + data.totals.wrongCount)) * 100)
      : 0;
  const goalPct = percent(todayDone, data.dailyGoal);
  const bookPct = percent(data.learned, data.totalWords);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 via-brand-500 to-violet-600 text-white shadow-lg">
        <div className="flex items-center gap-4 px-5 py-6 sm:px-8">
          <div className="relative grid h-24 w-24 shrink-0 place-items-center">
            <GoalRing value={goalPct} />
            <div className="absolute flex flex-col items-center">
              <span className="text-xl font-bold leading-none">{goalPct}%</span>
              <span className="text-[10px] text-white/70">今日目标</span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-white/75">今日学习</p>
            <p className="mt-0.5 text-2xl font-bold leading-tight">
              {todayDone}
              <span className="ml-1 text-sm font-normal text-white/70">/ {data.dailyGoal} 词</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-full bg-white/15 px-2.5 py-1">🔥 连胜 {data.streak} 天</span>
              {data.dueCount > 0 ? (
                <span className="rounded-full bg-amber-300/90 px-2.5 py-1 font-medium text-amber-950">
                  ⏰ {data.dueCount} 个待复习
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 px-5 pb-5 sm:flex-row sm:px-8">
          <Link href="/learn?mode=mixed" className="flex-1">
            <Button className="w-full bg-white text-brand-700 hover:bg-white/90">
              {data.dueCount > 0 ? "继续学习 · 含复习" : "开始学习"}
            </Button>
          </Link>
          <Link href="/learn?mode=review" className="flex-1">
            <Button variant="ghost" className="w-full bg-white/15 text-white hover:bg-white/25">
              只做复习
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="已学单词" value={data.learned} hint={`词库共 ${data.totalWords} 词`} icon="📖" />
        <StatTile label="已掌握" value={data.mastered} hint="间隔 ≥ 21 天" icon="🏆" />
        <StatTile label="待复习" value={data.dueCount} hint="按遗忘曲线到期" icon="⏰" />
        <StatTile label="累计正确率" value={`${accuracy}%`} hint={`收藏 ${data.favorites} 词`} icon="🎯" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:flex-1">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">📚 当前词书</h2>
            <Link href="/wordbooks" className="text-xs font-medium text-brand-600">
              切换
            </Link>
          </div>
          <p className="mt-3 text-xl font-bold text-slate-900 dark:text-slate-100">{data.currentBookName}</p>
          <Progress value={bookPct} className="mt-2" />
          <div className="mt-1.5 flex justify-between text-xs text-slate-400 dark:text-slate-500">
            <span>
              {data.learned} / {data.totalWords}
            </span>
            <span>{bookPct}%</span>
          </div>
          <Link href="/learn?mode=new" className="mt-4 block">
            <Button variant="outline" className="w-full">📇 学新词</Button>
          </Link>
        </div>

        <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:flex-1">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">⚡ 测试模式</h2>
            <Link href="/quiz" className="text-xs font-medium text-brand-600">
              全部
            </Link>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            <Link href="/quiz?type=spelling" className="w-full">
              <Button variant="ghost" size="sm" className="w-full text-left">✍️ 看中文拼写</Button>
            </Link>
            <Link href="/quiz?type=dictation" className="w-full">
              <Button variant="ghost" size="sm" className="w-full text-left">🎧 听发音拼写</Button>
            </Link>
            <Link href="/quiz?type=cloze" className="w-full">
              <Button variant="ghost" size="sm" className="w-full text-left">📝 例句填空</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">🧠 AI 能力</h2>
          <div className="mt-3 flex flex-col gap-2">
            <Link href="/chat" className="w-full">
              <Button variant="outline" size="sm" className="w-full text-left">
                💬 AI 口语陪练
              </Button>
            </Link>
            <p className="text-xs leading-relaxed text-slate-400 dark:text-slate-500">
              精讲结果自动缓存，例句填空按词生成，不重复消耗 AI 额度。
            </p>
          </div>
        </div>
        <Card className="p-0 sm:col-span-1">
          <div className="p-5">
            <SectionTitle title="近 14 天学习量" />
            <MiniBarChart data={data.recent.slice(-14)} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function GoalRing({ value }: { value: number }) {
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="8" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="white"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-700"
      />
    </svg>
  );
}

function MiniBarChart({
  data,
}: {
  data: { date: string; newCount: number; reviewCount: number }[];
}) {
  const max = Math.max(1, ...data.map((item) => item.newCount + item.reviewCount));
  return (
    <div className="flex h-32 items-end gap-1.5">
      {data.map((item) => {
        const total = item.newCount + item.reviewCount;
        const height = Math.round((total / max) * 100);
        return (
          <div key={item.date} className="group flex flex-1 flex-col items-center gap-1">
            <div className="flex h-24 w-full items-end rounded-lg bg-slate-100 dark:bg-slate-700/60">
              <div
                className="w-full rounded-lg bg-gradient-to-t from-brand-500 to-brand-300 transition-all"
                style={{ height: `${Math.max(total ? 6 : 0, height)}%` }}
                title={`${item.date}：新学 ${item.newCount}，复习 ${item.reviewCount}`}
              />
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500">{item.date.slice(8)}</span>
          </div>
        );
      })}
    </div>
  );
}