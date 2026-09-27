import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { appendLog, clearLogs, listLogs } from "@/lib/admin/logs";
import { ok } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "100");
  const logs = await listLogs();
  return ok({ logs: logs.slice(0, Number.isFinite(limit) ? limit : 100), total: logs.length });
}

export async function DELETE() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  await clearLogs();
  await appendLog({
    actor: guard.context.data.profile.username,
    action: "清空操作日志",
    level: "warn",
  });
  return ok({ ok: true });
}

/** 前端上报前端侧的关键操作（可选） */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => null)) as { action?: string; detail?: string } | null;
  if (!body?.action) return ok({ ok: true });
  await appendLog({
    actor: guard.context.data.profile.username,
    action: body.action.slice(0, 60),
    detail: body.detail?.slice(0, 200),
  });
  return ok({ ok: true });
}
