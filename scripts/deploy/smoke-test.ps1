param(
    [Parameter(Mandatory)][string]$BaseUrl,
    [int]$TimeoutSeconds = 15,
    [switch]$TestRegister
)

$ErrorActionPreference = 'Stop'
$BaseUrl = $BaseUrl.TrimEnd('/')
$failures = @()

function Test-Get {
    param(
        [string]$Path,
        [int[]]$AllowedStatus = @(200),
        [string]$Contains = ''
    )
    $tmp = New-TemporaryFile
    try {
        $statusText = & curl.exe -L --max-time $TimeoutSeconds -sS -o $tmp.FullName -w '%{http_code}' "$BaseUrl$Path"
        $status = [int]$statusText
        $body = if (Test-Path $tmp.FullName) { Get-Content -LiteralPath $tmp.FullName -Raw } else { '' }
        $ok = $AllowedStatus -contains $status
        if ($Contains -and ($body -notlike "*$Contains*")) { $ok = $false }
        $preview = if ($body) { $body.Substring(0, [Math]::Min(120, $body.Length)).Replace("`r", ' ').Replace("`n", ' ') } else { '' }
        Write-Host "$status GET $Path $preview"
        if (-not $ok) { $script:failures += "GET $Path returned $status" }
    } finally {
        Remove-Item -LiteralPath $tmp.FullName -Force -ErrorAction SilentlyContinue
    }
}

function Test-PostJson {
    param([string]$Path, [hashtable]$Payload, [int[]]$AllowedStatus = @(200,201))
    $bodyFile = New-TemporaryFile
    $outFile = New-TemporaryFile
    try {
        $Payload | ConvertTo-Json -Compress | Set-Content -LiteralPath $bodyFile.FullName -Encoding UTF8
        $statusText = & curl.exe --max-time $TimeoutSeconds -sS -o $outFile.FullName -w '%{http_code}' -H 'Content-Type: application/json' --data-binary "@$($bodyFile.FullName)" "$BaseUrl$Path"
        $status = [int]$statusText
        $body = if (Test-Path $outFile.FullName) { Get-Content -LiteralPath $outFile.FullName -Raw } else { '' }
        $preview = if ($body) { $body.Substring(0, [Math]::Min(160, $body.Length)).Replace("`r", ' ').Replace("`n", ' ') } else { '' }
        Write-Host "$status POST $Path $preview"
        if ($AllowedStatus -notcontains $status) { $script:failures += "POST $Path returned $status" }
    } finally {
        Remove-Item -LiteralPath $bodyFile.FullName,$outFile.FullName -Force -ErrorAction SilentlyContinue
    }
}

Test-Get '/api/health' @(200) 'healthy'
Test-Get '/api/public/categories' @(200)
Test-Get '/api/public/products' @(200)
Test-Get '/api/featured-products' @(200)
Test-Get '/' @(200)
Test-Get '/products' @(200)
Test-Get '/login' @(200)
Test-Get '/register' @(200)
Test-Get '/api/profile' @(401,403,307,308)
Test-Get '/api/cart' @(401,403,307,308)
Test-Get '/api/admin/stats' @(401,403,307,308)

if ($TestRegister) {
    $email = 'smoke_' + [Guid]::NewGuid().ToString('N').Substring(0, 8) + '@example.com'
    Test-PostJson '/api/auth/register' @{ name = 'Smoke Test'; email = $email; password = 'SmokeTest123!' } @(200,201)
}

if ($failures.Count -gt 0) {
    Write-Error "Smoke test failed:`n$($failures -join "`n")"
    exit 1
}

Write-Host 'Smoke test passed.'
