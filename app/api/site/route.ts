import { ok } from "@/lib/api";
import { getSiteConfig } from "@/lib/config/site";

export const dynamic = "force-dynamic";

/** 公开站点信息（不含密钥）：供前端展示公告、页脚、品牌名与注册开关 */
export async function GET() {
  const config = await getSiteConfig();
  return ok({
    name: config.name,
    description: config.description,
    announcement: config.announcement,
    allowRegister: config.allowRegister,
    aiEnabled: config.aiEnabled,
    footerText: config.footerText,
    launchedAt: config.launchedAt,
  });
}
