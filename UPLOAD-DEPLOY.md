# GitHub 推送 + EdgeOne Pages 部署 · 操作手册

> 适用项目：WordLeap 词跃（Next.js 15 + TypeScript + Tailwind 3）
> 本文只讲「敲什么命令、点哪个按钮」；原理与排查见 `DEPLOY.md`。
> 最后校准：2026-09-27（已核对代码实际行为）

---

## 零、一次性准备

### 0.1 安装 Git 并配置身份

```bash
git --version                # 有版本号即已安装
git config --global user.name  "你的GitHub用户名"
git config --global user.email "你的GitHub邮箱"
```

### 0.2 选择推送认证方式

| 方式 | 适合 | 做法 |
|---|---|---|
| **PAT**（推荐） | 私有仓库 / 最简单 | GitHub → Settings → Developer settings → **Personal access tokens** → Tokens (classic) → Generate new token → 勾选 **`repo`** → 生成后**立即复制**（只显示一次） |
| **SSH** | 不想反复输密码 | 见 0.3 |

### 0.3 （可选）配置 SSH

```bash
ssh-keygen -t ed25519 -C "你的邮箱"      # 一路回车
cat ~/.ssh/id_ed25519.pub                # 复制输出，贴到 GitHub → Settings → SSH and GPG keys → New SSH key
ssh -T git@github.com                    # 出现 "Hi 用户名!" 即成功
```

---

## 一、推送代码到 GitHub

### 1.1 推送前自检（重要）

```bash
cd /e/madao/demo

# 1) 必需文件是否齐全
for f in edgeone.json package-lock.json data/wordbooks/manifest.json .env.example; do
  [ -f "$f" ] && echo "OK   $f" || echo "缺失 $f"
done

# 2) 词库是否齐全（应为 14 个：13 本 + manifest）
ls data/wordbooks/*.json | wc -l

# 3) 敏感文件绝不能被跟踪（应无输出）
git ls-files | grep -E "^(\.env$|\.data/|node_modules/|\.next/)" || echo "OK   无敏感文件入库"
```

> ⚠️ `data/wordbooks/*.json`（14 个文件，约 7.8 MB）**必须入库**，否则线上词库为空。
> 已确认 `.gitignore` 排除了：`node_modules` / `.next` / `.data` / `.env*` / `data/raw/` / `.codeartsdoer` / `.workbuddy`。

### 1.2 本地提交（仓库已初始化，此步为日常更新用）

```bash
cd /e/madao/demo
git add -A
git commit -m "更新描述"
git log --oneline -3          # 确认提交在
```

> 若目录尚未初始化：`git init -b main`。

### 1.3 在 GitHub 创建空仓库（网页）

1. 登录 https://github.com → 右上角 **+** → **New repository**
2. 填 Repository name（如 `wordleap`），选 **Public** 或 **Private**
3. **三个复选框全部留空**：不勾 README、不勾 .gitignore、不勾 license（勾了会导致 push 被拒、需先 pull 合并）
4. **Create repository**，记下仓库地址

### 1.4 关联远程并推送

```bash
cd /e/madao/demo
git remote add origin https://github.com/<用户名>/wordleap.git
git branch -M main
git push -u origin main
```

**若 `origin` 已存在但地址不对**：

```bash
git remote set-url origin https://github.com/<用户名>/wordleap.git
```

**弹出账号密码框**：用户名填 GitHub 用户名，密码填 **PAT**（不是登录密码）。
报 `Invalid username or password` → PAT 没复制全或没勾 `repo` 权限。

> 用 SSH 则地址换成 `git@github.com:<用户名>/wordleap.git`，首次会问 `Are you sure you want to continue connecting`，输 `yes`。

**推完后校验**（把用户名/仓库名换成你的）：

```bash
git ls-remote --heads origin        # 应看到 refs/heads/main
git remote -v
```

### 1.5 网页确认

打开 `https://github.com/<用户名>/wordleap`，确认能看到 `data/wordbooks/` 目录、`edgeone.json`、`package-lock.json`。

---

## 二、EdgeOne Pages 部署

> 全程在同一浏览器会话完成。

### 2.1 创建 Pages 项目

