param(
  [string]$TemplateRepo = $(if ($env:DSH_PLUGIN_DEV_TEMPLATE_REPO) { $env:DSH_PLUGIN_DEV_TEMPLATE_REPO } else { 'G:\CodeRep\dsh-plugin-dev-template' }),
  [string]$SourceRepo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$DevRoot = 'G:\CodeRep\DevRep',
  [string]$DevRepoName = 'dsh_aris_agent',
  [string]$DevBranch = 'dev/aris',
  [string]$DevProfile = 'aris-dev',
  [string]$DevPresetId = 'aris-dev',
  [string]$BaseProfile = 'web',
  [int]$DevPort = 3081,
  [string]$BaseDshHome = (Join-Path $HOME '.dsh'),
  [string]$DevDshHome = (Join-Path $HOME '.dsh-dev'),
  [string]$Live2DModelBase = '',
  [string]$Live2DCubismCoreUrl = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js',
  [switch]$EnableLive2D,
  [switch]$InstallDependencies
)

$ErrorActionPreference = 'Stop'

$templateRepo = (Resolve-Path $TemplateRepo).Path
$templateScript = Join-Path $templateRepo 'scripts\setup-plugin-dev.ps1'
$resolvedSourceRepo = (Resolve-Path $SourceRepo).Path
$temporaryPatchFile = $null
$additionalPatchPath = ''

if (-not (Test-Path $templateScript)) {
  throw "Template setup script not found: $templateScript"
}

try {
  if ($EnableLive2D -or $Live2DModelBase -ne '') {
    $temporaryPatchFile = Join-Path $resolvedSourceRepo 'scripts\.tmp-aris-dev-live2d.patch.yml'
    @"
- id: dsh-aris
  config:
    live2dEnabled: true
    live2dModelBase: $Live2DModelBase
    live2dCubismCoreUrl: $Live2DCubismCoreUrl
    live2dAnchor: bottom-right
    live2dScale: 1
    live2dDraggable: true
    live2dFollowPointer: false
"@ | Set-Content -Path $temporaryPatchFile
    $additionalPatchPath = 'scripts\.tmp-aris-dev-live2d.patch.yml'
  }

  & $templateScript `
    -PluginPackageName '@aimercat/dsh-aris' `
    -PluginPackagePath 'packages\dsh-aris' `
    -PresetSourcePath 'packages\dsh-aris\preset\aris' `
    -DevRepoName $DevRepoName `
    -DevBranch $DevBranch `
    -DevProfile $DevProfile `
    -DevPresetId $DevPresetId `
    -DevPresetDisplayName '勇者爱丽丝（Dev）' `
    -SourceRepo $resolvedSourceRepo `
    -DevRoot $DevRoot `
    -BaseProfile $BaseProfile `
    -DevPort $DevPort `
    -BaseDshHome $BaseDshHome `
    -DevDshHome $DevDshHome `
    -AdditionalPatchPath $additionalPatchPath `
    -InstallDependencies:$InstallDependencies
} finally {
  if ($null -ne $temporaryPatchFile -and (Test-Path $temporaryPatchFile)) {
    Remove-Item $temporaryPatchFile -Force
  }
}
