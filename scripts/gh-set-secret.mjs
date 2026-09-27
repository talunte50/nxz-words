#!/usr/bin/env node
/**
 * gh-set-secret.mjs — 通过 GitHub REST API 写入 Actions 加密 Secret
 *
 * 为什么不用 gh CLI：本机受限环境里 gh 未登录 / 不可用。
 * GitHub 的 repo secret 使用 libsodium sealed box（X25519 + blake2b）加密，
 * Node 内置 crypto 没有 blake2b，所以必须依赖 libsodium-wrappers。
 *
 * 依赖（已装在隔离工作区，不污染项目）：
 *   C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules
 *
 * 用法：
 *   NODE_PATH=<workspace>/node_modules node scripts/gh-set-secret.mjs \
 *     <owner/repo> <GH_TOKEN> <SECRET_NAME> <SECRET_VALUE>
 */

import { createRequire } from "node:module";

// 清掉代理，否则 GitHub 请求会被内网代理劫持成 000
for (const k of [
  "http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY",
  "all_proxy", "ALL_PROXY",
]) {
  delete process.env[k];
}

const [, , repoSlug, token, secretName, secretValue] = process.argv;
if (!repoSlug || !token || !secretName || secretValue === undefined) {
  console.error(
    "用法: node scripts/gh-set-secret.mjs <owner/repo> <GH_TOKEN> <NAME> <VALUE>"
  );
  process.exit(2);
}

const WS = "C:/Users/Administrator/.workbuddy/binaries/node/workspace";
const require = createRequire(WS + "/");
const _sodium = require("libsodium-wrappers");

const API = "https://api.github.com";
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "nxz-words-deploy",
};

async function gh(path, init = {}) {
  const res = await fetch(API + path, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, json, text };
}

await _sodium.ready;
const sodium = _sodium;

// 1. 取仓库公钥
const pk = await gh(`/repos/${repoSlug}/actions/secrets/public-key`);
if (!pk.ok) {
  console.error(`❌ 获取公钥失败 [${pk.status}] ${pk.text.slice(0, 300)}`);
  process.exit(1);
}
const { key, key_id } = pk.json;

// 2. sealed box 加密
const keyBytes = sodium.from_base64(key, sodium.base64_variants.ORIGINAL);
const msgBytes = sodium.from_string(secretValue);
const encBytes = sodium.crypto_box_seal(msgBytes, keyBytes);
const encrypted_value = sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);

// 3. 上传
const put = await gh(`/repos/${repoSlug}/actions/secrets/${secretName}`, {
  method: "PUT",
  body: JSON.stringify({ encrypted_value, key_id }),
});

if (put.ok || put.status === 201 || put.status === 204) {
  console.log(`✅ Secret ${secretName} 已写入 ${repoSlug}`);
} else {
  console.error(`❌ 写入失败 [${put.status}] ${put.text.slice(0, 400)}`);
  process.exit(1);
}

// 4. 回读确认（列表里只显示名字与更新时间，值不可读）
const list = await gh(`/repos/${repoSlug}/actions/secrets`);
if (list.ok) {
  const names = (list.json.secrets || []).map((s) => s.name);
  console.log(`📋 当前仓库 secrets: ${names.length ? names.join(", ") : "(空)"}`);
}
