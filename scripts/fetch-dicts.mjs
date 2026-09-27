#!/usr/bin/env node
import { mkdir, writeFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { BOOKS, BRANCH, RAW_DIR, REPO, pickSources } from "./dict-config.mjs";

const API_URL = `https://api.github.com/repos/${REPO}/contents/public/dicts?ref=${BRANCH}`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/public/dicts`;

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const headers = { "User-Agent": "edgeone-vocab-dict-fetcher", Accept: "application/vnd.github+json" };
if (token) headers.Authorization = `Bearer ${token}`;

async function fetchWithRetry(url, options = {}, retries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
      if (res.status === 403 || res.status === 429) {
        throw new Error(`触发了 GitHub 限流 (HTTP ${res.status})，请设置 GITHUB_TOKEN 环境变量后重试`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      return res;
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const wait = attempt * 1500;
        console.warn(`  · 第 ${attempt} 次失败（${error.message}），${wait}ms 后重试…`);
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastError;
}

async function listDictFiles() {
  console.log("→ 读取 GitHub 词库目录…");
  const res = await fetchWithRetry(API_URL);
  const list = await res.json();
  if (!Array.isArray(list)) throw new Error("GitHub 返回格式异常，请稍后重试");
  return list.map((item) => item.name).filter(Boolean);
}

async function downloadOne(name, outDir) {
  const target = join(outDir, name);
  try {
    const info = await stat(target);
    if (info.size > 1024) {
      console.log(`  · 跳过已存在 ${name}（${(info.size / 1024).toFixed(0)} KB）`);
      return true;
    }
  } catch {
    /* 文件不存在，继续下载 */
  }
  const res = await fetchWithRetry(`${RAW_BASE}/${encodeURIComponent(name)}`);
  const text = await res.text();
  JSON.parse(text);
  await writeFile(target, text, "utf8");
  console.log(`  ✓ ${name}（${(Buffer.byteLength(text) / 1024).toFixed(0)} KB）`);
  return true;
}

async function main() {
  const outDir = resolve(process.cwd(), RAW_DIR);
  await mkdir(outDir, { recursive: true });

  const allNames = await listDictFiles();
  console.log(`  目录共 ${allNames.length} 个文件`);

  const plan = BOOKS.map((book) => ({ book, files: pickSources(book, allNames) }));

  let missing = 0;
  for (const { book, files } of plan) {
    if (!files.length) {
      missing += 1;
      console.warn(`⚠ ${book.name}（${book.id}）未匹配到任何源文件，请检查 scripts/dict-config.mjs 的 match 规则`);
    } else {
      console.log(`\n→ ${book.name}：命中 ${files.length} 个源文件`);
      console.log(`   ${files.join(", ")}`);
    }
  }

  console.log("\n→ 开始下载…");
  const wanted = new Set(plan.flatMap((entry) => entry.files));
  let ok = 0;
  let failed = 0;
  for (const name of wanted) {
    try {
      await downloadOne(name, outDir);
      ok += 1;
    } catch (error) {
      failed += 1;
      console.error(`  ✗ ${name} 下载失败：${error.message}`);
    }
  }

  console.log(`\n完成：成功 ${ok} 个，失败 ${failed} 个，未匹配词书 ${missing} 本`);
  console.log(`原始词库已保存到 ${RAW_DIR}/`);
  console.log("下一步执行： npm run dicts:build");
}

main().catch((error) => {
  console.error("✗ 执行失败：", error.message);
  process.exit(1);
});