# Aris Live2D 正式模型落地清单

## 背景

当前 Aris Live2D 已完成 MVP 级接线：

- `packages/dsh-aris` 的 host / client 两侧接线
- `arisAvatar` session projection
- `aris_avatar_control` 工具
- Aris preset 会话内的 session-gated Live2D overlay
- 位置 / 缩放 / 显隐本地记忆
- `motion` / `expression` / `bubble` 三类最小控制意图

当前模型仍应视为**临时模型**。`v2` 完成后的下一阶段，不是继续长期沿用临时方案，而是把现有控制链路接到**爱丽丝正式模型**这套长期基线上。

## 目标

把临时模型替换为可长期维护的正式模型，同时保留现有系统边界不变：

- preset 继续负责人格与使用门槛
- host 继续负责配置、projection、tool 注册
- client 继续负责渲染与运行时执行
- `aris_avatar_control` 继续作为声明式控制入口

正式模型阶段的重点不是“让模型显示出来”，而是建立一套**可持续替换、可持续维护、可持续扩展**的资产与运行时契约。

## 完成定义

满足以下条件，才算“正式模型建立完成”：

1. 默认使用的模型不再被视为临时资产。
2. 模型来源、授权边界、分发方式已经明确。
3. 模型格式与参数协议已经固定。
4. 现有 `aris_avatar_control` 的语义控制可稳定映射到正式模型。
5. `look` / `lipsync` / `expression state` 等 v2 能力不依赖临时命名猜测。
6. 文档中已写明资产落点、配置方式、验收标准与已知缺口。

## 清单

### 1. 模型来源与授权

先读：`docs/live2d-official-model-source-decision.md`

必须先确认以下问题：

- 来源类型：`现成授权模型` / `约稿新模型 + Rig` / `已有立绘拆件后重新 Rig`
- 使用范围：仅本地使用，还是允许随插件分发
- 入仓策略：允许直接存入仓库，还是只能本地外置
- 后续维护：动作、表情、贴图、参数缺口由谁维护

这一步是前置条件。没有授权结论，不应把任何正式资产接入仓库主线。

### 2. 运行格式基线

正式模型建议统一采用：

- `Cubism 4`
- `model3.json`
- `moc3`
- `motion3.json`
- `exp3.json`
- 可选 `physics3.json` / `pose3.json`

原因：当前 MVP 与后续 v2 方向都已经围绕 Cubism 3/4 路线设计，继续引入旧 `model.json` 路线只会增加兼容成本。

### 3. 资产目录约定

若授权允许入仓，建议目录结构固定为：

```text
packages/dsh-aris/
  assets/
    live2d/
      aris/
        model3.json
        aris.moc3
        textures/
        motions/
        expressions/
        physics3.json
        pose3.json
```

若授权不允许入仓，则保留目录约定，但实际资源通过 `live2dModelBase` 指向本地绝对路径或受控静态服务路径。

### 4. 参数协议

正式模型至少应支持以下常用参数或等价参数：

- `ParamAngleX`
- `ParamAngleY`
- `ParamBodyAngleX`
- `ParamEyeBallX`
- `ParamEyeBallY`
- `ParamMouthOpenY`

可选但推荐：

- `ParamBrowLY`
- `ParamBrowRY`
- `ParamEyeLOpen`
- `ParamEyeROpen`
- `ParamBodyAngleY`
- `ParamBreath`

要求：

- 在接入前明确记录真实参数名
- 若参数名与默认预期不同，必须通过映射表适配
- 不要把“运行时猜名字”当正式方案

### 5. 语义动作集

正式模型至少应具备以下语义动作：

- `idle`
- `greeting`
- `focus`
- `warning`
- `victory`
- `thinking`

这些动作是当前控制桥语义层最重要的稳定接口。底层资源文件名可以变化，但语义动作名不应漂移。

### 6. 语义表情集

正式模型至少应具备以下语义表情：

- `neutral`
- `happy`
- `thinking`
- `surprised`
- `warning`

如资源不足，可先用近似表情替代，但必须在文档中标记“占位映射”。

### 7. 声音与口型

正式模型阶段至少需要明确：

- 是否允许 motion 自带音频
- 是否默认静音
- `lipsync` 的最低实现是否基于 `ParamMouthOpenY`
- 后续是否要从“音量驱动”升级到“phoneme 驱动”

正式模型不要求一步到位做全套 TTS 口型，但至少要保证嘴部参数具备可驱动性。

### 8. 视线跟随

正式模型阶段应验证：

- 头部角度可跟随
- 眼球可跟随
- smoothing 后无明显抖动
- 指针跟随关闭时能回到稳定中立位

### 9. 仓库与配置兼容性

正式模型接入后，以下入口应保持兼容：

- `packages/dsh-aris/src/index.ts` 中的宿主配置入口
- `live2dModelBase`
- `live2dCubismCoreUrl`
- `live2dScale`
- `live2dFollowPointer`
- `live2dMuted`
- `live2dAllowMotionSound`
- `live2dDefaultHidden`

原则：用增量扩展兼容正式模型，不要为了换模型推翻现有配置面。

### 10. 验收清单

正式模型接入后，至少要通过以下验收：

1. Aris preset 会话中可正常加载。
2. 非 Aris preset 会话中不加载、不残留 observer。
3. `motion` / `expression` / `bubble` 三类控制意图保持可用。
4. `look` 可平滑工作。
5. `lipsync` 至少能驱动基础开口。
6. 快速折叠 / 展开 / 开关时不触发双重销毁。
7. 静音与 motion 音频设置继续生效。
8. GUI 刷新后状态恢复逻辑正常。
9. 缺失 motion / expression 时仍能优雅降级。
10. 文档、配置样例、资产说明已同步更新。

## 风险点

- 授权边界不清，导致正式模型不能入仓或不能分发
- 参数命名不一致，导致 `look` / `lipsync` / 状态机全靠临时适配
- 动作资源不足，语义动作表无法闭环
- 过早把模型细节写死到运行时代码里，导致以后换模型成本过高
- 把临时模型的命名习惯误当成长期契约

## 推荐执行顺序

1. 先定来源与授权。
2. 再确认最小正式模型资产是否齐备。
3. 再核参数协议与动作表。
4. 再接入当前运行时链路。
5. 最后做 lipsync、look、表情状态机打磨。

## 一句话总结

`v2` 负责把爱丽丝“作为可控制角色体”这条链路跑通；正式模型阶段负责把现在的临时身体，替换成可以长期使用的正式本体。
