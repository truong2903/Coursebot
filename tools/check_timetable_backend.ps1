param([string]$BaseUrl = 'http://localhost:8083')
$ErrorActionPreference = 'Stop'
# This script creates fixtures. Run only against the dedicated in-memory check server.
$checks = 0
function Assert-Check([bool]$Condition,[string]$Message) {
    if (-not $Condition) { throw "FAIL: $Message" }
    $script:checks++
    Write-Output "PASS: $Message"
}
function Login-Preview([string]$Username,[string]$Password) {
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $csrf = Invoke-RestMethod "$BaseUrl/api/auth/csrf" -WebSession $session
    $null = Invoke-RestMethod "$BaseUrl/api/auth/login" -Method Post -WebSession $session -ContentType 'application/json' -Headers @{'X-XSRF-TOKEN'=$csrf.token} -Body (@{username=$Username;password=$Password}|ConvertTo-Json)
    return $session
}
function Write-Api($Session,[string]$Path,$Body,[string]$Method='Post') {
    $csrf=Invoke-RestMethod "$BaseUrl/api/auth/csrf" -WebSession $Session
    Invoke-RestMethod "$BaseUrl$Path" -Method $Method -WebSession $Session -ContentType 'application/json' -Headers @{'X-XSRF-TOKEN'=$csrf.token} -Body (ConvertTo-Json -InputObject $Body -Depth 12)
}
function Assert-ApiError($Session,[string]$Path,$Body,[int]$Status,[string]$Text='',[string]$Method='Post') {
    try { $null=Write-Api $Session $Path $Body $Method; throw 'Request unexpectedly succeeded' }
    catch {
        $failure=$_
        Assert-Check ($failure.Exception.Response.StatusCode.value__ -eq $Status) "$Path rejects with HTTP $Status"
        if ($Text) { Assert-Check (($failure.ErrorDetails.Message|ConvertFrom-Json).message -like "*$Text*") "$Path returns the expected business message" }
    }
}
function Meeting([int]$Day,[string]$Weeks,[string]$Room='CHECK-A') {
    @{dayOfWeek=$Day;startsAt='09:00';endsAt='11:00';room=$Room;weeksExpression=$Weeks}
}
$student=Login-Preview 'preview_student' 'SVPreview2026!'
$training=Login-Preview 'preview_training' 'TrainingPreview2026!'
$lecturer=Login-Preview 'preview_lecturer' 'GVPreview2026!'
$timer=[System.Diagnostics.Stopwatch]::StartNew()
$dashboard=Invoke-RestMethod "$BaseUrl/api/dashboard" -WebSession $student
$timer.Stop()
Assert-Check ($dashboard.semesterCode -eq '20261' -and $dashboard.registrationAlwaysOpen -and $dashboard.registrationOpen) 'Imported semester is selected and registration is open without a deadline'
Assert-Check ($null -eq $dashboard.semesterStartsAt) 'Missing official semester start remains null'
Assert-Check ($dashboard.courses.Count -eq 9938) 'All 9,938 open source classes are returned'
Assert-Check (@($dashboard.courses|Where-Object {$_.meetings.Count -gt 1}).Count -gt 0) 'Student API returns multiple meetings per class'
Assert-Check (@($dashboard.courses|Where-Object {$_.scheduleReviewRequired}).Count -gt 0) 'Incomplete source schedules are marked for review'
Assert-Check ($dashboard.courses[0].instructor -eq 'Chưa phân công') 'Unassigned lecturers do not produce an API error'
Write-Output "Dashboard duration: $($timer.ElapsedMilliseconds) ms"
$sections=Invoke-RestMethod "$BaseUrl/api/training/sections" -WebSession $training
Assert-Check ($sections.Count -eq 11011) 'Training API returns all 11,011 classes including cancelled ones'
$null=Invoke-RestMethod "$BaseUrl/api/workspace/lecturer" -WebSession $lecturer
Assert-Check $true 'Lecturer workspace handles unassigned imported classes'
foreach ($code in @('CHECK101','CHECK102','CHECK103')) {
    $null=Write-Api $training '/api/training/courses' @{code=$code;name="Môn kiểm tra $code";department='CHECK';credits=3;active=$true}
}
$classA=Write-Api $training '/api/training/sections' @{id='CHECK-A';sectionCode='CHECK-A';courseCode='CHECK101';semesterCode='20261';capacity=20;status='OPEN';meetings=@((Meeting 1 '2'),(Meeting 3 '4'))}
Assert-Check ($classA.meetings.Count -eq 2) 'Training can create a class with two meetings and no lecturer'
$classB=Write-Api $training '/api/training/sections' @{id='CHECK-B';sectionCode='CHECK-B';courseCode='CHECK102';semesterCode='20261';capacity=20;status='OPEN';meetings=@((Meeting 2 '2' 'CHECK-B'),(Meeting 3 '4' 'CHECK-B'))}
$classC=Write-Api $training '/api/training/sections' @{id='CHECK-C';sectionCode='CHECK-C';courseCode='CHECK103';semesterCode='20261';capacity=20;status='OPEN';meetings=@((Meeting 1 '3' 'CHECK-C'))}
$null=Write-Api $student '/api/enroll' @{courseId='CHECK-A'}
Assert-ApiError $student '/api/enroll' @{courseId='CHECK-B'} 409 'trùng'
$null=Write-Api $student '/api/enroll' @{courseId='CHECK-C'}
Assert-Check $true 'Same time on disjoint weeks can be registered'
Assert-ApiError $training '/api/training/sections' @{id='CHECK-D';sectionCode='CHECK-D';courseCode='CHECK101';semesterCode='20261';capacity=20;status='OPEN';meetings=@((Meeting 1 '2'))} 400 'Phòng'
$schedule=Invoke-RestMethod "$BaseUrl/api/student/schedule?semester=20261" -WebSession $student
Assert-Check ($schedule.courses.Count -eq 2 -and ($schedule.courses|Where-Object {$_.id -eq 'CHECK-A'}).meetings.Count -eq 2) 'Student schedule retains all registered meetings'
$null=Write-Api $student '/api/drop' @{courseId='CHECK-A'}
Assert-Check $true 'Manual open mode allows cancellation before official dates are supplied'
$semester=(Invoke-RestMethod "$BaseUrl/api/training/semesters" -WebSession $training)|Where-Object {$_.code -eq '20261'}
$settings=@{code='20261';name='Học kỳ 20261';status='ACTIVE';registrationAlwaysOpen=$false}
$null=Write-Api $training "/api/training/semesters/$($semester.id)" $settings 'Put'
Assert-ApiError $student '/api/enroll' @{courseId='CHECK-B'} 409 'không mở'
$settings.registrationAlwaysOpen=$true
$null=Write-Api $training "/api/training/semesters/$($semester.id)" $settings 'Put'
$badDates=@{code='20261';name='Học kỳ 20261';status='ACTIVE';registrationAlwaysOpen=$true;startsAt='2026-12-01';endsAt='2026-11-01'}
Assert-ApiError $training "/api/training/semesters/$($semester.id)" $badDates 400 'bắt đầu' 'Put'
$cancelled=$sections|Where-Object {$_.status -eq 'CANCELLED'}|Select-Object -First 1
Assert-ApiError $student '/api/enroll' @{courseId=$cancelled.id} 409 'không mở'
$unreviewed=$dashboard.courses|Where-Object {$_.scheduleReviewRequired}|Select-Object -First 1
Assert-ApiError $student '/api/enroll' @{courseId=$unreviewed.id} 409 'xác định'
$full=$dashboard.courses|Where-Object {-not $_.scheduleReviewRequired -and $_.enrolled -ge $_.capacity}|Select-Object -First 1
$wait=Write-Api $student '/api/enroll' @{courseId=$full.id}
Assert-Check ($wait.message -like '*danh sách chờ*') 'School enrollment baseline is included in the capacity limit'
$null=Write-Api $student '/api/waitlist/leave' @{courseId=$full.id}
Write-Output "Completed $checks checks."
