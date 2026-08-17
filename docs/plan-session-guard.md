# Plan: dsh-session-guard —— 上下文守卫插件（爱丽丝全家桶新成员）

> 状态：实施中（dev/aris 分支）
> 目标：解决「上下文不足时会话直接结束无法继续」——补齐 DSH 宿主的两个缺口。
> 仓库：`G:\CodeRep\DevRep\dsh_aris_agent`（dev/aris 分支），新包 `packages/dsh-session-guard`。

---

## 1. 调研结论摘要（2026-08-18）

### 1.1 成熟框架怎么做

| 机制 | Claude Code | Kilo Code | DSH 宿主（现状） |
|---|---|---|---|
| 自动压缩（预防） | Auto-Compact，窗口末端预留 13K buffer 触发 | auto-compaction：threshold% + reserved safety buffer（min(20K, 输出上限)） | ✅ compaction-basic：pre-step 达窗口 80% 压缩（thresholdRatio 0.8） |
| 压缩产物 | 结构化摘要 + 状态重建（文件/Plan/技能重注入） | anchored summary + 保留最近 2 turn 原样 | ✅ 8 节结构化 checkpoint + 保留尾部 16% + KV cache 复用 |
| 工具结果剪枝 | Microcompact（缓存感知） | 40K 窗口外工具输出替换占位符 | ✅ tool-result-pruner（8192/4096/1024 字符） |
| 溢出兜底 | 413 恢复瀑布：collapse drain → reactive compact → 放弃 | reserved buffer 防溢出 + /compact | ✅ agent/request-error：CONTEXT_WINDOW_EXCEEDED → 压缩 → retry（仅 1 次） |
| 输出截断续写 | 8K→64K 升级重试 + 续写提示 ×3 | 有 output-token 处理 | ❌ **无**（turn 直接结束） |
| 熔断器 | 连续 3 次压缩失败停用 | — | ❌ 无 |
| 失败存档/续接 | /rewind、checkpoint | — | ⚠️ 仅日志 |

### 1.2 DSH 宿主源码事实（rc.6，已核实）

- `dsh-base` bundle 的 cordis.patch.yml 已挂 `token-meter` / `compaction-basic`（auto 默认 true）/ `command-compact` / `tool-result-pruner`，web profile 经 bundles 自动加载 → **自动压缩一直在运行**。
- `dsh-compaction-basic`：pre-step 压力压缩（需模型声明 contextWindow：DeepSeek 声明 1M、pi-ai gpt-5.4 声明 272K ✓）；`agent/request-error` 溢出恢复（`maxOverflowRetries` 默认 1，失败即抛给用户 → 会话结束）。
- `dsh-agent-loop` `step()`：`finish.kind === "max-tokens"` → 直接 `return { kind: "max-tokens" }` → turn/end（reason=max-tokens）→ **无续写**。
- ReactLoopAgent 公开 `send/followup/steer/inject/cancel/runMaintenance`；`agent/status`、`agent/pre-step`、`agent/request-error`、`session/event` 事件可监听；`turn/start` 在 pre-step 前 append（turn 内可安全执行压缩事务）。
- `BasicCompactionEngine` 公开 `compactRegion(start, end, agent, signal)`（turn 内 owner 模式）；`@deepseek-ai/dsh-compaction` 导出 `toolPairingBalancedBefore/After`、`CompactionEngine`、`ManualCompactionError`。
- service 名：`ctx.agents`（AgentRegistry）、`ctx.compaction`（CompactionEngine）。

### 1.3 根因定位（用户痛点）

1. **输出 max_tokens 截断**（deepseek-v4-flash + reasoningEffort: max 时思考 token 吃满输出预算）→ turn 直接结束 → 「会话结束无法继续」。
2. **溢出恢复仅 1 次**：重试仍溢出 → 错误抛给用户 → 会话结束。
3. 压缩失败（总结自身溢出/无文本/不小于原文）→ 无兜底、无 UI 提示。

