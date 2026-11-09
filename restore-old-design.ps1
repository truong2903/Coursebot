# Script khoi phuc giao dien ve nguyen trang cu
$sourceDir = "E:\ALL_Du_An\PTvTKHDT\Code Project\ui_backups\original_design"
$targetDir = "E:\ALL_Du_An\PTvTKHDT\Code Project\src\main\resources\static"

if (Test-Path $sourceDir) {
    Copy-Item -Path "$sourceDir\*" -Destination $targetDir -Recurse -Force
    Write-Host "[THANH CONG] Da khoi phuc toan bo giao dien ve nguyen trang truoc khi doi sang Bento Grid!" -ForegroundColor Green
} else {
    Write-Host "[LOI] Khong tim thay thu muc backup tai: $sourceDir" -ForegroundColor Red
}
