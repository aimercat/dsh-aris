# Third-Party Notices

本仓库（dsh-aris）以 MIT License 发布（见 [LICENSE](./LICENSE)），但包含从
[dsh-web-ui](https://github.com/zhu1090093659/dsh-web-ui)（Apache License 2.0）
移植的代码。按照 Apache-2.0 §4（Redistribution）的要求，此处声明移植来源与
许可；Apache License 2.0 全文见 [licenses/APACHE-2.0.txt](./licenses/APACHE-2.0.txt)
或 <https://www.apache.org/licenses/LICENSE-2.0>。

## 移植文件清单（来自 dsh-web-ui，Apache-2.0）

| 文件 | 来源 | 改动 |
| --- | --- | --- |
| `scripts/aggregate.mjs` | dsh-web-ui `scripts/aggregate.mjs` | 扩展 insert 块处理、聚合清单改为爱丽丝全家桶 |
| `scripts/link-profile.mjs` | dsh-web-ui `scripts/link-profile.mjs` | scope 改为 `@aimercat/`，外部链接清单策略 |
| `packages/dsh-aris-settings/src/bridge.ts` | dsh-web-ui-settings `src/bridge.ts` | 服务名改为 `arisSettings`，避免与 `webUiSettings` 冲突 |
| `packages/dsh-aris-settings/src/allowlist.ts` | dsh-web-ui-settings `src/allowlist.ts` | scope 收窄为 dsh-aris 家族 |
| `packages/dsh-aris-settings/src/client/compat-settings-scope.ts` | dsh-web-ui-settings `src/client/compat-settings-scope.ts` | 改名共存，两个全家桶互不干扰 |

以上文件的源文件版权归 dsh-web-ui 原仓库所有，按 Apache-2.0 条款使用。
本仓库其余代码（`packages/dsh-aris` 主体：勇者权限、Live2D、client half；
`packages/dsh-aris-all` 聚合包；脚本测试等）为原创，按 MIT License 发布。

## 使用说明

- 修改上述移植文件时，请保留头部 `Ported from ...` 署名注释。
- 新增从 dsh-web-ui（或其他 Apache-2.0 项目）移植的代码时，同步更新本文件。
