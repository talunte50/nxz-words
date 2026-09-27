#!/usr/bin/env node
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { BOOKS, OUT_DIR, RAW_DIR, pickSources } from "./dict-config.mjs";

const POS_PATTERN = /^(?:(?:[a-z]{1,6}\.\s*)+)/i;

function normalizeTrans(item) {
  if (!item) return null;
  if (typeof item === "string") return item;
  if (typeof item === "object") {
    return item.tranCn || item.translation || item.meaning || item.trans || null;
  }
  return null;
}

function collectTrans(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(normalizeTrans).filter(Boolean).map(String);
  }
  const single = normalizeTrans(raw);
  return single ? [String(single)] : [];
}

function normalizeWord(entry) {
  if (!entry || typeof entry !== "object") return null;
  const word = String(entry.name || entry.word || entry.headWord || "").trim();
  if (!word || /[^a-zA-Z'’\-\s.]/.test(word)) return null;

  // 合并多个可能的释义来源，去重
  const mergedTrans = [
    ...collectTrans(entry.trans),
    ...collectTrans(entry.translation),
    ...collectTrans(entry.meanings),
  ];
  const seenMeaning = new Set();
  const trans = mergedTrans.filter((t) => {
    if (seenMeaning.has(t)) return false;
    seenMeaning.add(t);
    return true;
  });
  if (!trans.length) return null;

  const rawPhonetic = String(
    entry.usphone || entry.ukphone || entry.phonetic || entry.usPhonetic || "",
  ).trim();

  const rawExample = entry.sentence || entry.example || entry.sampleSentence || "";
  let example = "";
  let exampleZh = "";
  if (typeof rawExample === "string") {
    example = rawExample.trim();
  } else if (rawExample && typeof rawExample === "object") {
    example = String(rawExample.sentence || rawExample.en || "").trim();
    exampleZh = String(rawExample.translation || rawExample.zh || "").trim();
  }
  // 若 source 顶层带独立的中文例句/释义翻译字段，补充 exampleZh
  if (!exampleZh && typeof entry.exampleZh === "string" && entry.exampleZh.trim()) exampleZh = entry.exampleZh.trim();
  if (!exampleZh && entry.sentenceTranslation && typeof entry.sentenceTranslation === "string") exampleZh = entry.sentenceTranslation.trim();

  return { word, trans, phonetic: rawPhonetic, example, exampleZh };
}

function extractPos(meaning) {
  const match = meaning.match(POS_PATTERN);
  return match ? match[0].trim() : "";
}

function parseRawDict(text) {
  const clean = text.replace(/^\uFEFF/, "").trim();
  const data = JSON.parse(clean);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.words)) return data.words;
  if (Array.isArray(data.list)) return data.list;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.headwords)) return data.headwords;
  if (Array.isArray(data.vocabulary)) return data.vocabulary;
  return [];
}

async function main() {
  const rawDir = resolve(process.cwd(), RAW_DIR);
  const outDir = resolve(process.cwd(), OUT_DIR);

  if (!existsSync(rawDir)) {
    console.error(`✗ 未找到 ${RAW_DIR}/ 目录，请先执行： npm run dicts:fetch`);
    process.exit(1);
  }

  const rawFiles = await readdir(rawDir);
  await mkdir(outDir, { recursive: true });

  const summary = [];

  for (const book of BOOKS) {
    const sources = pickSources(book, rawFiles);
    const seen = new Set();
    const words = [];

    for (const fileName of sources) {
      let parsed;
      try {
        parsed = parseRawDict(await readFile(join(rawDir, fileName), "utf8"));
      } catch (error) {
        console.warn(`  ⚠ 跳过 ${fileName}：${error.message}`);
        continue;
      }
      for (const entry of parsed) {
        const normalized = normalizeWord(entry);
        if (!normalized) continue;
        const key = normalized.word.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const meaning = normalized.trans.join("；");
        words.push({
          id: `${book.id}_${String(words.length + 1).padStart(5, "0")}`,
          word: normalized.word,
          phonetic: normalized.phonetic ? `/${normalized.phonetic.replace(/^\/|\/$/g, "")}/` : "",
          pos: extractPos(meaning) || "—",
          meaning,
          example: normalized.example ? String(normalized.example).slice(0, 240) : "",
          exampleZh: normalized.exampleZh ? String(normalized.exampleZh).slice(0, 240) : "",
          tags: [],
          bookId: book.id,
        });
        if (words.length >= book.limit) break;
      }
      if (words.length >= book.limit) break;
    }

    const payload = {
      id: book.id,
      name: book.name,
      description: book.description,
      level: book.level,
      cover: book.cover,
      words,
    };

    const serialized = JSON.stringify(payload);
    await writeFile(join(outDir, `${book.id}.json`), serialized, "utf8");
    const sizeKb = (Buffer.byteLength(serialized) / 1024).toFixed(0);
    summary.push({ id: book.id, count: words.length, sources: sources.length, sizeKb });

    if (!sources.length) {
      console.warn(`⚠ ${book.name}（${book.id}）未匹配到源文件，请检查 scripts/dict-config.mjs`);
    } else if (!words.length) {
      console.warn(`⚠ ${book.name}（${book.id}）转换出 0 个单词，源文件结构可能不兼容`);
    } else {
      console.log(`✓ ${book.name}：${words.length} 词，来源 ${sources.length} 个文件，${sizeKb} KB`);
    }
  }

  const manifest = BOOKS.map((book) => {
    const found = summary.find((item) => item.id === book.id);
    return {
      id: book.id,
      name: book.name,
      description: book.description,
      level: book.level,
      cover: book.cover,
      wordCount: found?.count ?? 0,
    };
  });
  await writeFile(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const total = summary.reduce((acc, item) => acc + item.count, 0);
  console.log(`\n全部完成：${BOOKS.length} 本词书，共 ${total} 词`);
  console.log("已生成 manifest.json（词书列表接口据此免加载全量词库）");
  console.log("输出目录：", OUT_DIR);
  console.log("下一步执行： npm run typecheck && npm run build");
}

main().catch((error) => {
  console.error("✗ 执行失败：", error.message);
  process.exit(1);
});