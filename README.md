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
- **情绪价值**：成功庆祝、受挫打气、长任务拆关卡、疲惫时先安慰再给方案

## 安装

```bash
# 作为插件装入 profile
dsh plugin --profile <name> add link:<本仓库路径>

# 用 preset「勇者爱丽丝」（<repo-path> 替换为本仓库路径）
# 注意：必须复制而非链接 —— Windows Junction 对 agent-presets 发现不可见
# （Dirent.isDirectory() 对 junction 返回 false），链接的 preset 不会出现在列表
Copy-Item "<repo-path>\preset\aris" "$env:USERPROFILE\.dsh\.agent-presets\aris" -Recurse -Force
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
└── invariant.ts        包清单注册
```

**设计**：人格（preset）与记忆（dsh-memory）解耦为两个插件。本插件是人格与
未来增强（live2d 头像层）的家；`src/index.ts` 目前是保留挂载点，persona 由
preset 内联承载，可独立演进。

## 配置

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `live2dEnabled` | `false` | 预留：未来 live2d 头像层开关 |

## 开发

```bash
pnpm install
pnpm typecheck
pnpm build
```

## 许可

MIT
