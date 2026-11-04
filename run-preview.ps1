param([int]$Port = 8081)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $projectRoot

$previewVariables = @{
    DB_NAME = 'coursebot_preview'
    APP_PREVIEW_ACCOUNTS_ENABLED = 'true'
    APP_BOOTSTRAP_ADMIN_USERNAME = 'admin'
    APP_BOOTSTRAP_ADMIN_PASSWORD = 'PreviewAdmin2026!'
    ACADEMIC_SOURCE_URL = ''
    TIMETABLE_SOURCE_URL = ''
}
$previousValues = @{}
foreach ($name in $previewVariables.Keys) {
    $previousValues[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    [Environment]::SetEnvironmentVariable($name, $previewVariables[$name], 'Process')
}

try {
    & (Join-Path $projectRoot 'run.ps1') -Port $Port
    exit $LASTEXITCODE
} finally {
    foreach ($name in $previewVariables.Keys) {
        [Environment]::SetEnvironmentVariable($name, $previousValues[$name], 'Process')
    }
}
