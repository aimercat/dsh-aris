# Aris Live2D MVP 接入说明

## 当前能力

当前初版已经具备：

- `packages/dsh-aris` 的 host/client 两侧接线
- `arisAvatar` session projection
- `aris_avatar_control` 工具
- Aris preset 会话内的 Live2D overlay
- 位置 / 缩放 / 显隐本地记忆
- 基础自动表演：开场、思考、完成、错误
- `motion` / `expression` / `bubble` 三类最小控制意图

## 仍未包含

- 实时 lipsync
- 多模型切换
- 正式授权内置模型资源
- Key 专属视觉切换
- 复杂 sequence 编排

## 如何配置模型

在 profile 的 patch 里，为 `@aimercat/dsh-aris` 增加配置，例如：

```yaml
- id: dsh-aris
  name: '@aimercat/dsh-aris'
  config:
    live2dEnabled: true
    live2dModelBase: file:///ABSOLUTE/PATH/TO/aris.model3.json
    live2dAnchor: bottom-right
    live2dScale: 1
    live2dDraggable: true
    live2dFollowPointer: false
```

如果你的模型文件由本地静态服务提供，也可以使用可访问 URL，而不一定是 `file:///`。

当前初版默认按 **Cubism 3/4 的 `model3.json` 路线** 处理，并会在浏览器侧自动加载 `live2dcubismcore.min.js`。如果你的模型是旧的 Cubism 2.1 `model.json` 路线，当前 MVP 不支持，且会在启动时要求 `live2d.min.js`。

## 如何安装主包

```powershell
# <repo-path> 替换为本仓库根路径
# 插件安装目标是 workspace 子包
 dsh plugin --profile <name> add link:<repo-path>\packages\dsh-aris

# 复制 preset
Copy-Item "<repo-path>\packages\dsh-aris\preset\aris" "$env:USERPROFILE\.dsh\.agent-presets\aris" -Recurse -Force
```

## 如何验证

1. 以 `aris` preset 开一个新会话
2. 确认该 profile 中 `@aimercat/dsh-aris` 的 `live2dEnabled` 已开启
3. 确认 `live2dModelBase` 指向有效模型设置文件
4. 打开会话后，应出现右下角 Live2D overlay
5. 会话开始时会触发一次 `greeting` 语义动作
6. 会话运行中：
   - 思考/运行时进入 `thinking`
   - 成功完成后进入 `victory`
   - 错误时进入 `warning` 并显示气泡

## 手动控制

当前工具名：`aris_avatar_control`

### 播放动作

```json
{
  "type": "motion",
  "group": "TapBody",
  "priority": "force"
}
```

### 切换表情

```json
{
  "type": "expression",
  "expression": "f02"
}
```

### 显示气泡

```json
{
  "type": "bubble",
  "text": "邦邦卡邦！老师，爱丽丝已上线。",
  "tone": "happy",
  "durationMs": 2200
}
```

## 已知限制

- 若 `live2dModelBase` 未配置或失效，`aris_avatar_control` 会降级为 `noop`
- 当前实现仅支持 Cubism 3/4 模型；Cubism 2.1 的 `model.json` 线不在 MVP 范围内
- 动作组 / 表情名取决于具体模型资源，当前默认语义映射只做了最保守的尝试
- 不存在的 motion / expression 会被静默忽略，不会炸掉 GUI
- 当前 overlay 拖拽是整个角色容器拖动，尚未区分单独拖拽手柄

## 调试建议

- 若角色不显示，先检查模型路径是否真实可访问
- 若只显示气泡不显示模型，通常是模型资源加载失败或不完整
- 若工具返回 `appliedMode: noop`，说明当前会话未激活 live2d 层或未配置模型路径
- 若界面正常但角色不响应，优先检查当前会话是否真的是 `aris` preset

## 验证结果

当前实现已通过：

- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

现有测试仍以 brave 权限层为主；Live2D 目前主要通过类型检查、构建和运行时降级策略兜底。