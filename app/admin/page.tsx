"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, EmptyState, SectionTitle, Spinner } from "@/components/ui";
import { useUser } from "@/components/AppShell";
import { apiGet, apiSend } from "@/lib/client/api";
import { cn } from "@/lib/utils";

/* ============================ 类型 ============================ */

interface SiteConfig {
  name: string;
  description: string;
  keywords: string[];
  announcement: string;
  allowRegister: boolean;
  aiEnabled: boolean;
  footerText: string;
  launchedAt: string;
  updatedAt: string;
}

interface SafeAiConfig {
  baseUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
  updatedAt: string;
  apiKeyMasked: string;
  hasApiKey: boolean;
  fromEnv: boolean;
}

interface AdminUser {
  uid: string;
  username: string;
  nickname: string;
  role: "admin" | "user";
  createdAt: string;
  lastActive: string | null;
  learned: number;
  favorites: number;
  studiedDays: number;
}

interface AdminBook {
  id: string;
  name: string;
  description: string;
  category: string;
  language: string;
  wordCount: number;
  cover: string;
  enabled: boolean;
  pinned: boolean;
  weight: number;
  categoryOverride: string;
}

interface Stats {
  users: { total: number; admins: number; active: number; newThisWeek: number };
  learning: { totalLearned: number; avgLearned: number };
  books: {
    total: number;
    totalWords: number;
    disabled: number;
    categories: { name: string; books: number; words: number }[];
  };
  growth: { date: string; count: number }[];
  config: {
    siteName: string;
    allowRegister: boolean;
    aiEnabled: boolean;
    aiReady: boolean;
    aiModel: string;
  };
}

interface OperationLog {
  id: string;
  at: string;
  actor: string;
  action: string;
  target?: string;
  detail?: string;
  level: "info" | "warn" | "error";
}

type TabKey = "dashboard" | "site" | "ai" | "users" | "books" | "logs";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "dashboard", label: "数据看板", icon: "📊" },
  { key: "site", label: "网站配置", icon: "⚙️" },
  { key: "ai", label: "大模型", icon: "🤖" },
  { key: "users", label: "用户管理", icon: "👥" },
  { key: "books", label: "词库管理", icon: "📚" },
  { key: "logs", label: "操作日志", icon: "📝" },
];

/* ============================ 小组件 ============================ */

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-slate-400 dark:text-slate-500">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800/60"
    >
      <span className="text-slate-700 dark:text-slate-200">{label}</span>
      <span
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition",
          checked ? "bg-brand-500" : "bg-slate-300 dark:bg-slate-600",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
            checked ? "left-[1.125rem]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}

function Toast({ message, tone }: { message: string; tone: "ok" | "err" }) {
  return (
    <div
      className={cn(
        "fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2 text-sm font-medium text-white shadow-lg",
        tone === "ok" ? "bg-emerald-500" : "bg-rose-500",
      )}
    >
      {message}
    </div>
  );
}

/* ============================ 主组件 ============================ */

