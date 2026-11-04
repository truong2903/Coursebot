param([string]$BaseUrl = 'http://localhost:8084', [string]$CsvDirectory = 'E:\CODE\PTvTKHDT\du_lieu_mau_csv')
$ErrorActionPreference = 'Stop'
# Reads business data only. Login creates temporary HTTP sessions.
$checks = 0
function Assert-Check([bool]$Condition,[string]$Message) {
    if (-not $Condition) { throw "FAIL: $Message" }
    $script:checks++
    Write-Output "PASS: $Message"
}
function Login-Academic([string]$Username) {
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $csrf = Invoke-RestMethod "$BaseUrl/api/auth/csrf" -WebSession $session
    $null = Invoke-RestMethod "$BaseUrl/api/auth/login" -Method Post -WebSession $session -ContentType 'application/json' -Headers @{'X-XSRF-TOKEN'=$csrf.token} -Body (@{username=$Username;password='AcademicDemo2026!'} | ConvertTo-Json)
    return $session
}
$students = @(Import-Csv (Join-Path $CsvDirectory '04_sinh_vien.csv'))
$lecturers = @(Import-Csv (Join-Path $CsvDirectory '05_giang_vien.csv'))
$registrations = @(Import-Csv (Join-Path $CsvDirectory '13_dang_ky.csv'))
$studentRow = $students[0]
$student = Login-Academic $studentRow.email
$dashboard = Invoke-RestMethod "$BaseUrl/api/dashboard" -WebSession $student
Assert-Check ($dashboard.student.id -eq $studentRow.ma_sinh_vien) 'Email login resolves to imported student'
Assert-Check ($dashboard.semesterCode -eq '2026-2027-1') 'Imported active semester is selected'
Assert-Check (-not $dashboard.registrationOpen -and -not $dashboard.registrationAlwaysOpen) 'Official imported registration dates are respected'
Assert-Check ($dashboard.courses.Count -eq 52) 'All 52 academic sample sections are available'
Assert-Check (@($dashboard.courses | Where-Object { $_.schedule -like '*Mẫu*' }).Count -eq 52) 'Converted schedules disclose sample time status'
$expected = @($registrations | Where-Object { $_.ma_sinh_vien -eq $studentRow.ma_sinh_vien -and $_.trang_thai_dang_ky -eq 'Đã đăng ký' })
Assert-Check ($dashboard.registered.Count -eq $expected.Count) 'Student timetable includes only active registrations'
$history = Invoke-RestMethod "$BaseUrl/api/enrollments/history" -WebSession $student
Assert-Check ($history.Count -eq @($registrations | Where-Object { $_.ma_sinh_vien -eq $studentRow.ma_sinh_vien }).Count) 'Registration history preserves all source statuses'
Assert-Check (@($history | Where-Object { -not $_.enrollmentDateOnly }).Count -eq 0) 'Date-only source values are not presented as precise times'
$curriculum = Invoke-RestMethod "$BaseUrl/api/student/curriculum" -WebSession $student
Assert-Check ($curriculum.courses.Count -gt 0) 'Student program and cohort resolve to imported curriculum'
$pendingRow = $registrations | Where-Object { $_.trang_thai_dang_ky -eq 'Chờ xác nhận' } | Select-Object -First 1
$pendingStudent = $students | Where-Object { $_.ma_sinh_vien -eq $pendingRow.ma_sinh_vien }
$pendingSession = Login-Academic $pendingStudent.email
$pendingHistory = Invoke-RestMethod "$BaseUrl/api/enrollments/history" -WebSession $pendingSession
Assert-Check (@($pendingHistory | Where-Object { $_.sectionCode -eq $pendingRow.ma_lop_hoc_phan -and $_.status -eq 'PENDING' }).Count -eq 1) 'Pending confirmation is retained and is not converted to waitlist'
$lecturer = Login-Academic $lecturers[0].email
$lecturerDashboard = Invoke-RestMethod "$BaseUrl/api/workspace/lecturer" -WebSession $lecturer
Assert-Check ($null -ne $lecturerDashboard) 'Imported lecturer can open workspace'
Assert-Check ($lecturerDashboard.semesterCode -eq '2026-2027-1' -and $lecturerDashboard.sections.Count -gt 0) 'Lecturer defaults to active teaching term after registration closes'
$training = Login-Academic 'academic_training'
$sections = Invoke-RestMethod "$BaseUrl/api/training/sections" -WebSession $training
Assert-Check ($sections.Count -eq 52) 'Training workspace reads imported classes'
Assert-Check (@($sections | Where-Object { -not $_.lecturerCode }).Count -eq 0) 'All imported teaching assignments are linked'
$semesters = Invoke-RestMethod "$BaseUrl/api/training/semesters" -WebSession $training
Assert-Check ($semesters.Count -eq 6) 'All six academic calendars are retained'
$programs = Invoke-RestMethod "$BaseUrl/api/training/curricula" -WebSession $training
Assert-Check ($programs.Count -eq 18) 'All eighteen curricula are retained'
$report = Invoke-RestMethod "$BaseUrl/api/reports?semester=2026-2027-1" -WebSession $training
Assert-Check (($report | Measure-Object -Property enrolled -Sum).Sum -eq 378) 'Reports count exactly 378 active enrollments without snapshot duplication'
$admin = Login-Academic 'admin'
$accounts = Invoke-RestMethod "$BaseUrl/api/admin/accounts" -WebSession $admin
Assert-Check ($accounts.Count -eq 113) '111 imported user accounts plus admin and training account are present'
Write-Output "Completed $checks checks."
