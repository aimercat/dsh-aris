# @aimercat/dsh-aris-all

爱丽丝全家桶聚合插件：一条命令装齐 dsh-aris 家族。

## 包含

| 包 | 作用 |
| --- | --- |
| `@aimercat/dsh-aris` | 天童爱丽丝搭档预设插件（host + client 双面） |
| `@aimercat/dsh-aris-settings` | 设置页「爱丽丝全家桶」组卡 + `arisSettings` 设置桥（rc.6 兼容） |
| `@aimercat/dsh-memory`（依赖，暂未入仓） | 工作区记忆（**preset 级开启**，见下） |

## 安装

```sh
# 本地开发（先让全部子包走仓库构建产物）
node scripts/link-profile.mjs
dsh plugin --profile aris-dev add link:.../packages/dsh-aris-all

# npm 发布后
dsh plugin --profile aris-dev add @aimercat/dsh-aris-all
```

装完重启 `dsh`（桌面宿主需连同 runtime node 进程一起杀），设置页出现「爱丽丝全家桶」组卡，Live2D 等设置卡收纳其中。

> 严格（isolated）pnpm 布局需在 profile 的 `pnpm-workspace.yaml` 配
> `nodeLinker: hoisted`（aris-dev 已配）；pnpm 11 release-age 门禁请用
> `minimumReleaseAgeExclude` 排除 `@aimercat/*`。

## 设计要点

- **聚合 patch 由 `scripts/aggregate.mjs` 从 `aggregate.yml` 生成**，改清单后运行
  `node scripts/aggregate.mjs`（`--check` 验证无漂移），勿手改 `cordis.patch.yml`。
- **`dsh-memory` 刻意不进聚合 patch**（只作为依赖被安装）：聚合 patch 行由
  profile 顶层（host 平面）解析，若含 dsh-memory 行等于全局挂载，违背
  「dsh-memory preset 级开启」决策。preset/aris 的 agent 平面按需启用它。
- 聚合包自身无 client half，也不启用 `self`；未来需要随包加载的 compat
  shim 或 Live2D 重依赖再启用。

## 单独安装

只想用某个成员时可直接装单包：

```sh
dsh plugin --profile aris-dev add link:.../packages/dsh-aris          # 主插件
dsh plugin --profile aris-dev add link:.../packages/dsh-aris-settings # 组卡 + 设置桥
```

注意：`dsh-aris` 单独安装时 Live2D 设置卡不显示（组卡宿主缺席时声明感知
注入静默挂起）；配置仍可通过 profile 的 `cordis.patch.yml` 写入。
