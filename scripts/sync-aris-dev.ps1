param(
  [string]$SourceRepo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$DevRoot = 'G:\CodeRep\DevRep',
  [string]$DevRepoName = 'dsh_aris_agent'
)

$ErrorActionPreference = 'Stop'

$sourceRepo = (Resolve-Path $SourceRepo).Path
$devRepo = Join-Path $DevRoot $DevRepoName

if (-not (Test-Path (Join-Path $sourceRepo '.git'))) {
  throw "Source repo is not a git repository: $sourceRepo"
}
if (-not (Test-Path $devRepo)) {
  throw "Dev repo does not exist: $devRepo"
}

$robocopy = Get-Command robocopy -ErrorAction SilentlyContinue
if ($null -eq $robocopy) {
  throw 'robocopy is required on Windows for sync-aris-dev.ps1'
}

$excludeDirs = @('.git', '.dsh', 'node_modules')
$excludeFiles = @()

$arguments = @(
  $sourceRepo,
  $devRepo,
  '/MIR',
  '/FFT',
  '/R:1',
  '/W:1',
  '/NFL',
  '/NDL',
  '/NJH',
  '/NJS',
  '/NP',
  '/XD'
) + $excludeDirs + @('/XF') + $excludeFiles

& robocopy @arguments | Out-Host
$code = $LASTEXITCODE
if ($code -gt 7) {
  throw "robocopy failed with exit code $code"
}

Write-Host ''
Write-Host 'Dev repo synced from current working tree snapshot.'
Write-Host "Source : $sourceRepo"
Write-Host "Target : $devRepo"
