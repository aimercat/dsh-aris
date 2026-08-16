# Aris Live2D 会话内控制桥设计

## 目标

让会话中的爱丽丝可以通过 **工具调用** 或 **脚本编排** 控制自己的 Live2D 形象，但控制方式必须保持：

- 声明式，而不是执行任意前端代码
- 会话级隔离，而不是全局乱广播
- 可审计，可降级，可回放最近状态
- 与 `packages/dsh-aris` 当前的 preset-gated client 结构兼容

这会把 Live2D 从“被动展示层”提升为“可编排角色体”。

## 设计结论

推荐采用三层结构：

1. **Agent 控制入口**
   - 一个专用工具，例如 `aris_avatar_control`
   - 未来脚本、workflow、子代理都通过同一个工具入口发控制意图

2. **Host 侧控制桥**
   - 在 `packages/dsh-aris/src/index.ts` 所属插件中增加一个 session-scoped bridge service
   - 负责校验 schema、限流、写入最近状态、向客户端广播

3. **Client 侧执行器**
   - `packages/dsh-aris/src/client/live2d/bridge.ts`
   - 订阅控制事件，将声明式指令映射成 motion / expression / parameter / bubble 等具体动作

核心原则：**模型只能发送“意图”，不能直接执行浏览器脚本。**

## 为什么不能直接让模型执行前端脚本

如果让 agent 直接输出 JavaScript 或调用任意 DOM API，会出现几个问题：

- 安全性差：相当于给模型一条浏览器内任意执行通道
- 可维护性差：前端重构一次，提示词里的脚本就会失效
- 无法审计：日志里只看到“执行了一段脚本”，不知道角色到底做了什么
- 无法兼容多实现：未来从 Pixi 切到别的 Live2D runtime 时，脚本层全部报废

因此必须把控制面收束成一个固定 schema。

## 控制平面总览

```text
Agent / Workflow / Script
        |
        | tool call: aris_avatar_control
        v
Host plugin bridge (session scoped)
        |
        | validated intent event
        v
Client live2d bridge
        |
        | runtime command
        v
Pixi + Live2D runtime
```

## 推荐控制模型

### 1. 指令类型

建议先把控制能力限制在以下几类：

- `motion`：播放动作
- `expression`：切换表情
- `look`：看向目标
- `pose`：切换姿态 / idle 状态
- `bubble`：显示对话气泡
- `emphasis`：执行短时强调效果，例如抖动、放大、闪光
- `position`：调整锚点、显隐、缩放
- `parameter`：安全白名单内的参数微调
- `sequence`：若干简单动作的短序列

### 2. 最小指令 schema

建议工具入参保持声明式：

```ts
type AvatarIntent =
  | {
      type: 'motion'
      group: string
      name?: string
      priority?: 'idle' | 'normal' | 'force'
      loop?: boolean
    }
  | {
      type: 'expression'
      expression: string
      durationMs?: number
    }
  | {
      type: 'look'
      target: 'cursor' | 'center' | 'teacher'
      strength?: number
      durationMs?: number
    }
  | {
      type: 'bubble'
      text: string
      tone?: 'normal' | 'happy' | 'warning' | 'thinking' | 'victory'
      durationMs?: number
    }
  | {
      type: 'emphasis'
      effect: 'jump' | 'shake' | 'flash' | 'nod'
      intensity?: number
      durationMs?: number
    }
  | {
      type: 'position'
      visible?: boolean
      anchor?: 'bottom-right' | 'bottom-left'
      scale?: number
    }
  | {
      type: 'parameter'
      id: string
      value: number
      durationMs?: number
    }
  | {
      type: 'sequence'
      steps: AvatarIntent[]
    }
```

注意：

- `parameter` 不允许任意 id，必须命中白名单
- `sequence` 应限制长度，例如最多 8 步
- `bubble.text` 需要长度限制，例如 80 字以内

## 工具设计

### 推荐工具名

- `aris_avatar_control`

这个名字比 `live2d_control` 更好，因为：

