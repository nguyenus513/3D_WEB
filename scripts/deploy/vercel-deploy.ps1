param(
    [string]$EnvFile = '.env.deploy.local',
    [switch]$Prod,
    [switch]$SkipBuild
)

. "$PSScriptRoot/common.ps1"
Import-DeployEnv $EnvFile
Require-Command vercel
Require-Env VERCEL_TOKEN

if (-not $SkipBuild) {
    Write-Host 'Running local build gate...'
    if (-not $env:MONGODB_URI) { $env:MONGODB_URI = Get-AtlasMongoUri }
    if (-not $env:MONGODB_DB_NAME) { $env:MONGODB_DB_NAME = $env:ATLAS_DB_NAME }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Local build failed' }
}

$args = @('deploy', '--yes', '--token', $env:VERCEL_TOKEN)
if ($Prod) { $args += '--prod' }
Write-Host "Running: vercel $($args -join ' ')"
& vercel @args
if ($LASTEXITCODE -ne 0) { throw 'Vercel deploy failed' }
