import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "管理后台",
  description: "站点管理后台：网站配置、大模型配置、用户管理、词库管理、数据看板。",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[60vh]" data-site={SITE_NAME}>
      {children}
    </div>
  );
}
