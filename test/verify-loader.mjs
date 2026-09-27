// 验证新的词书加载器：磁盘读取路径 + 最长前缀匹配
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const PUB = path.join(ROOT, "public", "wordbooks");

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "data/wordbooks/manifest.json"), "utf8"));
const ids = manifest.map((m) => m.id);
const byLen = [...ids].sort((a, b) => b.length - a.length);

function bookIdFromWordId(wordId) {
  if (!wordId) return "";
  for (const id of byLen) if (wordId.startsWith(id + "_")) return id;
  const at = wordId.indexOf("_");
  return at > 0 ? wordId.slice(0, at) : "";
}

const checks = [];
const t = (name, ok, extra = "") => checks.push({ name, ok: !!ok, extra });

// 1. public/wordbooks 齐全（368 本 + manifest）
const pubFiles = fs.readdirSync(PUB).filter((f) => f.endsWith(".json"));
t("public/wordbooks 含 manifest", pubFiles.includes("manifest.json"));
t("public/wordbooks 词书数 = 368", pubFiles.length - 1 === 368, `实际 ${pubFiles.length - 1}`);

// 2. 每本 manifest 里的书在 public 下都有文件
const missing = ids.filter((id) => !fs.existsSync(path.join(PUB, `${id}.json`)));
t("所有 manifest 词书都有静态文件", missing.length === 0, `缺失 ${missing.length}: ${missing.slice(0, 5).join(", ")}`);

// 3. 抽查若干本可通过磁盘读取且结构正确（含真实含下划线的 id）
const samples = ["cet4", "cet6", "kaoyan_2024", "dancimimi_1", "coca_20000", "frequently_used_words01"];
for (const id of samples) {
  const p = path.join(PUB, `${id}.json`);
  if (!fs.existsSync(p)) {
    t(`读取 ${id}`, false, "文件不存在");
    continue;
  }
  try {
    const b = JSON.parse(fs.readFileSync(p, "utf8"));
    t(`读取 ${id}`, b && Array.isArray(b.words) && b.words.length > 0, `words=${b?.words?.length}`);
  } catch (e) {
    t(`读取 ${id}`, false, e.message.slice(0, 50));
  }
}

// 4. 最长前缀匹配（含下划线书 id 的关键回归）
t("bookIdFromWordId(cet4_00001) = cet4", bookIdFromWordId("cet4_00001") === "cet4");
t(
  "bookIdFromWordId(kaoyan_2024_00001) = kaoyan_2024",
  bookIdFromWordId("kaoyan_2024_00001") === "kaoyan_2024",
  bookIdFromWordId("kaoyan_2024_00001"),
);
t(
  "bookIdFromWordId(frequently_used_words01_00001) = frequently_used_words01",
  bookIdFromWordId("frequently_used_words01_00001") === "frequently_used_words01",
  bookIdFromWordId("frequently_used_words01_00001"),
);
t("bookIdFromWordId(空) = ''", bookIdFromWordId("") === "");

// 4b. 前缀冲突场景（构造数据，验证「最长优先」语义正确）
{
  const conflictIds = ["ab", "ab_cd"];
  const byLen2 = [...conflictIds].sort((a, b) => b.length - a.length);
  const pick = (wid) => {
    for (const id of byLen2) if (wid.startsWith(id + "_")) return id;
    return "";
  };
  t("最长优先：ab_cd_1 → ab_cd", pick("ab_cd_1") === "ab_cd", pick("ab_cd_1"));
}

// 5. loader.ts 不再使用动态 import（关键：这是构建超限的根因）
const loader = fs.readFileSync(path.join(ROOT, "lib/dicts/loader.ts"), "utf8");
t("loader 不再动态 import JSON", !/await import\(`.*wordbooks/.test(loader));
t("loader 改为磁盘读取", /readFile/.test(loader) && /public.*wordbooks/.test(loader));

// 6. 详情页不再预生成 368 页
const detail = fs.readFileSync(path.join(ROOT, "app/wordbooks/[id]/page.tsx"), "utf8");
t("详情页移除 generateStaticParams", !/generateStaticParams/.test(detail));
t("详情页改为动态渲染", /force-dynamic/.test(detail));

// 7. .gitignore 不应忽略 public/wordbooks（必须入库分发）
const gi = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
t("public/wordbooks 未被 gitignore", !/public\/wordbooks/.test(gi) && !/^public$/m.test(gi));

// 8. data/wordbooks 只保留 manifest（去重）
const dataFiles = fs.readdirSync(path.join(ROOT, "data", "wordbooks"));
t("data/wordbooks 仅剩 manifest.json", dataFiles.length === 1 && dataFiles[0] === "manifest.json", dataFiles.join(","));

let pass = 0, fail = 0;
for (const c of checks) {
  console.log(`${c.ok ? "✅" : "❌"} ${c.name}${c.ok ? "" : "  ← " + c.extra}`);
  c.ok ? pass++ : fail++;
}
console.log(`\n通过 ${pass}/${checks.length}${fail ? `，失败 ${fail}` : ""}`);
process.exit(fail ? 1 : 0);
