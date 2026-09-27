# 逆行者单词 · EdgeOne AI 背单词

一个部署在 **EdgeOne Pages（Makers）** 上的 AI 英语单词学习应用：翻转卡片学习 + 艾宾浩斯记忆曲线排期 + 拼写/听写测试 + AI 精讲 + AI 口语陪练 + 个人中心。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Next.js 15（App Router）+ React 19 + TypeScript |
| 样式 | Tailwind CSS 3 |
| 存储 | EdgeOne Pages KV（生产）/ 本地文件 Mock（开发） |
| AI | OpenAI 兼容协议（`/v1/chat/completions`），可切换 DeepSeek / 通义 / 混元 等 |
| 鉴权 | 自签 HMAC-SHA256 Session Cookie + PBKDF2 密码哈希 |
| 部署 | EdgeOne Pages（Git 导入 / 直接上传） |
| 词库来源 | [RealKai42/qwerty-learner](https://github.com/RealKai42/qwerty-learner) 公开词库（13 本，约 4.5 万词） |

## 已实现功能

- **13 本词库**：小学 / 初中 / 高中 / 大学 / 四级 / 六级 / 商务英语 / 雅思 / 托福 / 考研 / GRE / 新概念 / 高频基础词
- **单词卡片**：3D 翻转、音标、TTS 朗读（Web Speech API）、例句朗读、收藏
- **艾宾浩斯复习**：SM-2 变体算法，四档评分（忘记/模糊/记得/简单）实时预览下次间隔
- **拼写测试**：看中文释义 + 首字母提示，输入英文单词，服务端判分
- **听写测试**：TTS 播放发音，凭听力拼写，服务端判分
- **AI 精讲**：词根词缀、例句、常见搭配、易混辨析、联想记忆，结果按词缓存进 KV
- **AI 口语陪练**：SSE 流式输出，自动带入收藏词，历史会话可保存 / 列表查看 / 恢复继续对话 / 单条删除
- **个人中心**：学习统计、30 天打卡热力图、词汇量、正确率、收藏夹、每日目标 / 提醒 / AI 语气设置
- **浅色 + 深色主题**：个人中心一键切换，实时生效并持久化到用户 profile
- **演示模式**：未配置 AI Key 时自动返回占位内容，UI 全流程可跑通
- **例句自动生成**：千词级词库源数据无例句。卡片翻面与「例句填空」题型按需调 /api/ai/example 生成例句+译文并全局缓存（KV example:<wordId>），同词只调一次 AI；未配置/失败时静默降级，不阻塞学习

> 拼写与听写测试和卡片学习共用同一套 SRS 进度：答对延长间隔，答错立即回炉。

### 可扩展方向（Roadmap）

Anki 卡片导入导出、单词发音跟读评分、例句填空、周报邮件、好友排行榜、自定义词书上传。

## 目录结构

```
.
├── app/
│   ├── layout.tsx              # 根布局 + AppShell
│   ├── page.tsx                # 首页仪表盘
│   ├── login/page.tsx          # 登录 / 注册
│   ├── learn/page.tsx          # 卡片学习会话
│   ├── quiz/page.tsx           # 拼写 / 听写测试
│   ├── wordbooks/page.tsx      # 词书管理
│   ├── chat/page.tsx           # AI 对话陪练
│   ├── profile/page.tsx        # 个人中心
│   └── api/                    # 服务端接口（部署为 Node Functions）
│       ├── auth/{login,logout,me}/
│       ├── learn/              # 取学习队列
│       ├── review/             # 卡片四档评分
│       ├── quiz/check/         # 拼写 / 听写判分
│       ├── favorites/  profile/  stats/  wordbooks/  chat-sessions/
│       └── ai/{explain,chat,example}/  # AI 精讲 / 流式对话 / 例句生成
├── components/                 # UI 组件（含 WordCard、QuizSession、ChatPanel）
├── lib/
│   ├── ai/                     # OpenAI 兼容客户端 + 提示词
│   ├── auth/session.ts         # Cookie 签名与密码哈希
│   ├── storage/                # KV 适配层（file / edgeone-kv）
│   ├── store/                  # 用户数据与统计
│   ├── client/                 # 浏览器侧请求封装与 hooks
│   ├── srs.ts                  # 记忆曲线算法
│   ├── wordbooks-server.ts     # 词库加载（仅服务端引用，避免打进前端包）
│   └── types.ts                # 全局类型
├── scripts/
│   ├── dict-config.mjs         # 词书定义与源文件匹配规则
│   ├── fetch-dicts.mjs         # 从 GitHub 下载原始词库
│   ├── build-dicts.mjs         # 转换为本项目词书格式
│   └── ai-smoke.mjs            # AI 连通性 / 流式联调脚本
├── data/
│   ├── raw/                    # 原始词库（由 dicts:fetch 生成，已 gitignore）
│   └── wordbooks/*.json        # 应用使用的 13 本词书（分片懒加载，共约 4.5 万词）
├── test/                       # 端到端冒烟 / 回归脚本（.mjs）
├── UPLOAD-DEPLOY.md            # GitHub 推送 + EdgeOne 部署操作手册
└── edgeone.json                # EdgeOne Pages 构建 / 缓存 / 重定向 / 安全头配置
```

## 快速开始

```bash
npm install
copy .env.example .env.local      # macOS / Linux: cp .env.example .env.local
npm run dev                       # http://localhost:3000
```

开发环境默认 `STORAGE_DRIVER=file`，数据写入 `.data/kv.json`，无需任何云资源即可完整体验。

首次进入 `/login`，输入任意用户名（≥3 位）+ 密码（≥6 位）即自动注册。

## 导入全量词库（约 2 万词）

仓库内置了 13 本种子词书（每本 12 词）保证开箱可用。要替换为 GitHub 上的完整词库，在你**本机**执行两条命令：

```bash
npm run dicts:fetch     # 1. 从 GitHub 下载原始词库到 data/raw/
npm run dicts:build     # 2. 合并去重并转换为 data/wordbooks/*.json
```

- 下载脚本会先读取 GitHub 目录列表，再按 `scripts/dict-config.mjs` 里的 **正则规则**匹配文件，因此源仓库文件改名后仍可用。
- 每本词书支持**多文件合并 + 按单词小写去重**。例如「小学英语」会自动合并人教版各年级分册。
- 「大学英语」在源仓库无精确匹配，默认映射到 `Level4luan` / `xueshiyingyu`，你可以在 `scripts/dict-config.mjs` 中改 `match` 换成任意词库。
- 每本词书有 `limit` 上限（如高中 4500、四级 5000），防止异常数据撑爆体积。
- 若遇到 GitHub 限流（`HTTP 403`），设置 `GITHUB_TOKEN` 环境变量后重试：
  ```bash
  set GITHUB_TOKEN=ghp_xxx && npm run dicts:fetch     # PowerShell: $env:GITHUB_TOKEN="ghp_xxx"; npm run dicts:fetch
  ```
- 转换完成后词书 id 固定为 `primary / junior / senior / college / cet4 / cet6 / business / ielts / toefl / kaoyan / gre / nce / topwords`，旧的 id 已全部重建，历史学习记录需重新开始。

## AI 大模型配置

在 `.env.local` 中填入 OpenAI 兼容协议的三个变量即可，无需改代码：

```bash
AI_BASE_URL=https://api.deepseek.com/v1
AI_API_KEY=sk-xxxxxxxx
AI_MODEL=deepseek-chat
```

常见服务商 base URL 参考：

| 服务商 | AI_BASE_URL | 示例模型 |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| 腾讯混元 | `https://api.hunyuan.cloud.tencent.com/v1` | `hunyuan-turbos-latest` |
| Moonshot | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` |

> 不配置也能跑：AI 精讲与对话会返回演示内容，便于先验证 UI 与业务流。

### 联调流式对话

```bash
npm run ai:smoke            # 直连模型，验证 Key 与 SSE 流式协议（推荐先跑）
npm run ai:smoke -- app     # 端到端调用本地 /api/ai/explain（需先 npm run dev）
npm run ai:smoke -- chat    # 端到端调用 /api/ai/chat（未登录返回 401 属预期）
```

脚本会自动读取 `.env.local`，输出时会**脱敏 Key**，不会把密钥写入任何文件或对话记录。
判断成功的标准：`✓ 流式成功：N 个分片`，且分片数 > 1（说明服务商真的按流返回，而非一次性返回）。

## 部署到 EdgeOne Pages

> 📖 **完整部署教程**已独立至 [`DEPLOY.md`](./DEPLOY.md)（原理与排查）；逐条可复制的**操作手册**见 [`UPLOAD-DEPLOY.md`](./UPLOAD-DEPLOY.md)。此处仅列关键步骤。

### 1. 创建项目

登录 [EdgeOne 控制台](https://console.cloud.tencent.com/edgeone) → 顶部 **Makers** Tab → **导入 Git 仓库**（支持 GitHub / Gitee），选择本仓库。

### 2. 构建配置

| 项 | 值 |
| --- | --- |
| 构建命令 | `npm run build` |
| 安装命令 | `npm install` |
| 输出目录 | `.next` |
| Node 版本 | 20.18.0（EdgeOne 预装版本之一） |

以上均已写入根目录 `edgeone.json`，控制台可留空。**注意**：`data/wordbooks/*.json` 必须提交进仓库，否则线上没有词库。

### 3. `edgeone.json` 已包含的配置

| 配置项 | 作用 |
| --- | --- |
| `caches` | `/_next/static/*` 缓存 1 年（带 hash，可长缓存）；`favicon.ico` 缓存 1 天 |
| `headers` | 全站安全头（`X-Content-Type-Options` / `X-Frame-Options` / `Referrer-Policy` / `Permissions-Policy`）；`/api/*` 强制 `no-store`；静态资源长缓存 |
| `redirects` | `/index.html` → `/`；`/home` → `/`；`/word-books` → `/wordbooks` |
| `nodeFunctionsConfig.maxDuration` | 60 秒，避免 AI 长请求被默认 30 秒截断 |

> 如需把裸域 301 跳到 `www`，在 `redirects` 中加一条 `{"source":"$host","destination":"$wwwhost","statusCode":301}`（仅对自定义域名生效）。

### 4. 绑定 KV 存储

1. 控制台进入 **KV 存储**，新建一个命名空间（如 `vocab-kv`）。
2. 在项目的环境变量 / 绑定中，把命名空间绑定为变量名 **`VOCAB_KV`**（也可用 `KV` / `PAGES_KV` / `EDGEONE_KV`，适配层会自动探测）。
3. 项目环境变量新增：

```bash
STORAGE_DRIVER=edgeone-kv
SESSION_SECRET=<48 位随机串，见 DEPLOY.md 生成命令；不填会回落到内置 dev 密钥>
AI_BASE_URL=...
AI_API_KEY=...
AI_MODEL=...
# 可选：Cookie 的 Secure 标记，留空则按 x-forwarded-proto 自动判定
# COOKIE_SECURE=true
```

> 代码位置：`lib/storage/edgeone-kv.ts`。适配层会自动从 `globalThis` 与 `process.env` 探测绑定对象；若你的平台版本注入了不同的绑定名或访问方式，只需修改该文件的 `BINDING_NAMES` 即可，业务代码零改动。

### 5. 加速区域选择

| 区域 | 大陆访问 | 自定义域名备案 |
| --- | --- | --- |
| 全球可用区（不含中国大陆） | 需代理 | **免备案**（推荐先跑通） |
| 全球可用区 | 可 | 需备案 |
| 中国大陆可用区 | 可 | 需备案 |

> 中国大陆 / 全球含大陆可用区下，`*.edgeone.app` 预览链接有效期仅 3 小时且超时返回 401，正式使用请绑定自定义域名。

### 6. 平台限制（务必留意）

- 账户总存储 **5 GiB**，项目文件数上限 **20000**，单文件上限 **25 MiB**
- Edge Functions：仅 JS、CPU 200 ms、内存 128 MB、请求体 1 MB —— **不适合调用大模型**
- 因此本项目把 AI 调用放在 Next.js API Route（部署为 Node Functions），并用 `nodeFunctionsConfig.maxDuration` 放宽到 60 秒
- 词库按 manifest 动态分片 import（每本独立 chunk 惰性加载），若未来词书总量过大导致函数包体超限，可改用 `node-functions.included_files` + `fs` 读取（见官方 `edgeone.json` 文档）

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/auth/login` | 登录或自动注册 |
| POST | `/api/auth/logout` | 退出登录 |
| GET | `/api/auth/me` | 当前用户与概览 |
| GET | `/api/wordbooks` | 13 本词书列表与各自进度 |
| GET | `/api/learn?mode=new\|review\|mixed&limit=20` | 学习队列 |
| POST | `/api/review` | 卡片评分 `{wordId, grade, minutes}` |
| POST | `/api/quiz/check` | 拼写/听写判分 `{wordId, answer, type, minutes}` |
| GET/POST | `/api/favorites` | 收藏列表 / 增删 |
| GET/PATCH | `/api/profile` | 个人设置读写 |
| GET | `/api/stats?days=30` | 学习统计（含当前词书名） |
| GET/DELETE | `/api/chat-sessions` | 会话列表（`?id=` 返回完整消息）/ 删除 |
| POST | `/api/ai/explain` | AI 精讲 `{word, level}` |
| POST | `/api/ai/chat` | AI 对话（SSE 流式） |
| POST | `/api/ai/example` | 按需生成例句 + 译文（结果缓存进 KV） |

## 记忆曲线算法

`lib/srs.ts` 实现了 SM-2 变体：

- 四档评分映射质量分 `again=0 / hard=3 / good=4 / easy=5`；拼写/听写答对等价 `good`，答错等价 `again`
- 质量分 < 3 判为遗忘：间隔归零、`lapses+1`、5 分钟后重来
- 否则按 `ease` 因子递增间隔，间隔阶梯为 `5分 → 30分 → 12时 → 1天 → 2天 → 4天 → 7天 → 15天 → 30天 → 60天 → 120天`
- 间隔 ≥ 21 天标记为「已掌握」

## 扩展或替换词书

1. 编辑 `scripts/dict-config.mjs`：改 `match` 正则、`name`、`limit`，即可换源或调规模。
2. 执行 `npm run dicts:fetch && npm run dicts:build`。
3. 新增词书只需在 `scripts/dict-config.mjs` 的 `BOOKS` 里加一条定义（含 id/源文件匹配正则/limit）并执行 `dicts:build`；前端分片由 `lib/dicts/loader.ts` 依据 `manifest.json` 动态生成，无需再手改 loader。

> 词库只在服务端引用（`lib/wordbooks-server.ts`），保证几万词不会进入浏览器首屏包。