#!/usr/bin/env node
/**
 * import-qwerty.mjs — 从 qwerty-learner 全量导入词库
 *
 * 数据源：
 *   E:/madao/qwerty-learner-master/src/resources/dictionary.ts  ← 官方词库清单（376 条）
 *   E:/madao/qwerty-learner-master/public/dicts/*.json          ← 词库内容（75MB）
 *
 * 源格式：  [{ name, trans: [], usphone, ukphone }]
 * 目标格式：{ id, word, phonetic, pos, meaning, example, exampleZh, tags, bookId }
 *
 * 用法: node scripts/import-qwerty.mjs [--limit N] [--only id1,id2]
 */

import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, basename } from "node:path";

const SRC_ROOT = "E:/madao/qwerty-learner-master";
const DICT_TS = join(SRC_ROOT, "src/resources/dictionary.ts");
const DICT_DIR = join(SRC_ROOT, "public/dicts");
// 词书数据写到 public/wordbooks/，作为静态资源分发（不打进 JS 包）。
// 只有 manifest.json 会同时落到 data/wordbooks/ 供构建期 import。
const OUT_DIR = resolve(process.cwd(), "public/wordbooks");
const MANIFEST_DIR = resolve(process.cwd(), "data/wordbooks");

const argv = process.argv.slice(2);
const ONLY = (() => {
  const i = argv.indexOf("--only");
  return i >= 0 && argv[i + 1] ? new Set(argv[i + 1].split(",")) : null;
})();

const POS_PATTERN = /^(?:(?:[a-z]{1,6}\.\s*)+)/i;

/* ---------------- 解析 dictionary.ts ---------------- */

async function parseDictionaryIndex() {
  const text = await readFile(DICT_TS, "utf8");
  const blocks = [];
  // 逐个对象块提取：从 { 开始到匹配的 }
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "{") {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        blocks.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }

  const field = (block, key) => {
    const m = block.match(new RegExp(`${key}:\\s*'([^']*)'`));
    if (m) return m[1];
    const m2 = block.match(new RegExp(`${key}:\\s*"([^"]*)"`));
    return m2 ? m2[1] : null;
  };

  const items = [];
  const usedIds = new Set();
  for (const block of blocks) {
    const id = field(block, "id");
    const url = field(block, "url");
    const name = field(block, "name");
    if (!id || !url || !name) continue;
    if (usedIds.has(id)) continue;
    usedIds.add(id);

    const category = field(block, "category") || "其他";
    const description = field(block, "description") || name;
    const language = field(block, "language") || "en";
    const languageCategory = field(block, "languageCategory") || language;
    const tagsRaw = block.match(/tags:\s*\[([^\]]*)\]/);
    const tags = tagsRaw
      ? tagsRaw[1]
          .split(",")
          .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
          .filter(Boolean)
      : [];
    const lengthMatch = block.match(/length:\s*(\d+)/);
    const length = lengthMatch ? Number(lengthMatch[1]) : 0;

    items.push({
      id,
      name,
      description,
      category,
      tags,
      language,
      languageCategory,
      url: url.replace(/^\/dicts\//, ""),
      length,
    });
  }
  return items;
}

/* ---------------- 词条转换 ---------------- */

function normalizeTrans(item) {
  if (!item) return null;
  if (typeof item === "string") return item;
  if (typeof item === "object") {
    return (
      item.tranCn ||
      item.translation ||
      item.meaning ||
      item.trans ||
      item.pos ||
      null
    );
  }
  return null;
}

function collectTrans(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.flatMap((x) => {
      if (x && typeof x === "object" && !Array.isArray(x)) {
        // 嵌套 { pos, tranCn } 形式
        const pos = x.pos ? `${x.pos} ` : "";
        const v = normalizeTrans(x);
        return v ? [String(pos + v).trim()] : [];
      }
      const v = normalizeTrans(x);
      return v ? [String(v)] : [];
    });
  }
  const single = normalizeTrans(raw);
  return single ? [String(single)] : [];
}

function cleanPhonetic(p) {
  if (!p) return "";
  const s = String(p).trim();
  if (!s) return "";
  return `/${s.replace(/^\/+|\/+$/g, "")}/`;
}

function extractPos(meaning) {
  const m = meaning.match(POS_PATTERN);
  return m ? m[0].trim().replace(/\s+$/, "") : "";
}

