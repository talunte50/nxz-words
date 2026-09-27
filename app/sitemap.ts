import type { MetadataRoute } from "next";
import manifest from "@/data/wordbooks/manifest.json";
import { SITE_URL } from "@/lib/seo";
import type { WordBookMeta } from "@/lib/types";

const META = manifest as WordBookMeta[];

/**
 * 站点地图
 *
 * 包含：静态公开页面 + 368 本词库的详情页。
 * 词库详情页是重要的长尾 SEO 入口（例如「考研英语词汇表」）。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/wordbooks`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/learn`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  const bookPages: MetadataRoute.Sitemap = META.map((book) => ({
    url: `${SITE_URL}/wordbooks/${book.id}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [...staticPages, ...bookPages];
}
