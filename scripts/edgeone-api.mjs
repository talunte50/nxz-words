#!/usr/bin/env node
/**
 * edgeone-api.mjs — 直连 EdgeOne Pages CAPI 管理项目
 *
 * 为什么需要它：
 *   `edgeone` CLI 只能建「从模板创建」的项目，无法指定 Git 仓库；
 *   但底层 CAPI 支持 Provider=Github + RepoUrl 等字段，可直接创建 Git 集成项目。
 *
 * 端点与认证（从 CLI 源码 edgeone-dist/cli.js 逆向得出）：
 *   global/海外 : https://pages-api.edgeone.ai/v1        ← API Token 走这个
 *   china/中国  : https://pages-api.cloud.tencent.com/v1
 *   认证头      : Authorization: Bearer <EDGEONE_API_TOKEN>
 *   请求体      : { Action: "XxxYyy", ...params }  （POST，JSON）
 *   响应        : { Code: 0, Data: { Response: {...} } }
 *
 * 判断 token 属于哪个区域：向错的区域发请求会返回
 *   { Code: 109, Message: "The Token usage region is incorrect." }
 *
 * 用法：
 *   node scripts/edgeone-api.mjs <TOKEN> <Action> ['{"参数":"值"}']
 *
 * 常用 Action：
 *   DescribeUserInfo                    查账号
 *   DescribePagesProjects               列项目（可按 ProjectId 过滤）
 *   CreatePagesProject                  建项目（支持 Provider=Github）
 *   DescribePagesProjectEnvs            读环境变量
 *   ModifyPagesProjectEnvs              写环境变量
 *   DescribePagesDeployments            列部署记录
 *   CreatePagesDeployment               触发部署
 *   DescribeProjectKVBindings           读 KV 绑定（加密）
 */

for (const k of [
  "http_proxy", "https_proxy", "HTTP_PROXY", "HTTPS_PROXY",
  "all_proxy", "ALL_PROXY",
]) delete process.env[k];
process.env.no_proxy = "*";

const BASE = "https://pages-api.edgeone.ai/v1";

const [TOKEN, ACTION, PARAMS_JSON] = process.argv.slice(2);
if (!TOKEN || !ACTION) {
  console.error(
    "用法: node scripts/edgeone-api.mjs <TOKEN> <Action> ['{...参数}']"
  );
  process.exit(2);
}

let params = {};
if (PARAMS_JSON) {
  try {
    params = JSON.parse(PARAMS_JSON);
  } catch {
    console.error("参数必须是合法 JSON");
    process.exit(2);
  }
}

export async function edgeoneCall(token, action, payload = {}, base = BASE) {
  const res = await fetch(base, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ Action: action, ...payload }),
  });
  return res.json();
}

const result = await edgeoneCall(TOKEN, ACTION, params);
console.log(JSON.stringify(result, null, 1));
