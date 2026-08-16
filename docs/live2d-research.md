# Aris Live2D 调研与接入方案

## 目标

为 `@aimercat/dsh-aris` 增加一层可配置的 Live2D 形象，使爱丽丝在 DSH Web GUI 中以插件方式常驻显示，并保持当前插件的边界不变：

- 人设继续留在 preset 内，不把 persona 逻辑搬进运行时代码。
- host 侧只提供配置与开关。
- client 侧负责实际渲染、交互、资源加载与性能控制。
- 尽量不侵入 DSH Web 内部 React 结构，优先采用独立 DOM overlay。

## 现有仓库边界

当前仓库已经为 Live2D 预留了明确挂载位：

- `packages/dsh-aris/src/index.ts`：host 插件占位，`Config.live2dEnabled` 已经存在。
- `packages/dsh-aris/src/client/index.ts`：已有基于 active session 的前端增强能力，适合继续做会话级启停。
- `packages/dsh-aris/tsdown.config.ts`：当前浏览器侧构建目标是单文件 `lib/client.js`，这意味着 v1 最稳妥的方案仍应优先保持单 bundle，不要假设插件 loader 一定能无缝处理任意额外 chunk。
- `packages/dsh-aris/README.md`：明确写了本包是人格增强与 future live2d/avatar layer 的归宿。

结论：Live2D 不需要新开独立仓库；在轻 monorepo 预备态下，直接作为 `packages/dsh-aris` 的 browser half 增强即可；host 只扩展 schema，主要实现放在 `packages/dsh-aris/src/client/`。

## 生态方案盘点

### 方案 A：官方 Cubism SDK for Web 直接接入

组成：

- 官方 Cubism Core + Cubism SDK for Web
- 自己写 Pixi/WebGL 适配、动作调度、命中检测、口型、拖拽、状态机

优点：

- 官方支持，能力最全。
- 对模型、参数、渲染链掌控最高。
- 后续做更深度的表情、物理、口型、命中区域联动时上限最高。

缺点：

- 集成成本最高。
- 需要自己处理一层 runtime glue code。
- 对这个仓库当前目标来说，首版性价比不高。

适用：

- 计划把 Live2D 做成长期核心能力。
- 需要语音口型、复杂动作编排、精细参数控制、后续可扩展为“桌宠级系统”。

参考：

