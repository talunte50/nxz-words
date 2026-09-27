// 千词级词库下的 API 冒烟测试：词书列表 / 首页学习 / cloze 判定
const BASE = "http://localhost:3000";

async function j(method, path, body, extraHeaders = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "Content-Type": "application/json", ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${String(data).slice(0, 300)}`);
  // 收集 Set-Cookie 以便后续请求带 session
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) globalThis.__cookie = setCookie.split(";")[0];
  return data;
}

function authHeaders() {
  return globalThis.__cookie ? { Cookie: globalThis.__cookie } : {};
}

const results = [];
function check(name, cond) {
  results.push([name, cond]);
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
}

try {
  // 1. 登录
  const me = await j("POST", "/api/auth/login", { username: "smokeuser", password: "password123" });
  check("login 返回 profile", !!me.profile || !!me.sessionId || !!me.ok);

  // 2. 词书列表：必须 7 本，wordCount 来自 manifest（不加载全量）
  const t0 = Date.now();
  const booksResp = await j("GET", "/api/wordbooks");
  const t1 = Date.now();
  const list = booksResp.data?.books || booksResp.books || booksResp;
  check("wordbooks 返回 13 本", list.length === 13);
  const counts = {};
  for (const b of list) counts[b.id] = b.wordCount;
  console.log("  wordCounts:", JSON.stringify(counts));
  check("各词书 wordCount>0", Object.values(counts).every((c) => c > 0));
  check("词书列表接口 <500ms（manifest 免加载）", t1 - t0 < 500);

  // 3. 首页学习：取 cet4 前 5 词
  const learnResp = await j("GET", "/api/learn?bookId=cet4&limit=5", undefined, authHeaders());
  const learnData = learnResp.data || learnResp;
  const items = learnData.items || learnData.words || learnData;
  const words = items.map((it) => it.word || it);
  check("learn(cet4,5) 返回 5 词", words.length === 5);
  check("词条含词/音标/释义", words[0].word && words[0].phonetic && words[0].meaning);

  // 4. cloze 判定（拼写模式等价：输入 word）
  const target = words[0];
  const okResp = await j("POST", "/api/quiz/check", { wordId: target.id, answer: target.word, type: "spelling" }, authHeaders());
  const ok = okResp.data || okResp;
  check("spell 答对判定正确", ok.correct === true);
  const badResp = await j("POST", "/api/quiz/check", { wordId: target.id, answer: "zzzz_wrong", type: "cloze" }, authHeaders());
  const bad = badResp.data || badResp;
  check("cloze 答错判定正确", bad.correct === false);

  // 5. stats / profile 不受影响
  const stats = await j("GET", "/api/stats", undefined, authHeaders());
  check("stats 可访问", !!stats);

  // 6. 随机抽查一本大词书（college 6000）的 learn
  const bigResp = await j("GET", "/api/learn?bookId=college&limit=3", undefined, authHeaders());
  const bigData = bigResp.data || bigResp;
  const bigItems = bigData.items || bigData.words || bigData;
  const bigWords = bigItems.map((it) => it.word || it);
  check("learn(college,3) 返回 3 词", bigWords.length === 3);
  check("college 词条有中文释义", bigWords.every((w) => /[\u4e00-\u9fff]/.test(w.meaning || "")));
} catch (error) {
  console.error("SMOKE ERROR:", error.message);
  process.exitCode = 1;
}

const failed = results.filter(([, ok]) => !ok);
console.log(`\n=== 冒烟结果：${results.length - failed.length}/${results.length} 通过 ===`);
if (failed.length) {
  failed.forEach(([n]) => console.log("  失败:", n));
  process.exitCode = 1;
}