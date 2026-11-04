param(
    [string]$DbName = 'coursebot_academic_demo',
    [string]$DbHost = 'localhost',
    [int]$DbPort = 5432,
    [string]$DbUser = 'postgres',
    [string]$OutputFile = ''
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot

function Find-PgTool([string]$ToolName) {
    $cmd = Get-Command $ToolName -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $found = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$ToolName.exe" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
    if ($found) { return $found.FullName }
    throw "Không tìm thấy $ToolName.exe. Hãy kiểm tra cài đặt PostgreSQL trên máy."
}

$pgDump = Find-PgTool 'pg_dump'
if ([string]::IsNullOrWhiteSpace($OutputFile)) {
    $exportDir = Join-Path $projectRoot 'data\exports'
    New-Item -ItemType Directory -Force -Path $exportDir | Out-Null
    $OutputFile = Join-Path $exportDir "$DbName.sql"
}

$savedPgPwd = $env:PGPASSWORD
try {
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

    & $pgDump -h $DbHost -p $DbPort -U $DbUser -d $DbName `
        --encoding=UTF8 --clean --if-exists --no-owner --no-privileges `
        -f $OutputFile
    if ($LASTEXITCODE -ne 0) { throw "Xuất database '$DbName' thất bại (mã lỗi $LASTEXITCODE)." }
    Write-Output "Đã xuất thành công database '$DbName' ra file: $OutputFile"
} finally {
    $env:PGPASSWORD = $savedPgPwd
}
