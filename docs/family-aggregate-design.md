# 爱丽丝全家桶聚合方案设计（路线图 ①）

> 状态：调研完成，方案定稿待实施
> 日期：2026-08-17
> 参考实现：`dsh-web-ui` 仓库（`G:\CodeRep\dsh-web-ui`），聚合包 `packages/dsh-web-ui-all`

---

## 1. 背景与目标

爱丽丝全家桶路线图（顺序执行）：

1. **① 全家桶聚合安装** —— 统一安装入口，类比 `dsh-web-ui-all` 聚合包模式，归属爱丽丝生态
2. **② 统一插件配置 UI 注入和管理** —— 全家桶各插件的设置卡统一注入与管理
3. **③ dsh-memory 迁移进全家桶并测试**

本文档完成 ① 的调研并给出 ①② 的设计基线（③ 仅规划）。

---

## 2. 参考实现解剖：dsh-web-ui-all 聚合包

### 2.1 聚合三件套

| 文件 | 作用 |
| --- | --- |
| `aggregate.yml` | **手写清单**：`patchFrom`（patch 行来源目录）、`self`（聚合包自身插件 id）、`deps`（workspace:* 依赖目录） |
| `scripts/aggregate.mjs` | **生成器**：递归展开 `patchFrom`（支持嵌套聚合、cycle 防护）→ 收集叶子包 `cordis.patch.yml` 的 `insert` 行 → 渲染聚合 `cordis.patch.yml`（带来源注释头）；`deps` 解析为 `workspace:*` 重写 package.json；`--check` 模式验证无漂移 |
| 聚合包 `package.json` | `dsh.bundle.patch` 指向生成的 `cordis.patch.yml`；`dependencies` 全部 `workspace:*`；`dsh.client` 声明 client half |

生成的 `cordis.patch.yml` 形态（`ui-web-ui-settings` 排最前，先声明子槽位）：

```yaml
# from ../dsh-web-ui-settings
- insert:
    - id: ui-web-ui-settings
      name: '@linxin666/dsh-client-ui-web-ui-settings'
# from ../dsh-ssh
- insert:
    - id: ssh
      name: '@linxin666/dsh-ssh'
```

### 2.2 安装与解析链路

- **npm 发布路径**：`dsh plugin --profile web add @linxin666/dsh-web-ui-all`（一条命令装齐）
- **本地开发路径**：`node scripts/link-profile.mjs`（把全家桶 symlink 到 `~/.dsh/profiles/node_modules/@linxin666`）→ `dsh plugin --profile web add link:.../packages/dsh-web-ui-all`
- DSH loader 从 **profile 顶层**解析 patch 行的 `name:`，子包经 dependencies 被 pnpm hoist 到顶层即可解析

### 2.3 已知坑（移植时注意）

| 坑 | 解法 |
| --- | --- |
| 严格（isolated）布局下子包收进嵌套目录 → `Cannot find package` | profile `pnpm-workspace.yaml` 加 `nodeLinker: hoisted`（**aris-dev 已配**）或 `public-hoist-pattern` |
| pnpm 11 `minimumReleaseAge` 门禁静默装回旧版 | `minimumReleaseAgeExclude` 排除全部 `@aimercat/*` |
| profile 非 workspace，`workspace:*` 回退拉 npm 已发布版本 | 本地开发先跑 link-profile.mjs 让子包走仓库构建产物 |
| `ERR_PNPM_IGNORED_BUILDS`（依赖构建脚本被拒） | `allowBuilds` 白名单 |

---

## 3. 参考实现解剖：设置组（统一配置 UI）

### 3.1 宿主插件 `dsh-web-ui-settings`

- client half 在 `SlotMap` 声明**子槽位** `web-ui.plugin.item`（`kind: 'list'; scope: 'root'`）
- 组卡注入官方槽位 `settings.plugin.item`（`order: 90`），`register` 时 `children: { 'web-ui.plugin.item': { kind: 'list', scope: 'root' } }`（**声明即授权**）
- 组卡展开后 `renderSlot('web-ui.plugin.item', {})` 渲染全部家族插件卡

### 3.2 子插件注入（家族插件卡）

每个子插件 client half：

```ts
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'web-ui.plugin.item': { kind: 'list'; scope: 'root'; owner: SettingsPluginItemOwnerProps }
  }
}
// ...
ctx.slots.inject('web-ui.plugin.item', () => ctx.slots.register({
  name: 'web-ui.plugin.item',
  id: 'my-plugin-settings',
  order: 100,
  locale: NS,
  inject: () => card.inject(),
}, MySettingsCard))
```

