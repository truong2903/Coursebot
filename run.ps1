param(
    [int]$Port = 8080,
    [string]$DbName = '',
    [string]$DbUser = '',
    [string]$DatabaseUrl = ''
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$savedEnv = @{
    PORT = $env:PORT
    DB_NAME = $env:DB_NAME
    DB_USERNAME = $env:DB_USERNAME
    DB_PASSWORD = $env:DB_PASSWORD
    DATABASE_URL = $env:DATABASE_URL
}

$env:PORT = "$Port"
if (-not [string]::IsNullOrWhiteSpace($DatabaseUrl)) { $env:DATABASE_URL = $DatabaseUrl }
if (-not [string]::IsNullOrWhiteSpace($DbName)) { $env:DB_NAME = $DbName }
if (-not [string]::IsNullOrWhiteSpace($DbUser)) { $env:DB_USERNAME = $DbUser }

$hasDotEnvUrl = $false
$dotEnvFile = Join-Path $projectRoot '.env'
if ([string]::IsNullOrEmpty($env:DB_NAME) -and [string]::IsNullOrEmpty($env:SPRING_DATASOURCE_URL) -and (Test-Path -LiteralPath $dotEnvFile)) {
    $dotEnvMatch = Get-Content -LiteralPath $dotEnvFile -Encoding UTF8 | Where-Object { $_ -match '^\s*DATABASE_URL\s*=\s*\S+' }
    if ($dotEnvMatch) { $hasDotEnvUrl = $true }
}

$usingCloudUrl = (-not [string]::IsNullOrWhiteSpace($env:DATABASE_URL)) -or $hasDotEnvUrl
$effectiveUrl = if ($env:SPRING_DATASOURCE_URL) { $env:SPRING_DATASOURCE_URL } else { "jdbc:postgresql://localhost:5432/$($env:DB_NAME)" }

if (-not $usingCloudUrl -and $effectiveUrl.StartsWith('jdbc:postgresql:') -and [string]::IsNullOrEmpty($env:SPRING_DATASOURCE_PASSWORD) -and [string]::IsNullOrEmpty($env:DB_PASSWORD)) {
    $userDbPwd = [Environment]::GetEnvironmentVariable('DB_PASSWORD', 'User')
    if (-not [string]::IsNullOrEmpty($userDbPwd)) {
        $env:DB_PASSWORD = $userDbPwd
    } elseif (-not [string]::IsNullOrEmpty($env:PGPASSWORD)) {
        $env:DB_PASSWORD = $env:PGPASSWORD
    } elseif ([Environment]::UserInteractive) {
        $userLabel = if ($env:SPRING_DATASOURCE_USERNAME) { $env:SPRING_DATASOURCE_USERNAME } elseif ($env:DB_USERNAME) { $env:DB_USERNAME } else { 'postgres' }
        $securePwd = Read-Host "Nhập mật khẩu PostgreSQL local cho user '$userLabel'" -AsSecureString
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd)
        try {
            $env:DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        } finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
    }
}

try {
    & .\mvnw.cmd spring-boot:run
    $result = $LASTEXITCODE
} finally {
    foreach ($key in $savedEnv.Keys) {
        [Environment]::SetEnvironmentVariable($key, $savedEnv[$key], 'Process')
    }
}
exit $result
