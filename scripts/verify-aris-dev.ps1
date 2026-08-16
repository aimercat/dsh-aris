param(
  [string]$TemplateRepo = $(if ($env:DSH_PLUGIN_DEV_TEMPLATE_REPO) { $env:DSH_PLUGIN_DEV_TEMPLATE_REPO } else { 'G:\CodeRep\dsh-plugin-dev-template' }),
  [string]$RepoPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$PluginPackagePath = 'packages\dsh-aris',
  [string]$ExpectedClientPlatform = 'web'
)

$ErrorActionPreference = 'Stop'

$templateScript = Join-Path (Resolve-Path $TemplateRepo).Path 'scripts\verify-plugin-dev.ps1'
if (-not (Test-Path $templateScript)) {
  throw "Template verify script not found: $templateScript"
}

& $templateScript `
  -RepoPath $RepoPath `
  -PluginPackagePath $PluginPackagePath `
  -ExpectedClientPlatform $ExpectedClientPlatform
