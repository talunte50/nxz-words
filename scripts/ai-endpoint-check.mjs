/**
 * 直连测试 AI 端点连通性（不依赖应用）。
 * 用法: node scripts/ai-endpoint-check.mjs <API_KEY> <BASE_URL> <MODEL>
 */
for (const k of ["http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY", "all_proxy", "ALL_PROXY"]) {
  delete process.env[k];
}
process.env.no_proxy = "*";
process.env.NO_PROXY = "*";

const KEY = process.argv[2];
const BASE = (process.argv[3] || "").replace(/\/$/, "");
const MODEL = process.argv[4];

const url = `${BASE}/chat/completions`;
console.log(`端点: ${url}`);
console.log(`模型: ${MODEL}`);
console.log(`Key : ${KEY.slice(0, 6)}...${KEY.slice(-4)}`);

const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: MODEL,
    messages: [{ role: "user", content: "只回复两个字：正常" }],
    max_tokens: 20,
    stream: false,
  }),
});

const text = await res.text();
console.log(`\nHTTP ${res.status}`);
if (res.ok) {
  try {
    const d = JSON.parse(text);
    console.log("回复:", d.choices?.[0]?.message?.content ?? JSON.stringify(d).slice(0, 300));
    console.log("用量:", JSON.stringify(d.usage ?? {}));
  } catch {
    console.log("原始响应:", text.slice(0, 400));
  }
} else {
  console.log("错误响应:", text.slice(0, 600));
}
