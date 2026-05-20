param(
    [string]$EnvFile = '.env.deploy.local',
    [ValidateSet('preview','production','development')][string[]]$Targets = @('preview','production'),
    [switch]$IncludeOptional
)

. "$PSScriptRoot/common.ps1"
Import-DeployEnv $EnvFile
Require-Command vercel
Require-Env VERCEL_TOKEN, MONGODB_DB_NAME, AUTH_SECRET, NEXTAUTH_SECRET

$atlasUri = if ($env:MONGODB_URI) { $env:MONGODB_URI } else { Get-AtlasMongoUri }
$domain = if ($env:VERCEL_PROD_DOMAIN) { "https://$($env:VERCEL_PROD_DOMAIN)" } elseif ($env:NEXT_PUBLIC_APP_URL) { $env:NEXT_PUBLIC_APP_URL } else { '' }

$required = [ordered]@{
    MONGODB_URI = $atlasUri
    MONGODB_DB_NAME = $env:MONGODB_DB_NAME
    AUTH_SECRET = $env:AUTH_SECRET
    NEXTAUTH_SECRET = $env:NEXTAUTH_SECRET
    NEXTAUTH_URL = if ($env:NEXTAUTH_URL) { $env:NEXTAUTH_URL } else { $domain }
    AUTH_URL = if ($env:AUTH_URL) { $env:AUTH_URL } else { $domain }
    NEXT_PUBLIC_APP_URL = if ($env:NEXT_PUBLIC_APP_URL) { $env:NEXT_PUBLIC_APP_URL } else { $domain }
    ADMIN_SECRET_KEY = $env:ADMIN_SECRET_KEY
    ADMIN_STEALTH_TOKEN = $env:ADMIN_STEALTH_TOKEN
    TOKEN_ENCRYPTION_KEY = $env:TOKEN_ENCRYPTION_KEY
}

$optionalNames = @(
    'R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME','R2_PUBLIC_URL',
    'GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GOOGLE_OAUTH_CLIENT_ID','GOOGLE_OAUTH_CLIENT_SECRET',
    'GMAIL_USER','GMAIL_APP_PASSWORD','QR_WEBHOOK_SECRET','WEBHOOK_SECRET'
)

if ($IncludeOptional) {
    foreach ($name in $optionalNames) { $required[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
}

foreach ($target in $Targets) {
    Write-Host "Setting Vercel env for target: $target"
    foreach ($entry in $required.GetEnumerator()) {
        if ([string]::IsNullOrWhiteSpace([string]$entry.Value)) {
            Write-Warning "Skipping empty env: $($entry.Key)"
            continue
        }
        $tmp = New-TemporaryFile
        try {
            [string]$entry.Value | Set-Content -LiteralPath $tmp.FullName -NoNewline -Encoding UTF8
            & vercel env rm $entry.Key $target --yes --token $env:VERCEL_TOKEN 2>$null | Out-Null
            Get-Content -LiteralPath $tmp.FullName -Raw | & vercel env add $entry.Key $target --token $env:VERCEL_TOKEN
            if ($LASTEXITCODE -ne 0) { throw "Failed setting Vercel env $($entry.Key) for $target" }
            Write-Host "  set $($entry.Key)"
        } finally {
            Remove-Item -LiteralPath $tmp.FullName -Force -ErrorAction SilentlyContinue
        }
    }
}

Write-Host 'Vercel environment variables completed.'
