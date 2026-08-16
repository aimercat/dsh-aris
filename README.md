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

非 Docker 的 staging 工作流已以爱丽丝插件为例落地，见：

- `docs/staging-workflow.md`
- `scripts/setup-aris-dev.ps1`
- `scripts/sync-aris-dev.ps1`
- `scripts/verify-aris-dev.ps1`
- `scripts/promote-aris-dev.ps1`

当前约定所有插件的开发副本统一放在 `G:\CodeRep\DevRep`。
推荐 dev 启动方式：`dsh --profile aris-dev --port 3081`

## 方向

当出现第二个重量级插件（例如 `dsh-aris-live2d`）时，再从这个预备态继续拆成正式多包结构。
