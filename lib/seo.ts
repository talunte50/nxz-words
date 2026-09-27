/**
 * 站点 SEO 与品牌常量
 *
 * 注意：这里的值是**构建期默认值**。运行期可通过管理端的「网站配置」
 * 覆盖站点名、描述、关键词等（存于 KV，见 lib/config/site.ts）。
 * 之所以保留静态默认值，是因为 Next.js 的 metadata 需要在构建时静态可读。
 */

export const SITE_NAME = "逆行者单词";

export const SITE_DESC =
  "逆行者单词 —— 免费在线背单词平台。内置 368 本词库、40 万词条，覆盖四六级、考研、雅思、托福、GRE、高考、新概念及日语、德语等多语种，支持艾宾浩斯智能复习、拼写听写填空测验与 AI 精讲。";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://nxz-words.edgeone.dev";

export const SITE_KEYWORDS = [
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
];

/** 各页面的 SEO 元数据 */
export const PAGE_SEO = {
  home: {
    title: "免费在线背单词",
    description:
      "逆行者单词提供 368 本免费词库、40 万词条，支持艾宾浩斯智能复习、拼写听写填空测验与 AI 精讲，一站式搞定四六级、考研、雅思、托福、GRE 词汇。",
  },
  wordbooks: {
    title: "词库大全",
    description:
      "368 本精选词库免费使用：CET-4/6、考研、雅思、托福、GRE、高考、中考、小学、新概念英语、日语、德语等，一键切换开始学习。",
  },
  learn: {
    title: "开始学词",
    description:
      "基于艾宾浩斯遗忘曲线的智能复习计划，每天安排最该复习的单词，配合音标、释义、例句与 AI 精讲高效记忆。",
  },
  quiz: {
    title: "单词测验",
    description:
      "拼写、听写、填空三种模式检验记忆效果，自动记录错词并纳入后续复习计划。",
  },
  favorites: {
    title: "我的收藏",
    description: "收藏难记的单词，集中攻克薄弱环节。",
  },
  chat: {
    title: "AI 对话答疑",
    description:
      "与 AI 助手对话学习英语，随时提问词义辨析、用法搭配、例句造句等问题。",
  },
  profile: {
    title: "个人中心",
    description: "查看学习统计、打卡记录，管理账号与界面主题。",
  },
  login: {
    title: "登录 / 注册",
    description: "登录逆行者单词，同步你的学习进度与收藏。",
  },
} as const;

export type PageSeoKey = keyof typeof PAGE_SEO;

/** 生成页面级 metadata 的辅助函数 */
export function pageMetadata(key: PageSeoKey, path: string) {
  const seo = PAGE_SEO[key];
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: path },
    openGraph: {
      title: `${seo.title} · ${SITE_NAME}`,
      description: seo.description,
      url: path,
    },
  };
}
