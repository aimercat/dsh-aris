# dsh-aris Staging Workflow

## 目标

`dsh_aris_agent` 现在只维护爱丽丝专用的 `aris-dev` 薄包装入口，不再在仓库内重复维护通用开发隔离模板。

通用实现与完整模板文档的 source of truth 已迁到独立仓库：

- 本地模板仓库：`G:\CodeRep\dsh-plugin-dev-template`
- GitHub：`https://github.com/aimercat/dsh-plugin-dev-template`
- 完整模板文档：`G:\CodeRep\dsh-plugin-dev-template\docs\plugin-dev-template.md`

本文件只记录爱丽丝仓库自己的默认参数与入口习惯。

## 本仓库保留的入口

- `scripts/setup-aris-dev.cmd` / `.ps1`
- `scripts/start-aris-dev.cmd`
- `scripts/sync-aris-dev.cmd` / `.ps1`
- `scripts/verify-aris-dev.cmd` / `.ps1`
- `scripts/promote-aris-dev.cmd` / `.ps1`

这些脚本内部都会转发到模板仓库的 `scripts/*-plugin-dev.*`，但会固定爱丽丝默认值：

- `PluginPackageName`: `@aimercat/dsh-aris`
- `PluginPackagePath`: `packages\dsh-aris`
- `PresetSourcePath`: `packages\dsh-aris\preset\aris`
- `DevRepoName`: `dsh_aris_agent`
- `DevBranch`: `dev/aris`
- `DevProfile`: `aris-dev`
- `DevPresetId`: `aris-dev`
- `DevPresetDisplayName`: `勇者爱丽丝（Dev）`
- `DevRoot`: `G:\CodeRep\DevRep`
- `DevDshHome`: `C:\Users\Duang\.dsh-dev`
- `DevPort`: `3081`

如果模板仓库不在默认位置，可以先设置：

```powershell
$env:DSH_PLUGIN_DEV_TEMPLATE_REPO = 'G:\CodeRep\dsh-plugin-dev-template'
```

批处理入口也会读取同名环境变量；未设置时默认回落到上面的路径。

## 一次性准备

在仓库根目录执行：

```bat
scripts\setup-aris-dev.cmd
```

如果要打开 Live2D dev 配置，可继续沿用爱丽丝专用参数：

```powershell
pwsh -NoProfile -File .\scripts\setup-aris-dev.ps1 -EnableLive2D -Live2DModelBase "<model-base-url>"
```

其中 Live2D 相关 patch 会由 `setup-aris-dev.ps1` 临时生成，再交给模板仓库的 `setup-plugin-dev.ps1` 追加到 dev profile。

## 日常循环

1. 同步当前工作树快照到开发副本：

```bat
scripts\sync-aris-dev.cmd
```

2. 在开发副本 `G:\CodeRep\DevRep\dsh_aris_agent` 内继续改动，或先在稳定副本试验后再同步。

3. 跑预检：

```bat
scripts\verify-aris-dev.cmd
```

4. 启动独立 dev 环境：

```bat
scripts\start-aris-dev.cmd
```

然后在浏览器打开 `http://127.0.0.1:3081`，选择 `勇者爱丽丝（Dev）`。

5. 验收通过后做 promote：

```bat
scripts\promote-aris-dev.cmd
```

真正执行 fast-forward merge：

```bat
scripts\promote-aris-dev.cmd -Execute
```

## 规则

1. 日常 profile 不直连 DevRep 开发副本。
2. 预检不过，不进 dev GUI 验收。
3. dev GUI 验收不过，不 promote 到稳定分支。

## 说明

如果需要调整通用隔离能力，不在本仓库继续扩展 `plugin-dev` 模板；应优先回流到 `dsh-plugin-dev-template`，再让爱丽丝薄包装跟随更新。
