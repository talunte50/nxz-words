import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { getWordBook, getBookMeta } from "@/lib/wordbooks-server";

// 词书详情页**动态渲染**：不在构建期预生成 368 个页面。
// 原因：全量词库 85MB，预渲染会显著拉长构建时间并可能触碰平台构建上限。
// 改为按需 ISR：首次访问生成，之后缓存 1 天。
export const dynamic = "force-dynamic";
export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const meta = getBookMeta(id);
  if (!meta) return { title: "词库不存在" };

  const title = `${meta.name}词汇表`;
  const description = `${meta.name}（${meta.wordCount.toLocaleString()} 词）完整词表，免费在线学习。${meta.description}。支持艾宾浩斯智能复习、拼写听写测验与 AI 精讲。`;

  return {
    title,
    description,
    keywords: [meta.name, `${meta.name}词汇`, `${meta.name}单词表`, "背单词", "在线背单词"],
    alternates: { canonical: `/wordbooks/${id}` },
    openGraph: {
      title: `${title} · ${SITE_NAME}`,
      description,
      url: `${SITE_URL}/wordbooks/${id}`,
      type: "article",
    },
  };
}

const POS_LABELS: Record<string, string> = {
  n: "名词",
  v: "动词",
  adj: "形容词",
  adv: "副词",
  prep: "介词",
  conj: "连词",
  pron: "代词",
  num: "数词",
};

export default async function WordBookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meta = getBookMeta(id);
  if (!meta) notFound();

  const book = await getWordBook(id);
  if (!book) notFound();

  // 首屏渲染前 120 词，其余提示登录后学习（避免单页过大）
  const preview = book.words.slice(0, 120);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <nav aria-label="面包屑" className="mb-4 text-sm text-[var(--muted)]">
        <Link href="/" className="hover:underline">
          首页
        </Link>
        <span className="mx-1">/</span>
        <Link href="/wordbooks" className="hover:underline">
          词库
        </Link>
        <span className="mx-1">/</span>
        <span>{meta.name}</span>
      </nav>

      <header className="mb-6">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-3xl" aria-hidden="true">
            {meta.cover}
          </span>
          <h1 className="text-2xl font-bold">{meta.name}词汇表</h1>
        </div>
        <p className="text-sm text-[var(--muted)]">{meta.description}</p>
        <p className="mt-2 text-sm">
          共 <strong>{meta.wordCount.toLocaleString()}</strong> 个单词
          {meta.category ? ` · 分类：${meta.category}` : ""}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/learn?book=${id}`}
            className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            开始学习本词库
          </Link>
          <Link
            href="/wordbooks"
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--surface-2)]"
          >
            浏览其他词库
          </Link>
        </div>
      </header>

      <section aria-labelledby="wordlist-heading">
        <h2 id="wordlist-heading" className="mb-3 text-lg font-semibold">
          单词列表
          {book.words.length > preview.length && (
            <span className="ml-2 text-sm font-normal text-[var(--muted)]">
              （展示前 {preview.length} 词）
            </span>
          )}
        </h2>
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
          {preview.map((word) => (
            <li key={word.id} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{word.word}</span>
                {word.phonetic && (
                  <span className="text-xs text-[var(--muted)]">{word.phonetic}</span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-[var(--muted)]">{word.meaning}</p>
            </li>
          ))}
        </ul>
        {book.words.length > preview.length && (
          <p className="mt-4 text-center text-sm text-[var(--muted)]">
            还有 {(book.words.length - preview.length).toLocaleString()} 个单词，
            <Link href={`/learn?book=${id}`} className="text-[var(--primary)] hover:underline">
              登录后开始学习
            </Link>
          </p>
        )}
      </section>

      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `${meta.name}词汇表`,
            description: meta.description,
            numberOfItems: meta.wordCount,
            itemListElement: preview.slice(0, 30).map((w, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: w.word,
              description: w.meaning,
            })),
          }),
        }}
      />
    </div>
  );
}