### 3.3 声明感知（核心机制，已从 `dsh-client-runtime` 类型源码确认）

`SlotRegistry.inject(key, callback)`：

- 槽位**已声明** → callback **同步立即执行**
- 槽位**未声明** → callback **挂起**，等声明者 `register()` 提交后执行；**不抛错**
- 槽位 collapse → effect dispose；后续再声明可重跑
- 对照：`SlotCore.register` 到未声明槽位**抛错**（load-time validation）；一个槽位只有一个声明者

**推论**：子插件注入子槽位与宿主声明顺序无关，且独立安装（宿主缺席）时静默不显示、不报错——这是 dsh-aris 设置卡改注入 `aris.plugin.item` 的可行性依据。

### 3.4 rc.6 settings 兼容层（bridge）

- 官方 `settingsScope` 对**第三方 namespace 一律返回 unavailable**（apiproxy allowlist 硬编码）
- `dsh-web-ui-settings` 提供 `webUiSettings` 服务：官方 scope 为主 + host 侧 bridge 路由（`/api/dsh-web-ui-settings`）兜底，loopback 连接才启用
- 家族插件统一 `ctx.webUiSettings ?? ctx.settingsScope` 读取

**对爱丽丝的现状影响**：dsh-aris 已用 `ctx.webUiSettings ?? ctx.settingsScope`，但**独立安装时 `webUiSettings` 不存在 → 回退官方 scope → `aris-live2d` namespace unavailable → 设置卡只读说明**。因此爱丽丝全家桶需要**自备 bridge**，不能依赖 dsh-web-ui 全家桶在场。

---

## 4. 爱丽丝全家桶聚合方案

### 4.1 仓库布局（dsh_aris_agent 升级正式 monorepo）

```
dsh_aris_agent/
├── package.json / pnpm-workspace.yaml / tsconfig.base.json   # 已有（轻 monorepo 预备态）
├── scripts/
│   ├── aggregate.mjs        # 移植 dsh-web-ui 版 + 扩展（见 4.4）
│   └── link-profile.mjs     # 移植 dsh-web-ui 版，scope 改 @aimercat/
├── packages/
│   ├── dsh-aris/            # 现有主插件（改造：live2d 卡注入目标槽位，见 4.3）
│   ├── dsh-aris-settings/   # 【新】设置组宿主：aris.plugin.item 子槽位 + arisSettings bridge
│   ├── dsh-memory/          # 【迁移，路线图③】包名不变 @aimercat/dsh-memory
│   └── dsh-aris-all/        # 【新】聚合包：aggregate.yml + 空 host half
└── preset/aris/             # 现有 preset（引用不变）
```

### 4.2 `dsh-aris-settings`（新包，统一配置 UI 宿主）

- **client half**：
  - `SlotMap` 声明子槽位 `aris.plugin.item`（`kind: 'list'; scope: 'root'`）
  - 组卡「爱丽丝全家桶」注入 `settings.plugin.item`（`order: 90`，与 web-ui-plugins 并存；建议配色走爱丽丝蓝色主题）
  - `children: { 'aris.plugin.item': ... }`，展开后 `renderSlot('aris.plugin.item', {})`
- **host half**：`arisSettings` 服务（移植 dsh-web-ui-settings 的 bridge 精简版：host 路由 `/api/dsh-aris-settings` + client `CompatScope` 控制器），服务名用 `arisSettings` 避免与 `webUiSettings` 冲突，**两全家桶共存互不干扰**
- locales：zh/en 双语

### 4.3 `dsh-aris` 改造

- live2d-settings 卡注入目标：`settings.plugin.item` → **`aris.plugin.item`**
  - 聚合场景（有 dsh-aris-settings）：卡片进「爱丽丝全家桶」组
  - 独立场景（无宿主）：声明感知挂起 → 静默不显示，**不抛错、不影响插件其余功能**
- binder 读取链：`ctx.get('arisSettings') ?? ctx.get('webUiSettings') ?? ctx.settingsScope`
- README 注明：设置卡完整形态需与 `dsh-aris-all`（或 `dsh-aris-settings`）一起安装

### 4.4 `dsh-aris-all`（新聚合包）

`aggregate.yml` 草案：

```yaml
# 注意：dsh-memory 只进 deps 不进 patchFrom！
# 保护「dsh-memory preset 级开启」决策：host 平面 0 挂载，preset 平面按需启用。
# 聚合安装后 preset/aris 仍能解析 @aimercat/dsh-memory（deps hoisted 到 profile 顶层）。
patchFrom:
  - ../dsh-aris
  - ../dsh-aris-settings
deps:
  - ../dsh-aris
  - ../dsh-aris-settings
  - ../dsh-memory
```

