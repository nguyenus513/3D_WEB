param(
    [string]$EnvFile = '.env.deploy.local',
    [switch]$CreateProject,
    [switch]$CreateCluster,
    [switch]$CreateDbUser,
    [switch]$AllowNetwork,
    [switch]$PrintUri
)

. "$PSScriptRoot/common.ps1"
Import-DeployEnv $EnvFile
Require-Env ATLAS_PUBLIC_KEY, ATLAS_PRIVATE_KEY, ATLAS_ORG_ID, ATLAS_PROJECT_NAME, ATLAS_CLUSTER_NAME, ATLAS_DB_NAME, ATLAS_DB_USER, ATLAS_DB_PASSWORD

if ($CreateProject -and [string]::IsNullOrWhiteSpace($env:ATLAS_PROJECT_ID)) {
    Write-Host "Ensuring Atlas project: $env:ATLAS_PROJECT_NAME"
    $projects = Invoke-AtlasApi -Method GET -Path "/groups?orgId=$($env:ATLAS_ORG_ID)" -AllowedStatus @(200)
    $project = @($projects.results | Where-Object { $_.name -eq $env:ATLAS_PROJECT_NAME }) | Select-Object -First 1
    if (-not $project) {
        $project = Invoke-AtlasApi -Method POST -Path '/groups' -Body @{
            name = $env:ATLAS_PROJECT_NAME
            orgId = $env:ATLAS_ORG_ID
        } -AllowedStatus @(201)
        Write-Host "Created Atlas project: $($project.id)"
    } else {
        Write-Host "Atlas project exists: $($project.id)"
    }
    $env:ATLAS_PROJECT_ID = $project.id
}

$projectId = Get-AtlasProjectId
Write-Host "Using Atlas project: $projectId"

if ($CreateCluster) {
    Write-Host "Ensuring Atlas M0 cluster: $env:ATLAS_CLUSTER_NAME"
    $existing = $null
    try { $existing = Invoke-AtlasApi -Method GET -Path "/groups/$projectId/clusters/$env:ATLAS_CLUSTER_NAME" -AllowedStatus @(200) } catch { $existing = $null }
    if ($existing) {
        Write-Host "Atlas cluster exists: $($existing.name), state=$($existing.stateName)"
    } else {
        $provider = if ($env:ATLAS_PROVIDER) { $env:ATLAS_PROVIDER } else { 'AWS' }
        $region = if ($env:ATLAS_REGION) { $env:ATLAS_REGION } else { 'AP_SOUTHEAST_1' }
        $body = @{
            name = $env:ATLAS_CLUSTER_NAME
            clusterType = 'REPLICASET'
            backupEnabled = $false
            providerSettings = @{
                providerName = 'TENANT'
                backingProviderName = $provider
                regionName = $region
                instanceSizeName = 'M0'
            }
        }
        $cluster = Invoke-AtlasApi -Method POST -Path "/groups/$projectId/clusters" -Body $body -AllowedStatus @(201,202)
        Write-Host "Created Atlas cluster: $($cluster.name), state=$($cluster.stateName)"
    }
    Wait-AtlasClusterReady | Out-Null
}

if ($CreateDbUser) {
    Write-Host "Ensuring Atlas DB user: $env:ATLAS_DB_USER"
    $users = Invoke-AtlasApi -Method GET -Path "/groups/$projectId/databaseUsers/admin" -AllowedStatus @(200)
    $existingUser = @($users.results | Where-Object { $_.username -eq $env:ATLAS_DB_USER }) | Select-Object -First 1
    $body = @{
        databaseName = 'admin'
        username = $env:ATLAS_DB_USER
        password = $env:ATLAS_DB_PASSWORD
        roles = @(
            @{
                databaseName = $env:ATLAS_DB_NAME
                roleName = 'readWrite'
            },
            @{
                databaseName = $env:ATLAS_DB_NAME
                roleName = 'dbAdmin'
            }
        )
        scopes = @(@{
            name = $env:ATLAS_CLUSTER_NAME
            type = 'CLUSTER'
        })
    }
    if ($existingUser) {
        Invoke-AtlasApi -Method PATCH -Path "/groups/$projectId/databaseUsers/admin/$($env:ATLAS_DB_USER)" -Body $body -AllowedStatus @(200) | Out-Null
        Write-Host "Updated DB user."
    } else {
        Invoke-AtlasApi -Method POST -Path "/groups/$projectId/databaseUsers" -Body $body -AllowedStatus @(201) | Out-Null
        Write-Host "Created DB user."
    }
}

if ($AllowNetwork) {
    $allowIp = if ($env:ATLAS_ALLOW_IP) { $env:ATLAS_ALLOW_IP } else { '0.0.0.0/0' }
    Write-Host "Ensuring Atlas network access: $allowIp"
    $body = @{
        cidrBlock = $allowIp
        comment = 'Vercel/serverless access for IE213.Q22'
    }
    Invoke-AtlasApi -Method POST -Path "/groups/$projectId/accessList" -Body @($body) -AllowedStatus @(200,201,409) | Out-Null
    Write-Host "Network access ready."
}

if ($PrintUri) {
    $uri = Get-AtlasMongoUri
    Write-Host "MONGODB_URI=$uri"
    Write-Host "MONGODB_DB_NAME=$env:ATLAS_DB_NAME"
}

Write-Host 'Atlas init completed.'

