import { apiGet, apiPost } from '../../core/api.js';

const state = { courses: [], registered: [], credits: 0, maxCredits: 20, filter: 'all', query: '', department: '', weekday: '', creditsFilter: '', sort: 'code' };
const chatHistory = [];
let chatBusy = false;
const $ = (selector) => document.querySelector(selector);
const list = $('#courseList');
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const monogram = (name) => name.split(/\s+/).slice(-2).map(part => part[0]).join('').toUpperCase();
const formatDate = value => value ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : 'Chưa thiết lập';
const weekdays = ['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7','Chủ nhật'];
function courseSessions(course){
  if(!course.meetings?.length)return [course];
  return course.meetings.map(meeting=>({...course,
    schedule:`${weekdays[meeting.dayOfWeek-1]||'Chưa xếp lịch'} · ${meeting.startsAt&&meeting.endsAt?`${meeting.startsAt.slice(0,5)} – ${meeting.endsAt.slice(0,5)}`:'Giờ học cần xác nhận'}${meeting.weeksExpression?` · Tuần ${meeting.weeksExpression}`:''}`,
    room:meeting.room||'Chưa có phòng',meetingDay:meeting.dayOfWeek,meetingValid:meeting.valid}));
}

async function loadDashboard() {
  const currentAccount = await apiGet('/api/auth/me');
  if (currentAccount.role !== 'STUDENT') {
    location.replace('/workspace.html');
    return;
  }
  Object.assign(state, await apiGet('/api/dashboard'));
  $('#copyrightYear').textContent=new Date().getFullYear();
  const initials = monogram(state.student.name);
  $('#sidebarName').textContent = state.student.name;
  $('#topName').textContent = state.student.name;
  $('#sidebarAvatar').textContent = initials;
  $('#topAvatar').textContent = initials;
  $('#welcomeName').textContent = state.student.name.split(' ').at(-1);
  $('#sidebarId').textContent = state.student.id;
  $('#semesterName').textContent = state.semesterName;
  $('#registeredSemester').textContent = state.semesterName;
  if($('#chatGreeting'))$('#chatGreeting').textContent = `Xin chào ${state.student.name.split(' ').at(-1)}! Mình có thể giúp bạn tra cứu học phần, lịch học và điều kiện đăng ký.`;
  $('#registrationStatus').innerHTML = `<span class="status-pulse"></span> ${state.registrationOpen ? 'CỔNG ĐĂNG KÝ ĐANG MỞ' : 'CỔNG ĐĂNG KÝ ĐANG ĐÓNG'}`;
  $('#registrationStatusCard').textContent = state.registrationOpen ? '● ĐANG MỞ' : '● ĐANG ĐÓNG';
  $('#registrationStatusCard').classList.toggle('good', state.registrationOpen);
  $('#registrationDeadline').textContent = state.registrationAlwaysOpen?'Đến khi có thông báo':formatDate(state.registrationCloseAt);
  $('#registrationDates').textContent = state.registrationAlwaysOpen?'Mở đăng ký liên tục (tạm thời)':`${formatDate(state.registrationOpenAt)} – ${formatDate(state.registrationCloseAt)}`;
  const openBadge=document.querySelector('.open-badge');openBadge.innerHTML=`<i></i> ${state.registrationOpen?'ĐANG MỞ':'ĐANG ĐÓNG'}`;openBadge.classList.toggle('closed',!state.registrationOpen);
  document.querySelector('.semester-picker strong').textContent = state.semesterName;
  document.querySelector('.registered-heading p').textContent = state.semesterName;
  $('#creditValue').textContent = state.credits;
  $('#creditLimitLabel').textContent = ` / ${state.maxCredits} tín chỉ`;
  $('#dropPolicy').textContent=state.registrationAlwaysOpen&&!state.semesterStartsAt?'Đang mở đăng ký và hủy lớp tạm thời. Thời hạn chính thức sẽ được cập nhật khi có ngày bắt đầu học kỳ.':`Bạn có thể tự hủy trong ${state.dropWindowDays} ngày đầu học kỳ. Sau thời hạn này, hãy liên hệ Ban Đào tạo.`;
  $('#creditProgress').style.width = `${Math.min(100, state.credits / state.maxCredits * 100)}%`;
  $('#courseCount').textContent = `${state.registered.length} học phần đã đăng ký`;
  $('#registeredCount').textContent = String(state.registered.length).padStart(2, '0');
  const weekdays = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
  const activeDays = new Set(state.registered.flatMap(courseSessions).map(course=>course.schedule.split(' · ')[0]).filter(day=>weekdays.includes(day)));
  $('#weekdayCount').textContent = activeDays.size;
  $('#weekdayDots').setAttribute('aria-label', activeDays.size ? `Lịch học ${[...activeDays].join(', ')}` : 'Chưa có ngày học');
  $('#weekdayDots').innerHTML = weekdays.map((day, index) => `<span class="${activeDays.has(day) ? 'on' : ''}">${['T2','T3','T4','T5','T6','T7','CN'][index]}</span>`).join('');
  const departments = [...new Set(state.courses.map(course => course.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  const departmentFilter = $('#departmentFilter');
  const selectedDepartment = state.department;
  departmentFilter.innerHTML = '<option value="">Tất cả khoa</option>' + departments.map(department => `<option value="${escapeHtml(department)}">${escapeHtml(department)}</option>`).join('');
  departmentFilter.value = selectedDepartment;
  const creditOptions=[...new Set(state.courses.map(course=>course.credits))].sort((a,b)=>a-b);
  $('#creditFilter').innerHTML='<option value="">Tất cả</option>'+creditOptions.map(credits=>`<option value="${credits}">${credits} tín chỉ</option>`).join('');
  $('#creditFilter').value=state.creditsFilter;
  renderCourses();
  renderRegistered();
}

function renderCourses() {
  const today=new Date();today.setHours(0,0,0,0);
  const registrationNotStarted=Boolean(!state.registrationAlwaysOpen&&state.registrationOpenAt&&new Date(`${state.registrationOpenAt}T00:00:00`)>today);
  const filtered = state.courses.filter(course => {
    const matchesQuery = `${course.code} ${course.name} ${course.department} ${course.instructor} ${course.schedule}`.toLocaleLowerCase('vi').includes(state.query.toLocaleLowerCase('vi'));
    const matchesFilter = state.filter === 'all' || (state.filter === 'available' && course.enrolled < course.capacity) || (state.filter === 'full' && course.enrolled >= course.capacity) || (state.filter === 'registered' && course.registered);
    const matchesDepartment = !state.department || course.department === state.department;
    const matchesWeekday = !state.weekday || courseSessions(course).some(session=>session.schedule.startsWith(state.weekday));
    const matchesCredits = !state.creditsFilter || String(course.credits) === state.creditsFilter;
    return matchesQuery && matchesFilter && matchesDepartment && matchesWeekday && matchesCredits;
  }).sort((a, b) => {
    if (state.sort === 'name') return a.name.localeCompare(b.name, 'vi');
    if (state.sort === 'credits') return a.credits - b.credits || a.code.localeCompare(b.code);
    if (state.sort === 'seats') return (a.capacity - a.enrolled) - (b.capacity - b.enrolled);
    return a.code.localeCompare(b.code, 'vi');
  });
  $('#visibleCount').textContent = filtered.length;
  $('#emptyState').classList.toggle('hidden', filtered.length > 0);
  list.classList.toggle('hidden', filtered.length === 0);
  const pages=Math.max(1,Math.ceil(filtered.length/50));state.page=Math.min(state.page||1,pages);
  let pager=$('#coursePager');if(!pager){pager=document.createElement('nav');pager.id='coursePager';pager.setAttribute('aria-label','Phân trang lớp học phần');list.insertAdjacentElement('afterend',pager);}
  pager.innerHTML=filtered.length>50?`<button type="button" class="details-button" data-page-step="-1" ${state.page===1?'disabled':''}>Trang trước</button><span> Trang ${state.page} / ${pages} · ${filtered.length} lớp </span><button type="button" class="details-button" data-page-step="1" ${state.page===pages?'disabled':''}>Trang sau</button>`:'';
  pager.querySelectorAll('[data-page-step]').forEach(button=>button.addEventListener('click',()=>{state.page+=Number(button.dataset.pageStep);renderCourses();list.scrollIntoView({block:'start'});}));
  list.innerHTML = filtered.slice((state.page-1)*50,state.page*50).map(course => {
    const available = course.capacity - course.enrolled;
    const isFull = available <= 0;
    const action = course.registered
      ? `<button class="cancel-button" data-action="drop" data-id="${escapeHtml(course.id)}">Hủy lớp</button>`
      : course.waitlisted
        ? `<button class="cancel-button" data-action="waitlist/leave" data-id="${escapeHtml(course.id)}">Rời danh sách chờ #${course.waitlistPosition}</button>`
      : !state.registrationOpen
        ? `<button class="register-button" disabled>${registrationNotStarted?'Chưa đến đợt đăng ký':'Đã hết đợt đăng ký'}</button>`
        : course.scheduleReviewRequired
          ? '<button class="register-button" disabled>Chờ xác nhận lịch / sĩ số</button>'
        : `<button class="register-button" data-action="enroll" data-id="${escapeHtml(course.id)}" ${!course.prerequisiteMet ? 'disabled' : ''} ${!course.prerequisiteMet && course.unmetConditionMessage ? `title="${escapeHtml(course.unmetConditionMessage)}"` : ''}>${!course.prerequisiteMet ? escapeHtml(course.conditionBlockReason || 'Thiếu điều kiện') : isFull ? 'Vào danh sách chờ' : 'Đăng ký lớp'} <span>${course.prerequisiteMet ? '↗' : ''}</span></button>`;
    const conditionText = /^(Tiên quyết|Học trước|Song hành):/i.test(course.prerequisite || '')
      ? escapeHtml(course.prerequisite)
      : `Điều kiện: ${escapeHtml(course.prerequisite)}`;
    return `<article class="course-card">
      <div class="course-symbol ${escapeHtml(course.color)}">${escapeHtml(monogram(course.code))}</div>
      <div class="course-main"><div class="course-heading"><h3>${escapeHtml(course.name)}</h3><span class="course-code">${escapeHtml(course.code)}</span></div>
        <div class="course-meta"><span><b>◷</b> ${escapeHtml(course.schedule)}</span><span><b>♧</b> ${escapeHtml(course.instructor)}</span><span><b>⌖</b> ${escapeHtml(course.room)}</span></div>
        <div class="course-bottom"><span class="credit-pill">${course.credits} tín chỉ</span><span class="prereq-pill">${conditionText}</span><span class="seat-pill ${isFull ? 'full' : ''}">${isFull ? 'Đã đủ chỗ' : `Còn ${available} chỗ`}</span>${course.registered ? '<span class="registered-pill">✓ Đã đăng ký</span>' : course.waitlisted ? '<span class="registered-pill">◷ Đang trong danh sách chờ</span>' : ''}</div>
      </div><div class="course-action"><button class="details-button" type="button" data-details="${escapeHtml(course.id)}">Chi tiết</button>${action}</div>
    </article>`;
  }).join('');
}

function renderRegistered() {
  const container = $('#registeredList');
  container.innerHTML = state.registered.length ? state.registered.map(course => `<div class="registered-item"><span class="registered-stripe ${escapeHtml(course.color)}"></span><div><strong>${escapeHtml(course.code)} · ${escapeHtml(course.name)}</strong><small>${escapeHtml(course.schedule)} · ${course.credits} tín chỉ</small></div><button class="remove-course" data-action="drop" data-id="${escapeHtml(course.id)}" title="Hủy học phần" aria-label="Hủy ${escapeHtml(course.code)}">×</button></div>`).join('') : '<div class="dialog-empty">Bạn chưa đăng ký học phần nào.</div>';
}

async function changeEnrollment(action, courseId) {
  if (action === 'drop' && !window.confirm('Bạn có chắc muốn hủy đăng ký lớp học phần này?')) return;
  try {
    const result = await apiPost(`/api/${action}`, { courseId });
    showToast(result.message || 'Đã cập nhật đăng ký.');
    if (result.success) await loadDashboard();
  } catch(error) { showToast(error.message||'Không kết nối được máy chủ. Vui lòng thử lại.'); }
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function appendMessage(text, sender, metadata = null) {
  const body = $('#chatBody');
  const row = document.createElement('div');
  if (sender === 'user') {
    row.className = 'user-message-row';
    row.innerHTML = `<div class="user-message">${escapeHtml(text)}</div>`;
  } else {
    row.className = 'bot-message-row';
    const sources=metadata?.sources?.length?`<div class="chat-sources"><span>Dữ liệu tham chiếu</span>${metadata.sources.map(source=>`<small>${escapeHtml(source)}</small>`).join('')}</div>`:'';
    row.innerHTML = `<span class="mini-bot">✳</span><div class="message-stack"><div class="bot-message">${escapeHtml(text)}</div>${sources}<small>EduPortal · vừa xong</small></div>`;
  }
  body.append(row);
  body.scrollTop = body.scrollHeight;
}

async function sendChat(message) {
  const clean = message.trim();
  if (!clean || chatBusy) return;
  if(clean.length>1000){showToast('Câu hỏi tối đa 1.000 ký tự.');return;}
  chatBusy=true;
  $('#chatForm').setAttribute('aria-busy','true');
  $('#chatForm button').disabled=true;
  $('#clearChat').disabled=true;
  appendMessage(clean, 'user');
  const typing = document.createElement('div');
  typing.className = 'typing';
  typing.textContent = 'EduPortal đang soạn câu trả lời…';
  $('#chatBody').append(typing);
  $('#chatBody').scrollTop = $('#chatBody').scrollHeight;
  try {
    const result = await apiPost('/api/chat', { message: clean, history: chatHistory.slice(-12) });
    typing.remove();
    const reply=result.reply || 'Mình chưa có câu trả lời cho câu hỏi này.';
    chatHistory.push({role:'user',content:clean},{role:'assistant',content:reply.slice(0,6000)});
    if(chatHistory.length>12)chatHistory.splice(0,chatHistory.length-12);
    $('#assistantMode').innerHTML=`<i></i> ${result.aiPowered?'AI trực tuyến + dữ liệu học vụ':result.mode==='FALLBACK'?'Đang tra cứu tại hệ thống':'Tra cứu học vụ tại hệ thống'}`;
    appendMessage(reply, 'bot',result);
    if(result.suggestions?.length)$('#assistant .suggestions').innerHTML=result.suggestions.map(question=>`<button type="button" data-question="${escapeHtml(question)}">${escapeHtml(question)}</button>`).join('');
  } catch (error) {
    typing.remove();
    appendMessage(error.message || 'Chưa nhận được câu trả lời. Bạn thử lại nhé.', 'bot');
  } finally {
    chatBusy=false;$('#chatForm').removeAttribute('aria-busy');$('#chatForm button').disabled=false;$('#clearChat').disabled=false;
  }
}
async function loadChatStatus(){
  try{const status=await apiGet('/api/chat/status');$('#assistantMode').innerHTML=`<i></i> ${status.aiConfigured?'AI trực tuyến + dữ liệu học vụ':'Tra cứu học vụ tại hệ thống'}`;$('#chatStatusNote').textContent=status.message;}
  catch{$('#chatStatusNote').textContent='Trợ lý tra cứu học vụ. Bạn có thể gửi câu hỏi để kiểm tra kết nối.';}
}

const formatDateTime = value => value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—';

async function showCourseDetails(sectionId) {
  const dialog = $('#courseDialog');
  const body = $('#courseDialogBody');
  $('#courseDialogTitle').textContent = 'Đang tải thông tin…';
  body.innerHTML = '<div class="dialog-empty">Đang lấy dữ liệu lớp học phần.</div>';
  dialog.showModal();
  try {
    const course = await apiGet(`/api/courses/${encodeURIComponent(sectionId)}`);
    $('#courseDialogTitle').textContent = `${course.code} · ${course.name}`;
    const syllabusUrl = safeHttpUrl(course.syllabusUrl);
    body.innerHTML = `<dl class="detail-grid">
      <div><dt>Mã lớp học phần</dt><dd>${escapeHtml(course.sectionCode)}</dd></div>
      <div><dt>Số tín chỉ</dt><dd>${course.credits}</dd></div>
      <div><dt>Giảng viên</dt><dd>${escapeHtml(course.instructor)}</dd></div>
      <div><dt>Lịch học</dt><dd>${escapeHtml(course.schedule)}</dd></div>
      <div><dt>Phòng học</dt><dd>${escapeHtml(course.room)}</dd></div>
      <div><dt>Sĩ số</dt><dd>${course.enrolled} / ${course.capacity} · còn ${Math.max(0, course.capacity - course.enrolled)} chỗ</dd></div>
      <div><dt>Điều kiện học phần</dt><dd>${escapeHtml(course.prerequisite || 'Không có')}</dd></div>
      <div><dt>Đề cương môn học</dt><dd>${syllabusUrl ? `<a href="${escapeHtml(syllabusUrl)}" target="_blank" rel="noopener noreferrer">Xem / tải đề cương ↗</a>` : 'Chưa có đề cương'}</dd></div>
      <div class="detail-grid-wide"><dt>Mô tả môn học</dt><dd>${escapeHtml(course.description || 'Chưa có mô tả.')}</dd></div>
      <div><dt>Trạng thái của bạn</dt><dd>${course.registered ? 'Đã đăng ký' : course.waitlisted ? `Danh sách chờ #${course.waitlistPosition}` : course.prerequisiteMet ? 'Có thể đăng ký' : escapeHtml(course.unmetConditionMessage || 'Chưa đủ điều kiện học phần')}</dd></div>
    </dl>${course.meetings?.length?`<div class="history-table-wrap"><table class="history-table"><thead><tr><th>Buổi học và tuần</th><th>Phòng</th></tr></thead><tbody>${courseSessions(course).map(session=>`<tr><td>${escapeHtml(session.schedule)}</td><td>${escapeHtml(session.room)}</td></tr>`).join('')}</tbody></table></div>`:''}`;
  } catch (error) {
    $('#courseDialogTitle').textContent = 'Không tải được thông tin';
    body.innerHTML = `<div class="dialog-empty">${escapeHtml(error.message)}</div>`;
  }
}
function safeHttpUrl(value) {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; }
  catch { return null; }
}

let enrollmentHistory = [];
function renderEnrollmentHistory() {
  const body = $('#historyDialogBody');
  const semester = $('#historySemesterFilter').value;
  const status = $('#historyStatusFilter').value;
  const shown = enrollmentHistory.filter(item => (!semester || item.semesterCode === semester) && (!status || item.status === status));
  body.querySelector('#historyRows').innerHTML = shown.length ? shown.map(item => `<tr><td><strong>${escapeHtml(item.courseCode)} · ${escapeHtml(item.courseName)}</strong><small>${item.credits} tín chỉ · ${escapeHtml(item.semesterName)}</small></td><td>${escapeHtml(item.sectionCode)}</td><td>${escapeHtml(item.schedule)}</td><td><span class="history-status ${item.status === 'ENROLLED' ? 'is-active' : ''}">${({ENROLLED:'Đang đăng ký',PENDING:'Chờ xác nhận',CANCELLED:'Đã hủy'})[item.status]||escapeHtml(item.status)}</span></td><td>${item.enrollmentDateOnly?new Date(item.enrolledAt).toLocaleDateString('vi-VN'):formatDateTime(item.enrolledAt)}</td></tr>`).join('') : `<tr><td colspan="5" class="dialog-empty">Không có kết quả phù hợp.</td></tr>`;
}

async function showEnrollmentHistory() {
  const dialog = $('#historyDialog');
  const body = $('#historyDialogBody');
  body.innerHTML = '<div class="dialog-empty">Đang tải lịch sử đăng ký.</div>';
  dialog.showModal();
  try {
    enrollmentHistory = await apiGet('/api/enrollments/history');
    const semesters = [...new Map(enrollmentHistory.map(item => [item.semesterCode, item.semesterName])).entries()];
    body.innerHTML = `<div class="history-filters"><label>Học kỳ<select id="historySemesterFilter"><option value="">Tất cả học kỳ</option>${semesters.map(([code,name])=>`<option value="${escapeHtml(code)}">${escapeHtml(name)}</option>`).join('')}</select></label><label>Trạng thái<select id="historyStatusFilter"><option value="">Tất cả trạng thái</option><option value="ENROLLED">Đang đăng ký</option><option value="PENDING">Chờ xác nhận</option><option value="CANCELLED">Đã hủy</option></select></label></div><div class="history-table-wrap"><table class="history-table"><thead><tr><th>Môn học</th><th>Lớp</th><th>Lịch học</th><th>Trạng thái</th><th>Thời gian</th></tr></thead><tbody id="historyRows"></tbody></table></div>`;
    $('#historySemesterFilter').addEventListener('change', renderEnrollmentHistory);
    $('#historyStatusFilter').addEventListener('change', renderEnrollmentHistory);
    renderEnrollmentHistory();
  } catch (error) {
    body.innerHTML = `<div class="dialog-empty">${escapeHtml(error.message)}</div>`;
  }
}

let transcriptData = null;
function renderTranscriptRows() {
  if (!transcriptData) return;
  const semester = $('#transcriptSemesterFilter')?.value || '';
  const outcome = $('#transcriptOutcomeFilter')?.value || '';
  const query = ($('#transcriptSearchInput')?.value || '').trim().toLocaleLowerCase('vi');
  const shown = transcriptData.results.filter(item =>
    (!semester || item.semesterCode === semester) &&
    (!outcome || (outcome === 'PASSED' ? item.passed : !item.passed)) &&
    (!query || `${item.courseCode} ${item.courseName} ${item.semesterName}`.toLocaleLowerCase('vi').includes(query))
  );
  $('#transcriptRows').innerHTML = shown.length
    ? shown.map(item => `<tr>
        <td><strong>${escapeHtml(item.semesterName)}</strong><small>${escapeHtml(item.semesterCode)}</small></td>
        <td><strong>${escapeHtml(item.courseCode)} · ${escapeHtml(item.courseName)}</strong></td>
        <td>${item.credits}</td>
        <td><strong>${item.grade !== null && item.grade !== undefined ? Number(item.grade).toFixed(2) : '—'}</strong></td>
        <td>${escapeHtml(item.letterGrade || '—')}</td>
        <td><span class="history-status ${item.passed ? 'is-active' : 'is-failed'}">${escapeHtml(item.outcome)}</span>${item.retakenAndPassed ? '<small>Đã học lại Đạt</small>' : ''}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" class="dialog-empty">Không có kết quả học tập phù hợp bộ lọc.</td></tr>';
}

async function showTranscript() {
  const dialog = $('#transcriptDialog');
  const body = $('#transcriptDialogBody');
  body.innerHTML = '<div class="dialog-empty">Đang tải bảng điểm học tập…</div>';
  dialog.showModal();
  try {
    transcriptData = await apiGet('/api/student/transcript');
    const semesters = [...new Map(transcriptData.results.map(item => [item.semesterCode, item.semesterName])).entries()];
    const avgLabel = transcriptData.weightedAverageGrade10 !== null && transcriptData.weightedAverageGrade10 !== undefined
      ? Number(transcriptData.weightedAverageGrade10).toFixed(2)
      : '—';
    body.innerHTML = `
      <div class="transcript-summary">
        <article class="transcript-stat"><span>Tín chỉ tích lũy</span><strong>${transcriptData.accumulatedCredits}</strong><small>Tính 1 lần mỗi môn Đạt</small></article>
        <article class="transcript-stat"><span>Môn đã hoàn thành</span><strong>${transcriptData.completedCourseCount}</strong><small>${escapeHtml(transcriptData.program || '—')} · ${escapeHtml(transcriptData.cohort || '—')}</small></article>
        <article class="transcript-stat"><span>Tổng lượt học</span><strong>${transcriptData.totalRecords}</strong><small>Bao gồm cả học lại</small></article>
        <article class="transcript-stat"><span>Điểm TB hệ 10</span><strong>${avgLabel}</strong><small>Tham khảo theo tín chỉ</small></article>
      </div>
      <div class="history-filters">
        <label>Học kỳ<select id="transcriptSemesterFilter"><option value="">Tất cả học kỳ</option>${semesters.map(([code, name]) => `<option value="${escapeHtml(code)}">${escapeHtml(name)}</option>`).join('')}</select></label>
        <label>Kết quả<select id="transcriptOutcomeFilter"><option value="">Tất cả</option><option value="PASSED">Đạt</option><option value="FAILED">Chưa đạt</option></select></label>
        <label>Tìm môn<input type="search" id="transcriptSearchInput" placeholder="Mã hoặc tên môn học…" autocomplete="off"></label>
      </div>
      <div class="history-table-wrap">
        <table class="history-table">
          <thead><tr><th>Học kỳ</th><th>Học phần</th><th>Tín chỉ</th><th>Điểm hệ 10</th><th>Điểm chữ</th><th>Kết quả</th></tr></thead>
          <tbody id="transcriptRows"></tbody>
        </table>
      </div>
      <p class="transcript-note">Điểm trung bình hệ 10 được tính tham khảo trên điểm cao nhất của các học phần đã có điểm số trong cơ sở dữ liệu; xếp loại học vụ chính thức áp dụng theo quy chế đào tạo của trường.</p>`;
    $('#transcriptSemesterFilter').addEventListener('change', renderTranscriptRows);
    $('#transcriptOutcomeFilter').addEventListener('change', renderTranscriptRows);
    $('#transcriptSearchInput').addEventListener('input', renderTranscriptRows);
    renderTranscriptRows();
  } catch (error) {
    body.innerHTML = `<div class="dialog-empty">${escapeHtml(error.message)}</div>`;
  }
}

async function showCurriculum() {
  const dialog=$('#curriculumDialog'),body=$('#curriculumDialogBody');
  body.innerHTML='<div class="dialog-empty">Đang tải khung chương trình.</div>';dialog.showModal();
  try {
    const options=await apiGet('/api/student/curricula');
    if(!options.length){body.innerHTML='<div class="dialog-empty">Chưa có khung chương trình nào đang áp dụng.</div>';return;}
    const data=await apiGet('/api/student/curriculum');
    const render=selected=>{
      const curriculum=selected.curriculum;$('#curriculumTitle').textContent=curriculum.name;
      const terms=new Map();selected.courses.forEach(item=>{const term=item.suggestedSemester||'Chưa phân kỳ';if(!terms.has(term))terms.set(term,[]);terms.get(term).push(item);});
      body.innerHTML=`<div class="curriculum-selector"><label for="curriculumSelector">Chương trình / khóa</label><select id="curriculumSelector">${options.map(option=>`<option value="${escapeHtml(option.code)}" ${option.code===curriculum.code?'selected':''}>${escapeHtml(option.name)} · ${escapeHtml(option.program)} · Khóa ${escapeHtml(option.cohort)}</option>`).join('')}</select></div><p class="curriculum-meta">${escapeHtml(curriculum.program)} · Khóa ${escapeHtml(curriculum.cohort)} · Phiên bản ${escapeHtml(curriculum.version)}</p>${[...terms.entries()].map(([term,items])=>`<section class="curriculum-term"><h3>${escapeHtml(term)}</h3><div class="history-table-wrap"><table class="history-table"><thead><tr><th>Mã môn</th><th>Tên môn học</th><th>Tín chỉ</th><th>Loại</th><th></th></tr></thead><tbody>${items.map((item,index)=>`<tr><td>${escapeHtml(item.courseCode)}</td><td><strong>${escapeHtml(item.courseName)}</strong></td><td>${item.credits}</td><td>${item.requiredCourse?'Bắt buộc':'Tự chọn'}</td><td><button type="button" class="details-button" data-curriculum-course="${selected.courses.indexOf(item)}">Chi tiết</button></td></tr>`).join('')}</tbody></table></div></section>`).join('')||'<div class="dialog-empty">Khung chương trình chưa có môn học.</div>'}`;
      $('#curriculumSelector').addEventListener('change',async event=>{body.innerHTML='<div class="dialog-empty">Đang tải chương trình…</div>';try{render(await apiGet(`/api/student/curriculum?code=${encodeURIComponent(event.target.value)}`));}catch(error){body.innerHTML=`<div class="dialog-empty">${escapeHtml(error.message)}</div>`;}});
      body.querySelectorAll('[data-curriculum-course]').forEach(button=>button.addEventListener('click',()=>{
        const item=selected.courses[Number(button.dataset.curriculumCourse)],courseDialog=$('#courseDialog');
        $('#courseDialogTitle').textContent=`${item.courseCode} · ${item.courseName}`;
        const syllabus=safeHttpUrl(item.syllabusUrl);
        $('#courseDialogBody').innerHTML=`<dl class="detail-grid"><div><dt>Số tín chỉ</dt><dd>${item.credits}</dd></div><div><dt>Loại học phần</dt><dd>${item.requiredCourse?'Bắt buộc':'Tự chọn'}</dd></div><div><dt>Học kỳ đề xuất</dt><dd>${escapeHtml(item.suggestedSemester)}</dd></div><div><dt>Tiên quyết</dt><dd>${escapeHtml(item.prerequisite||'Không có')}</dd></div><div class="detail-grid-wide"><dt>Mô tả</dt><dd>${escapeHtml(item.description||'Chưa có mô tả.')}</dd></div><div><dt>Đề cương</dt><dd>${syllabus?`<a href="${escapeHtml(syllabus)}" target="_blank" rel="noopener noreferrer">Xem / tải đề cương ↗</a>`:'Chưa có đề cương'}</dd></div></dl>`;
        courseDialog.showModal();
      }));
    };
    render(data);
  } catch(error){$('#curriculumTitle').textContent='Không tải được khung chương trình';body.innerHTML=`<div class="dialog-empty">${escapeHtml(error.message)}</div>`;}
}

list.addEventListener('click', event => {
  const detailsButton = event.target.closest('[data-details]');
  if (detailsButton) { showCourseDetails(detailsButton.dataset.details); return; }
  const button = event.target.closest('[data-action]');
  if (button) changeEnrollment(button.dataset.action, button.dataset.id);
});
$('#registeredList').addEventListener('click', event => {
  const button = event.target.closest('[data-action="drop"]');
  if (button) changeEnrollment('drop', button.dataset.id);
});
$('#searchInput').addEventListener('input', event => { state.page=1;state.query = event.target.value; renderCourses(); });
document.querySelectorAll('.filter-chip').forEach(button => button.addEventListener('click', () => {
  document.querySelector('.filter-chip.selected')?.classList.remove('selected');
  button.classList.add('selected');
  state.filter = button.dataset.filter;
  state.page=1;
  renderCourses();
}));
$('#departmentFilter').addEventListener('change', event => { state.page=1;state.department = event.target.value; renderCourses(); });
$('#weekdayFilter').addEventListener('change', event => { state.page=1;state.weekday = event.target.value; renderCourses(); });
$('#creditFilter').addEventListener('change', event => { state.page=1;state.creditsFilter = event.target.value; renderCourses(); });
$('#sortFilter').addEventListener('change', event => { state.page=1;state.sort = event.target.value; renderCourses(); });
$('#filterButton').addEventListener('click', () => $('#filterRow').classList.toggle('hidden'));
$('#refreshButton').addEventListener('click', () => loadDashboard().then(() => showToast('Danh sách học phần đã được làm mới.')).catch(() => showToast('Không tải được danh sách.')));
$('#chatForm').addEventListener('submit', event => { event.preventDefault(); sendChat($('#chatInput').value); $('#chatInput').value = ''; });
$('#assistant .suggestions').addEventListener('click',event=>{const button=event.target.closest('[data-question]');if(button)sendChat(button.dataset.question);});
$('#clearChat').addEventListener('click',()=>{if(chatBusy)return;chatHistory.length=0;$('#chatBody').replaceChildren();appendMessage('Cuộc trò chuyện mới. Bạn muốn tra cứu lịch học, điểm, điều kiện hay gợi ý môn học?', 'bot');});
loadChatStatus();
$('#viewSchedule').addEventListener('click', () => {
  $('#scheduleDialog').showModal();
  loadStudentSchedule(state.semesterCode);
});
let selectedSchedule;
async function loadStudentSchedule(semesterCode='') {
  const target=$('#dialogSchedule');target.innerHTML='<div class="dialog-empty">Đang tải thời khóa biểu…</div>';
  try{
    selectedSchedule=await apiGet(`/api/student/schedule${semesterCode?`?semester=${encodeURIComponent(semesterCode)}`:''}`);
    const weekdays=['Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7','Chủ nhật'];const byDay=new Map(weekdays.map(day=>[day,[]]));
    selectedSchedule.courses.flatMap(courseSessions).forEach(course=>{const day=weekdays.find(value=>course.schedule.startsWith(value));if(day)byDay.get(day).push(course);});
    target.innerHTML=`<div class="schedule-controls"><label for="scheduleSemester">Học kỳ</label><select id="scheduleSemester">${selectedSchedule.semesters.map(semester=>`<option value="${escapeHtml(semester.code)}" ${semester.code===selectedSchedule.semesterCode?'selected':''}>${escapeHtml(semester.name)}</option>`).join('')}</select><strong>${escapeHtml(selectedSchedule.semesterName)}</strong></div>${selectedSchedule.courses.length?`<div class="schedule-grid">${weekdays.map(day=>`<section class="schedule-day"><h3>${day}</h3>${byDay.get(day).length?byDay.get(day).map(course=>{const time=course.schedule.split(' · ').slice(1).join(' · ');return `<article class="schedule-event ${escapeHtml(course.color)}"><strong>${escapeHtml(time||'Thời gian chưa cập nhật')}</strong><span>${escapeHtml(course.code)} · ${escapeHtml(course.sectionCode)}</span><small>${escapeHtml(course.name)}</small><small>${escapeHtml(course.instructor)}</small><small>${escapeHtml(course.room)}</small></article>`;}).join(''):'<p class="schedule-free">Không có lớp</p>'}</section>`).join('')}</div>`:'<div class="dialog-empty">Không có học phần trong thời khóa biểu ở học kỳ này.</div>'}`;
    $('#scheduleSemester').addEventListener('change',event=>loadStudentSchedule(event.target.value));
  }catch(error){target.innerHTML=`<div class="dialog-empty">${escapeHtml(error.message)}</div>`;}
}
$('#exportSchedule').addEventListener('click', () => {
  const columns = [['code','Mã môn'],['name','Tên môn học'],['sectionCode','Mã lớp học phần'],['credits','Tín chỉ'],['instructor','Giảng viên'],['schedule','Lịch học'],['room','Phòng học']];
  if(!selectedSchedule?.courses)return showToast('Hãy mở thời khóa biểu trước khi xuất.');
  const rows = selectedSchedule.courses.flatMap(courseSessions);
  const cell = value => `"${String(value ?? '').replaceAll('"','""')}"`;
  const csv = '\ufeff' + [columns.map(([,label])=>cell(label)).join(','), ...rows.map(row=>columns.map(([key])=>cell(row[key])).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=`thoi-khoa-bieu-${selectedSchedule.semesterCode}.csv`;link.click();URL.revokeObjectURL(url);
});
$('#closeDialog').addEventListener('click', () => $('#scheduleDialog').close());
$('#closeCourseDialog').addEventListener('click', () => $('#courseDialog').close());
$('#closeHistoryDialog').addEventListener('click', () => $('#historyDialog').close());
$('#closeTranscriptDialog').addEventListener('click', () => $('#transcriptDialog').close());
$('#historyOpen').addEventListener('click', showEnrollmentHistory);
$('#transcriptOpen').addEventListener('click', showTranscript);
$('#curriculumOpen').addEventListener('click', showCurriculum);
$('#exportTranscript').addEventListener('click', () => {
  if (!transcriptData?.results?.length) return showToast('Chưa có dữ liệu bảng điểm để xuất.');
  const columns = [['semesterCode', 'Mã học kỳ'], ['semesterName', 'Học kỳ'], ['courseCode', 'Mã môn'], ['courseName', 'Tên môn học'], ['credits', 'Tín chỉ'], ['grade', 'Điểm hệ 10'], ['letterGrade', 'Điểm chữ'], ['outcome', 'Kết quả']];
  const cell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = '\ufeff' + [columns.map(([, label]) => cell(label)).join(','), ...transcriptData.results.map(row => columns.map(([key]) => cell(row[key])).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `bang-diem-${transcriptData.studentCode || 'sinh-vien'}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});
const accountMenu=$('#accountMenu'),accountMenuToggle=$('#accountMenuToggle'),accountMenuPanel=$('#accountMenuPanel');
function setAccountMenu(open){accountMenuPanel.hidden=!open;accountMenuToggle.setAttribute('aria-expanded',String(open));}
accountMenuToggle.addEventListener('click',()=>setAccountMenu(accountMenuPanel.hidden));
accountMenuToggle.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();setAccountMenu(true);accountMenuPanel.querySelector('a').focus();}});
document.addEventListener('pointerdown',event=>{if(!accountMenu.contains(event.target))setAccountMenu(false);});
document.addEventListener('focusin',event=>{if(!accountMenu.contains(event.target))setAccountMenu(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!accountMenuPanel.hidden){setAccountMenu(false);accountMenuToggle.focus();}});
$('#studentLogoutButton').addEventListener('click',async()=>{try{await apiPost('/api/auth/logout',{});}catch{}location.replace('/login.html');});
$('#scheduleDialog').addEventListener('click', event => { if (event.target === $('#scheduleDialog')) $('#scheduleDialog').close(); });
$('#courseDialog').addEventListener('click', event => { if (event.target === $('#courseDialog')) $('#courseDialog').close(); });
$('#historyDialog').addEventListener('click', event => { if (event.target === $('#historyDialog')) $('#historyDialog').close(); });
$('#transcriptDialog').addEventListener('click', event => { if (event.target === $('#transcriptDialog')) $('#transcriptDialog').close(); });
$('#closeCurriculumDialog').addEventListener('click',()=>$('#curriculumDialog').close());
$('#curriculumDialog').addEventListener('click',event=>{if(event.target===$('#curriculumDialog'))$('#curriculumDialog').close();});
document.addEventListener('keydown', event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#searchInput').focus(); } });

// Sidebar navigation active state synchronization
const navItems = Array.from(document.querySelectorAll('.main-nav .nav-item'));
const sectionNavs = [
  { id: 'overview', el: $('#overview'), link: document.querySelector('.main-nav a[href="#overview"]') },
  { id: 'courses', el: $('#courses'), link: document.querySelector('.main-nav a[href="#courses"]') },
  { id: 'schedule', el: $('#schedule'), link: document.querySelector('.main-nav a[href="#schedule"]') },
  { id: 'assistant', el: $('#assistant'), link: document.querySelector('.main-nav a[href="#assistant"]') }
];

function setActiveNav(targetEl) {
  if (!targetEl) return;
  navItems.forEach(item => item.classList.remove('active'));
  targetEl.classList.add('active');
}

// 1. Click on section links: smoothly scroll and set active immediately
sectionNavs.forEach(({ link, el }) => {
  if (!link) return;
  link.addEventListener('click', (e) => {
    e.preventDefault();
    setActiveNav(link);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const href = link.getAttribute('href');
      if (href) history.replaceState(null, '', href);
    }
  });
});

// 2. Click on modal dialog buttons: set active state
const modalNavButtons = [
  { btn: $('#historyOpen'), dialog: $('#historyDialog') },
  { btn: $('#transcriptOpen'), dialog: $('#transcriptDialog') },
  { btn: $('#curriculumOpen'), dialog: $('#curriculumDialog') }
];

modalNavButtons.forEach(({ btn, dialog }) => {
  if (!btn) return;
  btn.addEventListener('click', () => {
    setActiveNav(btn);
  });
  if (dialog) {
    dialog.addEventListener('close', () => {
      syncNavOnScroll();
    });
  }
});

// Also when opening schedule from registered list button
$('#viewSchedule')?.addEventListener('click', () => {
  const schedLink = document.querySelector('.main-nav a[href="#schedule"]');
  if (schedLink) setActiveNav(schedLink);
});

// 3. Scrollspy: auto-update active nav as user scrolls through sections
function syncNavOnScroll() {
  const isAnyModalOpen = [
    $('#scheduleDialog'),
    $('#historyDialog'),
    $('#transcriptDialog'),
    $('#curriculumDialog'),
    $('#courseDialog')
  ].some(d => d && d.open);
  if (isAnyModalOpen) return;

  const scrollY = window.scrollY || window.pageYOffset;
  const triggerOffset = scrollY + 180;

  let current = sectionNavs[0];
  for (const item of sectionNavs) {
    if (item.el) {
      const top = item.el.getBoundingClientRect().top + scrollY;
      if (top <= triggerOffset) {
        current = item;
      }
    }
  }
  if (current && current.link) {
    setActiveNav(current.link);
  }
}

let scrollRaf;
window.addEventListener('scroll', () => {
  if (scrollRaf) cancelAnimationFrame(scrollRaf);
  scrollRaf = requestAnimationFrame(syncNavOnScroll);
}, { passive: true });

// Initial sync on page load
if (location.hash) {
  const match = document.querySelector(`.main-nav a[href="${location.hash}"]`);
  if (match) setActiveNav(match);
  else syncNavOnScroll();
} else {
  syncNavOnScroll();
}

loadDashboard().catch(error => { showToast(error.message); list.innerHTML = '<div class="empty-state"><strong>Không kết nối được máy chủ</strong><p>Hãy chạy ứng dụng Java rồi tải lại trang.</p></div>'; });