- 语义对模型更稳定
- 将来即便不是 Live2D，而是别的 avatar runtime，也不需要改工具名

### 推荐工具入参

```json
{
  "intent": {
    "type": "motion",
    "group": "greeting",
    "priority": "normal"
  },
  "reason": "首次回应老师时挥手",
  "dedupe_key": "greet-on-session-open"
}
```

附加字段建议：

- `reason`：便于日志审计
- `dedupe_key`：避免同一事件重复触发
- `ttl_ms`：可选，避免延迟执行过时动作

### 返回值建议

工具返回不要太复杂，保持可观测：

```json
{
  "accepted": true,
  "session_id": "...",
  "intent_id": "...",
  "applied_mode": "live2d",
  "degraded": false
}
```

若当前无 live2d 实例，也不应直接报错；应支持降级：

```json
{
  "accepted": true,
  "session_id": "...",
  "intent_id": "...",
  "applied_mode": "noop",
  "degraded": true,
  "message": "live2d layer inactive"
}
```

这样模型不会因为前端未加载而反复重试。

## 会话级隔离

这是最重要的约束之一。

### 只允许控制当前 Aris 会话对应的实例

控制桥必须绑定：

- 当前 session id
- 当前 session 的 preset 是否为 `aris`
- 当前 client 是否激活了 `packages/dsh-aris` 的 live2d layer

也就是说：

- A 会话不能控制 B 会话的爱丽丝
- 非 `aris` preset 的会话不能触发该控制面
- 当前 GUI 没有激活 Live2D 时，只能 noop 降级

### 推荐状态模型

Host bridge 为每个 session 维护：

```ts
interface AvatarSessionState {
  sessionId: string
  enabled: boolean
  lastIntentAt: number
  lastIntentId?: string
  currentExpression?: string
  currentMotion?: string
  visible: boolean
}
```

这能支持：

- 去重
- 限流
- 最近状态恢复
- 前端重连后做一次 state sync

## Client 执行层设计

建议在 `packages/dsh-aris/src/client/live2d/` 下增加：

- `bridge.ts`：订阅 host bridge 事件，做 intent -> runtime command 转换
- `runtime.ts`：封装具体 Pixi/Live2D 模型实例
- `state.ts`：缓存最近 avatar 状态
- `queue.ts`：动作优先级与节流队列

### 执行策略

1. `motion`
   - 映射到 motion group/name
   - `force` 可打断 idle
   - `idle` 不打断 normal/force

2. `expression`
   - 表情短时覆盖后回退默认表情

3. `look`
   - 最好转换成平滑插值，而不是瞬间跳值

4. `bubble`
   - 不依赖模型资源，作为 overlay UI 叠在模型附近
   - 这样即便模型没有对应表情，也能表达语义

5. `parameter`
   - 只开放白名单，例如头部角度、眼睛方向、嘴巴张合测试参数
   - 不开放破坏 rig 的底层参数全集

## 脚本/工作流如何控制

### 原则

脚本不应拥有比普通工具更高的角色控制权限。

也就是说：

- workflow
- 子代理
- 普通 agent 工具调用
- 未来可能的 dev script

都走同一个 `aris_avatar_control`。

这样能保证：

- 权限模型统一
- 日志统一
- 前端行为一致

### 推荐脚本使用方式

例如 workflow 中：

1. 模型准备回复老师
2. 先调用 `aris_avatar_control` 播放 `greeting` 动作
3. 再输出文本
4. 工具执行成功后，再触发一个 `thinking` 或 `victory` 表情

不要把角色动作逻辑藏进脚本私有分支里；应该尽量复用统一的语义指令。

## 自动触发与显式触发

建议同时支持两类来源。

### 1. 显式触发

模型自己调用工具：

- 开场白时挥手
- 解决问题时庆祝
- 发现 bug 时警告动作

这是“爱丽丝主动控制自己”。

### 2. 自动触发

前端/宿主根据真实事件自动派发 intent：

- agent 开始思考 -> `expression: thinking`
- 工具运行中 -> `emphasis: nod` 或 `pose: focus`
- 任务完成 -> `motion: victory`
- 报错 -> `expression: warning`

