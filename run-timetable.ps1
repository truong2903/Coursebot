param([int]$Port = 8082, [switch]$PreviewAccounts)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot
$sourcePath = Join-Path $projectRoot 'data/imports/tkb20261/timetable-20261'
if (-not (Test-Path -LiteralPath "$sourcePath.mv.db")) { throw 'Chưa có file thời khóa biểu nguồn để nạp vào PostgreSQL. Xem docs/timetable-import.md.' }
# A separate PostgreSQL database per mode keeps preview and main application data isolated.
$variables = @{
    DB_NAME = 'coursebot_timetable'
    TIMETABLE_SOURCE_URL = 'jdbc:h2:file:' + $sourcePath.Replace('\','/')
    TIMETABLE_REGISTRATION_ALWAYS_OPEN = 'true'
    ACADEMIC_SOURCE_URL = ''
    APP_PREVIEW_ACCOUNTS_ENABLED = 'false'
}
if ($PreviewAccounts) {
    $variables.DB_NAME = 'coursebot_timetable_preview'
    $variables.APP_PREVIEW_ACCOUNTS_ENABLED = 'true'
    $variables.APP_BOOTSTRAP_ADMIN_PASSWORD = 'PreviewAdmin2026!'
}
$previous = @{}
foreach ($key in $variables.Keys) {
    $previous[$key] = [Environment]::GetEnvironmentVariable($key,'Process')
    [Environment]::SetEnvironmentVariable($key,$variables[$key],'Process')
}
try { & (Join-Path $projectRoot 'run.ps1') -Port $Port }
finally { foreach ($key in $variables.Keys) { [Environment]::SetEnvironmentVariable($key,$previous[$key],'Process') } }
