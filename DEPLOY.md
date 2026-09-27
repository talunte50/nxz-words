# EdgeOne Pages 部署教程

> 适用项目：逆行者单词（Next.js 15 App Router + TypeScript + Tailwind）
> 平台：腾讯云 EdgeOne Pages（Makers 模式）
> 最后更新：2026-09-27

---

## 目录

- [一、前置准备](#一前置准备)
- [二、创建 EdgeOne Pages 项目](#二创建-edgeone-pages-项目)
- [三、配置环境变量](#三配置环境变量)
- [四、创建并绑定 KV 存储](#四创建并绑定-kv-存储)
- [五、触发构建与首次部署](#五触发构建与首次部署)
- [六、部署后验证清单](#六部署后验证清单)
- [七、常见问题排查](#七常见问题排查)
- [八、注意事项与风险提示](#八注意事项与风险提示)
- [附录：仓库配置速查](#附录仓库配置速查)

---

## 一、前置准备

### 1. 代码仓库

项目必须托管在 EdgeOne Pages 支持的平台（GitHub / Gitee / CODING 等）。确认以下文件**已提交进仓库**：

| 文件 | 是否必须入库 | 说明 |
|---|---|---|
| `edgeone.json` | ✅ 必须 | 构建配置，平台自动读取 |
| `data/wordbooks/*.json`（14 个） | ✅ 必须 | 词库数据通过动态 import 打进 JS chunk，**不入库则线上词库为空** |
| `package.json` / `lockfile` | ✅ 必须 | 构建依赖 |
| `.env.example` | ✅ 建议 | 供运维参考，不含真实密钥 |
| `.env` / `.data/` | ❌ 禁止 | 已在 `.gitignore`，含本地密钥与本地数据 |

> ⚠️ **最常见线上故障**：忘记提交 `data/wordbooks/*.json`，导致首页和学词页词库加载失败（404 或空列表）。部署前务必 `git status` 确认这些文件未被忽略。

### 2. 腾讯云账号

- 开通 EdgeOne Pages（[console.cloud.tencent.com/edgeone](https://console.cloud.tencent.com/edgeone)）
- 确认账号有创建 KV 命名空间的权限

### 3. AI 大模型密钥（可选）

AI 精讲 / AI 对话功能需要 OpenAI 兼容协议的大模型 API，推荐 DeepSeek（成本低、大陆可用）：

```
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
AI_API_KEY=sk-你的真实密钥
```

也可替换为通义千问 / 混元 / Moonshot / 智谱等，只需改 `AI_BASE_URL` 和 `AI_MODEL`。

---

## 二、创建 EdgeOne Pages 项目

1. 进入 **EdgeOne 控制台 → Pages** → **创建项目**
2. 选择 **关联代码仓库**（Makers 模式），填入 GitHub / Gitee 仓库地址
3. 分支选 `main`（或你的默认分支）
4. 构建配置**无需手动填写**——平台自动读取 `edgeone.json`：
   - 安装命令：`npm install`
   - 构建命令：`npm run build`
   - 产物目录：`.next`
   - Node 版本：`20.18.0`
   - 函数超时：`60s`
5. 点击 **创建并部署**，等待首次构建完成（约 2~5 分钟）

构建完成后平台会给出预览链接（形如 `https://xxxx.edgeone.app`）。

> **注意**：`*.edgeone.app` 预览域名在中国大陆**无法直接访问**，且预览链接 **3 小时后过期**。生产环境请绑定自定义域名（见第八节）。

---

## 三、配置环境变量

在 **EdgeOne Pages 控制台 → 项目设置 → 环境变量** 中填入：

### 必填

| 变量名 | 示例值 | 说明 |
|---|---|---|
| `STORAGE_DRIVER` | `edgeone-kv` | **必须设置**，否则登录/学词等写操作全部 500（边缘节点无磁盘，file 驱动不可用） |
| `SESSION_SECRET` | 48 位随机十六进制串 | 会话签名密钥，**强烈建议 ≥ 32 字符**。切勿使用 `.env.example` 中的占位值。生成方式见下方 |
| `AI_API_KEY` | `sk-xxx` | AI 功能密钥（不用 AI 可留空，但 AI 页面会降级） |
| `AI_BASE_URL` | `https://api.deepseek.com/v1` | 大模型接入地址 |
| `AI_MODEL` | `deepseek-chat` | 模型名 |

### 可选

| 变量名 | 说明 |
|---|---|
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 预置管理员账号。两个变量必须**同时**设置才生效（缺一则跳过）。账号在**首次有人调用登录接口时**由服务端幂等创建，创建后即以 admin 角色存在。不设置则第一个注册的用户自动成为管理员 |
| `COOKIE_SECURE` | 留空即**自动判定**：`x-forwarded-proto` 为 https 时 `true`，localhost 时 `false`。生产 HTTPS 建议显式设为 `true`；本地 HTTP 调试设 `false` |

> 💡 大模型配置（地址 / 密钥 / 模型 / 温度 / Token 上限）现在是**双轨**的：
> 环境变量提供**默认值**，登录管理员后可在 **`/admin` → 大模型**里随时覆盖并「测试连通性」，改完立即生效、**无需重新部署**。
> 配置存放于 KV 的 `config:ai`，密钥对外只返回脱敏值（`ab****yz`）。

**生成 `SESSION_SECRET`（任选一种，复制输出结果）**

```bash
# Git Bash / macOS / Linux
openssl rand -hex 24

# PowerShell
-join (1..48 | ForEach-Object { "{0:x}" -f (Get-Random -Maximum 16) })
```

> ⚠️ 注意：未设置 `SESSION_SECRET` 时，代码会回落到内置的 `dev-secret-change-me-in-production`（见 `lib/auth/session.ts`），**不会报错但存在严重安全隐患**——任何人都能伪造会话。生产环境务必显式设置一个随机值。

> 填写完环境变量后**需要重新触发一次构建**才生效（环境变量在构建时注入）。

---

## 四、创建并绑定 KV 存储

这是生产环境最关键的一步，漏掉会导致登录 500。

1. 进入 **EdgeOne 控制台 → KV 存储** → **创建命名空间**，命名建议：`vocab-kv`
2. 回到 **Pages 项目 → 项目设置 → KV 存储**（或「数据连接」入口），将上述命名空间**绑定到环境变量 `VOCAB_KV`**
   - `lib/storage/edgeone-kv.ts` 按 `["VOCAB_KV", "KV", "PAGES_KV", "EDGEONE_KV"]` 顺序探测绑定，**推荐统一用 `VOCAB_KV`**，其余别名仅作兼容兜底
3. 绑定后再次触发构建

> 控制台绑定入口名称可能随 EdgeOne 版本略有差异，找不到时在项目设置里搜索 "KV" 关键字。

---

## 五、触发构建与首次部署

```
提交代码 / 配置好环境变量和 KV 绑定
        ↓
EdgeOne 控制台 → Pages → 项目 → 触发部署（或推代码自动触发）
        ↓
平台执行 npm install → npm run build → 产出 .next
        ↓
部署到边缘节点，生成预览链接
```

构建成功标志：日志末尾出现 `✓ Generating static pages` 且无报错。

### 5.1 自动部署（Git 集成）

本项目为 **Git 集成类型**：仓库已关联 EdgeOne，**推送到 `main` 即由平台自动构建并部署**。

```
git push origin main
        ↓
EdgeOne 平台拉取仓库 → npm install → npm run build
        ↓
部署到边缘节点，线上更新
```

**选型说明（重要）**：EdgeOne 项目类型**创建后不可更改**，两类互斥：

| 类型 | 部署入口 | 能否用 CLI 部署 |
| --- | --- | --- |
| 直接上传 | CLI / 控制台上传产物 | 可以 |
| **Git 集成** | 平台拉取仓库自动构建 | **不可以** |

因此本仓库**不含** CLI 部署工作流。早期曾用 GitHub Actions + `edgeone makers deploy` 上传产物实现自动部署（功能等价），但那类项目在后台显示为「上传产物」；为获得真正的 Git 绑定，已重建为 Git 集成类型。

> ⚠️ 若将来误加了 CLI 部署工作流，会与平台构建冲突，务必删除。

**构建配置**（与 `edgeone.json` 一致，创建项目时填写）：

| 配置项 | 值 |
| --- | --- |
| 框架预设 | `Next.js` |
| 构建命令 | `npm run build` |
| 安装命令 | `npm install` |
| 输出目录 | `.next` |
| Node 版本 | `20.18.0` |
| 函数最大时长 | `60` |

**查看构建结果**：控制台 → Pages → 项目 → **部署记录**。每次 push 都会产生一条记录，点进去可看完整构建日志。

> 从「直接上传」重建为「Git 集成」的完整步骤见 `REBUILD-AS-GIT-PROJECT.md`。

---

## 六、部署后验证清单

用浏览器（建议**手机真机** + 自定义域名）逐项验证：

- [ ] 首页能加载词库（13 本全部显示，不是空列表，总计约 4.5 万词）
- [ ] 注册 → 登录 → 退出 全流程正常
- [ ] 学词页：学 3 个词 → 刷新 → 记录仍在（证明 KV 写入成功）
- [ ] 测验页：拼写 / 听写 / 填空 各跑一次，计分正确
- [ ] **答完最后一题 → 点「查看结果」能正常进入成绩页**（修复过的高危 bug，务必回归）
- [ ] 个人中心：切到深色主题 → 刷新 → 主题保持
- [ ] 收藏 / 打卡 / 词书 页面数据正常
- [ ] AI 精讲 / AI 对话：能收到回复（SSE 流式正常结束）；AI 对话「历史」按钮可恢复旧会话
- [ ] 移动端：iPhone 刘海屏不被顶栏/底栏遮挡；Android 手势条区域可点；按钮触控区域够大
- [ ] 桌面端：布局未因移动端改动退化

> 验证学词持久化是判断 KV 是否真正生效的最快方法：刷新后记录还在 = KV OK；还在但注册成功学词 500 = KV 绑定名不对；完全空白 = `STORAGE_DRIVER` 没设。

---

## 七、常见问题排查

### 登录 / 注册返回 500

```
最可能原因（按概率排序）：
1. STORAGE_DRIVER 未设为 edgeone-kv
2. KV 命名空间未绑定 / 绑定名不是 VOCAB_KV
3. SESSION_SECRET 未设置（不会报错，但会话不安全）
```

查看 EdgeOne 控制台 → 项目 → 日志，定位到 `edgeone-kv.ts` 抛出的 `未找到 EdgeOne KV 绑定` 错误即可确认。

### 词库列表为空 / 404

`data/wordbooks/*.json` 没有提交进仓库。补齐后重新构建。

### AI 对话中途断流（SSE 截断）

`edgeone.json` 已设 `maxDuration: 60`。若你的模型回复较长（>60s），流会被边缘节点强制截断。对策：

- 换更快的模型 / 调小 `max_tokens`
- 或在 AI 层做分段输出（前端已支持增量渲染，后端只需控制单次响应时长）

### 登录后仍 401 / Cookie 丢失

Cookie 的 `secure` 默认**自动判定**（见 `lib/auth/session.ts` 的 `isSecureRequest()`）：优先看 `x-forwarded-proto` 是否为 https。

- 走 HTTPS 自定义域名访问却仍 401 → 平台未传 `x-forwarded-proto`，显式设 `COOKIE_SECURE=true` 后重新构建
- 通过 HTTP（如本地反代、IP 直连）访问 → 显式设 `COOKIE_SECURE=false` 后重新构建

### 构建报 `Cannot find module 'next'`

`package-lock.json` 没入库，或 `edgeone.json` 的 `installCommand` 没生效。执行 `git ls-files package-lock.json` 应能列出该文件。

### 已部署成功但线上返回 401

```
x-eop-msg: eo_time missing
server: edgeone makers
```

这是 EdgeOne 的**访问保护（预览保护）**，不是部署失败。控制台 → Pages → 项目 → 设置里关闭访问保护，或改用带签名的访问链接即可。

### 预览链接 3 小时后打不开

`*.edgeone.app` 预览域名设计如此，**生产环境必须绑定自定义域名**。

### 大陆用户访问不了

未绑定的 EdgeOne 预览域名在大陆被墙。绑定自定义域名后，**中国大陆可用区需要完成 ICP 备案**，非大陆区（新加坡等）无需备案但大陆访问延迟较高。

---

## 八、注意事项与风险提示

### 中国大陆可用区

- 绑定自定义域名 + 大陆节点 → 必须 ICP 备案（约 1~2 周）
- 选海外节点（新加坡等）→ 无需备案，但大陆用户延迟 200ms+，建议做 CDN 加速

### 数据迁移

KV 数据目前无导出工具。如需迁移：

```js
// 在 EdgeOne KV 控制台「数据管理」中可手动导出 key-value
// 批量 key 前缀参考 lib/storage/key.ts（users:/words:/sessions:/ 等）
```

### 监控建议

- EdgeOne 控制台 → 可观测：关注 5xx 比例（正常应 < 0.1%）
- AI 调用量与费用：在对应大模型平台侧监控，EdgeOne 侧无 AI 调用统计

### 安全

- `SESSION_SECRET` 一旦泄露，所有已登录会话可被伪造，**定期轮换**（轮换后需重新构建，所有用户需重新登录）
- `AI_API_KEY` 建议在大模型平台侧设置**IP 白名单**（如支持）或**调用限额**

---

## 附录：仓库配置速查

### `edgeone.json` 关键字段

```jsonc
{
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "outputDirectory": ".next",
  "nodeVersion": "20.18.0",
  "nodeFunctionsConfig": { "maxDuration": 60 },
  "redirects": [
    { "source": "/index.html",  "destination": "/",  "statusCode": 301 },
    { "source": "/home",        "destination": "/",  "statusCode": 301 },
    { "source": "/word-books",  "destination": "/wordbooks", "statusCode": 301 }
  ],
  "headers": [
    { "source": "/api/*",        "headers": [{ "key": "Cache-Control", "value": "no-store, max-age=0" }] },
    { "source": "/_next/static/*", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
  ],
  "caches": [
    { "source": "/_next/static/*", "cacheTtl": 31536000 }
  ]
}
```

### 环境变量完整清单（`console` 里按此填）

```bash
# 必填
STORAGE_DRIVER=edgeone-kv
SESSION_SECRET=<openssl rand -hex 24>
AI_API_KEY=<sk-xxx>
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat

# 可选
ADMIN_USERNAME=<your-admin>
ADMIN_PASSWORD=<your-password>
COOKIE_SECURE=true

# KV 绑定（在 KV 存储面板操作，不在此处填）
# 命名空间: vocab-kv
# 绑定变量名: VOCAB_KV
```