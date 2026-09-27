import manifest from "../../data/wordbooks/manifest.json";
import type { WordBook, WordBookMeta } from "../types";

/**
 * 词书加载器
 *
 * ⚠️ 重要架构决策（v2）：词书数据**不打包进 JS**。
 *
 * 背景：全量词库（368 本 / 40 万词 / 85MB）最初用 webpack 动态 import 打包，
 * 会生成 368 个 JS chunk，导致 EdgeOne Pages 构建超限（部署 code=30 失败）。
 *
 * 现在的策略：
 *   1. `public/wordbooks/*.json` 作为**静态资源**分发（走 CDN，不占 JS 包体积）
 *   2. 服务端（API 路由 / SSR）直接用 fs 读 `public/wordbooks/`，避免自请求的额外开销
 *   3. 词书详情页改为**动态渲染**（见 app/wordbooks/[id]/page.tsx），不在构建期预渲染 368 页
 *   4. manifest.json 仍打进包（仅几十 KB），用于首屏词书列表
 */

const META = manifest as WordBookMeta[];

const cache = new Map<string, WordBook>();

export function bookIds(): string[] {
  return META.map((m) => m.id);
}

export function isKnownBook(id: string): boolean {
  return META.some((m) => m.id === id);
}

export async function loadBook(id: string): Promise<WordBook | null> {
  const cached = cache.get(id);
  if (cached) return cached;
  if (!isKnownBook(id)) return null;

  const book = (await readFromDisk(id)) ?? (await readFromHttp(id));
  if (!book) return null;
  cache.set(id, book);
  return book;
}

/** 服务端：直接从磁盘读 public/wordbooks 下的 JSON（快，无网络开销） */
async function readFromDisk(id: string): Promise<WordBook | null> {
  if (typeof window !== "undefined") return null;
  try {
    const [{ readFile }, path] = await Promise.all([
      import("node:fs/promises"),
      import("node:path"),
    ]);
    // 部署环境下 cwd 即项目根；public/ 已被平台原样发布
    const file = path.join(process.cwd(), "public", "wordbooks", `${id}.json`);
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as WordBook;
  } catch {
    return null;
  }
}

/** 浏览器 / 磁盘不可用时的回退：走站点静态资源 */
async function readFromHttp(id: string): Promise<WordBook | null> {
  const base =
    typeof window === "undefined"
      ? (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/+$/, "")
      : "";
  try {
    const res = await fetch(`${base}/wordbooks/${encodeURIComponent(id)}.json`, {
      cache: "force-cache",
    });
    if (!res.ok) return null;
    return (await res.json()) as WordBook;
  } catch {
    return null;
  }
}

// 词书 id 可能自身含下划线（如 `kaoyan_2024`、`BeiShiGaoZhong_1_T`），
// 而 wordId 形如 `<bookId>_00001`。因此不能用「第一个下划线」切分，
// 必须做**最长前缀匹配**：取所有已知 bookId 中能作为前缀的最长者。
const BOOK_IDS_BY_LEN = [...bookIds()].sort((a, b) => b.length - a.length);

export function bookIdFromWordId(wordId: string): string {
  if (!wordId) return "";
  for (const id of BOOK_IDS_BY_LEN) {
    if (wordId.startsWith(`${id}_`)) return id;
  }
  // 回退：兼容 manifest 之外的旧数据
  const at = wordId.indexOf("_");
  return at > 0 ? wordId.slice(0, at) : "";
}

export function clearBookCache(): void {
  cache.clear();
}
