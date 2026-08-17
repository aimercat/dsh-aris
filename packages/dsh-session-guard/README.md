# @aimercat/dsh-session-guard

**上下文守卫**（爱丽丝全家桶成员）——解决「上下文不足时会话直接结束无法继续」。

DSH 宿主自带自动压缩（80% 阈值 + 溢出重试 1 次），但仍有两个致命缺口：**输出被 max_tokens 截断时 turn 直接结束**、**溢出恢复失败后没有任何兜底**。本插件补齐这三层，不重复造引擎。

## 能力

| 模块 | 行为 | 对照 |
|---|---|---|
| **Module A 输出续写守卫** | `turn/end` 出现 `max-tokens` 时，自动用续写提示唤醒 agent 继续（Claude Code 续写提示血统）；未闭合 tool-call 时安全拒绝；每会话最多 `maxContinuations` 次 | Claude Code 8K→64K + 续写 ×3 |
| **Module B 提前压缩哨兵** | 每步前测量 token，达声明窗口 `earlyThresholdRatio`（默认 70%，早于宿主 80%）主动压缩，选区保留尾部原文且不拆 tool-call/result 对，复用宿主 `compaction.compactRegion` 事务 | Kilo 的 reserved safety buffer |
| **Module C 熔断器 + 失败存档** | 按会话连续失败计数，超阈值停用守卫防烧钱；上下文溢出到达用户时，在工作区 `.dsh/session-guard/checkpoints/` 写续接存档 | Codex resume 哲学 |

## 配置

挂载行 `session-guard`（`cordis.patch.yml`），profile 覆盖其 `config` 即可：

```yaml
- id: session-guard
  config:
    enabled: true
    continuation:
      enabled: true
      maxContinuations: 3          # 每会话最多连续续写次数
      prompt: '...'                # 续写提示模板
    sentinel:
      enabled: true
      earlyThresholdRatio: 0.7     # 早于宿主 0.8 的压缩阈值
      retainRatio: 0.16            # 压缩保留的尾部原文比例
      maxRounds: 2                 # 单次 pre-step 最多压缩轮数
    breaker:
      enabled: true
      maxFailures: 3               # 连续失败熔断阈值
    checkpoint:
      enabled: true
      dir: '.dsh/session-guard'    # 存档目录（工作区相对，或绝对路径）
```

## 工程

- 仅 host half；依赖 `@deepseek-ai/dsh-compaction`（toolPairing 平衡工具）与 `@deepseek-ai/dsh-llm`（消息构造），运行时从宿主解析。
- 事件接线：`agent/pre-step`（哨兵 + session→agent 映射）、`session/event`（turn/end 边界）。
- 降级：宿主无 `compaction.compactRegion` 时哨兵静默退化为观测；无模型窗口声明时跳过。

## 验证

- L1：`pnpm typecheck && pnpm build && pnpm test`（44 单测，含 apply 集成测试）。
- L3：`dsh --profile <dev> --dump-config` 应见 `session-guard` 行。
- L5：dev GUI（3081）用户网页确认后合回 master。
