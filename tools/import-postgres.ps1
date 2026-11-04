param(
    [Parameter(Mandatory = $true)][string]$SqlFile,
    [string]$DbName = 'coursebot_academic_demo',
    [string]$DbHost = 'localhost',
    [int]$DbPort = 5432,
    [string]$DbUser = 'postgres'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot

if (-not (Test-Path -LiteralPath $SqlFile)) {
    throw "Không tìm thấy file SQL: $SqlFile"
}
if ($DbName -notmatch '^[A-Za-z0-9_]+$') {
    throw "Tên database không hợp lệ: $DbName"
}

function Find-PgTool([string]$ToolName) {
    $cmd = Get-Command $ToolName -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $found = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$ToolName.exe" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
    if ($found) { return $found.FullName }
    throw "Không tìm thấy $ToolName.exe. Hãy kiểm tra cài đặt PostgreSQL trên máy."
}

$psql = Find-PgTool 'psql'
$savedPgPwd = $env:PGPASSWORD
$savedClientEnc = $env:PGCLIENTENCODING
try {
    $env:PGCLIENTENCODING = 'UTF8'
    $userDbPwd = [Environment]::GetEnvironmentVariable('DB_PASSWORD', 'User')
    if (-not [string]::IsNullOrEmpty($env:DB_PASSWORD)) {
        $env:PGPASSWORD = $env:DB_PASSWORD
    } elseif (-not [string]::IsNullOrEmpty($userDbPwd)) {
        $env:PGPASSWORD = $userDbPwd
    } elseif ([string]::IsNullOrEmpty($env:PGPASSWORD) -and [Environment]::UserInteractive) {
        $securePwd = Read-Host "Nhập mật khẩu PostgreSQL cho user '$DbUser'" -AsSecureString
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePwd)
        try { $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
        finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    }

    $exists = (& $psql -h $DbHost -p $DbPort -U $DbUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DbName'").Trim()
    if ($LASTEXITCODE -ne 0) { throw "Không thể kết nối tới PostgreSQL tại ${DbHost}:${DbPort}." }
    if ($exists -ne '1') {
        & $psql -h $DbHost -p $DbPort -U $DbUser -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE `"$DbName`" ENCODING 'UTF8';"
        if ($LASTEXITCODE -ne 0) { throw "Không thể tạo database '$DbName'." }
        Write-Output "Đã tạo database mới: $DbName"
    }

    & $psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -v ON_ERROR_STOP=1 -f $SqlFile
    if ($LASTEXITCODE -ne 0) { throw "Nạp file SQL vào '$DbName' thất bại." }
    Write-Output "Đã nạp thành công dữ liệu từ '$SqlFile' vào database '$DbName'."
} finally {
    $env:PGPASSWORD = $savedPgPwd
    $env:PGCLIENTENCODING = $savedClientEnc
}