- 官方 Web SDK 下载页：[Live2D Cubism SDK for Web](https://www.live2d.com/en/sdk/download/web/)
- 官方 Web SDK 手册入口：[Cubism SDK for Web](https://docs.live2d.com/en/cubism-sdk-manual/cubism-sdk-for-web/#download)
- Cubism Core 说明：[Cubism Core](https://docs.live2d.com/en/cubism-sdk-manual/cubism-core/)
- 平台支持：[平台支持](https://docs.live2d.com/zh-CHS/cubism-sdk-manual/platform/)

### 方案 B：Pixi + `pixi-live2d-display` 封装层

组成：

- `pixi.js`
- `pixi-live2d-display` 系列封装
- 通过 Pixi 容器与模型对象完成渲染和交互

优点：

- 成熟度高，社区里最常见。
- 和 Web GUI / Electron / Tauri 这类桌面壳组合已有大量先例。
- 对 idle、拖拽、点击、看向鼠标、motion/expression 切换这类需求足够。
- 和当前插件“在页面角落挂一个角色层”的目标最匹配。

缺点：

- 生态分叉较多，需要挑维护线。
- 不是官方 SDK 原生 DX，遇到深度特性时仍需理解 Cubism 模型结构。
- 如果未来追求完整桌宠能力，可能需要部分下潜到官方 SDK 概念层。

维护快照：

- 原始仓库 `guansss/pixi-live2d-display` GitHub star 约 1491，未 archived，但最近 push 快照为 2024-08-20，open issues 53，说明“成熟但原仓活跃度下降”。
- npm 上较新的包线包括：
  - `@jannchie/pixi-live2d-display`：版本 `1.4.0`，发布时间快照到 `2026-07-17`，peer 依赖 `pixi.js ^8.0.0`
  - `@naari3/pixi-live2d-display`：版本 `1.2.5`，发布时间快照到 `2025-11-30`，peer 依赖 `pixi.js ^8.0.0`
- `pixi.js` 当前生态本身仍很活跃，npm 快照版本 `8.19.0`。

判断：

- 如果现在就要做一个能落地的 v1，优先选这条线。
- 包选择上，优先试 `@jannchie/pixi-live2d-display`，因为它明显在继续跟 Pixi 8 维护；`@naari3` 可作为备选。

参考：

- 原始 README：[pixi-live2d-display README](https://github.com/jannchie/pixi-live2d-display/blob/HEAD/README.zh.md)
- npm 包：[@jannchie/pixi-live2d-display](https://www.npmjs.com/package/@jannchie/pixi-live2d-display)
- npm 包：[@naari3/pixi-live2d-display](https://www.npmjs.com/package/@naari3/pixi-live2d-display)

### 方案 C：现成“桌宠/看板娘”项目二次改造

可参考项目：

- [AgentPet](https://github.com/cqzaaa/AgentPet)
- [maibot-deskpet-plugin](https://github.com/Maboroshinatsu/maibot-deskpet-plugin)
- [hermes-live2d](https://github.com/Soundpulse/hermes-live2d)
- [codex-live2d](https://github.com/yigefw245/codex-live2d)
- [chatgpt-desktopPet](https://github.com/yoyofx/chatgpt-desktopPet)

优点：

- 能快速观察现成功能拼装方式。
- 对拖拽、眼神跟随、窗口状态持久化、口型、动作 API 有直接参考价值。

缺点：

- 这些项目大多是完整桌宠应用，不是 DSH client plugin。
- 直接搬代码通常会引入过重的窗口管理、IPC、语音系统、数据库、系统托盘等非必要复杂度。

判断：

- 适合“抄作业学招式”，不适合直接嵌入本仓库。
- 应把它们当实现参考，而不是依赖。

## 推荐路线

### 首选路线

`Pixi 8 + @jannchie/pixi-live2d-display + 本仓库独立 overlay 容器`

原因：

1. 与当前仓库结构最贴合。
2. 首版开发成本最低，能尽快把“爱丽丝活起来”这个目标实现。
3. 足以覆盖 v1 必需能力：idle、点击、hover、拖拽、看向鼠标、基础表情/动作切换、资源懒加载。
4. 后续如果要补更复杂的口型/动作编排，仍可沿着 Pixi + Cubism 模型参数体系继续深入。

### 不推荐路线

#### 不推荐 1：一上来直接手写官方 SDK 全接入

理由：

- 对当前插件全家桶来说过重。
- 先把角色稳定挂进 GUI、建立配置和资源协议更关键。
- 这像类魂 Boss 两阶段，第一阶段先把渲染与交互站稳。

#### 不推荐 2：直接把某个桌宠项目整体塞进 client plugin

理由：

- 它们的架构目标是整应用，不是 DSH GUI 插件。
- 依赖和状态模型过大，后面会反咬维护成本。

#### 不推荐 3：把模型资源直接跟插件 npm 包硬绑定分发

理由：

- 模型文件的许可边界是主要风险。
- 角色美术资源、`moc3`、贴图、motions、expressions 最好和代码插件分层管理。

## 角色能力拆解

### v1 必做能力

1. 常驻显示
   - 页面右下角固定 overlay
   - 可折叠 / 可隐藏 / 记忆位置与缩放

2. Idle 动作
   - 默认 motion group 循环
   - 空闲时随机切换少量表情或轻动作

3. 基础交互
   - 点击命中区域触发表情或动作
   - hover 时可轻微反馈
   - 拖拽移动位置

4. 会话级启停
   - 仅在当前会话是 `aris` preset 时启用
   - 切到其他 preset 即卸载 observer、canvas、style、事件监听

5. 懒加载
   - 只有 Aris 会话真正激活时才加载 Pixi / Live2D 库与模型资源

### v1.5 / v2 能力

1. 看向鼠标
   - 通过参数驱动头部/眼球朝向
   - 需要做 smoothing，避免抖动

2. 表情状态机
   - 根据消息状态、工具执行状态、错误/成功事件切表达

3. 口型同步
   - 最低配：依据音量驱动 `ParamMouthOpenY`
   - 进阶：TTS phoneme 到 mouth shape 映射

4. 状态联动
   - 思考中、工具执行中、报错、完成时播放不同 motion/expression

5. 资源热切换
   - 后续支持不同服装 / 皮肤 / 武器姿态

### 关键技术点对照

- idle motion：`motion3.json` 动作组管理
- expression：`exp3.json` 切换
- 点击交互：hit area / 碰撞区域命中检测
- 拖拽：外层容器位置拖动，避免直接改模型内部变换
- 眨眼：优先模型自带；否则参数级自动驱动
- 口型：音量到嘴巴开合参数映射，参考官方 lip-sync 文档
- 资源懒加载：按 preset gate 动态初始化；页面隐藏时暂停 RAF

参考：

- 模型导出数据说明：[Data for Embedded Use](https://docs.live2d.com/4.2/en/cubism-editor-manual/export-moc3-motion3-files/)
- hit area：[Model Collision Detection](https://docs.live2d.com/4.2/en/cubism-sdk-manual/hitarea/)
- lip sync 教程：[Lip-sync Based on Volume of Wav Files (Web)](https://docs.live2d.com/en/cubism-sdk-tutorials/native-lipsync-from-wav-web/)
- lip sync 手册：[Lip-sync](https://docs.live2d.com/4.2/en/cubism-sdk-manual/lipsync/)

## 本仓库建议设计

### 配置层

建议把 `packages/dsh-aris/src/index.ts` 的配置扩展为：

```ts
export interface Config {
  live2dEnabled: boolean
  live2dModelBase?: string
  live2dCanvasSize?: { width: number; height: number }
  live2dAnchor?: 'bottom-right' | 'bottom-left'
  live2dScale?: number
  live2dIdleGroup?: string
  live2dDraggable?: boolean
  live2dFollowPointer?: boolean
  live2dTapMotions?: Record<string, string[]>
}
```

判断：

- v1 不要把配置做得过深，先覆盖模型路径、缩放、锚点、idle group、基础交互即可。
- 复杂动作状态机更适合留在 client 侧默认策略，而不是暴露太多 schema 给用户。

### 前端挂载层

建议新增：

- `packages/dsh-aris/src/client/live2d/overlay.ts`：创建/销毁 DOM 容器
- `packages/dsh-aris/src/client/live2d/runtime.ts`：Pixi app 与 Live2D model 生命周期
- `packages/dsh-aris/src/client/live2d/state.ts`：位置、缩放、显示状态持久化
- `packages/dsh-aris/src/client/live2d/events.ts`：点击、拖拽、hover、指针跟随
- `packages/dsh-aris/src/client/live2d/motions.ts`：idle / tap / expression 调度

挂载策略：

- 直接在 `document.body` 下插入带命名空间属性的容器，例如 `data-dsh-aris-live2d`。
- 使用 fixed 定位，不依赖聊天区 DOM 结构。
- 和当前 think enhancer 一样，由 active preset gate 控制启停。

这样做的原因：

- DSH Web UI 的内部结构未来可能变化；fixed overlay 最抗变。
- 不需要侵入现有 React tree。
- 出问题时可像当前 `dsh-aris-disabled` 一样做本地 kill switch。

### 资源组织

建议不要把正式模型直接塞到 npm 包中。更稳妥的两种方式：

1. 本地资源目录
   - 例如 `assets/live2d/aris/`
   - 由配置项指向 `model3.json`

2. 后续独立“资源包”
   - 代码插件负责 runtime
   - 资源包负责模型与贴图

建议的目录协议：

```text
assets/live2d/aris/
├── aris.model3.json
├── aris.moc3
├── textures/
├── motions/
└── expressions/
```

### 性能策略

- 默认限制 canvas 尺寸，不要无限贴近设备像素比。
- 页面 hidden 时暂停动画。
- 非 Aris 会话彻底销毁 Pixi app，避免后台常驻。
- 首屏不阻塞聊天输入，模型异步加载，失败时静默降级为无 avatar。
- v1 先不做多实例；整个 GUI 同时只保留一个爱丽丝实例。

## 许可与资源风险

这是前方真正的 Boss。

### 1. SDK 发布许可

官方说明：SDK 发布涉及 Release License / Publication License Agreement，是否需要签约取决于发布场景，应以官方 FAQ 为准。

参考：

- [What is the SDK Release License?](https://help.live2d.com/en/sdk/sdk_001/)

### 2. 示例模型不等于你自己的可分发模型

官方有单独 FAQ 与条款管理 sample model 的可商用与著作权声明：

- [Can I use the sample models for commercial purposes?](https://help.live2d.com/en/other/other_16/)
- [Live2D Sample Model Terms](https://www.live2d.com/eula/live2d-sample-model-terms_en.html)
- 中文 FAQ 索引：[使用示例模型时的著作权声明是什么？](https://help.live2d.com/zh-CHS/tag/%e7%a4%ba%e4%be%8b%e6%a8%a1%e5%9e%8b/)

判断：

- 调试阶段可使用官方 sample model 验证 runtime。
- 正式随插件分发“爱丽丝形象”时，最好使用你自己拥有明确授权的模型资源。
- 不要默认把网上找到的 VTuber / 二创 Live2D 资源并入仓库。

### 3. 编辑器与制作链

如果后面要自己做爱丽丝模型，除了 runtime，还需要：

- Live2D Cubism Editor
- 立绘切图与 PSD 分层
- rigging / physics / expressions / motions

功能差异参考：

- [FREE vs PRO comparison](https://www.live2d.com/en/cubism/comparison/)

## 可直接使用的参考资源

### 官方文档

- Web SDK 下载：[https://www.live2d.com/en/sdk/download/web/](https://www.live2d.com/en/sdk/download/web/)
- Web SDK 手册：[https://docs.live2d.com/en/cubism-sdk-manual/cubism-sdk-for-web/](https://docs.live2d.com/en/cubism-sdk-manual/cubism-sdk-for-web/#download)
- 模型导出数据：[https://docs.live2d.com/4.2/en/cubism-editor-manual/export-moc3-motion3-files/](https://docs.live2d.com/4.2/en/cubism-editor-manual/export-moc3-motion3-files/)
- hit area：[https://docs.live2d.com/4.2/en/cubism-sdk-manual/hitarea/](https://docs.live2d.com/4.2/en/cubism-sdk-manual/hitarea/)
- lip sync：[https://docs.live2d.com/en/cubism-sdk-tutorials/native-lipsync-from-wav-web/](https://docs.live2d.com/en/cubism-sdk-tutorials/native-lipsync-from-wav-web/)
- 平台支持：[https://docs.live2d.com/zh-CHS/cubism-sdk-manual/platform/](https://docs.live2d.com/zh-CHS/cubism-sdk-manual/platform/)

### 运行时方案

- PixiJS：[https://www.npmjs.com/package/pixi.js](https://www.npmjs.com/package/pixi.js)
- `@jannchie/pixi-live2d-display`：[https://www.npmjs.com/package/@jannchie/pixi-live2d-display](https://www.npmjs.com/package/@jannchie/pixi-live2d-display)
- `@naari3/pixi-live2d-display`：[https://www.npmjs.com/package/@naari3/pixi-live2d-display](https://www.npmjs.com/package/@naari3/pixi-live2d-display)
- 原始项目 README：[https://github.com/jannchie/pixi-live2d-display/blob/HEAD/README.zh.md](https://github.com/jannchie/pixi-live2d-display/blob/HEAD/README.zh.md)

### 现成项目参考

- AgentPet：[https://github.com/cqzaaa/AgentPet](https://github.com/cqzaaa/AgentPet)
- MaiBot 桌宠插件：[https://github.com/Maboroshinatsu/maibot-deskpet-plugin](https://github.com/Maboroshinatsu/maibot-deskpet-plugin)
- hermes-live2d：[https://github.com/Soundpulse/hermes-live2d](https://github.com/Soundpulse/hermes-live2d)
- codex-live2d：[https://github.com/yigefw245/codex-live2d](https://github.com/yigefw245/codex-live2d)
- chatgpt-desktopPet：[https://github.com/yoyofx/chatgpt-desktopPet](https://github.com/yoyofx/chatgpt-desktopPet)

## 会话内自我操控

如果希望会话中的爱丽丝通过工具/脚本操控自己的 Live2D 形象，应把这件事视为正式控制平面，而不是后补彩蛋。详细设计见 `docs/live2d-control-bridge.md`：推荐增加 `aris_avatar_control` 工具、host 侧 session-scoped bridge、client 侧 intent 执行器，并坚持声明式 schema 而非执行任意前端脚本。

## 实施建议

### Phase 1：跑通最小链路

目标：能在 Aris 会话中显示一个可点击、可 idle 的模型。

- 接入 Pixi 8
- 选定 `@jannchie/pixi-live2d-display`
- 创建 fixed overlay
- 加载调试 sample model
- 做启停与销毁
- 本地持久化位置、缩放、显隐

### Phase 2：交互增强

- tap hit area 触发表情/动作
- 跟随鼠标
- 消息/状态驱动表情切换
- 页面隐藏暂停动画

### Phase 3：语音与状态联动

- 接 TTS / 音量驱动嘴型
- 和 agent 状态、工具执行事件联动 motion/expression
- 独立资源包或正式授权模型接入

## 最终建议

工程判断很明确：

- **v1 推荐**：`Pixi 8 + @jannchie/pixi-live2d-display + 独立 overlay + 本地资源协议`
- **资源策略**：先用 sample model 验证 runtime，正式发布前替换为明确授权的爱丽丝模型资源
- **架构策略**：继续保持 preset 管人格、host 管配置、client 管渲染，不要把 Live2D 做成新的大而全应用

这样推进最稳，也最符合这个仓库已经写好的边界。下一步真正开干时，可以直接从这个文档里的 Phase 1 开始。