import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";
import { appendLog } from "@/lib/admin/logs";
import { fail, ok, errorMessage } from "@/lib/api";
import { getAiConfig, maskAiConfig, saveAiConfig, type AiConfig } from "@/lib/config/ai";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;
  const config = await getAiConfig();
  return ok({ config: maskAiConfig(config) });
}

export async function PATCH(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => null)) as Partial<AiConfig> & {
    /** 前端留空表示「不修改密钥」 */
    apiKey?: string;
    clearApiKey?: boolean;
  } | null;
  if (!body) return fail("请求体不合法");

  const patch: Partial<AiConfig> = {};
  if (typeof body.baseUrl === "string") patch.baseUrl = body.baseUrl.trim().replace(/\/+$/, "");
  if (typeof body.model === "string") patch.model = body.model.trim();
  if (typeof body.temperature === "number") {
    patch.temperature = Math.max(0, Math.min(2, body.temperature));
  }
  if (typeof body.maxTokens === "number") {
    patch.maxTokens = Math.max(64, Math.min(32000, Math.round(body.maxTokens)));
  }
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  // 密钥：仅在显式提供非空值或要求清空时更新
  if (body.clearApiKey) patch.apiKey = "";
  else if (typeof body.apiKey === "string" && body.apiKey.trim()) patch.apiKey = body.apiKey.trim();

  try {
    const config = await saveAiConfig(patch);
    await appendLog({
      actor: guard.context.data.profile.username,
      action: "更新大模型配置",
      target: Object.keys(patch)
        .map((k) => (k === "apiKey" ? "apiKey(已脱敏)" : k))
        .join(", "),
    });
    return ok({ config: maskAiConfig(config) });
  } catch (error) {
    return fail(errorMessage(error, "保存失败"), 500);
  }
}
