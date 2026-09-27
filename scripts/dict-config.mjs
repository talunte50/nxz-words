export const RAW_DIR = "data/raw";
export const OUT_DIR = "data/wordbooks";

export const REPO = "RealKai42/qwerty-learner";
export const BRANCH = "master";

export const BOOKS = [
  {
    id: "primary",
    name: "小学英语",
    description: "人教版小学 3-6 年级核心词汇（多分册合并去重）",
    level: "小学",
    cover: "🎒",
    match: [/^PEPXiaoXue/i, /^PEP_SL_XiaoXue/i, /XiaoXue/i],
    limit: 1500,
  },
  {
    id: "junior",
    name: "初中英语",
    description: "中考核心词汇，覆盖初中三年教材",
    level: "初中",
    cover: "📐",
    match: [/ChuZhong/i, /junior_high_school/i, /juniorMiddleSH/i],
    limit: 2500,
  },
  {
    id: "senior",
    name: "高中英语",
    description: "高考 3500 词与高中教材词汇",
    level: "高中",
    cover: "🧪",
    match: [/GaoZhong/i, /GaoKao_3500/i],
    limit: 4500,
  },
  {
    id: "college",
    name: "大学英语",
    description: "牛津核心 5000 + 麦克米伦 7000 通用英语词表（非应试，与四六级不重复）",
    level: "大学",
    cover: "🎓",
    match: [/^Oxford5000/i, /^Macmillan7000/i],
    limit: 6000,
  },
  {
    id: "cet4",
    name: "大学英语四级",
    description: "CET-4 核心词汇",
    level: "CET4",
    cover: "📘",
    match: [/^CET4_T/i],
    limit: 5000,
  },
  {
    id: "cet6",
    name: "大学英语六级",
    description: "CET-6 进阶词汇",
    level: "CET6",
    cover: "📗",
    match: [/^CET6_T/i],
    limit: 5000,
  },
  {
    id: "business",
    name: "商务英语",
    description: "BEC 商务英语词汇（中级 + 高级合并）",
    level: "商务",
    cover: "💼",
    match: [/^BEC_/i],
    limit: 3000,
  },
  {
    id: "ielts",
    name: "雅思",
    description: "雅思核心词汇（词表 + 高频 807 词，去重）",
    level: "雅思",
    cover: "🇬🇧",
    match: [/^IELTS_3_T/i, /^ielts-807/i],
    limit: 4000,
  },
  {
    id: "toefl",
    name: "托福",
    description: "托福核心词汇（官方词表 + 张洪岩精选）",
    level: "托福",
    cover: "✈️",
    match: [/^TOEFL_3_T/i, /^TOEFL_ZhangHongYan/i],
    limit: 4000,
  },
  {
    id: "kaoyan",
    name: "考研",
    description: "考研英语核心词汇（历年大纲词表）",
    level: "考研",
    cover: "🏫",
    match: [/^KaoYan_3_T/i, /^KaoYan_2024/i],
    limit: 4500,
  },
  {
    id: "gre",
    name: "GRE",
    description: "GRE 高阶学术词汇（3000 词 + 1500 精选）",
    level: "GRE",
    cover: "🔬",
    match: [/^GRE3000_3_T/i, /^GRE_1500/i],
    limit: 3000,
  },
  {
    id: "nce",
    name: "新概念英语",
    description: "新概念英语 1-4 册词汇（分册合并去重）",
    level: "新概念",
    cover: "📕",
    match: [/^NCE_[1-4]\.json$/i],
    limit: 4000,
  },
  {
    id: "topwords",
    name: "高频基础词",
    description: "常用高频核心词（中文释义，日常与考试通用）",
    level: "基础",
    cover: "🌟",
    // 只用有中文释义的高频源；top2000words / 4000_Essential 释义为英文，故不采用
    match: [/^frequently_used_word/i, /^Duolingo_Vocabulary/i, /^Longman_Communication_3000/i],
    limit: 4000,
  },
];

export function pickSources(book, allNames) {
  const seen = new Set();
  const picked = [];
  for (const name of allNames) {
    if (!name.toLowerCase().endsWith(".json")) continue;
    if (seen.has(name)) continue;
    if (book.match.some((pattern) => pattern.test(name))) {
      seen.add(name);
      picked.push(name);
    }
  }
  return picked;
}