1. 登录 [EdgeOne 控制台](https://console.cloud.tencent.com/edgeone) → 顶部 **Makers** / 左侧 **Pages**
2. **创建项目** → 代码源选 **关联代码仓库** → 平台选 **GitHub** → 按提示授权
3. 选仓库 `wordleap`，分支 **`main`**
4. 构建配置**全部留空**（平台自动读根目录 `edgeone.json`：`npm install` / `npm run build` / 输出 `.next` / Node 20.18.0）
5. **创建**，等首次构建（2~5 分钟）

构建成功标志：日志末尾出现 `✓ Generating static pages` 且无红字。
完成后会给出 `https://xxxx.edgeone.app` 预览链接（大陆打不开、3 小时过期，属正常）。

### 2.2 配置环境变量（必须）

项目 → **设置** → **环境变量**，逐条添加：

| 变量名 | 值 | 说明 |
|---|---|---|
| `STORAGE_DRIVER` | `edgeone-kv` | **必填**。漏掉则所有写操作 500（边缘节点无磁盘） |
| `SESSION_SECRET` | 见下方生成命令 | **必填**。不填会回落到内置 dev 密钥，存在伪造会话风险 |
| `AI_API_KEY` | `sk-...`（DeepSeek） | AI 功能密钥；不用 AI 可留空（会返回演示内容） |
| `AI_BASE_URL` | `https://api.deepseek.com/v1` | 大模型地址 |
| `AI_MODEL` | `deepseek-chat` | 模型名 |
| `COOKIE_SECURE` | `true` | 生产 HTTPS 建议显式设置；留空则自动按 `x-forwarded-proto` 判定 |
| `ADMIN_USERNAME` | 如 `admin` | 可选，须与下面同时设置 |
| `ADMIN_PASSWORD` | 如 `Adm!2026#Sec` | 可选，≥ 6 位 |

**生成 SESSION_SECRET（本地执行，复制结果）：**

```bash
# Git Bash / macOS / Linux
openssl rand -hex 24

# PowerShell
-join (1..48 | ForEach-Object { "{0:x}" -f (Get-Random -Maximum 16) })
```

> `ADMIN_USERNAME` / `ADMIN_PASSWORD` 两个都填才生效（缺一跳过）。该账号在**首次有人调用登录接口时**幂等创建，创建后即 admin；不配置则第一个注册的用户自动成为管理员。
> 添加后点 **保存**。

### 2.3 创建并绑定 KV 存储（必须）

1. 左侧菜单 → **KV 存储**（部分版本叫「边缘存储」/「数据连接」，搜 "KV"）→ **创建命名空间**，名称：`vocab-kv`
2. 回到 **Pages 项目 → 设置 → 数据连接 / KV 绑定**
3. 把 `vocab-kv` **绑定为变量名 `VOCAB_KV`**（代码按 `VOCAB_KV → KV → PAGES_KV → EDGEONE_KV` 顺序探测，推荐就用 `VOCAB_KV`）
4. 保存

### 2.4 重新构建（让环境变量 + KV 生效）

> 环境变量与 KV 绑定**不热更新**，改完必须重新构建。

项目 → **部署记录** → **重新部署** / **手动触发** → 选 `main` → **构建**。

### 2.5 绑定自定义域名（生产必须）

1. 项目 → **域名管理** → **添加域名**，填你的域名
2. 按提示到 DNS 服务商加 **CNAME**（EdgeOne 会给出目标值）
3. 等 DNS 生效（几分钟 ~ 1 小时）
4. 中国大陆可用区：域名需完成 **ICP 备案**（1~2 周）；海外可用区：免备案但大陆延迟较高

---

## 三、部署后验收

用**手机真机 + 自定义域名**逐项勾：

- [ ] 首页显示 **13 本词库**（不是空列表）
- [ ] 注册 → 登录 → 退出 正常
- [ ] 学 3 个词 → 刷新 → 记录仍在 ←（**KV 生效的判定标准**）
- [ ] 测验：拼写 / 听写 / 填空 各跑一次，计分正确
- [ ] **答完最后一题点「查看结果」进入成绩页**（回归重点）
- [ ] 个人中心切深色主题 → 刷新仍保持
- [ ] AI 精讲 / AI 对话有回复；对话「历史」可恢复旧会话
- [ ] 移动端：刘海屏不遮挡、手势条区域可点
- [ ] 桌面端：布局未退化

**故障速查**

| 症状 | 最可能原因 | 处理 |
|---|---|---|
| 注册/登录 500 | `STORAGE_DRIVER` 未设 / KV 未绑 `VOCAB_KV` | 回 2.2 / 2.3，重新构建 |
| 词库空列表 / 404 | `data/wordbooks/*.json` 未入库 | `git ls-files data/wordbooks` 确认，补推后重建 |
| AI 对话中断 | 模型单次回复 > 60s 被 `maxDuration` 截断 | 换快模型 / 调小 `max_tokens` |
| 登录后仍 401 | `x-forwarded-proto` 缺失导致 secure 判定错误 | 显式设 `COOKIE_SECURE=true`（HTTP 场景设 `false`），重建 |
| 构建报 `Cannot find module 'next'` | `package-lock.json` 未入库 | `git ls-files package-lock.json` 确认 |
| 预览链接失效 | `*.edgeone.app` 3 小时过期，正常 | 绑自定义域名（2.5） |

---

## 四、日常更新 / 回滚

```bash
cd /e/madao/demo
git add -A
git commit -m "更新描述"
git push            # 推到 main 会自动触发 EdgeOne 构建
```

- 只改**环境变量 / KV 绑定**时不会自动重建，需手动「重新部署」
- 回滚：项目 → **部署记录** → 任一历史版本可一键回滚

---

## 五、命令速记卡

```bash
# 首次上传
cd /e/madao/demo
git init -b main
git add -A && git commit -m "feat: 初始化"
git remote add origin https://github.com/<用户名>/wordleap.git
git push -u origin main

# 日常更新
git add -A && git commit -m "更新描述" && git push

# 生成会话密钥
openssl rand -hex 24
```

控制台三件套顺序固定：**环境变量 → KV 绑定 → 重新构建**。改过不重建，一律不生效。
