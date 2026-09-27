# AI 例句生成与缓存方案（逆行者单词）

## 背景

- 全量词库 21995 词（7 本）来自 qwerty-learner 的 380 个源 JSON，这些源**只有 name/trans/usphone/ukphone 四个字段，本身无例句**。
- 当前拼写 / 听写 / 例句填空（cloze）三种题型中，cloze 依赖 `word.example`；无例句的词 cloze 会退化为"无挖空可填"。
- AI 精讲（`/api/ai/explain`）已支持大模型讲解，返回的 `examples` 有 2 条，但未回写到词书。

## 目标

按词「按需」生成例句 + 中文译文，**全局共享缓存**（例句是客观内容，非个性化数据），cloze / 听写 / 卡片 / AI 精讲 四个场景统一受益。

## 设计

### 1. 缓存层（KV，独立于用户数据）

新增 `lib/store/example-cache.ts`：

- key：`example:<wordId>`（wordId 已含 bookId 前缀，天然全局唯一）
- value：`{ en: string; zh: string; model: string; at: string }`
- 存储走 `lib/storage` 抽象（本地 file 兜底，EdgeOne KV 生产），与 `user-store` 同一套基础设施。
- API：
  - `getCachedExample(wordId): Promise<ExampleCache | null>`
  - `setCachedExample(wordId, en, zh): Promise<void>`（写入带 model/at 元信息）

> 选择独立 key 而非塞进词书 JSON：词书 JSON 只进前端 bundle / 动态 import，改它要重跑 build；KV 写缓存即时生效、天然全局共享、不污染词书文件。

### 2. 生成 API：`POST /api/ai/example`

入参 `{ wordId }`，逻辑：
1. `findWord(wordId)` 取词（词不存在 404）。
2. 先查缓存 `getCachedExample`，命中直接返回 `{ en, zh, cached: true }`（**不调 AI**）。
3. 未命中且词本身已有 `example`（静态词书种子数据）→ 直接回填缓存并返回 `{ en: word.example, zh: word.exampleZh, cached: true }`。
4. 都无 → 调 `chat()` 用**例句专用 prompt**（新增 `EXAMPLE_SYSTEM` + `exampleMessages(word)`），要求只输出 `{"en","zh"}` 一个 JSON；用 `extractJson` 解析。
5. 成功 → `setCachedExample`，返回 `{ en, zh, cached: false }`。
6. AI 未配置 → 返回 400 + `AiNotConfiguredError` 信息（前端 catch 后静默降级，不阻塞学习）。

约束：
- `maxTokens` 设 300（例句短），`temperature 0.3`（例句要稳定可复用，不宜太发散）。
- 生成失败（网络/解析异常）**不写缓存**，返回 500，前端下次重试。
- 单次生成走 Node 函数（非 Edge 200ms 限制内），与 `ai/explain` 同一约束。

### 3. 前端接入点

- `components/WordCard.tsx`：卡片翻到背面时，若 `!word.example`，`lib/client/api.ts` 新增 `fetchExample(wordId)` 调 `/api/ai/example`，拿到后 set 到本地 state 显示例句区；已 `example` 则直接用。
- `components/QuizSession.tsx`（cloze）：出题前确保例句存在——`/api/learn` 取到的词若无例句，先批量 `Promise.all(fetchExample)` 预热（限并发 2），再渲染挖空。
- `components/AiExplainPanel.tsx`：精讲面板的 `examples` 取回后，**顺带回写缓存**（调 `/api/ai/example` 或新增 `/api/ai/example/write` 复用同一缓存），下次卡片/cloze 免再调 AI。

> 为控制改动面，第一期只做「按需 fetch + 缓存」，不做批量预热写回；精讲面板回写作为第二迭代（避免一次性改动 5 个组件）。

### 4. 降级策略

- AI 未配置 / 调用失败：卡片与 cloze 显示占位「例句由 AI 生成（未配置/失败）」，**不阻塞**学习流程；cloze 该题自动跳过（不算错，计 `skipped`）。
- 已有静态例句（种子词书、或将来 build-dicts 能拉到带例句的源）优先用静态的，不调 AI。

## 验证

1. 单测 `example-cache`（file-store 模式）：写→读→命中/未命中。
2. 冒烟 `/api/ai/example`：未配置 AI 时返回 400 且词表学习不受影响。
3. 配置 AI 后：同词连调两次，第二次 `cached: true` 且未产生第二次 AI 请求（看日志或耗时）。
4. 回归：cloze 题型在有缓存例句时能正常挖空判定；无例句词 cloze 显示占位并跳过。

## 改动清单

| 文件 | 动作 |
|---|---|
| `lib/store/example-cache.ts` | 新增（get/set 缓存） |
| `lib/ai/prompts.ts` | 新增 `EXAMPLE_SYSTEM` + `exampleMessages` |
| `app/api/ai/example/route.ts` | 新增 API |
| `lib/client/api.ts` | 新增 `fetchExample(wordId)` |
| `components/WordCard.tsx` | 无例句时按需拉取并展示 |
| `components/QuizSession.tsx` | cloze 无例句时拉取/占位/跳过 |
| `README.md` | 说明例句缓存机制与 AI 未配置时的降级行为 |

不改动 `wordbooks-server.ts` / 词书 JSON 结构，零侵入现有学习流程。