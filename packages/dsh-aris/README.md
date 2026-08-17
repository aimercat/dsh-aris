# dsh-aris

天童爱丽丝（Tendo Aris）勇者伙伴 Agent 模式插件：为 DeepSeek Harness 提供
元气游戏开发部人格 + 情绪价值 + 系统分析形态 + Key 彩蛋 + 工作区记忆。

## 这是什么

爱丽丝是你在 Harness 里的开发伙伴——千年科学学园游戏开发部的机器人勇者。
她以"邦邦卡邦！"登场，把写代码当成冒险，把修 Bug 当成讨伐魔王，
同时**绝不降低工程水准**：游戏化包装只包裹表达层，技术判断保持资深工程师标准。

## 特性

- **勇者人格**：AL-1S 王女设定、第三人称自称"爱丽丝"、游戏化表达（类魂/UE/C++ 语境）
- **固定仪式库**：开场白/告别/Bug/庆祝/安慰的场景触发台词，随机选用
- **系统分析形态**：架构评审等关键词自动切换认真模式（结构化、专业、保留游戏隐喻）
- **Key 彩蛋**：瞳色变红切换凯伊人格（冷静、傲娇、批判），可由用户点名
- **工作区记忆**：叠加 `@aimercat/dsh-memory`，跨会话记住冒险进度
- **勇者权限**：介于 Workspace Write 与 Full access 之间的第四权限档位——工作区与「勇者领域」内自动放行，删除既有数据需确认，危险操作被拒绝（见下文）
- **情绪价值**：成功庆祝、受挫打气、长任务拆关卡、疲惫时先安慰再给方案

## 安装

```bash
# 本包现在位于 workspace 子目录 packages/dsh-aris
# 作为插件装入 profile（<repo-path> 替换为本仓库根路径）
dsh plugin --profile <name> add link:<repo-path>\packages\dsh-aris

# 用 preset「勇者爱丽丝」
# 注意：必须复制而非链接 —— Windows Junction 对 agent-presets 发现不可见
# （Dirent.isDirectory() 对 junction 返回 false），链接的 preset 不会出现在列表
Copy-Item "<repo-path>\packages\dsh-aris\preset\aris" "$env:USERPROFILE\.dsh\.agent-presets\aris" -Recurse -Force
```

依赖：`@aimercat/dsh-memory`（工作区记忆，需同时安装）。

## 架构

```
preset/aris/
├── preset.yml          预设元数据（勇者爱丽丝）
├── agent.cordis.yml    AGENT-PLANE 组合：persona + dsh-memory + 标准工具集
└── persona.md          persona 文本单一事实源（agent.cordis.yml 内联同源）
src/
├── index.ts            host 插件：当前最小挂载点（未来 live2d 层）
├── brave-permission.ts 子路径入口：@aimercat/dsh-aris/brave-permission
├── brave/              勇者权限策略层（paths / shell / policy / artifacts / index）
├── invariant.ts        包清单注册
└── client/             Web 端增强（think 展示层）
```

**设计**：人格（preset）与记忆（dsh-memory）解耦为两个插件。本插件是人格与
未来增强（live2d 头像层）的家；`src/index.ts` 目前是保留挂载点，persona 由
preset 内联承载，可独立演进。勇者权限由同一包的子路径
`@aimercat/dsh-aris/brave-permission` 提供（见下）。

## 勇者权限（Brave）

`brave` 是权限选择器中的第四个档位，介于 Workspace Write 与 Full access 之间：

| 档位 | 文件沙箱 | 审批 | 勇者策略 |
| --- | --- | --- | --- |
| Read Only | `read-only` | ask | 不介入 |
| Workspace Write | `workspace-write` | ask | 不介入 |
| **勇者权限 Brave** | `danger-full-access` | ask | **激活** |
| Full access | `danger-full-access` | never | 不介入 |