function convertEntry(entry, bookId, seq) {
  if (!entry || typeof entry !== "object") return null;

  const word = String(
    entry.name || entry.word || entry.headWord || ""
  ).trim();
  if (!word) return null;

  const trans = [
    ...collectTrans(entry.trans),
    ...collectTrans(entry.translation),
    ...collectTrans(entry.meanings),
  ];
  const seen = new Set();
  const dedup = trans.filter((t) => {
    const k = t.trim();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (!dedup.length) return null;

  const meaning = dedup.join("；");

  // 例句
  let example = "";
  let exampleZh = "";
  const ex = entry.sentence || entry.example || entry.sampleSentence;
  if (typeof ex === "string") example = ex.trim();
  else if (ex && typeof ex === "object") {
    example = String(ex.sentence || ex.en || "").trim();
    exampleZh = String(ex.translation || ex.zh || "").trim();
  }
  if (!exampleZh && typeof entry.sentenceTranslation === "string") {
    exampleZh = entry.sentenceTranslation.trim();
  }

  return {
    id: `${bookId}_${String(seq).padStart(5, "0")}`,
    word,
    phonetic: cleanPhonetic(
      entry.usphone || entry.ukphone || entry.phonetic || ""
    ),
    pos: extractPos(meaning) || "—",
    meaning,
    example: example ? example.slice(0, 240) : "",
    exampleZh: exampleZh ? exampleZh.slice(0, 240) : "",
    tags: [],
    bookId,
  };
}

function parseDictFile(text) {
  const clean = text.replace(/^\uFEFF/, "").trim();
  const data = JSON.parse(clean);
  if (Array.isArray(data)) return data;
  for (const k of ["words", "list", "data", "headwords", "vocabulary"]) {
    if (Array.isArray(data[k])) return data[k];
  }
  return [];
}

/* ---------------- 分类封面 ---------------- */

const CATEGORY_EMOJI = {
  中国考试: "📘",
  国际考试: "🌍",
  英语词典: "📖",
  青少年英语: "🧒",
  专业词汇: "🎓",
  代码练习: "💻",
  日语学习: "🗾",
  德语学习: "🇩🇪",
  印尼语: "🇮🇩",
  哈萨克语: "🇰🇿",
  测试: "🧪",
  其他: "📚",
};

/* ---------------- 主流程 ---------------- */

async function main() {
  if (!existsSync(DICT_TS)) {
    console.error(`✗ 未找到 ${DICT_TS}`);
    process.exit(1);
  }
  if (!existsSync(DICT_DIR)) {
    console.error(`✗ 未找到 ${DICT_DIR}`);
    process.exit(1);
  }

  const index = await parseDictionaryIndex();
  console.log(`解析到 ${index.length} 个词库条目\n`);

  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(MANIFEST_DIR, { recursive: true });

  const manifest = [];
  const summary = [];
  let ok = 0;
  let skipped = 0;

  for (const item of index) {
    if (ONLY && !ONLY.has(item.id)) continue;

    const filePath = join(DICT_DIR, item.url);
    if (!existsSync(filePath)) {
      skipped += 1;
      console.warn(`⚠ 跳过 ${item.id}：源文件不存在 ${item.url}`);
      continue;
    }

    let parsed;
    try {
      parsed = parseDictFile(await readFile(filePath, "utf8"));
    } catch (e) {
      skipped += 1;
      console.warn(`⚠ 跳过 ${item.id}：解析失败 ${e.message}`);
      continue;
    }

    const seen = new Set();
    const words = [];
    for (const entry of parsed) {
      const converted = convertEntry(entry, item.id, words.length + 1);
      if (!converted) continue;
      const key = converted.word.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      words.push(converted);
    }

    if (!words.length) {
      skipped += 1;
      console.warn(`⚠ 跳过 ${item.id}：转换出 0 词`);
      continue;
    }

    const payload = {
      id: item.id,
      name: item.name,
      description: item.description,
      level: item.category,
      cover: CATEGORY_EMOJI[item.category] || "📚",
      category: item.category,
      language: item.language,
      words,
    };

    const serialized = JSON.stringify(payload);
    await writeFile(join(OUT_DIR, `${item.id}.json`), serialized, "utf8");

    manifest.push({
      id: item.id,
      name: item.name,
      description: item.description,
      level: item.category,
      category: item.category,
      language: item.language,
      cover: CATEGORY_EMOJI[item.category] || "📚",
      wordCount: words.length,
    });

    summary.push({ id: item.id, name: item.name, count: words.length });
    ok += 1;

    if (ok % 25 === 0) {
      process.stdout.write(`  已处理 ${ok} 本...\n`);
    }
  }

  // manifest 排序：按分类聚合，分类内按名称
  const catOrder = Object.keys(CATEGORY_EMOJI);
  manifest.sort((a, b) => {
    const ai = catOrder.indexOf(a.category);
    const bi = catOrder.indexOf(b.category);
    if (ai !== bi) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
    return a.name.localeCompare(b.name, "zh");
  });

  // manifest 同时写两处：
  //   public/wordbooks/  运行时静态分发（如需前端直接读）
  //   data/wordbooks/    构建期被 lib/dicts/loader.ts import（首屏词书列表）
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(join(OUT_DIR, "manifest.json"), manifestJson, "utf8");
  await writeFile(join(MANIFEST_DIR, "manifest.json"), manifestJson, "utf8");

  const total = summary.reduce((a, b) => a + b.count, 0);
  console.log(`\n${"=".repeat(50)}`);
  console.log(`✓ 成功导入 ${ok} 本词书，共 ${total.toLocaleString()} 词`);
  if (skipped) console.log(`⚠ 跳过 ${skipped} 本`);
  console.log(`✓ manifest.json 已生成（${manifest.length} 条）`);
  console.log(`输出目录：${OUT_DIR}`);

  // 分类统计
  const byCat = {};
  for (const s of summary) {
    const it = index.find((x) => x.id === s.id);
    const c = it ? it.category : "其他";
    byCat[c] = byCat[c] || { books: 0, words: 0 };
    byCat[c].books += 1;
    byCat[c].words += s.count;
  }
  console.log("\n分类统计：");
  for (const [c, v] of Object.entries(byCat)) {
    console.log(`  ${c}: ${v.books} 本 / ${v.words.toLocaleString()} 词`);
  }
}

main().catch((e) => {
  console.error("✗ 执行失败：", e);
  process.exit(1);
});
