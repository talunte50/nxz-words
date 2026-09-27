// 校验管理端与词库导入的核心逻辑（纯静态/数据校验，不依赖 Next 运行时）
import fs from "fs";

const read = (p) => fs.readFileSync(p, "utf8");
const checks = [];
const t = (name, cond, extra = "") => checks.push({ name, ok: !!cond, extra });

// ---- 1. manifest 统计 ----
const manifest = JSON.parse(read("data/wordbooks/manifest.json"));
const total = manifest.reduce((s, b) => s + (b.wordCount || 0), 0);
t("manifest 368 本", manifest.length === 368, `实际 ${manifest.length}`);
t("词条 ~400k", total > 390000 && total < 410000, `实际 ${total}`);

// ---- 2. bookIdFromWordId 最长前缀匹配（54 本含下划线的书是回归点）----
const loader = read("lib/dicts/loader.ts");
t(
  "loader 使用最长前缀匹配",
  /BOOK_IDS_BY_LEN/.test(loader) && /b\.length - a\.length/.test(loader) && /startsWith\(`\$\{id\}_`\)/.test(loader),
);

// ---- 3. 管理端守卫 ----
const guard = read("lib/admin/guard.ts");
t("guard 校验 admin 角色", /role !== "admin"/.test(guard) && /403/.test(guard));
t("guard 校验登录", /未登录/.test(guard) && /401/.test(guard));

// ---- 4. AI 配置脱敏 ----
const aiCfg = read("lib/config/ai.ts");
t("AI 配置 KV 优先 + env 兜底", /stored/.test(aiCfg) && /envDefaults/.test(aiCfg));
t("AI 密钥脱敏", /maskKey/.test(aiCfg) && /apiKeyMasked/.test(aiCfg));
t("空值不覆盖 env", /if \(!stored\.apiKey\) merged\.apiKey = base\.apiKey/.test(aiCfg));

// ---- 5. client 已改为读 KV ----
const client = read("lib/ai/client.ts");
t("client 不再直读 process.env.AI_*", !/process\.env\.AI_/.test(client), "仍存在 process.env.AI_*");
t("client 引入 getAiConfig", /getAiConfig/.test(client));

// ---- 6. 词库覆盖层 ----
const books = read("lib/config/books.ts");
t(
  "覆盖层支持 enabled/pinned/weight/category",
  /enabled\?/.test(books) && /pinned\?/.test(books) && /weight\?/.test(books),
);

// ---- 7. 用户管理能力齐备 ----
const us = read("lib/store/user-store.ts");
for (const fn of [
  "listUsers",
  "adminResetPassword",
  "adminDeleteUser",
  "adminCreateUser",
  "adminSetRole",
  "countAdmins",
]) {
  t(`user-store.${fn} 存在`, us.includes(`function ${fn}`));
}
t("保护最后一个管理员", read("app/api/admin/users/route.ts").includes("至少保留一名管理员"));

// ---- 8. 日志 ----
const logs = read("lib/admin/logs.ts");
t("日志有上限截断", /MAX_LOGS/.test(logs) && /KEEP_LOGS/.test(logs));

// ---- 9. 登录受 allowRegister 控制 ----
const login = read("app/api/auth/login/route.ts");
t("登录遵循 allowRegister", /allowRegister/.test(login) && /暂未开放注册/.test(login));

// ---- 10. 前端只拿启用的词库 ----
const wb = read("app/api/wordbooks/route.ts");
t("wordbooks 只返回启用词库", /listEnabledWordBooks/.test(wb));

// ---- 11. SEO 品牌已更名 ----
const seo = read("lib/seo.ts");
t("SEO 品牌 = 逆行者单词", /SITE_NAME = "逆行者单词"/.test(seo));
t("layout 无旧品牌", !/WordLeap|词跃|逆行者记单词/.test(read("app/layout.tsx")));

// ---- 12. 数据文件齐全 ----
const files = fs.readdirSync("data/wordbooks").filter((f) => f.endsWith(".json"));
t("词库文件数 >= 369", files.length >= 369, `实际 ${files.length}`);

// ---- 13. 管理端 UI 六模块齐全 ----
const admin = read("app/admin/page.tsx");
for (const key of ["dashboard", "site", "ai", "users", "books", "logs"]) {
  t(`管理端含 ${key} 模块`, admin.includes(`"${key}"`));
}
t("大模型连通测试入口", admin.includes("/api/admin/ai/test"));

let pass = 0;
let fail = 0;
for (const c of checks) {
  console.log(`${c.ok ? "✅" : "❌"} ${c.name}${c.ok ? "" : "  ← " + c.extra}`);
  if (c.ok) pass++;
  else fail++;
}
console.log(`\n通过 ${pass}/${checks.length}${fail ? `，失败 ${fail}` : ""}`);
process.exit(fail ? 1 : 0);
