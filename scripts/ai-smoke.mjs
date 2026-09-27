#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(file) {
  const result = {};
  for (const name of [file, ".env.local", ".env"]) {
    try {
      const raw = readFileSync(resolve(process.cwd(), name), "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const index = trimmed.indexOf("=");
        if (index === -1) continue;
        const key = trimmed.slice(0, index).trim();
        const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
        if (!(key in result)) result[key] = value;
      }
    } catch {
      /* 文件不存在则跳过 */
    }
  }
  return result;
}

const env = { ...loadEnv(".env.local"), ...process.env };
const baseUrl = (env.AI_BASE_URL || "").replace(/\/+$/, "");
const apiKey = env.AI_API_KEY || "";
const model = env.AI_MODEL || "";

const mode = process.argv[2] || "direct";
const appUrl = (env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");

function mask(secret) {
  if (!secret || secret.length < 8) return "(未设置)";
  return `${secret.slice(0, 4)}****${secret.slice(-4)}`;
}

async function directStream() {
  if (!baseUrl || !apiKey || !model) {
    console.error("✗ 缺少配置：请在 .env.local 中填写 AI_BASE_URL / AI_API_KEY / AI_MODEL");
    process.exit(1);
  }
  console.log("→ 直连测试：", `${baseUrl}/chat/completions`);
  console.log("  model =", model, "| key =", mask(apiKey));

  const started = Date.now();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [{ role: "user", content: "用一句话解释 abandon 这个词" }],
    }),
  });

  if (!res.ok || !res.body) {
    console.error(`✗ HTTP ${res.status}:`, (await res.text()).slice(0, 400));
    process.exit(1);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let chunks = 0;

  process.stdout.write("  流式输出: ");
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
        if (delta) {
          text += delta;
          chunks += 1;
          process.stdout.write(delta);
        }
      } catch {
        /* 忽略非 JSON 心跳行 */
      }
    }
  }
  console.log("\n");
  console.log(`✓ 流式成功：${chunks} 个分片，${text.length} 字，耗时 ${Date.now() - started} ms`);
  if (chunks <= 1) {
    console.log("⚠ 只收到 1 个分片，可能未真正流式返回（检查服务商是否支持 stream）");
  }
}

async function appCheck() {
  console.log("→ 端到端测试：", `${appUrl}/api/ai/explain`);
  console.log("  （请确保已执行 npm run dev 或 npm run start）");
  try {
    const res = await fetch(`${appUrl}/api/ai/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: "abandon", level: "CET4" }),
    });
    const json = await res.json();
    if (!json?.ok) {
      console.error("✗ 应用返回异常:", JSON.stringify(json).slice(0, 300));
      process.exit(1);
    }
    console.log("  aiEnabled =", json.data.aiEnabled, "| cached =", json.data.cached);
    console.log("  释义 =", json.data.explanation?.translation);
    console.log("  例句数 =", json.data.explanation?.examples?.length ?? 0);
    if (!json.data.aiEnabled) {
      console.log("⚠ 应用未启用 AI（未读到 AI_API_KEY），当前返回的是演示数据");
    } else {
      console.log("✓ 端到端链路正常");
    }
  } catch (error) {
    console.error("✗ 请求失败:", error.message);
    process.exit(1);
  }
}

async function appChatStream() {
  console.log("→ 端到端流式测试：", `${appUrl}/api/ai/chat`);
  console.log("  注意：该接口需要登录 Cookie，未登录会返回 401");
  try {
    const res = await fetch(`${appUrl}/api/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Hello, let's practice." }] }),
    });
    if (res.status === 401) {
      console.log("  401：未携带登录 Cookie，这属于预期行为，请改用 direct 模式验证模型连通性");
      return;
    }
    const text = await res.text();
    console.log("  响应片段:", text.slice(0, 200));
  } catch (error) {
    console.error("✗ 请求失败:", error.message);
  }
}

const runners = { direct: directStream, app: appCheck, chat: appChatStream };
const runner = runners[mode];
if (!runner) {
  console.error("用法: node scripts/ai-smoke.mjs [direct|app|chat]");
  process.exit(1);
}
await runner();