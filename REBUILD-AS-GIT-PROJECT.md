# EdgeOne 真·Git 绑定完成报告

> 执行时间：2026-09-27
> **结果：已完全打通 ✅** —— `git push` 即可自动触发平台构建并上线

---

## 一、最终状态（已验证）

| 项 | 值 |
| --- | --- |
| 项目名 | `nxz-words` |
| **ProjectId** | `makers-gkzwuzgwbhpr` |
| **Provider** | **`Github`** ← 真绑定 |
| RepoUrl | `https://github.com/talunte50/nxz-words` |
| RepoBranch | `main` |
| Framework | `Next.js` |
| BuildCmd / InstallCmd / OutputDir | `npm run build` / `npm install` / `.next` |
| Area | `overseas`（全球可用区，不含中国大陆） |
| 预设域名 | **`nxz-words.edgeone.dev`** |
| 项目 Status | `Normal` |
| 环境变量 | 6 条（Production） |

### 部署验证记录

| DeploymentId | Status | 耗时 | Commit | 触发方式 |
| --- | --- | --- | --- | --- |
| `dpjc3prlte8z` | **Success** | 88s | `d9278236` | **push 自动触发** ✅ |
| `dpg7eg6cxvix` | **Success** | 152s | `5a7c4b51` | 手工 API 触发 |
| `dp2hwcqqqcxu` | Invalid | — | — | 首次创建时瞬时失败（见第三节） |

**结论**：GitHub 授权正常，自动构建正常。**每次 `git push origin main` 都会自动部署。**

### 环境变量（已回读验证）

```
STORAGE_DRIVER = edgeone-kv
SESSION_SECRET = 44026e99da9d4b051a9a8b5190dedd98f87c68929f8c643f
COOKIE_SECURE  = true
AI_BASE_URL    = https://apihub.agnes-ai.cn/v1
AI_MODEL       = agnes-3.0-flash
AI_API_KEY     = wk-VZM68PF6pqQ4i8IKt9kiCLxWcoqbPsxVg0HqEPsWjxphT0pw
```

---

## 二、怎么做到的：直连 EdgeOne CAPI

`edgeone` CLI **无法**创建 Git 集成项目（只有 `makers create --template`），但底层 CAPI 可以。

**端点**（逆向 `edgeone-dist/cli.js` 得出）：

```
海外(global) : https://pages-api.edgeone.ai/v1        ← 本项目用这个
中国(china)  : https://pages-api.cloud.tencent.com/v1
认证         : Authorization: Bearer <EDGEONE_API_TOKEN>
请求         : POST  body = { Action: "XxxYyy", ...参数 }
响应         : { Code: 0, Data: { Response: {...} } }
```

**判断 token 区域**：请求错区域返回 `{ Code: 109, Message: "The Token usage region is incorrect." }`。

**创建 Git 项目的参数**（照抄账号下已有 `it-tools` 项目的字段结构）：

```json
{
  "Action": "CreatePagesProject",
  "Name": "nxz-words",
  "Provider": "Github",
  "Channel": "Custom",
  "Area": "overseas",
  "RepoUrl": "https://github.com/talunte50/nxz-words",
  "RepoOwner": "talunte50",
  "RepoName": "nxz-words",
  "RepoBranch": "main",
  "Framework": "Next.js",
  "BuildCmd": "npm run build",
  "InstallCmd": "npm install",
  "OutputDir": ".next",
  "RootDir": "./"
}
```

**环境变量**：

```json
{
  "Action": "ModifyPagesProjectEnvs",
  "ProjectId": "makers-gkzwuzgwbhpr",
  "EnvVars": [{ "Key": "FOO", "Value": "bar", "Env": ["Production"] }]
}
```

完整 Action 清单与字段说明见 `.workbuddy/skills/edgeone-gh-deploy/references/edgeone-capi.md`。

---

## 三、关于首次的「克隆报错」

首次创建后出现过：

```
DeploymentId: dp2hwcqqqcxu
Status: Failed
Code: 11
ViaMeta: Github
RepoBranch: null      ← 平台未取到凭证
```

这是**项目刚创建、授权尚未生效时的瞬时状态**。后续（`dpg7eg6cxvix` 起）`RepoBranch: main` 正常落库、`RepoCommitMsg` 也能正确读出，说明授权其实已经建立。

**判断 Git 集成是否真的可用**，看这两点即可：

1. `DescribePagesProjects` 返回的 `RepoUrl` / `RepoOwner` / `RepoName` 有值
2. `DescribePagesDeployments` 最新记录的 `RepoBranch` 有值且 `Status: Success`

> ⚠️ 注意：`CreatePagesProject` **不校验 Provider 合法性**（传 `"Git"` 也能建成），
> 所以「创建成功」不等于「真绑定」，必须做上面的验证。

---

## 四、遗留事项（均需控制台操作）

### 1. KV 绑定（必须，否则写操作 500）

KV 审批通过后 → 项目 **设置** → **KV 存储 / 数据连接** → 绑定命名空间 → **变量名填 `VOCAB_KV`**。

> CAPI 没有 KV 命名空间相关 Action（`DescribeKVs` 等均返回 107），只能控制台操作。

### 2. 关闭访问保护

当前访问 `https://nxz-words.edgeone.dev` 返回：

```
401
x-eop-msg: eo_time missing
server: edgeone makers
```

这是项目的**访问保护**，不是故障。在项目设置里关闭即可。

### 3. 自定义域名（可选）

`CustomDomains` 当前为空。如需绑定自有域名，在控制台添加。

---

## 五、辅助脚本

`scripts/edgeone-api.mjs` —— 直连 CAPI（标准 fetch，无第三方依赖）：

```bash
node scripts/edgeone-api.mjs <TOKEN> DescribeUserInfo
node scripts/edgeone-api.mjs <TOKEN> DescribePagesProjects '{"PageSize":50,"PageNumber":1}'
node scripts/edgeone-api.mjs <TOKEN> DescribePagesProjects '{"ProjectId":"makers-gkzwuzgwbhpr"}'
node scripts/edgeone-api.mjs <TOKEN> DescribePagesProjectEnvs '{"ProjectId":"makers-gkzwuzgwbhpr"}'
node scripts/edgeone-api.mjs <TOKEN> DescribePagesDeployments '{"ProjectId":"makers-gkzwuzgwbhpr"}'
node scripts/edgeone-api.mjs <TOKEN> ModifyPagesProjectEnvs '{"ProjectId":"...","EnvVars":[{"Key":"K","Value":"V","Env":["Production"]}]}'
```
