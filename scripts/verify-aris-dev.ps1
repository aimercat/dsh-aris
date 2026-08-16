param(
  [string]$RepoPath = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

function Read-Json([string]$Path) {
  Get-Content $Path -Raw | ConvertFrom-Json
}

$repo = (Resolve-Path $RepoPath).Path
$rootPackage = Join-Path $repo 'package.json'
$pluginPackage = Join-Path $repo 'packages\dsh-aris\package.json'
$clientBundle = Join-Path $repo 'packages\dsh-aris\lib\client.js'

Push-Location $repo
try {
  pnpm install
  if ($LASTEXITCODE -ne 0) { throw 'pnpm install failed' }
  pnpm typecheck
  if ($LASTEXITCODE -ne 0) { throw 'pnpm typecheck failed' }
  pnpm build
  if ($LASTEXITCODE -ne 0) { throw 'pnpm build failed' }
  pnpm test
  if ($LASTEXITCODE -ne 0) { throw 'pnpm test failed' }
} finally {
  Pop-Location
}

Assert-True (Test-Path $rootPackage) "Missing root package.json: $rootPackage"
Assert-True (Test-Path $pluginPackage) "Missing plugin package.json: $pluginPackage"
Assert-True (Test-Path $clientBundle) "Missing client bundle: $clientBundle"

$root = Read-Json $rootPackage
$plugin = Read-Json $pluginPackage
$client = Get-Content $clientBundle -Raw

Assert-True ($null -ne $root.dsh.bundle.patch) 'Root package.json is missing dsh.bundle.patch'
Assert-True ($plugin.dsh.client.platform -eq 'web') 'packages/dsh-aris/package.json is missing dsh.client.platform = web'
Assert-True (-not ($client -match 'require\("\./')) 'Client bundle still contains relative chunk requires'
Assert-True (-not ($client -match '\.cjs')) 'Client bundle still references split CJS chunks'

Write-Host ''
Write-Host 'Aris dev verification passed.'
Write-Host "Repo        : $repo"
Write-Host "Root bundle : OK"
Write-Host "Client meta : OK"
Write-Host "Single file : OK"