export default function AdminPage() {
  const router = useRouter();
  const { profile, ready } = useUser();
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [toast, setToast] = useState<{ message: string; tone: "ok" | "err" } | null>(null);

  // 数据
  const [stats, setStats] = useState<Stats | null>(null);
  const [site, setSite] = useState<SiteConfig | null>(null);
  const [ai, setAi] = useState<SafeAiConfig | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [books, setBooks] = useState<AdminBook[]>([]);
  const [logs, setLogs] = useState<OperationLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [bookQuery, setBookQuery] = useState("");
  const [bookCat, setBookCat] = useState("全部");

  const notify = useCallback((message: string, tone: "ok" | "err" = "ok") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2200);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, siteRes, aiRes, usersRes, booksRes, logsRes] = await Promise.all([
        apiGet<Stats>("/api/admin/stats"),
        apiGet<{ config: SiteConfig }>("/api/admin/config"),
        apiGet<{ config: SafeAiConfig }>("/api/admin/ai"),
        apiGet<{ users: AdminUser[] }>("/api/admin/users"),
        apiGet<{ books: AdminBook[] }>("/api/admin/books"),
        apiGet<{ logs: OperationLog[] }>("/api/admin/logs?limit=100"),
      ]);
      setStats(s);
      setSite(siteRes.config);
      setAi(aiRes.config);
      setUsers(usersRes.users);
      setBooks(booksRes.books);
      setLogs(logsRes.logs);
    } catch (error) {
      notify(error instanceof Error ? error.message : "加载失败", "err");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    if (!ready) return;
    if (!profile) {
      router.replace("/login");
      return;
    }
    if (profile.role !== "admin") {
      notify("需要管理员权限", "err");
      router.replace("/");
      return;
    }
    void loadAll();
  }, [ready, profile, router, loadAll, notify]);

  const categories = useMemo(() => {
    const set = new Set(books.map((b) => b.category));
    return ["全部", ...[...set].sort((a, b) => a.localeCompare(b, "zh"))];
  }, [books]);

  const filteredBooks = useMemo(() => {
    const q = bookQuery.trim().toLowerCase();
    return books.filter((b) => {
      if (bookCat !== "全部" && b.category !== bookCat) return false;
      if (!q) return true;
      return b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q);
    });
  }, [books, bookQuery, bookCat]);

  if (!ready || loading) return <Spinner label="正在加载管理后台…" />;
  if (!profile || profile.role !== "admin") {
    return <EmptyState icon="🔒" title="无访问权限" description="请使用管理员账号登录。" />;
  }

  return (
    <div className="space-y-4">
      {toast ? <Toast message={toast.message} tone={toast.tone} /> : null}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">管理后台</h1>
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            当前登录：{profile.nickname}（{profile.username}）
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => void loadAll()}>
          刷新
        </Button>
      </div>

      {/* Tab 导航 */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition",
              tab === t.key
                ? "bg-brand-500 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700",
            )}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "dashboard" && stats ? <Dashboard stats={stats} /> : null}

      {tab === "site" && site ? (
        <SiteTab
          site={site}
          busy={busy}
          onSave={async (patch) => {
            setBusy(true);
            try {
              const res = await apiSend<{ config: SiteConfig }>("/api/admin/config", "PATCH", patch);
              setSite(res.config);
              notify("网站配置已保存");
            } catch (error) {
              notify(error instanceof Error ? error.message : "保存失败", "err");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {tab === "ai" && ai ? (
        <AiTab
          ai={ai}
          busy={busy}
          onSave={async (patch) => {
            setBusy(true);
            try {
              const res = await apiSend<{ config: SafeAiConfig }>("/api/admin/ai", "PATCH", patch);
              setAi(res.config);
              notify("大模型配置已保存");
            } catch (error) {
              notify(error instanceof Error ? error.message : "保存失败", "err");
            } finally {
              setBusy(false);
            }
          }}
          onTest={async (probe) => {
            setBusy(true);
            try {
              const res = await apiSend<{
                success: boolean;
                latency: number;
                model: string;
                message: string;
                reply?: string;
                raw?: string;
              }>("/api/admin/ai/test", "POST", probe);
              if (res.success) {
                notify(`连接成功 · ${res.latency}ms · ${res.reply || "OK"}`);
              } else {
                notify(`${res.message}（${res.latency}ms）`, "err");
              }
              setLogs((await apiGet<{ logs: OperationLog[] }>("/api/admin/logs?limit=100")).logs);
            } catch (error) {
              notify(error instanceof Error ? error.message : "测试失败", "err");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {tab === "users" ? (
        <UsersTab
          users={users}
          selfUid={profile.id}
          busy={busy}
          onAction={async (payload) => {
            setBusy(true);
            try {
              await apiSend("/api/admin/users", "POST", payload);
              const res = await apiGet<{ users: AdminUser[] }>("/api/admin/users");
              setUsers(res.users);
              notify("操作成功");
            } catch (error) {
              notify(error instanceof Error ? error.message : "操作失败", "err");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {tab === "books" ? (
        <BooksTab
          books={filteredBooks}
          totalBooks={books.length}
          categories={categories}
          query={bookQuery}
          category={bookCat}
          busy={busy}
          onQuery={setBookQuery}
          onCategory={setBookCat}
          onUpdate={async (bookId, patch) => {
            setBooks((prev) => prev.map((b) => (b.id === bookId ? { ...b, ...patch } : b)));
            try {
              await apiSend("/api/admin/books", "POST", { action: "update", bookId, ...patch });
            } catch (error) {
              notify(error instanceof Error ? error.message : "保存失败", "err");
              void loadAll();
            }
          }}
          onReset={async (bookId) => {
            try {
              await apiSend("/api/admin/books", "POST", { action: "reset", bookId });
              await loadAll();
              notify("已恢复默认");
            } catch (error) {
              notify(error instanceof Error ? error.message : "操作失败", "err");
            }
          }}
          onBulk={async (ids, enabled) => {
            setBusy(true);
            try {
              await apiSend("/api/admin/books", "POST", { action: "bulk", ids, enabled });
              await loadAll();
              notify(`已${enabled ? "启用" : "禁用"} ${ids.length} 本词库`);
            } catch (error) {
              notify(error instanceof Error ? error.message : "操作失败", "err");
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}

      {tab === "logs" ? (
        <LogsTab
          logs={logs}
          onClear={async () => {
            if (!confirm("确定清空全部操作日志？此操作不可恢复。")) return;
            try {
              await apiSend("/api/admin/logs", "DELETE");
              setLogs([]);
              notify("日志已清空");
            } catch (error) {
              notify(error instanceof Error ? error.message : "操作失败", "err");
            }
          }}
        />
      ) : null}
    </div>
  );
}

/* ============================ 数据看板 ============================ */

function Dashboard({ stats }: { stats: Stats }) {
  const maxGrowth = Math.max(1, ...stats.growth.map((g) => g.count));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="用户总数" value={stats.users.total} hint={`管理员 ${stats.users.admins}`} />
        <StatBox label="活跃用户" value={stats.users.active} hint="有过学习记录" />
        <StatBox label="词库数" value={stats.books.total} hint={`已停用 ${stats.books.disabled}`} />
        <StatBox label="词条总量" value={fmt(stats.books.totalWords)} hint="全部词库合计" />
      </div>

      <Card>
        <SectionTitle title="近 7 天新增用户" extra={<span className="text-xs text-slate-400">合计 {stats.users.newThisWeek} 人</span>} />
        <div className="flex h-32 items-end gap-2">
          {stats.growth.map((g) => (
            <div key={g.date} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-slate-400">{g.count || ""}</span>
              <div
                className="w-full rounded-t-md bg-brand-500/80 transition-all"
                style={{ height: `${Math.max(3, (g.count / maxGrowth) * 88)}px` }}
              />
              <span className="text-[10px] text-slate-400">{g.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <SectionTitle title="学习概况" />
          <dl className="space-y-2 text-sm">
            <Row label="累计已学词条" value={`${fmt(stats.learning.totalLearned)} 词`} />
            <Row label="人均已学" value={`${stats.learning.avgLearned} 词`} />
            <Row label="站点名称" value={stats.config.siteName} />
            <Row
              label="开放注册"
              value={stats.config.allowRegister ? "已开启" : "已关闭"}
              tone={stats.config.allowRegister ? "green" : "rose"}
            />
            <Row
              label="AI 功能"
              value={stats.config.aiEnabled ? "已开启" : "已关闭"}
              tone={stats.config.aiEnabled ? "green" : "slate"}
            />
            <Row
              label="大模型连通"
              value={stats.config.aiReady ? stats.config.aiModel : "未就绪"}
              tone={stats.config.aiReady ? "green" : "amber"}
            />
          </dl>
        </Card>

        <Card>
          <SectionTitle title="词库分类分布" />
          <div className="space-y-2.5">
            {stats.books.categories.map((c) => {
              const pct = stats.books.totalWords ? (c.words / stats.books.totalWords) * 100 : 0;
              return (
                <div key={c.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300">{c.name}</span>
                    <span className="text-slate-400">
                      {c.books} 本 · {fmt(c.words)} 词
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatBox({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{value}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">{hint}</div> : null}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "green" | "rose" | "amber" | "slate" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd>
        {tone ? <Badge tone={tone}>{value}</Badge> : <span className="text-slate-800 dark:text-slate-200">{value}</span>}
      </dd>
    </div>
  );
}

/* ============================ 网站配置 ============================ */

function SiteTab({
  site,
  busy,
  onSave,
}: {
  site: SiteConfig;
  busy: boolean;
  onSave: (patch: Partial<SiteConfig>) => Promise<void>;
}) {
  const [form, setForm] = useState(site);
  const [kwText, setKwText] = useState(site.keywords.join("\n"));

  useEffect(() => {
    setForm(site);
    setKwText(site.keywords.join("\n"));
  }, [site]);

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle title="基础信息" />
        <div className="space-y-3">
          <Field label="站点名称" hint="用于浏览器标题、页头品牌与 SEO">
            <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="站点描述" hint="搜索引擎摘要（建议 80–160 字）">
            <textarea
              className={cn(inputClass, "min-h-[5rem] resize-y")}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>
          <Field label="SEO 关键词" hint="每行一个，或用逗号分隔">
            <textarea
              className={cn(inputClass, "min-h-[6rem] resize-y")}
              value={kwText}
              onChange={(e) => setKwText(e.target.value)}
            />
          </Field>
          <Field label="首页公告" hint="留空则不显示；可用于活动、维护通知">
            <input
              className={inputClass}
              value={form.announcement}
              onChange={(e) => setForm({ ...form, announcement: e.target.value })}
            />
          </Field>
          <Field label="页脚文案" hint="版权信息 / 备案号">
            <input
              className={inputClass}
              value={form.footerText}
              onChange={(e) => setForm({ ...form, footerText: e.target.value })}
            />
          </Field>
          <Field label="上线日期" hint="用于「已运行 N 天」等展示">
            <input
              type="date"
              className={inputClass}
              value={form.launchedAt}
              onChange={(e) => setForm({ ...form, launchedAt: e.target.value })}
            />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle title="功能开关" />
        <div className="space-y-2">
          <Toggle
            checked={form.allowRegister}
            onChange={(v) => setForm({ ...form, allowRegister: v })}
            label="允许新用户注册"
          />
          <Toggle
            checked={form.aiEnabled}
            onChange={(v) => setForm({ ...form, aiEnabled: v })}
            label="开启 AI 功能（精讲 / 对话 / 例句生成）"
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button
          disabled={busy}
          onClick={() =>
            onSave({
              name: form.name,
              description: form.description,
              keywords: kwText
                .split(/[\n,，]/)
                .map((s) => s.trim())
                .filter(Boolean),
              announcement: form.announcement,
              footerText: form.footerText,
              launchedAt: form.launchedAt,
              allowRegister: form.allowRegister,
              aiEnabled: form.aiEnabled,
            })
          }
        >
          {busy ? "保存中…" : "保存配置"}
        </Button>
      </div>
    </div>
  );
}

/* ============================ 大模型配置 ============================ */

function AiTab({
  ai,
  busy,
  onSave,
  onTest,
}: {
  ai: SafeAiConfig;
  busy: boolean;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
  onTest: (probe: { baseUrl?: string; apiKey?: string; model?: string }) => Promise<void>;
}) {
  const [form, setForm] = useState({ baseUrl: ai.baseUrl, model: ai.model, temperature: ai.temperature, maxTokens: ai.maxTokens });
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(ai.enabled);

  useEffect(() => {
    setForm({ baseUrl: ai.baseUrl, model: ai.model, temperature: ai.temperature, maxTokens: ai.maxTokens });
    setEnabled(ai.enabled);
    setApiKey("");
  }, [ai]);

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          title="接口配置"
          extra={
            ai.hasApiKey ? (
              <Badge tone="green">密钥已配置</Badge>
            ) : (
              <Badge tone="rose">未配置密钥</Badge>
            )
          }
        />
        <div className="space-y-3">
          <Field label="接口地址（Base URL）" hint="OpenAI 兼容接口，如 https://api.openai.com/v1">
            <input
              className={inputClass}
              placeholder="https://apihub.agnes-ai.cn/v1"
              value={form.baseUrl}
              onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
            />
          </Field>
          <Field
            label="API Key"
            hint={
              ai.hasApiKey
                ? `当前：${ai.apiKeyMasked}${ai.fromEnv ? "（来自环境变量）" : ""}；留空表示不修改`
                : "尚未配置，请填写"
            }
          >
            <input
              type="password"
              className={inputClass}
              placeholder={ai.hasApiKey ? "留空保持不变" : "sk-..."}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </Field>
          <Field label="模型名">
            <input
              className={inputClass}
              placeholder="agnes-3.0-flash"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="采样温度" hint="0–2，越高越发散">
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                className={inputClass}
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
              />
            </Field>
            <Field label="最大 Token" hint="单次回复上限">
              <input
                type="number"
                step="64"
                min="64"
                max="32000"
                className={inputClass}
                value={form.maxTokens}
                onChange={(e) => setForm({ ...form, maxTokens: Number(e.target.value) })}
              />
            </Field>
          </div>
          <Toggle checked={enabled} onChange={setEnabled} label="启用 AI 调用" />
        </div>
      </Card>

      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          disabled={busy}
          onClick={() => onTest({ baseUrl: form.baseUrl, apiKey: apiKey || undefined, model: form.model })}
        >
          {busy ? "测试中…" : "测试连通性"}
        </Button>
        <Button
          disabled={busy}
          onClick={() =>
            onSave({
              baseUrl: form.baseUrl,
              model: form.model,
              temperature: form.temperature,
              maxTokens: form.maxTokens,
              enabled,
              ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
            })
          }
        >
          {busy ? "保存中…" : "保存配置"}
        </Button>
      </div>
    </div>
  );
}

/* ============================ 用户管理 ============================ */

function UsersTab({
  users,
  selfUid,
  busy,
  onAction,
}: {
  users: AdminUser[];
  selfUid: string;
  busy: boolean;
  onAction: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", role: "user" as "admin" | "user" });
  const [query, setQuery] = useState("");

  const list = users.filter(
    (u) => !query.trim() || u.username.toLowerCase().includes(query.trim().toLowerCase()) || u.nickname.includes(query.trim()),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          className={inputClass}
          placeholder="搜索用户名 / 昵称"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? "取消" : "新建用户"}
        </Button>
      </div>

      {showCreate ? (
        <Card>
          <SectionTitle title="新建用户" />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="用户名">
              <input className={inputClass} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </Field>
            <Field label="初始密码" hint="至少 6 位">
              <input
                type="password"
                className={inputClass}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </Field>
            <Field label="角色">
              <select
                className={inputClass}
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "user" })}
              >
                <option value="user">普通用户</option>
                <option value="admin">管理员</option>
              </select>
            </Field>
          </div>
          <div className="mt-3 flex justify-end">
            <Button
              disabled={busy}
              onClick={async () => {
                await onAction({ action: "create", ...form });
                setForm({ username: "", password: "", role: "user" });
                setShowCreate(false);
              }}
            >
              创建
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="px-4 py-3 font-medium">用户</th>
                <th className="px-3 py-3 font-medium">角色</th>
                <th className="px-3 py-3 font-medium">已学</th>
                <th className="px-3 py-3 font-medium">收藏</th>
                <th className="px-3 py-3 font-medium">学习天数</th>
                <th className="px-3 py-3 font-medium">注册时间</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.uid} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800 dark:text-slate-100">{u.nickname}</div>
                    <div className="text-xs text-slate-400">{u.username}</div>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={u.role === "admin" ? "brand" : "slate"}>{u.role === "admin" ? "管理员" : "普通"}</Badge>
                  </td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{u.learned}</td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{u.favorites}</td>
                  <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{u.studiedDays}</td>
                  <td className="px-3 py-3 text-xs text-slate-400">{u.createdAt.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          const pwd = prompt(`为用户「${u.username}」设置新密码（至少 6 位）：`);
                          if (pwd) void onAction({ action: "resetPassword", uid: u.uid, password: pwd });
                        }}
                      >
                        重置密码
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void onAction({ action: "setRole", uid: u.uid, role: u.role === "admin" ? "user" : "admin" })
                        }
                      >
                        {u.role === "admin" ? "降为用户" : "设为管理员"}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={busy || u.uid === selfUid}
                        onClick={() => {
                          if (confirm(`确定删除用户「${u.username}」？其学习数据将一并删除，且不可恢复。`)) {
                            void onAction({ action: "delete", uid: u.uid });
                          }
                        }}
                      >
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!list.length ? <EmptyState icon="👥" title="没有匹配的用户" /> : null}
      </Card>
    </div>
  );
}

/* ============================ 词库管理 ============================ */

function BooksTab({
  books,
  totalBooks,
  categories,
  query,
  category,
  busy,
  onQuery,
  onCategory,
  onUpdate,
  onReset,
  onBulk,
}: {
  books: AdminBook[];
  totalBooks: number;
  categories: string[];
  query: string;
  category: string;
  busy: boolean;
  onQuery: (v: string) => void;
  onCategory: (v: string) => void;
  onUpdate: (bookId: string, patch: Partial<AdminBook>) => Promise<void>;
  onReset: (bookId: string) => Promise<void>;
  onBulk: (ids: string[], enabled: boolean) => Promise<void>;
}) {
  const allIds = books.map((b) => b.id);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input className={cn(inputClass, "max-w-xs flex-1")} placeholder="搜索词库名称 / ID" value={query} onChange={(e) => onQuery(e.target.value)} />
        <select className={cn(inputClass, "w-auto")} value={category} onChange={(e) => onCategory(e.target.value)}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void onBulk(allIds, true)}>
          全部启用
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void onBulk(allIds, false)}>
          全部禁用
        </Button>
        <span className="text-xs text-slate-400">
          共 {totalBooks} 本 / 当前显示 {books.length} 本
        </span>
      </div>

      <Card className="p-0">
        <div className="max-h-[36rem] overflow-y-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="sticky top-0 bg-white dark:bg-slate-800">
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                <th className="px-4 py-3 font-medium">词库</th>
                <th className="px-3 py-3 font-medium">分类</th>
                <th className="px-3 py-3 font-medium">词数</th>
                <th className="px-3 py-3 font-medium">权重</th>
                <th className="px-3 py-3 font-medium">置顶</th>
                <th className="px-3 py-3 font-medium">启用</th>
                <th className="px-4 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span>{b.cover}</span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-slate-800 dark:text-slate-100">{b.name}</div>
                        <div className="truncate text-[11px] text-slate-400">{b.id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge tone="slate">{b.category}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 dark:text-slate-300">{fmt(b.wordCount)}</td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      className="w-16 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                      defaultValue={b.weight}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== b.weight) void onUpdate(b.id, { weight: v });
                      }}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-500"
                      checked={b.pinned}
                      onChange={(e) => void onUpdate(b.id, { pinned: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-brand-500"
                      checked={b.enabled}
                      onChange={(e) => void onUpdate(b.id, { enabled: e.target.checked })}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="ghost" onClick={() => void onReset(b.id)}>
                      恢复默认
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!books.length ? <EmptyState icon="📚" title="没有匹配的词库" /> : null}
      </Card>
    </div>
  );
}

/* ============================ 操作日志 ============================ */

function LogsTab({ logs, onClear }: { logs: OperationLog[]; onClear: () => Promise<void> }) {
  const toneOf = (level: OperationLog["level"]) =>
    level === "error" ? "rose" : level === "warn" ? "amber" : "slate";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">最近 {logs.length} 条（最多保留 300 条）</span>
        <Button size="sm" variant="danger" onClick={() => void onClear()}>
          清空日志
        </Button>
      </div>
      <Card className="p-0">
        <div className="max-h-[36rem] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
          {logs.map((l) => (
            <div key={l.id} className="flex items-start gap-3 px-4 py-3">
              <Badge tone={toneOf(l.level)}>{l.level}</Badge>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-slate-800 dark:text-slate-100">
                  <span className="font-medium">{l.actor}</span> {l.action}
                  {l.target ? <span className="text-slate-400"> · {l.target}</span> : null}
                </div>
                {l.detail ? <div className="mt-0.5 truncate text-xs text-slate-400">{l.detail}</div> : null}
              </div>
              <span className="shrink-0 text-[11px] text-slate-400">{formatTime(l.at)}</span>
            </div>
          ))}
        </div>
        {!logs.length ? <EmptyState icon="📝" title="暂无操作日志" description="管理端的写操作会自动记录在这里。" /> : null}
      </Card>
    </div>
  );
}

/* ============================ 工具 ============================ */

function fmt(n: number): string {
  return n.toLocaleString("zh-CN");
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
