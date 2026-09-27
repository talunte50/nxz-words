import { requireAdmin } from "@/lib/admin/guard";
import { ok } from "@/lib/api";
import { getAiConfig, isAiReady, maskAiConfig } from "@/lib/config/ai";
import { getSiteConfig } from "@/lib/config/site";
import { getBookOverrides } from "@/lib/config/books";
import { listUsers } from "@/lib/store/user-store";
import { listRawWordBooks } from "@/lib/wordbooks-server";

export const dynamic = "force-dynamic";

/** 数据看板：用户 / 学习 / 词库 / 配置概览 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const [users, overrides, aiConfig, siteConfig] = await Promise.all([
    listUsers(),
    getBookOverrides(),
    getAiConfig(),
    getSiteConfig(),
  ]);

  const books = listRawWordBooks();
  const totalWords = books.reduce((sum, b) => sum + (b.wordCount ?? 0), 0);
  const disabledBooks = Object.values(overrides).filter((o) => o.enabled === false).length;

  const totalLearned = users.reduce((sum, u) => sum + u.learned, 0);
  const activeUsers = users.filter((u) => u.lastActive).length;
  const admins = users.filter((u) => u.role === "admin").length;

  // 最近 7 天新增账号
  const days: { date: string; count: number }[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, count: users.filter((u) => u.createdAt.slice(0, 10) === key).length });
  }

  // 词库分类分布
  const categoryMap = new Map<string, { books: number; words: number }>();
  for (const b of books) {
    const cat = overrides[b.id]?.category || b.category || b.level || "未分类";
    const cur = categoryMap.get(cat) ?? { books: 0, words: 0 };
    cur.books += 1;
    cur.words += b.wordCount ?? 0;
    categoryMap.set(cat, cur);
  }
  const categories = [...categoryMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.words - a.words);

  return ok({
    users: {
      total: users.length,
      admins,
      active: activeUsers,
      newThisWeek: days.reduce((s, d) => s + d.count, 0),
    },
    learning: {
      totalLearned,
      avgLearned: users.length ? Math.round(totalLearned / users.length) : 0,
    },
    books: {
      total: books.length,
      totalWords,
      disabled: disabledBooks,
      categories,
    },
    growth: days,
    config: {
      siteName: siteConfig.name,
      allowRegister: siteConfig.allowRegister,
      aiEnabled: siteConfig.aiEnabled,
      aiReady: isAiReady(aiConfig),
      aiModel: aiConfig.model || "未配置",
      ai: maskAiConfig(aiConfig),
    },
  });
}
