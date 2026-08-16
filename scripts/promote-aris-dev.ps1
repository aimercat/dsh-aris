param(
  [string]$StableRepo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path,
  [string]$DevRoot = 'G:\CodeRep\DevRep',
  [string]$DevRepoName = 'dsh_aris_agent',
  [string]$DevBranch = 'dev/aris',
  [string]$StableBranch = 'main',
  [switch]$Execute
)

$ErrorActionPreference = 'Stop'

function Require-Clean([string]$Repo, [string]$Label) {
  $status = git -C $Repo status --short
  if ($status) {
    throw "$Label worktree is not clean:`n$status"
  }
}

$stableRepo = (Resolve-Path $StableRepo).Path
$devRepo = Join-Path $DevRoot $DevRepoName

if (-not (Test-Path (Join-Path $stableRepo '.git'))) {
  throw "Stable repo is not a git repository: $stableRepo"
}
if (-not (Test-Path (Join-Path $devRepo '.git'))) {
  throw "Dev repo is not a git worktree/repository: $devRepo"
}

Require-Clean $stableRepo 'Stable'
Require-Clean $devRepo 'Dev'

Write-Host 'Promote plan:'
Write-Host "Stable repo  : $stableRepo"
Write-Host "Dev repo     : $devRepo"
Write-Host "Stable branch: $StableBranch"
Write-Host "Dev branch   : $DevBranch"
Write-Host ''
Write-Host 'Commands:'
Write-Host "git -C `"$stableRepo`" switch $StableBranch"
Write-Host "git -C `"$stableRepo`" merge --ff-only $DevBranch"

if (-not $Execute) {
  Write-Host ''
  Write-Host 'Dry run only. Add -Execute to perform the fast-forward merge.'
  exit 0
}

git -C $stableRepo switch $StableBranch
if ($LASTEXITCODE -ne 0) { throw "Failed to switch stable repo to $StableBranch" }

git -C $stableRepo merge --ff-only $DevBranch
if ($LASTEXITCODE -ne 0) { throw "Failed to fast-forward merge $DevBranch into $StableBranch" }

Write-Host ''
Write-Host 'Promote complete.'