---

## 2. 方案设计：`@aimercat/dsh-session-guard`

只做宿主没有的，不重复造引擎。host half 三个模块 + 配置 + 事件审计。

### 2.1 Module A：输出续写守卫（continuation guard）

- 监听 `session/event` 的 `turn/end`（reason.kind === "max-tokens"）。
- 通过 WeakMap（`agent/pre-step` 时记录 session→agent）找到 owner agent。
- **安全前置检查**：最后一个 assistant/message 若含未闭合 tool-call（无对应 tool/result），跳过续写（DeepSeek API 不允许 tool_calls 后直接跟 user 消息）并记一次失败。
- 调用 `agent.followup(续写消息)` 唤醒新 turn；续写消息 = `createUserMessage({content:[{type:"text",text:prompt}]}, source: {kind:"plugin",plugin:"dsh-session-guard"})`。
- 提示模板仿 Claude Code：「Output token limit hit. Resume directly — no apology, no recap of what you were doing. Pick up mid-thought if that is where the cut happened. Break remaining work into smaller pieces.」（可配置，中文模板可选）。
- 连续续写上限 `maxContinuations`（默认 3，按 session 维度计数；turn 正常结束即重置）；达到上限后停手并记日志。

### 2.2 Module B：提前压缩哨兵（early compaction sentinel）

- 宿主在 80% 才压、溢出恢复只有 1 次 → 哨兵在更早阈值（`earlyThresholdRatio` 默认 0.7）主动压缩，给溢出留 buffer。
- `agent/pre-step` 时 `ctx.tokenMeter.measure(session)`；`totalTokens >= early 阈值` 且 `< 宿主阈值`（避免与宿主竞争）时：
  1. 自己选区：从尾部累计 `retainRatio`（默认 0.16）token，向前用 `toolPairingBalancedBefore` 找平衡边界（不拆 tool-call/result 对）；
  2. 调用 `ctx.compaction` 的 `compactRegion(start, end, agent, signal)`（运行时检测存在性，无则跳过——优雅降级）；
  3. 压缩后重新测量，若仍超阈值则逐轮推进（最多 `maxRounds` 默认 2）。
- pre-step 事件链串行执行，与宿主压缩天然互斥（宿主压完再测低于阈值 → 哨兵不压；反之亦然）。
- 错误捕获 → warn 日志 + 熔断计数（不打断 turn）。

### 2.3 Module C：熔断器 + 失败存档（breaker + checkpoint）

- **熔断器**：按 session 维度统计连续失败（续写跳过/哨兵压缩失败/溢出恢复失败），≥ `maxFailures`（默认 3）→ 停用 A/B 模块（日志 + `session/event` 可见审计事件），session 正常完成或新 session 时复位。
- **失败存档**：监听 `turn/end`（reason.kind === "error" 且 error.code === "CONTEXT_WINDOW_EXCEEDED"）→ 把会话关键状态写成 checkpoint 文档：
  - 路径：工作区 `.dsh/session-guard/checkpoints/<sessionId>-turn<N>.md`（可配置）；
  - 内容：会话 id/标题、时间、最近消息的摘要级导出（`session.deriveMessages()` 尾部裁剪）、下一步建议；
  - 用途：会话结束后可人工/脚本续接（Codex resume 哲学）。

### 2.4 配置（z schema，仿 compaction-basic 风格）

```ts
{
  enabled: boolean,            // 总开关，默认 true
  continuation: { enabled: true, maxContinuations: 3, prompt: string },
  sentinel:     { enabled: true, earlyThresholdRatio: 0.7, retainRatio: 0.16, maxRounds: 2 },
  breaker:      { enabled: true, maxFailures: 3 },
  checkpoint:   { enabled: true, dir: ".dsh/session-guard" },
}
```

---

## 3. 工程结构

