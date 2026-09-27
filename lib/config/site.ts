/**
 * 站点级配置（存 KV，管理端可改）
 *
 * 设计原则：
 * - KV 为准，环境变量兜底。这样「管理端改了配置」能立即生效，
 *   而首次部署未配置时也不会崩。
 * - 只存可公开/可运营的字段；密钥类（如 AI_API_KEY）单独存放并做脱敏返回。
 */

import { getKV } from "../storage";
import { SITE_DESC, SITE_KEYWORDS, SITE_NAME } from "../seo";

const SITE_CONFIG_KEY = "config:site";

export interface SiteConfig {
  /** 站点名（品牌） */
  name: string;
  /** 站点描述，用于 SEO */
  description: string;
  /** SEO 关键词 */
  keywords: string[];
  /** 首页公告（为空则不显示） */
  announcement: string;
  /** 是否允许新用户注册 */
  allowRegister: boolean;
  /** 是否开启 AI 功能 */
  aiEnabled: boolean;
  /** 页脚备案号 / 版权信息 */
  footerText: string;
  /** 站点上线时间，用于「已运行 N 天」 */
  launchedAt: string;
  updatedAt: string;
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  name: SITE_NAME,
  description: SITE_DESC,
  keywords: [...SITE_KEYWORDS],
  announcement: "",
  allowRegister: true,
  aiEnabled: true,
  footerText: "",
  launchedAt: "2026-09-27",
  updatedAt: new Date(0).toISOString(),
};

export async function getSiteConfig(): Promise<SiteConfig> {
  try {
    const stored = await getKV().get<Partial<SiteConfig>>(SITE_CONFIG_KEY);
    if (!stored) return { ...DEFAULT_SITE_CONFIG };
    return { ...DEFAULT_SITE_CONFIG, ...stored };
  } catch {
    return { ...DEFAULT_SITE_CONFIG };
  }
}

export async function saveSiteConfig(patch: Partial<SiteConfig>): Promise<SiteConfig> {
  const current = await getSiteConfig();
  const next: SiteConfig = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await getKV().put(SITE_CONFIG_KEY, next);
  return next;
}
