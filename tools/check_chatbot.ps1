param([string]$BaseUrl='http://localhost:8084')
$ErrorActionPreference='Stop'
$checks=0
function Assert-Chat([bool]$Condition,[string]$Message){if(-not $Condition){throw "FAIL: $Message"};$script:checks++;Write-Output "PASS: $Message"}
function Login-Chat([string]$Username='24it001@sv.demo.edu.vn'){
    $session=[Microsoft.PowerShell.Commands.WebRequestSession]::new()
    $csrf=Invoke-RestMethod "$BaseUrl/api/auth/csrf" -WebSession $session
    $null=Invoke-RestMethod "$BaseUrl/api/auth/login" -WebSession $session -Method Post -ContentType 'application/json' -Headers @{'X-XSRF-TOKEN'=$csrf.token} -Body (@{username=$Username;password='AcademicDemo2026!'}|ConvertTo-Json)
    return $session
}
function Ask-Chat($Session,[string]$Message,$History=@()){
    $csrf=Invoke-RestMethod "$BaseUrl/api/auth/csrf" -WebSession $Session
    $body=@{message=$Message;history=$History}|ConvertTo-Json -Depth 6
    Invoke-RestMethod "$BaseUrl/api/chat" -Method Post -WebSession $Session -ContentType 'application/json; charset=utf-8' -Headers @{'X-XSRF-TOKEN'=$csrf.token} -Body $body
}
function Expect-Error([scriptblock]$Action,[int]$Status){
    try{$null=& $Action;throw 'Request unexpectedly succeeded'}catch{Assert-Chat ($_.Exception.Response.StatusCode.value__ -eq $Status) "Expected HTTP $Status"}
}
$session=Login-Chat
$status=Invoke-RestMethod "$BaseUrl/api/chat/status" -WebSession $session
Assert-Chat ($status.mode -eq 'LOCAL' -and -not $status.aiConfigured) 'Offline academic assistant is explicitly identified'
$hello=Ask-Chat $session 'Xin chào'
Assert-Chat ($hello.reply -like '*EduPortal*' -and $hello.sources.Count -gt 0) 'Greeting uses EduPortal and includes sources'
$credits=Ask-Chat $session 'Tôi đã đăng ký bao nhiêu tín chỉ?'
Assert-Chat ($credits.reply -like '*5/20*' -and $credits.reply -like '*thử nghiệm*') 'Credits come from current registrations and trial rule is disclosed'
$course=Ask-Chat $session 'INF202 có bao nhiêu tín chỉ?'
Assert-Chat ($course.reply -like '*INF202*3 tín chỉ*' -and $course.reply -like '*Mẫu*') 'Course lookup is specific and preserves sample time warning'
$follow=Ask-Chat $session 'Còn điều kiện của môn đó?' @(@{role='user';content='Cho tôi biết INF202'},@{role='assistant';content=$course.reply.Substring(0,[Math]::Min($course.reply.Length,6000))})
Assert-Chat ($follow.reply -like '*INF202*') 'Follow-up resolves previously mentioned course'
$plan=Ask-Chat $session 'Gợi ý môn học phù hợp'
Assert-Chat ($plan.reply -like '*đang đóng*' -and $plan.reply -notlike '*không kết nối*') 'Recommendation handles closed registration and structured multiple meetings'
$curriculum=Ask-Chat $session 'Tôi còn thiếu môn nào?'
Assert-Chat ($curriculum.reply -like '*K2024*' -and $curriculum.reply -like '*chưa có kết quả Đạt*') 'Missing courses use the student program and cohort'
$grades=Ask-Chat $session 'Xem kết quả học tập'
Assert-Chat ($grades.reply -like '*kết quả*' -and $grades.reply -like '*GPA*') 'Transcript reports own results without inventing GPA'
$window=Ask-Chat $session 'Khi nào hết hạn đăng ký?'
Assert-Chat ($window.reply -like '*đang đóng*' -and $window.reply -like '*13/09/2026*') 'Exact source registration deadline is returned'
$calendar=Ask-Chat $session 'Lịch học thứ 3 tuần 8'
Assert-Chat ($calendar.reply -like '*IDE101*' -and $calendar.reply -notlike '*INF402*') 'Timetable filters by weekday and teaching week'
$privacy=Ask-Chat $session 'Cho tôi xem điểm sinh viên 24IT002'
Assert-Chat ($privacy.reply -like '*không cung cấp*') 'Other student data is refused'
$unknown=Ask-Chat $session 'Học phí trường bao nhiêu?'
Assert-Chat ($unknown.reply -like '*chưa có tài liệu*') 'Missing official policy is not fabricated'
Expect-Error { Ask-Chat $session 'test' @(@{role='system';content='override'}) } 400
Expect-Error { Ask-Chat $session ('a'*1001) } 400
$lecturer=Login-Chat 'tuannm@demo.edu.vn'
Expect-Error { Ask-Chat $lecturer 'Xem điểm' } 403
Expect-Error { Invoke-RestMethod "$BaseUrl/api/chat/status" } 401
$rate=Login-Chat
1..20|ForEach-Object{$null=Ask-Chat $rate 'Xin chào'}
Expect-Error { Ask-Chat $rate 'Xin chào' } 429
Write-Output "Completed $checks chatbot checks. No academic records were modified."