```
packages/dsh-session-guard/
├── package.json          # @aimercat/dsh-session-guard；dsh.bundle.patch + platform web 骨架
├── tsconfig.json         # extends ../../tsconfig.base.json, composite
├── tsdown.config.ts      # node half esm（本包只有 host half，无 client bundle）
├── cordis.patch.yml      # - insert: [{ id: session-guard, name: '@aimercat/dsh-session-guard' }]
├── vitest.config.ts      # 单测
└── src/
    ├── index.ts          # SessionGuard Service（inject: ["tokenMeter"]，ctx.get 降级其余）
    ├── config.ts         # resolveConfig + 校验（严格 key 白名单）
    ├── continuation.ts   # Module A
    ├── sentinel.ts       # Module B（含范围选择）
    ├── breaker.ts        # Module C 熔断器
    ├── checkpoint.ts     # Module C 存档
    ├── types.ts          # 共享类型
    └── invariant.ts      # assertNever 等
```

依赖：仅 `@deepseek-ai/dsh-compaction`（toolPairing 工具 + ManualCompactionError）、`@deepseek-ai/dsh-llm`（createUserMessage）、`@deepseek-ai/schemastery`（z）、`@deepseek-ai/cordis`（Service）。peerDeps 与 dsh-aris 一致风格。

## 4. 聚合接入（爱丽丝全家桶）

- `packages/dsh-aris-all/aggregate.yml`：`patchFrom` 与 `deps` 各加 `../dsh-session-guard`；
- 重跑 `node scripts/aggregate.mjs` 重新生成聚合 patch（--check 防漂移）；
- dev 实测：aris-dev profile 挂 `@aimercat/dsh-session-guard`（link 到 DevRep），bundle 自动同步 patch 行。

## 5. 验证关卡

| 关卡 | 动作 | 通过标准 |
|---|---|---|
| L1 | `pnpm typecheck && pnpm build && pnpm test`（workspace 内） | 全绿 |
| L2 | 检查 lib 产物 | host half 正常 ESM；无 client 依赖 |
| L3 | dev profile `--dump-config` | session-guard 行合成出现 |
| L4 | 杀 runtime node + 重启 dev GUI（3081） | 加载无报错；日志无异常 |
| L5 | **用户网页确认**（dev GUI） | 行为符合预期后合回 master（--ff-only） |

## 6. 风险与降级

- DeepSeek API 不允许「assistant 带 tool_calls 后直接跟 user 消息」→ Module A 前置检查未闭合 tool-call，有则跳过（安全优先）。
- `ctx.compaction` 无 `compactRegion`（宿主版本差异）→ Module B 静默降级为纯监控日志。
- 哨兵与宿主 pre-step 压缩竞争 → 事件链串行 + 阈值区间错开（0.7~0.8 之间才介入）。
- 续写循环失控 → maxContinuations 上限 + 熔断器。
- checkpoint 写入失败 → 仅 warn，不影响会话。

## 7. 实施步骤

1. [x] 调研与可行性验证（本 plan 前完成）
2. [ ] 新包骨架：package.json / tsconfig / tsdown / cordis.patch.yml / vitest
3. [ ] config.ts（校验）＋ types.ts ＋ invariant.ts
4. [ ] Module A continuation（含未闭合 tool-call 检查）
5. [ ] Module B sentinel（含范围选择）
6. [ ] Module C breaker + checkpoint
7. [ ] index.ts 组合 + 事件注册
8. [ ] 单测（config/continuation/sentinel/breaker）
9. [ ] L1 构建验证（typecheck/build/test）
10. [ ] 聚合接入 dsh-aris-all + 重生成 patch
11. [ ] L3/L4 dev profile 验证
12. [ ] L5 用户确认 → 合回 master

---

*调研参考：Claude Code 官方博客（session management & 1M context）、claude-code 源码分析（四层压缩）、Kilo Code Context Condensing 官方文档、DSH 宿主 rc.6 源码（dsh-compaction-basic / dsh-agent-loop / dsh-llm-deepseek / dsh-base cordis.patch.yml）。*
