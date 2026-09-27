import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "WordLeap 词跃 · AI 背单词",
  description: "部署在 EdgeOne Pages 上的 AI 英语单词学习应用，支持艾宾浩斯复习与 AI 精讲",
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