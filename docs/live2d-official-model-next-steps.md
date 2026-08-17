# Aris Live2D 正式模型下一步实施 TODO

## 目的

本文件把“正式模型落地清单”进一步收束成可以执行的下一步任务，重点是：

- 不推翻当前 MVP 架构
- 尽量沿用现有 host / client / settings / bridge 边界
- 先把正式模型接入路径理顺，再逐步补齐 v2 细节能力

## 当前基础

当前仓库已经具备这些基础能力：

- `packages/dsh-aris/src/index.ts`：插件主配置入口
- `packages/dsh-aris/src/live2d/host.ts`：host 侧 projection / tool 注册
- `packages/dsh-aris/src/live2d/settings.ts`：Live2D 设置面
- `packages/dsh-aris/src/live2d/types.ts`：Live2D 类型约束
- `packages/dsh-aris/src/client/live2d/bridge.ts`：client 侧桥接与执行
- `packages/dsh-aris/src/client/live2d/`：前端运行时相关实现

这意味着正式模型阶段不需要重开系统设计，重点是把资产协议和语义映射补齐。

## 实施原则

1. 先处理资产和协议，再处理视觉细节。
2. 先引入“语义映射层”，不要让运行时代码直接依赖具体资源文件名。
3. 先保证降级稳定，再追求更复杂的表演效果。
4. 任何新字段都优先走增量兼容，不破坏现有配置。

## TODO 列表

### Phase 1. 锁定正式模型输入

#### 1.1 确认资产来源

先读：`docs/live2d-official-model-source-decision.md`

产出：一条明确结论。

需要确认：

- 正式模型是否允许入仓
- 是否允许随插件一起分发
- 如果不能入仓，实际资源放在哪里
- 由谁维护 motion / expression / 参数缺口

完成标准：文档中能写出唯一来源，不再使用“临时找一个能跑的模型”这种表述。

当前已确认：

- 来源线：`现成授权模型`
- 近期目标：`先保证老师本机长期可用`
- 阶段方案：`正式模型先外置，本地路径接入`

#### 1.2 建立资产目录约定

若允许入仓：

```text
packages/dsh-aris/assets/live2d/aris/
```

若不允许入仓：

- 保留目录约定文档
- 真实资产通过 `live2dModelBase` 外置配置

完成标准：仓库内外的资产落点不再含糊。

### Phase 2. 补齐正式模型协议

#### 2.1 在 `types.ts` 中引入正式模型语义类型

目标文件：

- `packages/dsh-aris/src/live2d/types.ts`

建议新增：

- `ArisLive2DProfileId`
- `ArisSemanticMotion`
- `ArisSemanticExpression`
- `ArisParameterBinding`

目的：

- 把“正式模型语义层”从资源文件名中解耦
- 让后续 `look` / `lipsync` / motion 映射有类型约束

完成标准：类型层能表达“语义动作名”和“真实资源名”是两层概念。

#### 2.2 在 `index.ts` 中扩展最小配置面

目标文件：

- `packages/dsh-aris/src/index.ts`

建议新增的最小字段：

- `live2dProfile?: 'temporary' | 'aris-official'`
- `live2dMotionMap?: Partial<Record<string, string>>`
- `live2dExpressionMap?: Partial<Record<string, string>>`
- `live2dParameterMap?: Partial<Record<string, string>>`

要求：

- 保持现有字段默认值不变
- 让正式模型可以通过配置显式切换与适配

完成标准：正式模型不是隐式替换，而是明确存在一个 profile / mapping 概念。

### Phase 3. 在 host 侧传递正式模型语义信息

#### 3.1 扩展 host config 归一化

目标文件：

- `packages/dsh-aris/src/live2d/host.ts`

任务：

- 把 profile、motion map、expression map、parameter map 归一化
- 通过 session projection 或等价配置通路传给 client
- 保持未配置时的保守默认值

注意：

- 不要在 host 侧写死具体模型资产
- host 的职责是“传递与校验”，不是“渲染时猜资源”

完成标准：client 侧收到的是明确、结构化的正式模型配置。

### Phase 4. 在 client 侧建立语义映射执行层

#### 4.1 在 `bridge.ts` 中拆出“语义 -> 资源”解析层

目标文件：

- `packages/dsh-aris/src/client/live2d/bridge.ts`

任务：

- 把现有控制意图先映射到语义动作 / 语义表情
- 再由语义映射到具体 motion / expression / parameter
- 为未来 `sequence` / `look` / `parameter` 能力预留统一入口

建议新增内部概念：

- `resolveSemanticMotion()`
- `resolveSemanticExpression()`
- `resolveParameterBinding()`

完成标准：运行时不再直接散落依赖具体动作组名或表情文件名。

#### 4.2 明确 `look` 与 `lipsync` 的参数依赖

目标文件：

- `packages/dsh-aris/src/client/live2d/bridge.ts`
- `packages/dsh-aris/src/client/live2d/*` 相关运行时文件

任务：

- 明确视线跟随依赖哪些参数
- 明确嘴部驱动依赖哪些参数
- 若正式模型参数名不同，走 `parameterMap` 适配

完成标准：`look` 和 `lipsync` 不再依赖硬编码参数名假设。

### Phase 5. 资产与配置验证

#### 5.1 补一份正式模型配置样例

建议文件：

- `docs/live2d-mvp-setup.md` 或独立新增配置示例文档

至少应包含：

- 内置资源路径的配置方式
- 外置资源路径的配置方式
- 正式模型 profile 的配置方式
- motion / expression / parameter 映射示例

完成标准：接入正式模型不再只能靠口头说明。

#### 5.2 定义最小验收脚本

建议先做人工验收清单，不急着上自动化 UI 测试。

最低验证项：

1. 能正常加载正式模型。
2. `greeting` / `thinking` / `victory` / `warning` 可触发。
3. 折叠 / 展开 / 切 preset 不炸。
4. `follow pointer` 可平滑工作。
5. `mute` / `allowMotionSound` 继续生效。

完成标准：正式模型不是“看起来差不多”，而是通过一组固定检查项验收。

## 建议提交顺序

### 提交 1：协议层

范围：

- `packages/dsh-aris/src/live2d/types.ts`
- `packages/dsh-aris/src/index.ts`
- 必要的 schema / config 文档

目标：

- 把正式模型 profile 与 mapping 概念引入类型和配置层

### 提交 2：host / client 语义映射层

范围：

- `packages/dsh-aris/src/live2d/host.ts`
- `packages/dsh-aris/src/client/live2d/bridge.ts`
- 相关 client runtime 文件

目标：

- 把语义动作和真实资源解耦

### 提交 3：正式模型接入

范围：

- 正式模型配置
- 资源目录或外置路径接线
- 文档更新

目标：

- 让正式模型真正跑起来

### 提交 4：v2 细节增强

范围：

- `look`
- `lipsync`
- 表情状态机
- sequence / parameter 等扩展

目标：

- 在正式模型基线上补齐 v2 体验

## 暂不建议立刻做的事

- 不建议现在就做多模型系统
- 不建议现在就做复杂编排 DSL
- 不建议把临时模型的资源命名写成长期协议
- 不建议为了一个正式模型把整个运行时推翻重写

## 下一步的最小动作

如果只做一个最小推进动作，优先顺序应是：

1. 定正式模型来源和授权边界
2. 定 `profile + motionMap + expressionMap + parameterMap` 这套配置协议
3. 再开始动运行时代码

## 一句话总结

下一阶段最重要的不是“换一个更像爱丽丝的模型文件”，而是建立一条让正式模型可以稳定接入、稳定替换、稳定维护的工程通路。
