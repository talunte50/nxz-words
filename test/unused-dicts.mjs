import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { BOOKS } from "../scripts/dict-config.mjs";

const rawDir = "E:/madao/demo/data/raw";
const used = new Set();
for (const book of BOOKS) {
  const files = await readdir(rawDir);
  const picked = [];
  const seen = new Set();
  for (const name of files) {
    if (!name.toLowerCase().endsWith(".json")) continue;
    if (seen.has(name)) continue;
    if (book.match.some((p) => p.test(name))) {
      seen.add(name);
      picked.push(name);
    }
  }
  picked.forEach((n) => used.add(n));
}

const allFiles = await readdir(rawDir);
const unused = allFiles.filter((n) => !used.has(n));

const groups = {
  雅思: /IELTS|ielts/i,
  托福: /TOEFL|toefl/i,
  GRE: /GRE|gre/i,
  GMAT: /GMAT|gmat/i,
  SAT: /SAT/i,
  考研: /KaoYan|kaoyan|KaoYanShanGuo/i,
  专四: /PETS3|TEM4|zhuansi4|zhuan4/i,
  专八: /PETS_3|TEM8|zhuansi8/i,
  PETS: /PETS/i,
  新概念: /NCE|nce/i,
  星火桥基: /xinghuoqiaoji/i,
  外研: /waiyan|WaiYanShe|Newwaiyan/i,
  译林: /YiLin|yiLin/i,
  人教版: /PEP/i,
  牛津: /Oxford/i,
  麦克米伦: /Macmillan/i,
  朗文: /Longman/i,
  柯林斯: /Collins/i,
  多邻国: /Duolingo/i,
  EF: /EF_LEVEL/i,
  RAZ: /^raz/i,
  词源: /word_roots|roots/i,
  词缀: /suffix_word/i,
  高频词: /frequently_used|top2000|Top1000|Top1500|Top500|Top250|Top60|Top50|4000_Essential/i,
  高考阅读: /gaokao/i,
  医学: /BIOmedical|medic/i,
  AI: /ai_for_science|ai_machine/i,
  日语: /Jap|japanese/i,
  编程: /Child_|python|java|js-|go_|csharp|rust|linux|SQL/i,
  其他: null,
};

const categorized = {};
for (const name of unused) {
  let matched = false;
  for (const [label, re] of Object.entries(groups)) {
    if (re && re.test(name)) {
      (categorized[label] ||= []).push(name);
      matched = true;
      break;
    }
  }
  if (!matched) (categorized["其他"] ||= []).push(name);
}

console.log(`总文件数: ${allFiles.length}, 已使用: ${used.size}, 未使用: ${unused.length}\n`);
console.log("=== 未使用文件分类 ===\n");
for (const [label, files] of Object.entries(categorized)) {
  console.log(`${label} (${files.length}):`);
  for (const f of files) console.log(`  ${f}`);
  console.log("");
}