param(
  [string]$SourceRepo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$DevRoot = 'G:\CodeRep\DevRep',
  [string]$DevRepoName = 'dsh_aris_agent',
  [string]$DevBranch = 'dev/aris',
  [string]$DevProfile = 'aris-dev',
  [string]$DevPresetId = 'aris-dev',
  [string]$BaseProfile = 'web',
  [int]$DevPort = 3081,
  [switch]$InstallPlugin
)

$ErrorActionPreference = 'Stop'

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

Require-Command git

$sourceRepo = (Resolve-Path $SourceRepo).Path
$devRoot = [System.IO.Path]::GetFullPath($DevRoot)
$devRepo = Join-Path $devRoot $DevRepoName
$presetSource = Join-Path $sourceRepo 'packages\dsh-aris\preset\aris'
$presetTarget = Join-Path $HOME ".dsh\.agent-presets\$DevPresetId"
$profilesRoot = Join-Path $HOME '.dsh\profiles'
$baseProfileDir = Join-Path $profilesRoot $BaseProfile
$devProfileDir = Join-Path $profilesRoot $DevProfile

if (-not (Test-Path (Join-Path $sourceRepo '.git'))) {
  throw "Source repo is not a git repository: $sourceRepo"
}
if (-not (Test-Path $presetSource)) {
  throw "Preset source not found: $presetSource"
}
if (-not (Test-Path $baseProfileDir)) {
  throw "Base profile not found: $baseProfileDir"
}

New-Item -ItemType Directory -Path $devRoot -Force | Out-Null
New-Item -ItemType Directory -Path $devProfileDir -Force | Out-Null

$worktreeExists = $false
$worktreeList = git -C $sourceRepo worktree list --porcelain
$normalizedDevRepo = [System.IO.Path]::GetFullPath($devRepo).Replace('/', '\')
foreach ($line in $worktreeList) {
  if (-not $line.StartsWith('worktree ')) { continue }
  $listed = $line.Substring(9)
  $normalizedListed = [System.IO.Path]::GetFullPath($listed).Replace('/', '\')
  if ($normalizedListed -eq $normalizedDevRepo) {
    $worktreeExists = $true
    break
  }
}
if ((-not $worktreeExists) -and (Test-Path $devRepo) -and (Test-Path (Join-Path $devRepo '.git'))) {
  $worktreeExists = $true
}

if (-not $worktreeExists) {
  $branchExists = $false
  try {
    git -C $sourceRepo rev-parse --verify --quiet $DevBranch *> $null
    if ($LASTEXITCODE -eq 0) { $branchExists = $true }
  } catch {
    $branchExists = $false
  }

  if ($branchExists) {
    git -C $sourceRepo worktree add $devRepo $DevBranch
  } else {
    git -C $sourceRepo worktree add $devRepo -b $DevBranch
  }
} else {
  Write-Host "Dev worktree already exists: $devRepo"
}

if (Test-Path $presetTarget) {
  Remove-Item $presetTarget -Recurse -Force
}
Copy-Item $presetSource $presetTarget -Recurse -Force

$presetFile = Join-Path $presetTarget 'preset.yml'
if (Test-Path $presetFile) {
  $content = Get-Content $presetFile -Raw
  $content = [System.Text.RegularExpressions.Regex]::Replace($content, '^name:\s*.+$', 'name: 勇者爱丽丝（Dev）', [System.Text.RegularExpressions.RegexOptions]::Multiline)
  Set-Content -Path $presetFile -Value $content
}

$basePackage = Join-Path $baseProfileDir 'package.json'
$basePatch = Join-Path $baseProfileDir 'cordis.patch.yml'
$devPackage = Join-Path $devProfileDir 'package.json'
$devPatch = Join-Path $devProfileDir 'cordis.patch.yml'

if (Test-Path $basePackage) {
  $package = Get-Content $basePackage -Raw | ConvertFrom-Json
  $package.name = "dsh-profile-$DevProfile"
  if ($null -eq $package.dependencies) {
    $package | Add-Member -NotePropertyName dependencies -NotePropertyValue ([ordered]@{})
  }
  $package.dependencies.'@aimercat/dsh-aris' = "link:$devRepo\packages\dsh-aris"
  $package | ConvertTo-Json -Depth 20 | Set-Content -Path $devPackage
}
if (Test-Path $basePatch) {
  Copy-Item $basePatch $devPatch -Force
}

Write-Host ''
Write-Host 'Staging environment prepared.'
Write-Host "Source repo : $sourceRepo"
Write-Host "Dev repo    : $devRepo"
Write-Host "Dev branch  : $DevBranch"
Write-Host "Dev preset  : $DevPresetId"
Write-Host "Dev profile : $DevProfile"
Write-Host ''
Write-Host 'Next steps:'
Write-Host "1. Open the dev repo: $devRepo"
Write-Host "2. Start DSH with profile on a separate port:"
Write-Host "   dsh --profile $DevProfile --port $DevPort"
Write-Host "3. Open http://127.0.0.1:$DevPort and start a session with preset: 勇者爱丽丝（Dev）"
Write-Host "4. If needed, verify the dev repo before testing:"
Write-Host "   powershell -ExecutionPolicy Bypass -File $sourceRepo\scripts\verify-aris-dev.ps1 -RepoPath $devRepo"

if ($InstallPlugin) {
  Require-Command dsh
  dsh plugin --profile $DevProfile add "link:$devRepo\packages\dsh-aris"
}
