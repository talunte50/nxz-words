import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { SITE_NAME, SITE_DESC, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} · 免费在线背单词，368 本词库 · 40 万词条 · AI 智能记忆`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESC,
  keywords: [
    "逆行者单词",
    "背单词",
    "英语单词",
    "在线背单词",
    "单词学习",
    "四六级词汇",
    "考研英语单词",
    "雅思词汇",
    "托福单词",
    "GRE词汇",
    "高考英语词汇",
    "新概念英语",
    "艾宾浩斯记忆曲线",
    "单词测验",
    "AI背单词",
    "免费背单词软件",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  applicationName: SITE_NAME,
  category: "education",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "zh_CN",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} · 免费在线背单词，368 本词库 · 40 万词条 · AI 智能记忆`,
    description: SITE_DESC,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} · 免费在线背单词`,
    description: SITE_DESC,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#3366ff",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-[100dvh] overflow-x-hidden bg-[var(--bg)] font-sans text-[var(--text)]">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
