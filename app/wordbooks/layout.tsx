import type { Metadata } from "next";
import { PAGE_SEO, SITE_NAME } from "@/lib/seo";

const SEO = PAGE_SEO.wordbooks;

export const metadata: Metadata = {
  title: SEO.title,
  description: SEO.description,
  alternates: { canonical: "/wordbooks" },
  openGraph: {
    title: `${SEO.title} · ${SITE_NAME}`,
    description: SEO.description,
    url: "/wordbooks",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