**关键决策与理由**：

| 决策 | 理由 |
| --- | --- |
| `dsh-memory` 只进 `deps` 不进 `patchFrom` | 聚合 patch 行是 profile 顶层（host 平面）解析；若含 dsh-memory 行 = 全局挂载，违背 2026-08-17「dsh-memory 改为 preset 级别开启」决策 |
| `self` 暂不启用 | 无 compat shim 需求（dsh-aris 已是双面包自带 client）；未来 Live2D 重依赖或 client 补丁再启用 |
| **aggregate.mjs 必须扩展**：顶层块完整捕获 | dsh-aris 的 `cordis.patch.yml` 含 `permission` restate 块（`- id: permission` + `config:`），原版 parsePatchRows 只认 `- id:` 后紧跟 `name:` 的行，会报错丢块。扩展方案：把每个 `- id:` 顶层块完整捕获——`insert` 块拆出行，非 insert 块（permission 等 config 块）**原样保留拼接**，聚合 patch = 子 patch 完整等价拼接 |

### 4.5 `dsh-memory` 迁移（路线图 ③，本次仅规划）

- 从 `G:\CodeRep\dsh_memory_support` 迁入 `packages/dsh-memory`，**包名不变** `@aimercat/dsh-memory` → preset/aris 引用零改动
- 历史处理二选一：`git subtree add -P packages/dsh-memory`（保留历史）或直接拷贝（文件少、成本低）；推荐 subtree，保留审计线索
- 迁移后 `dsh_memory_support` 仓库冻结/归档
- 可选增强（② 范畴）：dsh-memory 增加设置卡（memory 目录、注入开关等）注入 `aris.plugin.item`

### 4.6 preset 与 profile 现状核对

- `preset/aris/agent.cordis.yml`：`@aimercat/dsh-aris` + `@aimercat/dsh-memory` 引用**不变**
- aris-dev profile：`nodeLinker: hoisted` **已满足**聚合要求；`@aimercat/dsh-aris`、`@aimercat/dsh-memory` 现为 Junction link → 改由 link-profile.mjs（@aimercat scope）统一管理
- 桌面宿主重启纪律：**必须连同 runtime node 进程一起杀**（历史踩坑）

---

## 5. 实施步骤（① ②）

1. 移植 `aggregate.mjs` → `dsh_aris_agent/scripts/aggregate.mjs`（扩展：完整块拼接 + 错误文案）
2. 移植 `link-profile.mjs` → `scripts/link-profile.mjs`（scope 常量改 `@aimercat/`）
3. 新建 `packages/dsh-aris-settings`（host bridge + client 组卡 + locales + tests）
4. 改造 `dsh-aris`：live2d 卡注入 `aris.plugin.item` + binder 读取链 + README
5. 新建 `packages/dsh-aris-all`（aggregate.yml + package.json + 空 host half + README）
6. 运行 aggregate.mjs 生成 patch；`pnpm typecheck && pnpm build && pnpm test` 全绿
7. 本机验证：`link-profile.mjs` → `dsh plugin --profile aris-dev add link:.../packages/dsh-aris-all` → 杀 runtime 重启 → GUI 验证「爱丽丝全家桶」组卡 + live2d 卡在组内 + preset 会话正常
8. （路线图 ③）迁移 dsh-memory + 回归测试

---

## 6. 风险与待验证

1. **permission 块拼接等价性**：聚合 patch 与 dsh-aris 独立 patch 的 `--dump-config` 合成结果应一致（Cordis restate 语义按 patch 数组顺序，需实测确认无冲突）
2. **双全家桶共存**：`settings.plugin.item` 两个组卡 order 错开（web-ui-plugins=90，aris 组卡建议 90 前后错位或 100+）；`arisSettings`/`webUiSettings` 服务名不冲突；`aris.plugin.item`/`web-ui.plugin.item` 槽位名不冲突
3. **独立安装体验变化**：dsh-aris 单独安装时 live2d 设置卡不再显示（改由组卡承载）——README 明示，聚合包为推荐安装方式
4. **client 双平面**：聚合包自身无 client half（`dsh.client` 留空或不声明）；未来若放 compat shim 再开 `self`
5. **profile 层 `dsh.profile.bundles` 与 patch 行关系**：aris-dev 当前走 cordis.patch.yml 组合，聚合包走 bundle patch（`dsh.bundle.patch`），验证叠加顺序
