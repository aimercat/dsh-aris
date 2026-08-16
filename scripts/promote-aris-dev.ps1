param(
  [string]$TemplateRepo = $(if ($env:DSH_PLUGIN_DEV_TEMPLATE_REPO) { $env:DSH_PLUGIN_DEV_TEMPLATE_REPO } else { 'G:\CodeRep\dsh-plugin-dev-template' }),
  [string]$StableRepo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$DevRoot = 'G:\CodeRep\DevRep',
  [string]$DevRepoName = 'dsh_aris_agent',
  [string]$DevBranch = 'dev/aris',
  [string]$StableBranch = 'main',
  [switch]$Execute
)

$ErrorActionPreference = 'Stop'

$templateScript = Join-Path (Resolve-Path $TemplateRepo).Path 'scripts\promote-plugin-dev.ps1'
if (-not (Test-Path $templateScript)) {
  throw "Template promote script not found: $templateScript"
}

& $templateScript `
  -StableRepo $StableRepo `
  -DevRoot $DevRoot `
  -DevRepoName $DevRepoName `
  -DevBranch $DevBranch `
  -StableBranch $StableBranch `
  -Execute:$Execute
