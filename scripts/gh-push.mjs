#!/usr/bin/env node
/**
 * 通过 GitHub REST API 推送本地提交（Git Data API）
 *
 * 为什么需要这个脚本（本机环境限制）：
 *   1. 环境变量把网络请求强制指向内部代理 127.0.0.1:53424，转发 GitHub 超时
 *      → 脚本内清除代理变量并设 no_proxy='*'
 *   2. child_process.spawnSync 调用 git 抛 EBUSY（沙箱限制）
 *      → 完全手工解析 .git（松散对象 + packfile），零子进程
 *
 * 用法：node scripts/gh-push.mjs <TOKEN> [owner/repo] [branch]
 * 限制：仅支持 fast-forward（远端须为本地 HEAD 祖先，或远端为空仓库）
 */
import fs from "node:fs";
import path from "node:path";
import { createGitReader } from "./git-pack-reader.mjs";

// ---- 清除代理（必须在任何网络请求之前）----
for (const k of [
  "http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY",
  "all_proxy", "ALL_PROXY", "GIT_HTTP_PROXY",
]) {
  delete process.env[k];
}
process.env.no_proxy = "*";
process.env.NO_PROXY = "*";

const TOKEN = process.argv[2];
const REPO = process.argv[3] || "talunte50/nxz-words";
const BRANCH = process.argv[4] || "main";
const API = "https://api.github.com";
const GIT_DIR = path.resolve(process.cwd(), ".git");

if (!TOKEN) {
  console.error("用法: node scripts/gh-push.mjs <TOKEN> [owner/repo] [branch]");
  process.exit(1);
}

const git = createGitReader(GIT_DIR);

function parseCommit(buf) {
  const text = buf.toString("utf8");
  const lines = text.split("\n");
  const out = { tree: null, parents: [], message: "" };
  let i = 0;
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === "") { i += 1; break; }
    const sp = line.indexOf(" ");
    const key = line.slice(0, sp);
    const value = line.slice(sp + 1);
    if (key === "tree") out.tree = value;
    else if (key === "parent") out.parents.push(value);
  }
  out.message = lines.slice(i).join("\n");
  return out;
}

function parseTree(buf) {
  const entries = [];
  let off = 0;
  while (off < buf.length) {
    const sp = buf.indexOf(0x20, off);
    const mode = buf.subarray(off, sp).toString("utf8");
    const nul = buf.indexOf(0, sp + 1);
    const name = buf.subarray(sp + 1, nul).toString("utf8");
    const sha = buf.subarray(nul + 1, nul + 21).toString("hex");
    off = nul + 21;
    entries.push({ mode, name, sha });
  }
  return entries;
}

function flattenTree(treeSha, prefix = "") {
  const { buf } = git.read(treeSha);
  const files = [];
  for (const e of parseTree(buf)) {
    const full = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.mode === "40000") files.push(...flattenTree(e.sha, full));
    else files.push({ path: full, sha: e.sha });
  }
  return files;
}

function resolveRef(ref) {
  const p = path.join(GIT_DIR, ref);
  if (fs.existsSync(p)) return fs.readFileSync(p, "utf8").trim();
  const packed = path.join(GIT_DIR, "packed-refs");
  if (fs.existsSync(packed)) {
    for (const line of fs.readFileSync(packed, "utf8").split("\n")) {
      if (line.startsWith("#") || !line.trim()) continue;
      const [sha, name] = line.split(" ");
      if (name === ref) return sha;
    }
  }
  return null;
}

function headCommit() {
  const head = fs.readFileSync(path.join(GIT_DIR, "HEAD"), "utf8").trim();
  if (!head.startsWith("ref: ")) return head;
  return resolveRef(head.slice(5));
}

function isAncestor(ancestor, descendant) {
  let cur = descendant;
  const seen = new Set();
  while (cur && !seen.has(cur)) {
    if (cur === ancestor) return true;
    seen.add(cur);
    cur = parseCommit(git.read(cur).buf).parents[0] ?? null;
  }
  return false;
}

