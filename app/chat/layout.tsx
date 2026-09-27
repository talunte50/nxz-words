import type { Metadata } from "next";
import { PAGE_SEO, SITE_NAME } from "@/lib/seo";

const SEO = PAGE_SEO.chat;

export const metadata: Metadata = {
  title: SEO.title,
  description: SEO.description,
  alternates: { canonical: "/chat" },
  openGraph: {
    title: `${SEO.title} · ${SITE_NAME}`,
    description: SEO.description,
    url: "/chat",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
