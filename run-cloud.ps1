param(
    [int]$Port = 8080,
    [string]$DatabaseUrl = ''
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

function Set-DotEnvDatabaseUrl([string]$Path, [string]$Url) {
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    $cleanLine = "DATABASE_URL=$($Url.Trim())"
    if (Test-Path -LiteralPath $Path) {
        $lines = [System.Collections.Generic.List[string]]::new([string[]][System.IO.File]::ReadAllLines($Path, [System.Text.Encoding]::UTF8))
        $replaced = $false
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match '^\s*DATABASE_URL\s*=') {
                $lines[$i] = $cleanLine
                $replaced = $true
                break
            }
        }
        if (-not $replaced) {
            $lines.Insert(0, $cleanLine)
        }
        [System.IO.File]::WriteAllLines($Path, $lines, $utf8NoBom)
    } else {
        [System.IO.File]::WriteAllText($Path, "$cleanLine`r`n", $utf8NoBom)
    }
}

$dotEnvPath = Join-Path $projectRoot '.env'
if (-not [string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    Set-DotEnvDatabaseUrl -Path $dotEnvPath -Url $DatabaseUrl
    Write-Output "Đã cập nhật DATABASE_URL vào file .env (giữ nguyên các biến AI_* / SMTP_*)"
} elseif ([string]::IsNullOrWhiteSpace($env:DATABASE_URL)) {
    $hasUrl = $false
    if (Test-Path -LiteralPath $dotEnvPath) {
        $hasUrl = [bool](Get-Content -LiteralPath $dotEnvPath -Encoding UTF8 | Where-Object { $_ -match '^\s*DATABASE_URL\s*=\s*\S+' })
    }
    if (-not $hasUrl -and [Environment]::UserInteractive) {
        $inputUrl = Read-Host "Dán đường link PostgreSQL (postgresql://...) bạn được chia sẻ"
        if ([string]::IsNullOrWhiteSpace($inputUrl)) {
            throw "Chưa có đường link DATABASE_URL để kết nối Cloud PostgreSQL."
        }
        Set-DotEnvDatabaseUrl -Path $dotEnvPath -Url $inputUrl
        Write-Output "Đã lưu link vào file .env (lần sau chỉ cần chạy .\run-cloud.ps1)"
    }
}

$savedVars = @{
    ACADEMIC_SOURCE_URL = $env:ACADEMIC_SOURCE_URL
    TIMETABLE_SOURCE_URL = $env:TIMETABLE_SOURCE_URL
    APP_PREVIEW_ACCOUNTS_ENABLED = $env:APP_PREVIEW_ACCOUNTS_ENABLED
    DB_NAME = $env:DB_NAME
    SPRING_DATASOURCE_URL = $env:SPRING_DATASOURCE_URL
}
$env:ACADEMIC_SOURCE_URL = ''
$env:TIMETABLE_SOURCE_URL = ''
$env:APP_PREVIEW_ACCOUNTS_ENABLED = 'false'
Remove-Item Env:DB_NAME -ErrorAction SilentlyContinue
Remove-Item Env:SPRING_DATASOURCE_URL -ErrorAction SilentlyContinue

try {
    & (Join-Path $projectRoot 'run.ps1') -Port $Port
    exit $LASTEXITCODE
} finally {
    foreach ($key in $savedVars.Keys) {
        [Environment]::SetEnvironmentVariable($key, $savedVars[$key], 'Process')
    }
}