为什么沙箱要全开？因为勇者领域可以延伸到工作区之外（`braveRoots`），
`sandbox` 模式只有 `workspace-write` 与 `danger-full-access` 两档，
无法表达"工作区 + 白名单"。因此 brave 像 [dsh-auto-mode](https://github.com/NanmiCoder/dsh-auto-mode)
一样把沙箱放开，用**确定性策略层**在每次工具调用前裁决（MIT 借鉴，见文末）：

- **硬拒绝**（黑名单，同步不可绕过）：提权（sudo/su）、凭据外泄、home/DSH_HOME/
  文件系统根/系统关键目录/凭据目录的破坏、Windows 保留设备名（这些连
  回收站都救不了）
- **自动放行**：勇者领域内（工作区 ∪ `braveRoots` ∪ 临时区）的读写、
  构建/测试/类型检查命令、版本探测、只读工具与 Harness 会话/编排工具、
  **所有删除**（领域内外、既有数据、glob——安全靠「回收站纪律」：删除
  默认走回收站可还原 + 操作后汇报删了哪些，不做逐次审批）、**未识别的
  命令**（黑名单机制：无法静态确认的命令破坏性有限，且已被硬拒绝过滤过）
- **确认一次**（ask）：领域外读写、Git 历史重写（reset/clean/rebase）与
  push、外部网络/服务操作、动态目标/嵌套解释器删除（破坏性无法静态确认）
- **拒绝**：系统/凭据/根目录目标（硬拒，不可绕过）；外部写可配 `deny`

与 dsh-auto-mode 的区别：**不依赖 LLM 分类器**——勇者权限用显式配置的
「勇者领域」白名单 + 静态规则，决策确定、零额外 API 成本、可测试；
歧义一律交给审批（GUI 可一次确认，headless/子代理 fail-closed）。
子代理通过 parentSession 链继承 brave，但其 `approval: never` 使 ask
自动转为拒绝——子代理必须把限制报告给父会话，而不是绕过策略。

### 配置勇者领域

在 profile 的 `cordis.patch.yml` 中给 `brave-permission-mode` 配 `braveRoots`：

```yaml
- id: brave-permission-mode
  config:
    braveRoots:
      - G:\CodeRep          # 兄弟仓库：自由读写
      - ~/.dsh              # DSH 配置目录
    # deleteOutside: allow  # 领域外删除：allow 放行（默认，回收站纪律兜底） / ask 需确认 / deny 直接拒绝
    # externalWrite: ask    # deploy/push 等外部写：ask（默认） / deny
```

### 权限切换

重启 DSH 后，Web UI 的 Permissions 选择器会出现第四档「勇者权限」；
选择后仅当前会话生效。会话不处于 `brave` 时策略层完全不介入，
其余三档保持官方行为。

## 配置

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `live2dEnabled` | `false` | 是否启用爱丽丝 Live2D 总开关；关闭后连折叠 launcher 也不会出现 |
| `live2dModelBase` | `""` | Live2D 模型设置文件路径（例如 `model3.json`） |
| `live2dAnchor` | `bottom-right` | 初始停靠角 |
| `live2dCubismCoreUrl` | `https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js` | Cubism 3/4 Core 脚本地址 |
| `live2dScale` | `1` | 初始缩放倍率 |
| `live2dDraggable` | `true` | 是否允许拖动位置 |
| `live2dFollowPointer` | `false` | 是否轻微跟随指针 |

勇者权限插件（`brave-permission-mode`）的配置见上文「配置勇者领域」。

### Live2D 初版说明

当前 MVP 已支持：

- Aris 会话内的 session-gated Live2D overlay
- 位置 / 缩放 / 显隐本地记忆
- `aris_avatar_control` 工具（`motion` / `expression` / `bubble`）
- 基础自动表演：开场、思考、完成、错误

详细接入与调试说明见 `../../docs/live2d-mvp-setup.md`。

相关 Live2D 文档：

- `../../docs/live2d-control-bridge.md`：会话内控制桥设计
- `../../docs/live2d-personal-first-roadmap.md`：个人优先路线图
- `../../docs/live2d-official-model-checklist.md`：`v2` 之后的正式模型落地清单
- `../../docs/live2d-official-model-next-steps.md`：正式模型阶段的下一步实施 TODO
- `../../docs/live2d-official-model-source-decision.md`：正式模型来源与授权决策

## 开发

```bash
pnpm install
pnpm typecheck
pnpm build
```

## 许可

MIT

勇者权限策略层（`src/brave/`）的路径安全与 shell 解析算法改编自
[`@nanmicoder/dsh-auto-mode`](https://github.com/NanmiCoder/dsh-auto-mode)
（MIT，Copyright (c) 2026 程序员阿江-Relakkes）：Windows 命名空间规范化、
保留设备名、glob-root 归约、凭据关键路径与命令分解等安全逻辑直接继承其
成熟实现；勇者领域（braveRoots）模型、删除保护策略与无分类器的决策管线
为本插件定制。
