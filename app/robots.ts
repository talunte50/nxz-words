import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * robots.txt
 *
 * 允许收录公开页面；屏蔽需要登录的接口与个人数据页，避免爬虫浪费配额、
 * 也避免把用户私有页面暴露给搜索引擎。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/profile",
          "/favorites",
          "/admin",
          "/quiz",
          "/chat",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
