param(
    [string]$EnvFile = '.env.deploy.local',
    [switch]$SkipDump,
    [switch]$SkipRestore,
    [string]$ArchivePath = '.tmp-intelligentroutex.archive.gz'
)

. "$PSScriptRoot/common.ps1"
Import-DeployEnv $EnvFile
Require-Env ATLAS_PUBLIC_KEY, ATLAS_PRIVATE_KEY, ATLAS_CLUSTER_NAME, ATLAS_DB_NAME, ATLAS_DB_USER, ATLAS_DB_PASSWORD

$atlasUri = Get-AtlasMongoUri
$localUri = if ($env:LOCAL_MONGODB_URI) { $env:LOCAL_MONGODB_URI } else { 'mongodb://miniver:miniver_dev_password@localhost:27017/intelligentroutex?authSource=admin' }

if (-not $SkipDump) {
    Require-Command mongodump
    Write-Host "Dumping local MongoDB to $ArchivePath"
    & mongodump --uri=$localUri --db=$env:ATLAS_DB_NAME --archive=$ArchivePath --gzip
    if ($LASTEXITCODE -ne 0) { throw 'mongodump failed' }
}

if (-not $SkipRestore) {
    Require-Command mongorestore
    Write-Host 'Restoring dump to Atlas...'
    & mongorestore --uri=$atlasUri --archive=$ArchivePath --gzip --drop
    if ($LASTEXITCODE -ne 0) { throw 'mongorestore failed' }
}

Write-Host 'Applying schema/index script to Atlas...'
npx -y mongosh@latest $atlasUri scripts/mongodb/create-current-schema.js
if ($LASTEXITCODE -ne 0) { throw 'Atlas schema application failed' }

Write-Host 'Atlas migration completed.'
