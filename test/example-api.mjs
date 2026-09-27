// 验证 /api/ai/example 在未配置 AI 时的降级行为（本地无 key，应 400）
const BASE = "http://localhost:3001";

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "smokeuser", password: "password123" }),
  });
  return res.headers.get("set-cookie")?.split(";")[0] || "";
}

const cookie = await login();
const header = { Cookie: cookie };

// 取一个无静态例句的词 id（cet4 的词 example 都是空串）
const learnRes = await fetch(`${BASE}/api/learn?bookId=cet4&limit=1`, { headers: header });
const learn = (await learnRes.json()).data;
const wordId = learn.items[0].word.id;
console.log("测试词 id:", wordId, "word:", learn.items[0].word.word, "静态例句:", JSON.stringify(learn.items[0].word.example));

// 调例句 API
const exRes = await fetch(`${BASE}/api/ai/example`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...header },
  body: JSON.stringify({ wordId }),
});
const exData = await exRes.json();
console.log("status:", exRes.status);
console.log("body:", JSON.stringify(exData));

// 判定
let pass = true;
if (exRes.status === 400 && /AI 未配置/.test(exData.error || "")) {
  console.log("PASS  未配置 AI 时返回 400 + 提示，学习流程不受影响");
} else {
  console.log("FAIL  未配置降级行为不符（status=" + exRes.status + "）");
  pass = false;
}
if (exRes.status !== 404 && exRes.status !== 502) {
  console.log("PASS  非 404/502，词存在且未误判");
}
process.exit(pass ? 0 : 1);