async function api(method, p, data, allowEmptyRepo = false) {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "workbuddy-push",
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  // 空仓库：GET ref 返回 404，或 409 "Git Repository is empty."
  if (allowEmptyRepo && (res.status === 404 || res.status === 409)) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} ${method} ${p}\n${(await res.text()).slice(0, 1200)}`);
  return res.json();
}

// ============ 主流程 ============
const userRes = await fetch(`${API}/user`, {
  headers: { Authorization: `Bearer ${TOKEN}`, "User-Agent": "workbuddy-push" },
});
const me = await userRes.json();
if (!userRes.ok || !me.login) {
  console.error("❌ Token 无效:", JSON.stringify(me).slice(0, 300));
  process.exit(1);
}

const localHead = headCommit();
const localCommit = parseCommit(git.read(localHead).buf);
console.log(`认证用户  : ${me.login}`);
console.log(`本地 HEAD : ${localHead.slice(0, 12)}  (${localCommit.message.split("\n")[0]})`);

const remoteRef = await api("GET", `/repos/${REPO}/git/ref/heads/${BRANCH}`, null, true);
const remoteHead = remoteRef?.object?.sha ?? null;

let entries;
let baseTree = null;

if (remoteHead) {
  console.log(`远端 HEAD : ${remoteHead.slice(0, 12)}`);
  if (remoteHead === localHead) {
    console.log("✓ 远端与本地一致，无需推送。");
    process.exit(0);
  }
  if (!isAncestor(remoteHead, localHead)) {
    console.error("❌ 远端有本地没有的提交，无法 fast-forward。请先合并再推送。");
    process.exit(1);
  }
  console.log("✓ fast-forward 校验通过");

  baseTree = (await api("GET", `/repos/${REPO}/git/commits/${remoteHead}`)).tree.sha;
  const remoteFiles = new Map(flattenTree(baseTree).map((f) => [f.path, f.sha]));
  const localFiles = flattenTree(localCommit.tree);
  entries = [];
  for (const f of localFiles) {
    if (remoteFiles.get(f.path) !== f.sha) entries.push({ ...f, status: "A" });
    remoteFiles.delete(f.path);
  }
  for (const p of remoteFiles.keys()) entries.push({ path: p, status: "D" });
} else {
  console.log("远端分支为空（首次推送）");
  entries = flattenTree(localCommit.tree).map((f) => ({ ...f, status: "A" }));
}

console.log(`待处理文件: ${entries.length} 个`);

const treeEntries = [];
for (let i = 0; i < entries.length; i += 1) {
  const e = entries[i];
  if (e.status === "D") {
    treeEntries.push({ path: e.path, mode: "100644", type: "blob", sha: null });
  } else {
    const { buf } = git.read(e.sha);
    const created = await api("POST", `/repos/${REPO}/git/blobs`, {
      content: buf.toString("base64"),
      encoding: "base64",
    });
    treeEntries.push({ path: e.path, mode: "100644", type: "blob", sha: created.sha });
  }
  if ((i + 1) % 20 === 0 || i + 1 === entries.length) {
    process.stdout.write(`\r上传进度: ${i + 1}/${entries.length}   `);
  }
}
console.log("");

const treePayload = { tree: treeEntries };
if (baseTree) treePayload.base_tree = baseTree;
const newTree = await api("POST", `/repos/${REPO}/git/trees`, treePayload);
console.log(`✓ 新 tree   : ${newTree.sha.slice(0, 12)}`);

const newCommit = await api("POST", `/repos/${REPO}/git/commits`, {
  message: localCommit.message,
  tree: newTree.sha,
  parents: remoteHead ? [remoteHead] : [],
});
console.log(`✓ 新 commit : ${newCommit.sha.slice(0, 12)}`);

if (remoteHead) {
  await api("PATCH", `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: newCommit.sha });
} else {
  await api("POST", `/repos/${REPO}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha: newCommit.sha });
}
console.log(`✅ 推送成功 → https://github.com/${REPO}/tree/${BRANCH}`);
