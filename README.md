# dsh-aris workspace

爱丽丝插件全家桶的 workspace 根目录。当前采用“轻 monorepo 预备态”：
先建立 `pnpm workspace` 与共享根配置，现阶段只有一个主包，避免过早拆成过多独立插件。

## 当前包

- `packages/dsh-aris`：爱丽丝主包，包含 preset、勇者权限、Web client 增强与未来 Live2D 挂载点
- `docs/`：跨包调研与设计文档

## 开发

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm test
```

上述根脚本当前会转发到 `@aimercat/dsh-aris`。

## 安装当前主包

```bash
# 作为插件装入 profile
# <repo-path> 替换为本仓库根路径
# 真正安装目标是 workspace 子包 packages/dsh-aris
dsh plugin --profile <name> add link:<repo-path>\packages\dsh-aris

# 用 preset「勇者爱丽丝」
# 注意：必须复制而非链接 —— Windows Junction 对 agent-presets 发现不可见
Copy-Item "<repo-path>\packages\dsh-aris\preset\aris" "$env:USERPROFILE\.dsh\.agent-presets\aris" -Recurse -Force
```

## Staging

本仓库只保留 `aris-dev` 专用薄包装；通用开发隔离实现与模板文档已经迁到独立仓库：

- 本地模板仓库：`G:\CodeRep\dsh-plugin-dev-template`
- GitHub：`https://github.com/aimercat/dsh-plugin-dev-template`
- 通用说明：`G:\CodeRep\dsh-plugin-dev-template\docs\plugin-dev-template.md`
- 爱丽丝专用说明：`docs/staging-workflow.md`

本仓库保留的入口只有：

- `scripts/setup-aris-dev.cmd` / `.ps1`
- `scripts/start-aris-dev.cmd`
- `scripts/sync-aris-dev.cmd` / `.ps1`
- `scripts/verify-aris-dev.cmd` / `.ps1`
- `scripts/promote-aris-dev.cmd` / `.ps1`

这些脚本会转发到模板仓库里的 `plugin-dev` 实现，并固定爱丽丝默认参数：

- 开发副本根目录：`G:\CodeRep\DevRep`
- 开发 profile：`aris-dev`
- 开发 preset：`勇者爱丽丝（Dev）`
- 独立 `DSH_HOME`：`C:\Users\Duang\.dsh-dev`
- 推荐启动入口：`scripts\start-aris-dev.cmd`

如果模板仓库不在默认路径，可以先设置环境变量 `DSH_PLUGIN_DEV_TEMPLATE_REPO` 再运行上述脚本。

## 方向

当出现第二个重量级插件（例如 `dsh-aris-live2d`）时，再从这个预备态继续拆成正式多包结构。
