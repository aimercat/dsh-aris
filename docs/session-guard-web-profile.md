# dsh-session-guard：合回 master 与日常 GUI 挂载清单

> 前置条件：L5 用户已在 dev GUI（3081）确认插件正常。
> 本清单在 L5 确认后按顺序执行，一步到位。

## 1. 合回 master

```powershell
# 在 DevRep 开发副本执行（promote 脚本转发模板，注意 StableBranch 必须显式传 master）
cd G:\CodeRep\DevRep\dsh_aris_agent
.\scripts\promote-aris-dev.ps1 -StableBranch master -Execute
```

或手动等价操作：

```powershell
# 先确认可快进（期望输出 0  N）
git rev-list --left-right --count master...dev/aris
# dry-run 验证
git -C G:\CodeRep\dsh_aris_agent merge --ff-only --no-commit dev/aris
git -C G:\CodeRep\dsh_aris_agent merge --abort
# 正式合回（在稳定仓库 worktree 执行）
git -C G:\CodeRep\dsh_aris_agent merge --ff-only dev/aris
```

## 2. 稳定仓库构建产物

lib/ 不被 git 跟踪——合回后必须在稳定仓库重新安装 + 构建，否则日常 GUI 加载旧产物：

```powershell
cd G:\CodeRep\dsh_aris_agent
pnpm install
pnpm --filter @aimercat/dsh-session-guard build
```

## 3. 日常 web profile 挂载（~/.dsh/profiles/web）

编辑 `~/.dsh/profiles/web/package.json`：

```jsonc
"dependencies": {
  // 加一行（link 指向稳定仓库）
  "@aimercat/dsh-session-guard": "link:G:\\CodeRep\\dsh_aris_agent\\packages\\dsh-session-guard",
  ...
},
"dsh": { "profile": { "bundles": [
  ...
  "@aimercat/dsh-aris",
  "@aimercat/dsh-session-guard"   // 加一行
] } }
```

```powershell
cd ~/.dsh/profiles/web
pnpm install
```

## 4. 重启日常 runtime（关键！外壳重启无效）

```powershell
# 杀 3080 的 runtime node 进程（bin.js web --port 3080），再经桌面宿主重启
Get-NetTCPConnection -LocalPort 3080 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
# 然后从桌面宿主重新打开/启动 GUI
```

## 5. 验证

```powershell
# L3：行合成
dsh --profile web --dump-config | Select-String session-guard
# L4：HTTP 健康
Invoke-WebRequest http://127.0.0.1:3080 -UseBasicParsing | Select-Object StatusCode
```

## 备选：走聚合包安装

若用户以 `dsh-aris-all` 一键安装全家桶，session-guard 已在聚合 patch 中（4 insert rows），
无需单独挂 web profile——装聚合包即包含。此时仅需确保聚合包的 dependencies 能解析
`@aimercat/dsh-session-guard`（workspace:* 已同步，见 pnpm-lock.yaml）。

## 行为验证（可选实测）

长会话中观察：

- 输出截断自动续写：日志出现 `session-guard: continued turn N after max-tokens truncation`
- 提前压缩：日志出现 `session-guard: early-compacted N surface nodes`
- 溢出存档：`<工作区>/.dsh/session-guard/checkpoints/` 出现存档 md

日志级别：插件走 `ctx.logger.info/warn`，宿主默认可见 warn；info 需宿主日志级别支持。
