import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { appendLog } from "@/lib/admin/logs";
import { errorMessage, fail, ok } from "@/lib/api";
import { getBookOverrides, resetBookOverride, saveBookOverride } from "@/lib/config/books";
import { listRawWordBooks } from "@/lib/wordbooks-server";

export const dynamic = "force-dynamic";

/** 词库管理清单：manifest 原值 + 覆盖层 */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const overrides = await getBookOverrides();
  const books = listRawWordBooks().map((book) => {
    const o = overrides[book.id] ?? {};
    return {
      id: book.id,
      name: book.name,
      description: book.description,
      category: book.category ?? book.level,
      language: book.language ?? "en",
      wordCount: book.wordCount,
      cover: book.cover,
      enabled: o.enabled !== false,
      pinned: Boolean(o.pinned),
      weight: o.weight ?? 0,
      categoryOverride: o.category ?? "",
    };
  });

  return ok({ books, total: books.length });
}

export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => null)) as {
    action?: "update" | "reset" | "bulk";
    bookId?: string;
    enabled?: boolean;
    pinned?: boolean;
    weight?: number;
    category?: string;
    bookIds?: string[];
    ids?: string[];
  } | null;
  if (!body?.action) return fail("缺少 action");

  const actor = guard.context.data.profile.username;

  try {
    if (body.action === "update") {
      if (!body.bookId) return fail("缺少 bookId");
      const patch = {
        ...(typeof body.enabled === "boolean" ? { enabled: body.enabled } : {}),
        ...(typeof body.pinned === "boolean" ? { pinned: body.pinned } : {}),
        ...(typeof body.weight === "number" ? { weight: Math.round(body.weight) } : {}),
        ...(typeof body.category === "string" ? { category: body.category.trim() } : {}),
      };
      await saveBookOverride(body.bookId, patch);
      await appendLog({ actor, action: "更新词库设置", target: body.bookId, detail: JSON.stringify(patch) });
      return ok({ overrides: await getBookOverrides() });
    }

    if (body.action === "reset") {
      if (!body.bookId) return fail("缺少 bookId");
      await resetBookOverride(body.bookId);
      await appendLog({ actor, action: "重置词库设置", target: body.bookId });
      return ok({ overrides: await getBookOverrides() });
    }

    if (body.action === "bulk") {
      const ids = body.ids ?? body.bookIds ?? [];
      if (!ids.length) return fail("缺少 ids");
      const enabled = body.enabled !== false;
      for (const id of ids) await saveBookOverride(id, { enabled });
      await appendLog({
        actor,
        action: enabled ? "批量启用词库" : "批量禁用词库",
        target: `${ids.length} 本`,
      });
      return ok({ overrides: await getBookOverrides() });
    }

    return fail(`未知 action: ${body.action}`);
  } catch (error) {
    return fail(errorMessage(error, "操作失败"), 500);
  }
}
