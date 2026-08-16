# DSH 插件 Staging 工作流

## 目标

在不引入 Docker 的前提下，把“开发中的插件改动”与“老师真实日用环境”隔离开。

这份流程以 `dsh-aris` 为例，但目录和命名规则可以推广到后续所有插件。

## 为什么当前不优先 Docker

当前主要问题不是后端进程环境一致性，而是：

- DSH profile 会直接吃本地插件目录
- preset 复制与 bundle 安装是本机用户目录状态
- GUI / client plugin 的成败依赖真实桌面宿主与本地配置

因此，当前性价比最高的隔离方式不是容器，而是：

- 稳定副本
- DevRep 开发副本
- dev profile
- dev preset

## 推荐目录结构

### 稳定副本

```text
G:\CodeRep\dsh_aris_agent
```

### 开发副本

```text
G:\CodeRep\DevRep\dsh_aris_agent
```

后续其它插件也统一放在：

```text
G:\CodeRep\DevRep\<plugin-name>
```

## 推荐命名

### Profile

- 日常：`aris-main`
- 开发：`aris-dev`

### Preset

- 日常：`aris`
- 开发：`aris-dev`

开发 preset 建议显示名改成 `勇者爱丽丝（Dev）`，避免 GUI 中误选。若插件内部存在按 preset id 启用的逻辑（如 Aris 的 thinking / Live2D gate），也必须显式把 `aris-dev` 视为受支持的 preset id，而不能只硬编码 `aris`。

## 爱丽丝插件的落地实践

### 一次性准备

在稳定仓库根目录执行：

```bat
scripts\setup-aris-dev.cmd
```

如果你明确在 PowerShell 里执行，也可以用：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-aris-dev.ps1
```

这会做四件事：

1. 在 `G:\CodeRep\DevRep\dsh_aris_agent` 建 dev worktree
2. 创建/复用开发分支 `dev/aris`
3. 把 preset 复制成 `~/.dsh/.agent-presets/aris-dev`，并改名为 `勇者爱丽丝（Dev）`
4. 以 `web` profile 为模板，生成 `aris-dev` profile 的 package.json / cordis.patch.yml，并把 `@aimercat/dsh-aris` 改指向 DevRep 开发副本

默认 profile 名是 `aris-dev`。如果你改名了，可以传参：

```bat
scripts\setup-aris-dev.cmd -DevProfile my-aris-dev
```

### 日常开发

1. 在稳定副本里先做实验性修改，或在开发副本里直接改代码。

稳定副本当前如果已经有大量未提交改动，需要先把当前工作树快照同步到开发副本：

```bat
scripts\sync-aris-dev.cmd
```

这一步是必要的，因为 `git worktree` 只带走 `HEAD` 已提交内容，不会自动带走你当前工作区里的未提交改动。换句话说：不先 `sync`，DevRep 里测到的很可能还是旧版本。

2. 在开发副本里继续改代码：

```text
G:\CodeRep\DevRep\dsh_aris_agent
```

3. 改完先跑预检：

```bat
scripts\verify-aris-dev.cmd
```

它会依次执行：

- `pnpm install`
- `pnpm typecheck`
- `pnpm build`
- `pnpm test`

并额外检查：

- 根 `package.json` 是否仍有 `dsh.bundle.patch`
- `packages/dsh-aris/package.json` 是否仍有 `dsh.client.platform = web`
- `packages/dsh-aris/lib/client.js` 是否已是单文件（没有 `require("./*.cjs")`）

3. 只在 `aris-dev` profile + `勇者爱丽丝（Dev）` preset 里做 GUI 验收

推荐启动命令：

```powershell
dsh --profile aris-dev --port 3081
```

然后在浏览器打开：

```text
http://127.0.0.1:3081
```

### Promote 到稳定副本

当开发副本验证通过后，在稳定仓库根目录执行：

```bat
scripts\promote-aris-dev.cmd
```

默认是 dry-run，只打印即将执行的 git 命令。

真正执行 fast-forward promote：

```bat
scripts\promote-aris-dev.cmd -Execute
```

默认约定：

- dev branch: `dev/aris`
- stable branch: `main`

如果你的默认分支不是 `main`，可以显式传：

```powershell
.\scripts\promote-aris-dev.ps1 -StableBranch master -Execute
```

## 三条硬规则

1. **真实日用 profile 不要直连 DevRep 开发副本**
2. **预检不过，不进 dev GUI 验收**
3. **dev GUI 验收不过，不 promote 到稳定副本**

## 可选增强：独立 DSH home

如果后面插件越来越多，建议再加一层：

- 日常：`~/.dsh`
- 开发：`~/.dsh-dev`

这样可以把 profile、preset、插件安装记录进一步隔离。

当前阶段可以先不做，等你发现 `aris-dev` profile 仍会和日常环境互相影响时，再补这层。

## 适用范围

这套工作流不只适用于 `dsh-aris`，后续所有插件都能复用：

- `dsh-task-board`
- `dsh-ssh`
- `dsh-aionui-panel`
- 以及后续的 `dsh-aris-live2d`

统一的收益是：

- 开发目录固定
- dev profile 命名固定
- promote 习惯固定
- 出问题时不需要临时救火真实环境

## 最终建议

当前阶段最稳的路线不是 Docker，而是：

- **稳定副本 + DevRep 开发副本 + dev profile + dev preset**

对爱丽丝插件来说，这已经足够把“改坏了导致本地真实环境启动不了”的风险压到很低。