# decisions


## [+] aris preset 补齐标准模式全部能力 (2026-08-15)

让 dsh-aris 的爱丽丝模式具备标准模式全部能力：① 新增 shell 行 tool-bash（win32 禁用）/tool-pwsh（非 win32 禁用），执行器在 host plane；② 把原本散放的 4 个 subagent 工具行重构为 delegation 组（cordis:group + isolate workflowEngine: true），并补入 workflow-worker-thread(provider: spawn)、tool-workflow、tool-ralph(subagentProvider: spawn, maxRounds: 64) 及两个 disabled 产品子代理行（codex/claude-code）；③ plan-mode section 文案同步为标准版。workflow 相关行必须放在带 isolate workflowEngine: true 的组内，否则消费者解析不到本 preset 填充的 host 注册表。已用 agentPresets.standingKeyFor('aris') mount-validate 通过。repo（G:\CodeRep\dsh_aris_agent\preset\aris\）与已安装副本（~/.dsh/.agent-presets/aris\）两处都要同步编辑；本次已把 repo 领先的"思考风格"persona 块同步进安装副本。
