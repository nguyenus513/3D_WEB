param(
    [string]$EnvFile = '.env.deploy.local',
    [switch]$CreateProject,
    [switch]$CreateCluster,
    [switch]$CreateDbUser,
    [switch]$AllowNetwork,
    [switch]$SkipMigration,
    [switch]$SkipVercelEnv,
    [switch]$Prod,
    [switch]$TestRegister
)

$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/common.ps1"
Import-DeployEnv $EnvFile

Write-Host '=== 1/6 Atlas init ==='
& "$PSScriptRoot/atlas-init.ps1" -EnvFile $EnvFile -CreateProject:$CreateProject -CreateCluster:$CreateCluster -CreateDbUser:$CreateDbUser -AllowNetwork:$AllowNetwork -PrintUri
if ($LASTEXITCODE -ne 0) { throw 'Atlas init failed' }

if (-not $SkipMigration) {
    Write-Host '=== 2/6 Atlas migration ==='
    & "$PSScriptRoot/atlas-migrate.ps1" -EnvFile $EnvFile
    if ($LASTEXITCODE -ne 0) { throw 'Atlas migration failed' }
} else {
    Write-Host '=== 2/6 Atlas migration skipped ==='
}

if (-not $SkipVercelEnv) {
    Write-Host '=== 3/6 Vercel env ==='
    & "$PSScriptRoot/vercel-env.ps1" -EnvFile $EnvFile
    if ($LASTEXITCODE -ne 0) { throw 'Vercel env failed' }
} else {
    Write-Host '=== 3/6 Vercel env skipped ==='
}

Write-Host '=== 4/6 Vercel deploy ==='
& "$PSScriptRoot/vercel-deploy.ps1" -EnvFile $EnvFile -Prod:$Prod
if ($LASTEXITCODE -ne 0) { throw 'Vercel deploy failed' }

$baseUrl = if ($Prod -and $env:VERCEL_PROD_DOMAIN) {
    "https://$($env:VERCEL_PROD_DOMAIN)"
} elseif ($env:NEXT_PUBLIC_APP_URL) {
    $env:NEXT_PUBLIC_APP_URL
} else {
    Write-Warning 'NEXT_PUBLIC_APP_URL/VERCEL_PROD_DOMAIN not set, skipping smoke test. Paste preview URL and run smoke-test.ps1 manually.'
    exit 0
}

Write-Host '=== 5/6 Smoke test ==='
& "$PSScriptRoot/smoke-test.ps1" -BaseUrl $baseUrl -TestRegister:$TestRegister
if ($LASTEXITCODE -ne 0) { throw 'Smoke test failed' }

Write-Host '=== 6/6 Done ==='
Write-Host "Deployment pipeline completed for $baseUrl"
