import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { appendLog } from "@/lib/admin/logs";
import { fail, ok, errorMessage } from "@/lib/api";
import { getSiteConfig, saveSiteConfig, type SiteConfig } from "@/lib/config/site";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const config = await getSiteConfig();
  return ok({ config });
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => null)) as Partial<SiteConfig> | null;
  if (!body) return fail("请求体不合法");

  const patch: Partial<SiteConfig> = {};
  if (typeof body.name === "string" && body.name.trim()) patch.name = body.name.trim().slice(0, 40);
  if (typeof body.description === "string") patch.description = body.description.slice(0, 300);
  if (Array.isArray(body.keywords)) {
    patch.keywords = body.keywords
      .filter((k): k is string => typeof k === "string")
      .map((k) => k.trim())
      .filter(Boolean)
      .slice(0, 30);
  }
  if (typeof body.announcement === "string") patch.announcement = body.announcement.slice(0, 300);
  if (typeof body.allowRegister === "boolean") patch.allowRegister = body.allowRegister;
  if (typeof body.aiEnabled === "boolean") patch.aiEnabled = body.aiEnabled;
  if (typeof body.footerText === "string") patch.footerText = body.footerText.slice(0, 200);
  if (typeof body.launchedAt === "string") patch.launchedAt = body.launchedAt.slice(0, 20);

  try {
    const config = await saveSiteConfig(patch);
    await appendLog({
      actor: guard.context.data.profile.username,
      action: "更新站点配置",
      target: Object.keys(patch).join(", "),
    });
    return ok({ config });
  } catch (error) {
    return fail(errorMessage(error, "保存失败"), 500);
  }
}
