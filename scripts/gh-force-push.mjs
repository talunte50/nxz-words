/**
 * 强制推送：忽略远端历史，直接把本地 HEAD 的完整 tree 发布到指定分支。
 * 用于远端只有自动生成的初始化 commit（如 Contents API 创建的 .gitkeep）的场景。
 *
 * 用法: node scripts/gh-force-push.mjs <TOKEN> <owner/repo> [branch]
 */
import fs from "node:fs";
import path from "node:path";
import { createGitReader } from "./git-pack-reader.mjs";

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
  console.error("用法: node scripts/gh-force-push.mjs <TOKEN> <owner/repo> [branch]");
  process.exit(1);
}

const git = createGitReader(GIT_DIR);

function parseCommit(buf) {
  const lines = buf.toString("utf8").split("\n");
  const out = { tree: null, parents: [], message: "" };
  let i = 0;
  for (; i < lines.length; i += 1) {
    if (lines[i] === "") { i += 1; break; }
    const sp = lines[i].indexOf(" ");
    const k = lines[i].slice(0, sp);
    const v = lines[i].slice(sp + 1);
    if (k === "tree") out.tree = v;
    else if (k === "parent") out.parents.push(v);
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

function flattenTree(sha, prefix = "") {
  const { buf } = git.read(sha);
  const files = [];
  for (const e of parseTree(buf)) {
    const full = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.mode === "40000") files.push(...flattenTree(e.sha, full));
    else files.push({ path: full, sha: e.sha });
  }
  return files;
}

function headCommit() {
  const head = fs.readFileSync(path.join(GIT_DIR, "HEAD"), "utf8").trim();
  if (!head.startsWith("ref: ")) return head;
  const refFile = path.join(GIT_DIR, head.slice(5));
  if (fs.existsSync(refFile)) return fs.readFileSync(refFile, "utf8").trim();
  for (const line of fs.readFileSync(path.join(GIT_DIR, "packed-refs"), "utf8").split("\n")) {
    if (line.startsWith("#") || !line.trim()) continue;
    const [sha, name] = line.split(" ");
    if (name === head.slice(5)) return sha;
  }
  throw new Error("无法解析 HEAD");
}

async function api(method, p, data) {
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
  if (!res.ok) throw new Error(`HTTP ${res.status} ${method} ${p}\n${(await res.text()).slice(0, 1200)}`);
  return res.json();
}

const me = await (await fetch(`${API}/user`, {
  headers: { Authorization: `Bearer ${TOKEN}`, "User-Agent": "workbuddy-push" },
})).json();
console.log(`认证用户  : ${me.login}`);

const localHead = headCommit();
const commit = parseCommit(git.read(localHead).buf);
console.log(`本地 HEAD : ${localHead.slice(0, 12)}  (${commit.message.split("\n")[0]})`);

const files = flattenTree(commit.tree);
console.log(`待上传文件: ${files.length} 个`);

const treeEntries = [];
for (let i = 0; i < files.length; i += 1) {
  const f = files[i];
  const { buf } = git.read(f.sha);
  const blob = await api("POST", `/repos/${REPO}/git/blobs`, {
    content: buf.toString("base64"),
    encoding: "base64",
  });
  treeEntries.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
  if ((i + 1) % 20 === 0 || i + 1 === files.length) {
    process.stdout.write(`\r上传进度: ${i + 1}/${files.length}   `);
  }
}
console.log("");

const tree = await api("POST", `/repos/${REPO}/git/trees`, { tree: treeEntries });
console.log(`✓ 新 tree   : ${tree.sha.slice(0, 12)}`);

// 无父提交（干净起点）；若远端已有 HEAD，把它作为父以保留历史连贯
let parents = [];
try {
  const ref = await (await fetch(`${API}/repos/${REPO}/git/ref/heads/${BRANCH}`, {
    headers: { Authorization: `Bearer ${TOKEN}`, "User-Agent": "workbuddy-push" },
  })).json();
  if (ref?.object?.sha) parents = [ref.object.sha];
} catch { /* 忽略 */ }

const newCommit = await api("POST", `/repos/${REPO}/git/commits`, {
  message: commit.message,
  tree: tree.sha,
  parents,
});
console.log(`✓ 新 commit : ${newCommit.sha.slice(0, 12)}`);

await api("PATCH", `/repos/${REPO}/git/refs/heads/${BRANCH}`, { sha: newCommit.sha, force: false });
console.log(`✅ 推送成功 → https://github.com/${REPO}/tree/${BRANCH}`);
