# @aimercat/dsh-aris-settings

爱丽丝家族设置组：设置页「爱丽丝全家桶」组卡 + rc.6 设置桥。

## 作用

- **组卡**：向设置页 `settings.plugin.item` 注入「爱丽丝全家桶」卡（`order: 95`），
  声明 `aris.plugin.item` 子槽位，dsh-aris 家族插件的设置卡收纳其中。
- **设置桥**：官方 `settingsScope` 对第三方 namespace 一律返回 unavailable
  （rc.6 apiproxy allowlist 硬编码），本包提供 `arisSettings` 服务（官方 scope
  为主 + `/api/dsh-aris-settings` loopback 桥兜底），家族插件卡片可正常读写。
- 与 dsh-web-ui 的 `webUiSettings` 服务**互不冲突**：两个全家桶可共存，
  各自的组卡与设置桥独立工作。

## 开发

```sh
pnpm typecheck && pnpm build && pnpm test
```
