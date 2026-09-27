import type { Metadata } from "next";
import { PAGE_SEO, SITE_NAME } from "@/lib/seo";

const SEO = PAGE_SEO.learn;

export const metadata: Metadata = {
  title: SEO.title,
  description: SEO.description,
  alternates: { canonical: "/learn" },
  openGraph: {
    title: `${SEO.title} · ${SITE_NAME}`,
    description: SEO.description,
    url: "/learn",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
