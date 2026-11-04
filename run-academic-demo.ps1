param([int]$Port = 8084)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot
$sourcePath = Join-Path $projectRoot 'data/imports/academic-demo/academic-demo'
if (-not (Test-Path -LiteralPath "$sourcePath.mv.db")) { throw 'Chưa có file nguồn học vụ để nạp vào PostgreSQL. Xem docs/academic-data-import.md.' }
$variables = @{
    DB_NAME = 'coursebot_academic_demo'
    ACADEMIC_SOURCE_URL = 'jdbc:h2:file:' + $sourcePath.Replace('\','/')
    ACADEMIC_INITIAL_PASSWORD = 'AcademicDemo2026!'
    APP_BOOTSTRAP_ADMIN_PASSWORD = 'AcademicDemo2026!'
    APP_PREVIEW_ACCOUNTS_ENABLED = 'false'
    TIMETABLE_SOURCE_URL = ''
    TIMETABLE_REGISTRATION_ALWAYS_OPEN = 'false'
    APP_PUBLIC_URL = "http://localhost:$Port"
}
$previous = @{}
foreach ($key in $variables.Keys) {
    $previous[$key] = [Environment]::GetEnvironmentVariable($key,'Process')
    [Environment]::SetEnvironmentVariable($key,$variables[$key],'Process')
}
try { & (Join-Path $projectRoot 'run.ps1') -Port $Port }
finally { foreach ($key in $variables.Keys) { [Environment]::SetEnvironmentVariable($key,$previous[$key],'Process') } }
