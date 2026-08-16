param(
  [string]$TemplateRepo = $(if ($env:DSH_PLUGIN_DEV_TEMPLATE_REPO) { $env:DSH_PLUGIN_DEV_TEMPLATE_REPO } else { 'G:\CodeRep\dsh-plugin-dev-template' }),
  [string]$SourceRepo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$DevRoot = 'G:\CodeRep\DevRep',
  [string]$DevRepoName = 'dsh_aris_agent'
)

$ErrorActionPreference = 'Stop'

$templateScript = Join-Path (Resolve-Path $TemplateRepo).Path 'scripts\sync-plugin-dev.ps1'
if (-not (Test-Path $templateScript)) {
  throw "Template sync script not found: $templateScript"
}

& $templateScript `
  -SourceRepo $SourceRepo `
  -DevRoot $DevRoot `
  -DevRepoName $DevRepoName
