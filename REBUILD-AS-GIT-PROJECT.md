# EdgeOne 真·Git 绑定完成报告

> 执行时间：2026-09-27
> 结果：**Git 集成项目已通过 API 创建成功**，剩余 1 步需控制台授权

---

## 一、最终状态

### 新项目

| 项 | 值 |
| --- | --- |
| 项目名 | `nxz-words` |
| **ProjectId** | `makers-gkzwuzgwbhpr` |
| **Provider** | **`Github`** ← 真绑定 |
| RepoUrl | `https://github.com/talunte50/nxz-words` |
| RepoBranch | `main` |
| Framework | `Next.js` |
| BuildCmd | `npm run build` |
| InstallCmd | `npm install` |
| OutputDir | `.next` |
| Area | `overseas`（全球可用区，不含中国大陆） |
| 预设域名 | `nxz-words.edgeone.dev` |
| 环境变量 | 6 条（全部已在 Production） |

### 环境变量（已通过 API 写入并回读验证）

```
STORAGE_DRIVER = edgeone-kv
SESSION_SECRET = 44026e99da9d4b051a9a8b5190dedd98f87c68929f8c643f
COOKIE_SECURE  = true
AI_BASE_URL    = https://apihub.agnes-ai.cn/v1
AI_MODEL       = agnes-3.0-flash
AI_API_KEY     = wk-VZM68PF6pqQ4i8IKt9kiCLxWcoqbPsxVg0HqEPsWjxphT0pw
```

---

## 二、逆向出的 EdgeOne CAPI（重要）

`edgeone` CLI 只能建**从模板创建**的项目，但底层 CAPI 支持直接指定 Git 仓库。

**端点与认证**：

```
海外(global) : https://pages-api.edgeone.ai/v1
中国(china)  : https://pages-api.cloud.tencent.com/v1
认证         : Authorization: Bearer <EDGEONE_API_TOKEN>
请求         : POST，body = { Action: "XxxYyy", ...参数 }
响应         : { Code: 0, Data: { Response: {...} } }
```

**判断 token 区域**：向错误区域请求会返回 `{ Code: 109, Message: "The Token usage region is incorrect." }`。
→ 你的 token 属于 **global**，必须用 `pages-api.edgeone.ai`。

**实测可用的 Action**：

| Action | 用途 |
| --- | --- |
| `DescribeUserInfo` | 查账号（返回 UserName / ZoneId / Uin） |
| `DescribePagesProjects` | 列项目，可传 `ProjectId` 过滤 |
| `CreatePagesProject` | 建项目，**支持 `Provider:"Github"`** |
| `DescribePagesProjectEnvs` | 读环境变量 |
| `ModifyPagesProjectEnvs` | 写环境变量 |
| `DeletePagesProjectEnvs` | 删环境变量 |
| `DescribePagesDeployments` | 列部署记录 |
| `CreatePagesDeployment` | 触发部署 |
| `DescribeProjectKVBindings` | 读 KV 绑定（返回值加密） |

**CAPI 不支持**（返回 `Code:107 Action has not found.`）：

- 任何 Git 授权相关 Action（`DescribeGitRepos` / `DescribePagesRepoAuth` 等）
- KV 命名空间列表 / 创建
- `DescribePagesDeployment`（单数形式）

**创建 Git 项目的完整参数**（照抄自账号下已有的 `it-tools` 项目）：

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

> 注意：`CreatePagesProject` **不校验 Provider 值的合法性**，传 `"Git"` 也能建出来。
> 所以「建成了」不等于「真绑定」，必须看 `RepoUrl` 是否落库 + 能否成功触发 Git 构建。

---

## 三、⚠️ 剩余关键一步：控制台授权 GitHub

**问题**：通过 API 创建的项目虽然 `Provider=Github`、`RepoUrl` 也写入了，但**没有建立 GitHub App 授权关系**。表现为触发部署时报错：

```
DeploymentId: dp2hwcqqqcxu
Status: Failed
Code: 11
ViaMeta: Github
RepoBranch: null        ← 关键：分支为空，说明平台没有仓库访问凭证
```

**原因**：GitHub 授权必须走 OAuth 交互流程（浏览器跳转 + 用户点授权），CAPI 没有对应 Action，无法用 API 完成。

### 你需要做的（2 分钟）

1. 打开 EdgeOne 控制台 → **Pages** → 项目 `nxz-words`
2. 进入 **设置** → 找到 **Git 配置 / 代码仓库** 相关项
3. 点击 **重新授权 / 绑定 GitHub**，完成 GitHub App 授权（选 `talunte50` 账号，授权 `nxz-words` 仓库）
4. 确认分支为 `main`
5. 手动点一次 **重新部署**

授权完成后，后续推送代码到 `main` 就会自动触发平台构建（真正的 Git 集成）。

> 如果控制台提示项目配置不完整或无法授权，最稳妥的做法是：删掉当前项目，
> 用控制台「导入 Git 仓库」重新创建一次（配置参数照抄本文档第二节，环境变量值见第一节）。

---

## 四、辅助脚本

`scripts/edgeone-api.mjs` —— 直连 CAPI 的命令行工具：

```bash
# 查账号
node scripts/edgeone-api.mjs <TOKEN> DescribeUserInfo

# 列所有项目
node scripts/edgeone-api.mjs <TOKEN> DescribePagesProjects '{"PageSize":50,"PageNumber":1}'

# 查单个项目
node scripts/edgeone-api.mjs <TOKEN> DescribePagesProjects '{"ProjectId":"makers-gkzwuzgwbhpr"}'

# 读环境变量
node scripts/edgeone-api.mjs <TOKEN> DescribePagesProjectEnvs '{"ProjectId":"makers-gkzwuzgwbhpr"}'

# 写环境变量
node scripts/edgeone-api.mjs <TOKEN> ModifyPagesProjectEnvs \
  '{"ProjectId":"makers-gkzwuzgwbhpr","EnvVars":[{"Key":"FOO","Value":"bar","Env":["Production"]}]}'

# 列部署记录
node scripts/edgeone-api.mjs <TOKEN> DescribePagesDeployments '{"ProjectId":"makers-gkzwuzgwbhpr"}'
```

---

## 五、遗留事项

1. **GitHub 授权**（见第三节，需控制台操作）
2. **KV 绑定**：KV 申请通过后，在项目设置里绑为变量名 **`VOCAB_KV`**。
   不绑定则注册/学词等所有写操作返回 500。
3. **访问保护**：若访问返回 `401 + x-eop-msg: eo_time missing`，在控制台关闭访问保护。
4. 旧项目 `makers-oumogbchjfcf` 已删除，本站点原域名 `nxz-words.edgeone.cool` 已失效；
   新预设域名为 **`nxz-words.edgeone.dev`**（EdgeOne Pages 新域名后缀）。