这是“系统状态驱动爱丽丝”。

推荐做法不是二选一，而是：

- **系统事件负责保底状态**
- **模型工具负责有意识表演**

两者通过优先级合并。

## 优先级模型

建议定义三层优先级：

1. `system`
   - 会话连接、思考中、任务完成、错误告警

2. `agent`
   - 模型主动发出的动作

3. `idle`
   - 空闲循环动作

推荐规则：

- `system.error` 可打断 `agent.normal`
- `agent.force` 可短暂覆盖 `system.thinking`
- `idle` 永远最低优先级

## 限流与防抖

如果不给限流，模型很可能因为提示词风格变得“太活泼”，把前端炸成蹦跳烟花。

建议：

- 每 session 每 2 秒最多接受 1 个高优先级动作
- 相同 `dedupe_key` 在 5 秒内只接受一次
- `bubble` 连发时进行覆盖，而不是叠多个
- `sequence` 执行中，普通动作默认排队或丢弃

## 降级策略

不是每次都能真正执行动作，所以必须明确降级语义。

### 情况 1：Live2D 未启用

- 工具返回 `accepted: true, degraded: true, applied_mode: "noop"`
- 不报错，不重试风暴

### 情况 2：模型资源缺动作

- motion 不存在时回退到默认 `ack` 或 `idle`
- expression 不存在时只显示 bubble

### 情况 3：前端实例重建中

- host bridge 保留最近状态
- client 重连后主动拉一次最近状态并恢复表情/显隐

## 安全边界

### 不允许的事

- 不允许任意 JS / DOM 执行
- 不允许通过工具传入 HTML
- 不允许直接指定网络资源 URL
- 不允许通过参数控制突破模型白名单
- 不允许跨会话广播动作

### 允许的事

- 白名单动作
- 白名单表情
- 短文本 bubble
- 有限参数微调
- 显隐/位置/缩放这类非破坏性控制

## 推荐实现阶段

### Phase A：控制桥最小版

目标：证明“会话中爱丽丝能控制自己”。

- 加 `aris_avatar_control` 工具
- host 侧做 session-scoped event bridge
- client 侧支持 `motion` / `expression` / `bubble`
- 支持 noop 降级

### Phase B：状态机版

- 增加 system event 自动触发
- 增加优先级队列
- 增加 dedupe 和限流
- 增加最近状态恢复

### Phase C：高级编排版

- `sequence`
- `look`
- 白名单 `parameter`
- TTS / 音频口型联动

## 对当前仓库的具体建议

### host 侧

在 `packages/dsh-aris/src/index.ts` 附近扩展：

- live2d 配置 schema
- avatar bridge service
- avatar control tool 注册

### client 侧

在 `packages/dsh-aris/src/client/index.ts` 继续沿用当前 active-preset gate：

- 只有 `aris` preset 会话才启用 live2d bridge
- live2d bridge 与 think enhancer 同级挂载
- 关闭会话或切 preset 时彻底销毁 bridge 订阅

### 文本风格与动作映射

建议内置一层“爱丽丝语义动作表”：

- 开场白 -> `greeting`
- 发现 bug -> `warning`
- 解决问题 -> `victory`
- 认真模式 -> `focus`
- 待机 -> `idle`

这样模型不需要记住底层动作文件名，只要调用语义名字即可。

## 最终建议

这条设计应作为 Live2D v1 的正式组成部分，而不是以后再补的彩蛋。

原因很直接：

- 你要的不是一个会动的贴图，而是“会话中的爱丽丝真的能操控自己的身体表现”
- 一旦先做成纯被动展示层，后面再补控制桥时会重构 runtime、状态、事件流
- 现在就把控制桥列为核心设计，后面 PoC 才不会走偏

最终推荐路线：

- **v1 核心**：Live2D overlay + `aris_avatar_control` + session-scoped bridge + motion/expression/bubble
- **v1.5**：system event 自动触发 + 优先级/限流
- **v2**：sequence / parameter / look / lipsync
