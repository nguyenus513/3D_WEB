Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Import-DeployEnv {
    param([string]$Path = '.env.deploy.local')

    if (-not (Test-Path -LiteralPath $Path)) {
        Write-Warning "Deploy env file not found: $Path. Falling back to process environment."
        return
    }

    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith('#')) { return }
        $idx = $line.IndexOf('=')
        if ($idx -lt 1) { return }
        $name = $line.Substring(0, $idx).Trim()
        $value = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
    }
}

function Require-Env {
    param([Parameter(Mandatory)][string[]]$Names)
    $missing = @()
    foreach ($name in $Names) {
        if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name, 'Process'))) {
            $missing += $name
        }
    }
    if ($missing.Count -gt 0) {
        throw "Missing required environment variables: $($missing -join ', ')"
    }
}

function Require-Command {
    param([Parameter(Mandatory)][string[]]$Names)
    $missing = @()
    foreach ($name in $Names) {
        if (-not (Get-Command $name -ErrorAction SilentlyContinue)) { $missing += $name }
    }
    if ($missing.Count -gt 0) {
        throw "Missing required commands: $($missing -join ', '). Install them before continuing."
    }
}

function ConvertTo-JsonFile {
    param(
        [Parameter(Mandatory)]$InputObject,
        [Parameter(Mandatory)][string]$Path
    )
    $json = if ($InputObject -is [System.Array]) {
        ConvertTo-Json -InputObject $InputObject -Depth 20
    } else {
        $InputObject | ConvertTo-Json -Depth 20
    }
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText((Resolve-Path $Path), $json, $utf8NoBom)
}

function Invoke-AtlasApi {
    param(
        [Parameter(Mandatory)][ValidateSet('GET','POST','PATCH','DELETE')][string]$Method,
        [Parameter(Mandatory)][string]$Path,
        $Body = $null,
        [int[]]$AllowedStatus = @(200,201,202,204,409)
    )

    Require-Env ATLAS_PUBLIC_KEY, ATLAS_PRIVATE_KEY
    Require-Command curl.exe

    $baseUrl = 'https://cloud.mongodb.com/api/atlas/v2'
    $url = if ($Path.StartsWith('http')) { $Path } else { "$baseUrl$Path" }
    $bodyFile = $null
    $outputFile = New-TemporaryFile
    $headers = @('-H', 'Accept: application/vnd.atlas.2023-01-01+json')

    try {
        $args = @('--digest', '-u', "$env:ATLAS_PUBLIC_KEY`:$env:ATLAS_PRIVATE_KEY", '-sS', '-X', $Method)
        $args += $headers
        if ($null -ne $Body) {
            $bodyFile = New-TemporaryFile
            ConvertTo-JsonFile -InputObject $Body -Path $bodyFile.FullName
            $args += @('-H', 'Content-Type: application/json', '--data-binary', "@$($bodyFile.FullName)")
        }
        $args += @('-o', $outputFile.FullName, '-w', '%{http_code}', $url)
        $statusText = & curl.exe @args
        $status = [int]$statusText
        $raw = if (Test-Path $outputFile.FullName) { Get-Content -LiteralPath $outputFile.FullName -Raw } else { '' }
        if ($AllowedStatus -notcontains $status) {
            throw "Atlas API $Method $Path failed with HTTP $status`: $raw"
        }
        if ([string]::IsNullOrWhiteSpace($raw)) { return $null }
        return $raw | ConvertFrom-Json
    } finally {
        Remove-Item -LiteralPath $outputFile.FullName -Force -ErrorAction SilentlyContinue
        if ($bodyFile) { Remove-Item -LiteralPath $bodyFile.FullName -Force -ErrorAction SilentlyContinue }
    }
}

function Get-AtlasMongoUri {
    Require-Env ATLAS_DB_USER, ATLAS_DB_PASSWORD, ATLAS_CLUSTER_NAME, ATLAS_DB_NAME
    $projectId = Get-AtlasProjectId
    $cluster = Invoke-AtlasApi -Method GET -Path "/groups/$projectId/clusters/$env:ATLAS_CLUSTER_NAME" -AllowedStatus @(200)
    $srvAddress = [string]$cluster.srvAddress
    if (-not $srvAddress) { throw "Cluster has no srvAddress yet. Current state: $($cluster.stateName)" }
    $srvAddress = $srvAddress -replace '^mongodb\+srv://', ''
    $encodedPassword = [System.Uri]::EscapeDataString($env:ATLAS_DB_PASSWORD)
    return "mongodb+srv://<user>:<password>@<cluster>/<database>"
}

function Get-AtlasProjectId {
    if (-not [string]::IsNullOrWhiteSpace($env:ATLAS_PROJECT_ID)) { return $env:ATLAS_PROJECT_ID }
    Require-Env ATLAS_ORG_ID, ATLAS_PROJECT_NAME
    $projects = Invoke-AtlasApi -Method GET -Path "/groups?orgId=$($env:ATLAS_ORG_ID)" -AllowedStatus @(200)
    $match = @($projects.results | Where-Object { $_.name -eq $env:ATLAS_PROJECT_NAME }) | Select-Object -First 1
    if (-not $match) { throw "Atlas project not found and ATLAS_PROJECT_ID not set: $env:ATLAS_PROJECT_NAME" }
    $env:ATLAS_PROJECT_ID = $match.id
    return $match.id
}

function Wait-AtlasClusterReady {
    param([int]$TimeoutMinutes = 15)
    $projectId = Get-AtlasProjectId
    $deadline = (Get-Date).AddMinutes($TimeoutMinutes)
    while ((Get-Date) -lt $deadline) {
        $cluster = Invoke-AtlasApi -Method GET -Path "/groups/$projectId/clusters/$env:ATLAS_CLUSTER_NAME" -AllowedStatus @(200)
        Write-Host "Atlas cluster state: $($cluster.stateName)"
        if ($cluster.stateName -eq 'IDLE') { return $cluster }
        Start-Sleep -Seconds 30
    }
    throw "Timed out waiting for Atlas cluster to become IDLE."
}

