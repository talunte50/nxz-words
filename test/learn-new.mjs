const BASE = "http://localhost:3000";

async function loginCookie() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "smokeuser", password: "password123" }),
  });
  return res.headers.get("set-cookie")?.split(";")[0] || "";
}

const cookie = await loginCookie();

// 抽查新 6 本的 learn 能否动态 import 并返回带中文释义的词
const newBooks = ["ielts", "toefl", "kaoyan", "gre", "nce", "topwords"];
let allOk = true;
for (const bookId of newBooks) {
  const res = await fetch(`${BASE}/api/learn?bookId=${bookId}&limit=3`, {
    headers: { Cookie: cookie },
  });
  const json = await res.json();
  if (!json.ok) {
    console.log(`FAIL  ${bookId}: 接口 ${res.status} ${json.error}`);
    allOk = false;
    continue;
  }
  const items = json.data.items || [];
  const sample = items[0]?.word;
  const zhOk = sample && /[\u4e00-\u9fff]/.test(sample.meaning || "");
  if (!items.length || !zhOk) allOk = false;
  console.log(
    `${zhOk && items.length ? "PASS" : "FAIL"}  ${bookId}  total=${json.data.total} 样例=${sample?.word} 释义=${(sample?.meaning || "").slice(0, 20)}`,
  );
}
console.log(allOk ? "\n✅ 新 6 本 learn 均可取词且带中文释义" : "\n❌ 存在异常");
process.exit(allOk ? 0 : 1);