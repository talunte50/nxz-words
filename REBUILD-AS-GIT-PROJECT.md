# 重建 EdgeOne 项目为 Git 集成类型（真绑定 GitHub）

> 目的：让 EdgeOne 后台真正显示「已关联 GitHub 仓库」，实现平台侧自动构建部署。
>
> 背景：EdgeOne 项目类型**创建后不可更改**，且两种类型互斥：
> - **直接上传** → 只能用 CLI / 控制台上传产物（当前 `nxz-words` 就是这种）
> - **Git 集成** → 平台拉取仓库自动构建（CLI 无法部署）
>
> CLI 只有 `makers create --template`（从模板建），**没有**创建 Git 集成项目的命令，
> 所以必须手工在控制台操作。

---

## 第 0 步：备份（已完成，核对用）

以下值已备份到 `.workbuddy/env-backup-2026-09-27.txt`，重建后原样填回：

```
STORAGE_DRIVER = edgeone-kv
SESSION_SECRET = 44026e99da9d4b051a9a8b5190dedd98f87c68929f8c643f
COOKIE_SECURE  = true
AI_BASE_URL    = https://apihub.agnes-ai.cn/v1
AI_MODEL       = agnes-3.0-flash
AI_API_KEY     = wk-VZM68PF6pqQ4i8IKt9kiCLxWcoqbPsxVg0HqEPsWjxphT0pw
```

**不会丢的**：词库数据（在 GitHub 仓库）、`edgeone.json` 全部配置、代码。
**会丢的**：环境变量、KV 绑定（需重配）。

---

## 第 1 步：删除旧项目

EdgeOne 控制台 → **Pages** → 找到 `nxz-words` → **设置** → 页面底部 → **删除项目**

> 若提示需要输入项目名确认，输入 `nxz-words`。

⚠️ 删除后 `https://nxz-words.edgeone.cool` 会立即失效，直到新项目部署完成。

---

## 第 2 步：新建 Git 集成项目

控制台 → **Pages** → **创建项目** → 选 **「导入 Git 仓库」**（**不要**选「直接上传」）

1. 授权 GitHub（若未授权过，会跳转授权页；选 `talunte50` 账号，授权范围可只勾这一个仓库）
2. 选择仓库：**`talunte50/nxz-words`**
3. 分支：**`main`**
4. 项目名称：**`nxz-words`**（保持同名，域名可延续）
5. 加速区域：**全球可用区（不含中国大陆）** ← 免备案，与你之前的选择一致

---

## 第 3 步：构建配置（关键，对照 `edgeone.json`）

| 配置项 | 填写值 |
| --- | --- |
| 框架预设 | `Next.js` |
| 构建命令 | `npm run build` |
| 安装命令 | `npm install` |
| 输出目录 | `.next` |
| Node 版本 | `20.18.0` |

> 这些值应与仓库里的 `edgeone.json` 完全一致。若平台支持读取 `edgeone.json` 自动填充，优先让它自动读。
> **函数最大执行时长**设为 `60`（对应 `nodeFunctionsConfig.maxDuration`，AI 流式回复需要）。

---

## 第 4 步：配置环境变量

项目创建后 → **设置** → **环境变量** → 逐条添加（环境选 **Production**）：

| Key | Value |
| --- | --- |
| `STORAGE_DRIVER` | `edgeone-kv` |
| `SESSION_SECRET` | `44026e99da9d4b051a9a8b5190dedd98f87c68929f8c643f` |
| `COOKIE_SECURE` | `true` |
| `AI_BASE_URL` | `https://apihub.agnes-ai.cn/v1` |
| `AI_MODEL` | `agnes-3.0-flash` |
| `AI_API_KEY` | `wk-VZM68PF6pqQ4i8IKt9kiCLxWcoqbPsxVg0HqEPsWjxphT0pw` |

> `STORAGE_DRIVER` 必须为 `edgeone-kv`；`SESSION_SECRET` 换新值也可以，但会导致所有用户登录态失效，建议沿用。

---

## 第 5 步：绑定 KV（等审批通过后做）

项目 → **设置** → **KV 存储 / 数据连接** → 绑定命名空间 → **变量名必须填 `VOCAB_KV`**

> 变量名不是 `VOCAB_KV` 会导致所有写操作 500。

---

## 第 6 步：移除 Actions 工作流（重要）

Git 集成项目由平台构建，**不能再用 CLI 部署**（会冲突，且 CLI 明确只支持直接上传类型）。

删除 `.github/workflows/deploy-edgeone.yml`：

```bash
git rm .github/workflows/deploy-edgeone.yml
git commit -m "ci: 移除 CLI 部署工作流（项目已改为 Git 集成，由平台构建）"
git push origin main
```

同时可以清理不再需要的脚本与 secret：

```bash
git rm scripts/gh-set-secret.mjs scripts/gh-run-logs.mjs
```

> 仓库 secret `EDGEONE_API_TOKEN` 可在 Settings → Secrets → Actions 里删除。

---

## 第 7 步：验证

```bash
# 1. 平台侧构建是否触发
#    控制台 → Pages → nxz-words → 部署记录，应能看到由 push 触发的构建

# 2. 线上连通性
curl -s -o /dev/null -w "%{http_code}\n" https://nxz-words.edgeone.cool/login

# 3. 关闭「访问保护」后再验证（否则会返回 401 + x-eop-msg: eo_time missing）
```

验收清单：

- [ ] 首页能加载词库列表（非空）
- [ ] 注册 → 登录 → 退出 正常（**验证 KV 已生效**）
- [ ] 学词页学 3 个词 → 刷新 → 记录仍在
- [ ] AI 精讲 / AI 对话能收到回复
- [ ] 推送一次代码 → 平台自动重新构建并上线

---

## 附：两种方案对比（供决策参考）

| | 上传式（Actions 调 CLI） | Git 集成（真绑定） |
| --- | --- | --- |
| 后台显示 | 上传产物 | 已关联 GitHub |
| 触发 | Actions 构建后 CLI 上传 | 平台拉代码自行构建 |
| 构建环境 | GitHub 机器 | EdgeOne 平台 |
| 环境变量 | 项目上持久保存 | 项目上持久保存 |
| 重建成本 | 无（现状） | 需删项目重建 + 重配变量 |
| 大陆可用性 | 不受影响 | 不受影响 |

**功能等价性**：两者都能实现「push 代码 → 自动上线」，差别主要在后台展示形式与构建执行方。
