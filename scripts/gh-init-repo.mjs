/**
 * 用 Contents API 往空仓库写入一个占位提交，使仓库脱离 "empty" 状态。
 * 之后 Git Data API（blobs/trees/commits）才可用。
 * 用法: node scripts/gh-init-repo.mjs <TOKEN> <owner/repo> [branch]
 */
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

if (!TOKEN) {
  console.error("用法: node scripts/gh-init-repo.mjs <TOKEN> <owner/repo> [branch]");
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/vnd.github+json",
  "User-Agent": "workbuddy-init",
  "Content-Type": "application/json",
};

// 检查是否已非空
const info = await (await fetch(`https://api.github.com/repos/${REPO}`, { headers })).json();
console.log(`仓库: ${info.full_name}  size=${info.size}`);

const probe = await fetch(`https://api.github.com/repos/${REPO}/git/ref/heads/${BRANCH}`, { headers });
if (probe.ok) {
  console.log("✓ 仓库已有提交，无需初始化。");
  process.exit(0);
}

const res = await fetch(`https://api.github.com/repos/${REPO}/contents/.gitkeep`, {
  method: "PUT",
  headers,
  body: JSON.stringify({
    message: "chore: initialize repository",
    content: Buffer.from("").toString("base64"),
    branch: BRANCH,
  }),
});
const data = await res.json();
if (!res.ok) {
  console.error(`❌ 初始化失败 HTTP ${res.status}:`, JSON.stringify(data).slice(0, 500));
  process.exit(1);
}
console.log(`✓ 初始化成功，首个 commit: ${data.commit.sha.slice(0, 12)}`);
