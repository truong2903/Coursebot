import { apiDelete, apiGet, apiPost, apiPut } from '../../core/api.js';
import { resourceDefinitions as definitions } from './resource-definitions.js';

const $ = selector => document.querySelector(selector);
const view = $('#workspaceView');
const nav = $('#workspaceNav');
const dialog = $('#workspaceDialog');
const form = $('#workspaceForm');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const number = value => new Intl.NumberFormat('vi-VN').format(Number(value || 0));
const date = value => value ? new Intl.DateTimeFormat('vi-VN').format(new Date(`${value}T00:00:00`)) : '—';
const roleNames = { STUDENT:'Sinh viên', LECTURER:'Giảng viên', TRAINING_OFFICE:'Ban Đào tạo', ADMIN:'Quản trị viên' };
let account;
let currentPage = 'overview';
let currentResource;
let editingId = null;
let records = [];
let toastTimer;
let selectedCurriculumCode = null;
let selectedLecturerCurriculum = '';
let auditFilterState = {};
let reportFilterState = {semester:'',courseCode:'',sectionCode:''};
let lecturerSemesterOptions = [];
let selectedLecturerSemester = '';
let enrollmentFilterState = { semester: '', status: '', q: '' };
let enrollmentSemesters = [];

function menuFor(role) {
  const entries = role === 'LECTURER' ? [
    ['OVERVIEW','TỔNG QUAN'],['overview','Lịch giảng dạy'],['roster','Danh sách sinh viên'],['curricula','Khung chương trình']
  ] : role === 'TRAINING_OFFICE' ? [
    ['OVERVIEW','ĐIỀU PHỐI HỌC VỤ'],['overview','Tổng quan'],['enrollments','Duyệt & Hủy đăng ký'],['registrations','Đợt đăng ký'],['sections','Lớp học phần'],['courses','Môn học'],['curricula','Khung chương trình'],['prerequisites','Tiên quyết'],['semesters','Học kỳ'],['reports','Báo cáo']
  ] : [
    ['OVERVIEW','QUẢN TRỊ'],['overview','Tổng quan'],['accounts','Tài khoản'],['permissions','Phân quyền'],['logs','Nhật ký hệ thống'],['reports','Báo cáo']
  ];
  const needed={accounts:'ACCOUNTS_MANAGE',permissions:'PERMISSIONS_MANAGE',logs:'AUDIT_VIEW',reports:'REPORTS_VIEW',enrollments:'TRAINING_READ',registrations:'TRAINING_READ',sections:'TRAINING_READ',courses:'TRAINING_READ',curricula:'TRAINING_READ',prerequisites:'TRAINING_READ',semesters:'TRAINING_READ'};
  nav.innerHTML = entries.filter(([key])=>key==='OVERVIEW'||key==='overview'||!needed[key]||account.permissions?.includes(needed[key])).map(([key,label]) => key === 'OVERVIEW'
    ? `<span class="nav-group">${esc(label)}</span>`
    : `<button type="button" data-page="${esc(key)}" class="${key === currentPage ? 'active' : ''}"><span class="ws-nav-icon" aria-hidden="true">${iconFor(key)}</span><span class="ws-nav-text">${esc(label)}</span></button>`).join('');
}

function iconFor(key) {
  const icons = {
    overview: `<svg class="ws-anim-svg ws-icon-overview" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect class="b-box b1" x="3" y="3" width="7" height="9" rx="1.5"></rect><rect class="b-box b2" x="14" y="3" width="7" height="5" rx="1.5"></rect><rect class="b-box b3" x="14" y="12" width="7" height="9" rx="1.5"></rect><rect class="b-box b4" x="3" y="16" width="7" height="5" rx="1.5"></rect></svg>`,
    roster: `<svg class="ws-anim-svg ws-icon-roster" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="user-lead-body" d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle class="user-lead-head" cx="9" cy="7" r="4"></circle><path class="user-sub-body" d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path class="user-sub-head" d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
    enrollments: `<svg class="ws-anim-svg ws-icon-enrollments" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path class="check-tick" d="M9 13.5l2 2 4.5-4.5"></path></svg>`,
    registrations: `<svg class="ws-anim-svg ws-icon-registrations" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line class="reg-pin" x1="16" y1="2" x2="16" y2="6"></line><line class="reg-pin" x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><circle class="reg-clock" cx="12" cy="15" r="3"></circle><polyline class="reg-hand" points="12 13.5 12 15 13.5 15"></polyline></svg>`,
    sections: `<svg class="ws-anim-svg ws-icon-sections" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect class="sec-board" x="2" y="3" width="20" height="14" rx="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line><line class="sec-line s1" x1="6" y1="7" x2="14" y2="7"></line><line class="sec-line s2" x1="6" y1="11" x2="18" y2="11"></line></svg>`,
    courses: `<svg class="ws-anim-svg ws-icon-courses" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path class="book-spine" d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path class="book-cover" d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path><path class="book-mark" d="M12 2v8l3-2.5 3 2.5V2"></path></svg>`,
    curricula: `<svg class="ws-anim-svg ws-icon-curricula" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle class="c-node c1" cx="6" cy="6" r="2.8"></circle><circle class="c-node c2" cx="18" cy="9" r="2.8"></circle><circle class="c-node c3" cx="9" cy="18" r="2.8"></circle><path class="c-branch" d="M8.5 7.5L15.5 8.5M8.5 15.5L16 10.5M7 9v6"></path></svg>`,
    prerequisites: `<svg class="ws-anim-svg ws-icon-prerequisites" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="6" r="3"></circle><path class="arrow-chain" d="M8.5 15.5L15.5 8.5"></path><polyline class="arrow-tip" points="11 6 18 6 18 13"></polyline></svg>`,
    semesters: `<svg class="ws-anim-svg ws-icon-semesters" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line class="sem-ring1" x1="16" y1="2" x2="16" y2="6"></line><line class="sem-ring2" x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><polygon class="sem-badge" points="12 12 13.5 15 17 15.5 14.5 18 15 21.5 12 19.5 9 21.5 9.5 18 7 15.5 10.5 15" stroke-width="1.5"></polygon></svg>`,
    reports: `<svg class="ws-anim-svg ws-icon-reports" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10" class="rep-bar b3"></line><line x1="12" y1="20" x2="12" y2="4" class="rep-bar b2"></line><line x1="6" y1="20" x2="6" y2="14" class="rep-bar b1"></line></svg>`,
    accounts: `<svg class="ws-anim-svg ws-icon-accounts" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle class="acc-head" cx="12" cy="7" r="4"></circle><path class="acc-badge" d="M19 8l2 2 4-4" stroke-width="1.8"></path></svg>`,
    permissions: `<svg class="ws-anim-svg ws-icon-permissions" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle class="key-ring" cx="7.5" cy="15.5" r="5.5"></circle><path class="key-shaft" d="m11.5 11.5 7.5-7.5"></path><line class="key-tooth1" x1="16" y1="5" x2="18" y2="7"></line><line class="key-tooth2" x1="18" y1="7" x2="20" y2="9"></line></svg>`,
    logs: `<svg class="ws-anim-svg ws-icon-logs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline class="term-prompt" points="4 17 10 11 4 5"></polyline><line class="term-cursor" x1="12" y1="19" x2="20" y2="19"></line></svg>`
  };
  return icons[key] || '•';
}
function showToast(text) {
  const toast = $('#workspaceToast'); toast.textContent = text; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}
function setPageHeader(title, description = '') {
  $('#pageTitle').textContent = title; $('#pageBreadcrumb').textContent = title;
  $('#pageDescription').textContent = description; $('#pageEyebrow').textContent = roleNames[account.role].toLocaleUpperCase('vi');
  $('#pageActions').innerHTML = '';
}

async function loadOverview() {
  view.innerHTML = '<div class="workspace-loading">Đang tải dữ liệu tổng quan…</div>';
  if(account.role==='LECTURER'){
    const [data,semesters]=await Promise.all([apiGet(`/api/workspace/lecturer${selectedLecturerSemester?`?semester=${encodeURIComponent(selectedLecturerSemester)}`:''}`),apiGet('/api/workspace/lecturer/semesters')]);
    lecturerSemesterOptions=semesters;if(!selectedLecturerSemester)selectedLecturerSemester=data.semesterCode;renderLecturerOverview(data);return;
  }
  const endpoint = account.role === 'LECTURER' ? '/api/workspace/lecturer'
    : account.role === 'TRAINING_OFFICE' ? '/api/workspace/training-office' : '/api/workspace/admin';
  const data = await apiGet(endpoint);
  $('#semesterLabel').textContent = data.semester || account.semester || 'Không có học kỳ';
  if (account.role === 'LECTURER') renderLecturerOverview(data);
  else if (account.role === 'TRAINING_OFFICE') renderTrainingOverview(data);
  else renderAdminOverview(data);
}

function statCard(label,value,note='') { const display=typeof value==='number'||(typeof value==='string'&&value.trim()!==''&&Number.isFinite(Number(value)))?number(value):String(value??'—');return `<article class="workspace-stat"><span>${esc(label)}</span><strong>${esc(display)}</strong>${note?`<small>${esc(note)}</small>`:''}</article>`; }
function tableMarkup(columns,rows,empty='Chưa có dữ liệu.') {
  return `<div class="workspace-table-wrap"><table class="workspace-table"><thead><tr>${columns.map(c=>`<th>${esc(c[1])}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${columns.map(([key])=>`<td>${esc(row[key]??'—')}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${columns.length}" class="empty-state">${esc(empty)}</td></tr>`}</tbody></table></div>`;
}
function renderLecturerOverview(data) {
  setPageHeader('Lịch giảng dạy',`${data.name} · ${data.lecturerCode} · ${data.semester}`);
  selectedLecturerSemester=data.semesterCode;
  $('#semesterLabel').textContent=data.semester||'Không có học kỳ';
  const columns=[['sectionCode','Mã lớp'],['courseCode','Mã môn'],['courseName','Tên môn'],['schedule','Lịch học'],['room','Phòng'],['studentCount','Sĩ số']];
  const rows=data.sections.map(section=>`<tr>${columns.map(([key])=>`<td>${esc(section[key]??'—')}</td>`).join('')}<td><button type="button" class="secondary-button" data-section-detail="${esc(section.id)}">Chi tiết</button></td></tr>`).join('');
  view.innerHTML=`<div class="workspace-stats">${statCard('Lớp được phân công',data.sections.length)}${statCard('Sinh viên đang học',data.totalStudents)}${statCard('Học kỳ',data.semester)}${statCard('Vai trò',roleNames[account.role])}</div><section class="workspace-panel"><div class="lecturer-schedule-toolbar"><label>Học kỳ<select id="lecturerSemesterSelect">${lecturerSemesterOptions.map(item=>`<option value="${esc(item.code)}" ${item.code===data.semesterCode?'selected':''}>${esc(item.name)}</option>`).join('')}</select></label><button type="button" class="secondary-button" id="exportLecturerSchedule">Xuất lịch CSV</button></div><div class="workspace-table-wrap"><table class="workspace-table"><thead><tr>${columns.map(([,label])=>`<th>${esc(label)}</th>`).join('')}<th></th></tr></thead><tbody>${rows||`<tr><td class="empty-state" colspan="${columns.length+1}">Bạn chưa được phân công lớp học phần nào.</td></tr>`}</tbody></table></div></section>`;
  $('#lecturerSemesterSelect').addEventListener('change',async event=>{selectedLecturerSemester=event.target.value;try{const next=await apiGet(`/api/workspace/lecturer?semester=${encodeURIComponent(selectedLecturerSemester)}`);renderLecturerOverview(next);}catch(error){showToast(error.message);}});
  $('#exportLecturerSchedule').addEventListener('click',()=>exportCsv(`lich-giang-day-${data.semesterCode}`,columns,data.sections));
  view.querySelectorAll('[data-section-detail]').forEach(button=>button.addEventListener('click',async()=>{try{showSectionDetail(await apiGet(`/api/workspace/lecturer/sections/${encodeURIComponent(button.dataset.sectionDetail)}`));}catch(error){showToast(error.message);}}));
}
function showSectionDetail(section) {
  $('#dialogEyebrow').textContent='CHI TIẾT LỚP HỌC PHẦN';$('#dialogTitle').textContent=`${section.sectionCode} · ${section.courseName}`;
  const fields=[['Mã môn',section.courseCode],['Tên môn',section.courseName],['Tín chỉ',section.credits],['Học kỳ',section.semester],['Giảng viên',section.lecturer],['Lịch học',section.schedule],['Phòng',section.room],['Sĩ số',`${section.enrolled} / ${section.capacity} · còn ${section.remaining} chỗ`],['Trạng thái',section.status],['Tiên quyết',section.prerequisite||'Không có'],['Mô tả',section.description||'Chưa có mô tả.']];
  const safeUrl=(()=>{try{const url=new URL(section.syllabusUrl);return ['http:','https:'].includes(url.protocol)?url.href:null;}catch{return null;}})();
  $('#dialogFields').innerHTML=fields.map(([label,value])=>`<div class="dialog-field ${label==='Mô tả'?'full':''}"><label>${esc(label)}</label><p>${esc(value)}</p></div>`).join('')+`<div class="dialog-field"><label>Đề cương</label><p>${safeUrl?`<a href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer">Xem / tải đề cương ↗</a>`:'Chưa có đề cương'}</p></div>`;
  $('#dialogSave').hidden=true;dialog.showModal();
  if(section.meetings?.length)$('#dialogFields').insertAdjacentHTML('beforeend',`<div class="dialog-field full"><label>Các buổi học</label>${section.meetings.map(m=>`<p>${m.dayOfWeek===7?'Chủ nhật':m.dayOfWeek?'Thứ '+(m.dayOfWeek+1):'Chưa xếp lịch'} · ${esc(m.startsAt?.slice(0,5)||'?')} – ${esc(m.endsAt?.slice(0,5)||'?')} · ${esc(m.room||'Chưa có phòng')} · Tuần ${esc(m.weeksExpression||'Mọi tuần')}</p>`).join('')}</div>`);
}
async function loadLecturerCurricula() {
  setPageHeader('Tra cứu khung chương trình','Chọn chương trình và khóa để xem môn học theo học kỳ.');view.innerHTML='<div class="workspace-loading">Đang tải chương trình đào tạo…</div>';
  try{const options=await apiGet('/api/workspace/lecturer/curricula');if(!options.length){view.innerHTML='<section class="workspace-panel empty-state">Chưa có chương trình đào tạo đang áp dụng.</section>';return;}
    if(!selectedLecturerCurriculum||!options.some(item=>item.code===selectedLecturerCurriculum))selectedLecturerCurriculum=options[0].code;
    const data=await apiGet(`/api/workspace/lecturer/curricula/${encodeURIComponent(selectedLecturerCurriculum)}`);renderLecturerCurriculum(options,data);
  }catch(error){view.innerHTML=`<section class="workspace-panel empty-state">${esc(error.message)}</section>`;}
}
function renderLecturerCurriculum(options,data) {
  const curriculum=data.curriculum,terms=new Map();data.courses.forEach(course=>{const term=course.suggestedSemester||'Chưa phân kỳ';if(!terms.has(term))terms.set(term,[]);terms.get(term).push(course);});
  view.innerHTML=`<section class="workspace-panel"><div class="curriculum-selector"><label for="lecturerCurriculumSelect">Chương trình / khóa</label><select id="lecturerCurriculumSelect">${options.map(item=>`<option value="${esc(item.code)}" ${item.code===curriculum.code?'selected':''}>${esc(item.name)} · ${esc(item.program)} · Khóa ${esc(item.cohort)}</option>`).join('')}</select></div><p class="curriculum-meta">${esc(curriculum.program)} · Khóa ${esc(curriculum.cohort)} · Phiên bản ${esc(curriculum.version)}</p>${[...terms.entries()].map(([term,courses])=>`<section class="curriculum-term"><h3>${esc(term)}</h3><div class="workspace-table-wrap"><table class="workspace-table"><thead><tr><th>Mã môn</th><th>Tên môn</th><th>Tín chỉ</th><th>Loại</th><th></th></tr></thead><tbody>${courses.map((course,index)=>`<tr><td>${esc(course.courseCode)}</td><td>${esc(course.courseName)}</td><td>${course.credits}</td><td>${course.requiredCourse?'Bắt buộc':'Tự chọn'}</td><td><button class="secondary-button" type="button" data-curriculum-detail="${data.courses.indexOf(course)}">Chi tiết</button></td></tr>`).join('')}</tbody></table></div></section>`).join('')||'<div class="empty-state">Chương trình chưa có môn học.</div>'}</section>`;
  $('#lecturerCurriculumSelect').addEventListener('change',async event=>{selectedLecturerCurriculum=event.target.value;view.innerHTML='<div class="workspace-loading">Đang tải chương trình…</div>';try{renderLecturerCurriculum(options,await apiGet(`/api/workspace/lecturer/curricula/${encodeURIComponent(selectedLecturerCurriculum)}`));}catch(error){view.innerHTML=`<section class="workspace-panel empty-state">${esc(error.message)}</section>`;}});
  view.querySelectorAll('[data-curriculum-detail]').forEach(button=>button.addEventListener('click',()=>showCurriculumCourseDetail(data.courses[Number(button.dataset.curriculumDetail)])));
}
function showCurriculumCourseDetail(course) {
  $('#dialogEyebrow').textContent='CHI TIẾT MÔN HỌC';$('#dialogTitle').textContent=`${course.courseCode} · ${course.courseName}`;
  const safeUrl=(()=>{try{const url=new URL(course.syllabusUrl);return ['http:','https:'].includes(url.protocol)?url.href:null;}catch{return null;}})();
  const fields=[['Mã môn',course.courseCode],['Tên môn',course.courseName],['Tín chỉ',course.credits],['Học kỳ đề xuất',course.suggestedSemester],['Loại học phần',course.requiredCourse?'Bắt buộc':'Tự chọn'],['Điều kiện tiên quyết',course.prerequisite||'Không có'],['Mô tả',course.description||'Chưa có mô tả.']];
  $('#dialogFields').innerHTML=fields.map(([label,value])=>`<div class="dialog-field ${label==='Mô tả'?'full':''}"><label>${esc(label)}</label><p>${esc(value)}</p></div>`).join('')+`<div class="dialog-field"><label>Đề cương</label><p>${safeUrl?`<a href="${esc(safeUrl)}" target="_blank" rel="noopener noreferrer">Xem / tải đề cương ↗</a>`:'Chưa có đề cương'}</p></div>`;
  $('#dialogSave').hidden=true;dialog.showModal();
}
function renderTrainingOverview(data) {
  setPageHeader('Tổng quan học vụ',`${data.semester} · Đăng ký từ ${date(data.registrationOpenAt)} đến ${date(data.registrationCloseAt)}`);
  const rows=data.sections.map(item=>({...item,enrolled:`${item.enrolled} / ${item.capacity}`}));
  const pendingBanner = data.pendingCount > 0
    ? `<div class="pending-banner"><span>Đang có <strong>${number(data.pendingCount)} bản ghi đăng ký chờ xác nhận (PENDING)</strong> cần Ban Đào tạo xử lý.</span><button type="button" class="primary-button" id="jumpPendingButton">Duyệt đăng ký ngay →</button></div>`
    : '';
  view.innerHTML=`<div class="workspace-stats">${statCard('Sinh viên',data.studentCount)}${statCard('Môn học',data.courseCount)}${statCard('Lớp học phần',data.sectionCount)}${statCard('Đăng ký đang hoạt động',data.enrollmentCount,`${number(data.waitingListCount)} chờ lớp · ${number(data.pendingCount||0)} chờ duyệt`)}</div>${pendingBanner}<section class="workspace-panel"><div class="workspace-toolbar"><strong>Sĩ số lớp học kỳ này</strong></div>${tableMarkup([['sectionCode','Mã lớp'],['courseCode','Mã môn'],['courseName','Tên môn'],['lecturer','Giảng viên'],['schedule','Lịch'],['enrolled','Sĩ số'],['prerequisite','Tiên quyết']],rows,'Học kỳ này chưa có lớp học phần.')}</section>`;
  $('#jumpPendingButton')?.addEventListener('click', () => { enrollmentFilterState.status = 'PENDING'; openPage('enrollments'); });
}
function renderAdminOverview(data) {
  setPageHeader('Tổng quan quản trị','Số liệu hệ thống được lấy trực tiếp từ cơ sở dữ liệu.');
  view.innerHTML=`<div class="workspace-stats">${statCard('Tài khoản sinh viên',data.studentAccounts)}${statCard('Tài khoản giảng viên',data.lecturerAccounts)}${statCard('Môn học',data.courses)}${statCard('Lớp học phần',data.courseSections)}</div><section class="workspace-panel"><div class="workspace-toolbar"><strong>Tình hình đăng ký</strong></div><p>${number(data.activeEnrollments)} lượt đăng ký đang có hiệu lực trên hệ thống.</p></section>`;
}

function statusCell(value) {
  const normalized=String(value??'').toUpperCase();
  const cls=['ACTIVE','OPEN','ENROLLED'].includes(normalized)?'active':['SCHEDULED','WAITING','PENDING'].includes(normalized)?'warning':'';
  const labels={ACTIVE:'Đang hoạt động',LOCKED:'Đã khóa',DISABLED:'Đã vô hiệu hóa',OPEN:'Đang mở',CLOSED:'Đã đóng',SCHEDULED:'Sắp mở',CANCELLED:'Đã hủy',ENROLLED:'Đang đăng ký',WAITING:'Đang chờ',PENDING:'Chờ xác nhận'};
  return `<span class="status-pill ${cls}">${esc(labels[normalized]||value||'—')}</span>`;
}
function canManageResource(key) {
  return key==='accounts' ? account.permissions?.includes('ACCOUNTS_MANAGE') : account.permissions?.includes('TRAINING_MANAGE');
}
async function loadResource(key) {
  const definition=definitions[key]; if(!definition)return;
  currentResource=key; setPageHeader(definition.title,definition.description);
  view.innerHTML='<div class="workspace-loading">Đang tải dữ liệu…</div>';
  if(!definition.readOnly&&canManageResource(key))$('#pageActions').innerHTML='<button type="button" class="primary-button" id="createRecord">+ Thêm mới</button>';
  try {
    if(key==='reports'){
      const [semesters,reportRows]=await Promise.all([apiGet('/api/reports/semesters'),apiGet('/api/reports')]);
      records=reportRows;renderReports(semesters);return;
    }
    records=await apiGet(definition.endpoint);
    if(key==='logs')renderAuditLogs();else renderResource(key);
  } catch(error) { view.innerHTML=`<section class="workspace-panel"><div class="empty-state">${esc(error.message)}<br><small>Chức năng này cần API và quyền truy cập tương ứng.</small></div></section>`; }
}
function renderAuditLogs(query='') {
  const definition=definitions.logs,filtered=records.filter(row=>JSON.stringify(row).toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
  const rows=filtered.map(row=>`<tr><td>${esc(new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short'}).format(new Date(row.createdAt)))}</td><td>${esc(row.actor)}</td><td>${esc(roleNames[row.role]||row.role)}</td><td>${esc(row.action)}</td><td>${esc(row.target||'—')}</td><td>${esc(row.details||'—')}</td><td><button type="button" class="secondary-button" data-audit-detail="${row.id}">Chi tiết</button></td></tr>`).join('');
  const actions=[...new Set(records.map(row=>row.action))].sort();
  view.innerHTML=`<section class="workspace-panel"><form id="auditFilters" class="audit-filters"><label>Tài khoản<input name="actor" type="search" placeholder="Tên đăng nhập"></label><label>Vai trò<select name="role"><option value="">Tất cả</option><option value="STUDENT">Sinh viên</option><option value="LECTURER">Giảng viên</option><option value="TRAINING_OFFICE">Ban Đào tạo</option><option value="ADMIN">Quản trị viên</option><option value="SYSTEM">Hệ thống</option></select></label><label>Thao tác<select name="action"><option value="">Tất cả thao tác</option>${actions.map(action=>`<option value="${esc(action)}">${esc(action)}</option>`).join('')}</select></label><label>Từ ngày<input name="from" type="datetime-local"></label><label>Đến ngày<input name="to" type="datetime-local"></label><button class="primary-button" type="submit">Lọc nhật ký</button></form><div class="workspace-toolbar"><input id="auditSearch" class="workspace-search" type="search" placeholder="Tìm trong kết quả…"><button type="button" class="secondary-button" id="exportAudit">Xuất CSV</button></div><div class="workspace-table-wrap"><table class="workspace-table"><thead><tr>${definition.columns.map(([,label])=>`<th>${esc(label)}</th>`).join('')}<th></th></tr></thead><tbody>${rows||`<tr><td colspan="${definition.columns.length+1}" class="empty-state">${query?'Không tìm thấy nhật ký phù hợp.':'Không có bản ghi nhật ký.'}</td></tr>`}</tbody></table></div><p class="table-summary">${number(filtered.length)} bản ghi trong kết quả</p></section>`;
  $('#auditSearch').value=query;
  for(const [key,value] of Object.entries(auditFilterState))if($('#auditFilters').elements[key])$('#auditFilters').elements[key].value=value;
  $('#auditSearch').addEventListener('input',event=>{const text=event.target.value;const focus=()=>{const search=$('#auditSearch');search.focus();search.setSelectionRange(text.length,text.length);};auditFilterState=Object.fromEntries(new FormData($('#auditFilters')).entries());renderAuditLogs(text);focus();});
  $('#auditFilters').addEventListener('submit',async event=>{event.preventDefault();auditFilterState=Object.fromEntries(new FormData(event.currentTarget).entries());const params=new URLSearchParams(auditFilterState);try{records=await apiGet(`${definitions.logs.endpoint}?${params}`);renderAuditLogs($('#auditSearch')?.value||'');}catch(error){showToast(error.message);}});
  $('#exportAudit').addEventListener('click',()=>exportCsv('nhat-ky-he-thong',definition.columns,filtered));
  view.querySelectorAll('[data-audit-detail]').forEach(button=>button.addEventListener('click',()=>showAuditDetail(records.find(row=>String(row.id)===button.dataset.auditDetail))));
}
function showAuditDetail(item) {
  if(!item)return;$('#dialogEyebrow').textContent='NHẬT KÝ HỆ THỐNG';$('#dialogTitle').textContent=`${item.action} · ${item.target||'Sự kiện'}`;
  const fields=[['Thời gian',new Intl.DateTimeFormat('vi-VN',{dateStyle:'full',timeStyle:'medium'}).format(new Date(item.createdAt))],['Tài khoản',item.actor],['Vai trò',roleNames[item.role]||item.role],['Thao tác',item.action],['Đối tượng',item.target||'—'],['Chi tiết',item.details||'—']];
  $('#dialogFields').innerHTML=fields.map(([label,value])=>`<div class="dialog-field full"><label>${esc(label)}</label><p>${esc(value)}</p></div>`).join('');$('#dialogMessage').className='dialog-message';$('#dialogSave').hidden=true;dialog.showModal();
}
function renderReports(semesters) {
  const def=definitions.reports,total=records.reduce((sum,row)=>sum+row.enrolled,0),waiting=records.reduce((sum,row)=>sum+row.waitlisted,0);
  const capacity=records.reduce((sum,row)=>sum+row.capacity,0),occupancy=capacity?Math.round(total/capacity*100):0;
  const rows=records.map((row,index)=>`<tr><td>${esc(row.semester)}</td><td>${esc(row.courseCode)}</td><td>${esc(row.courseName)}</td><td>${esc(row.sectionCode)}</td><td>${statusCell(row.status)}</td><td>${number(row.enrolled)}</td><td>${number(row.capacity)}</td><td>${number(row.waitlisted)}</td><td><button type="button" class="secondary-button" data-report-detail="${index}">Chi tiết</button></td></tr>`).join('');
  view.innerHTML=`<section class="workspace-panel"><form id="reportFilters" class="report-filters"><label>Học kỳ<select name="semester"><option value="">Tất cả học kỳ</option>${semesters.map(item=>`<option value="${esc(item.code)}">${esc(item.name)}</option>`).join('')}</select></label><label>Mã môn<input name="courseCode" value="${esc(reportFilterState.courseCode)}" placeholder="Tìm mã môn"></label><label>Mã lớp<input name="sectionCode" value="${esc(reportFilterState.sectionCode)}" placeholder="Tìm mã lớp"></label><button type="submit" class="primary-button">Áp dụng lọc</button><button type="button" class="secondary-button" id="resetReportFilters">Xóa lọc</button></form><div class="workspace-stats report-stats">${statCard('Lượt đăng ký',total)}${statCard('Sinh viên chờ',waiting)}${statCard('Tỷ lệ lấp đầy',`${occupancy}%`,`${number(total)} / ${number(capacity)} chỗ`)}</div><section class="report-chart-panel"><div class="workspace-toolbar"><strong>Sĩ số theo lớp học phần</strong></div><div class="report-bars">${records.slice(0,12).map(row=>`<div class="report-bar-row"><span title="${esc(row.sectionCode)} · ${esc(row.courseName)}">${esc(row.sectionCode)}</span><div><i style="width:${row.capacity?Math.min(100,row.enrolled/row.capacity*100):0}%"></i></div><small>${number(row.enrolled)} / ${number(row.capacity)}</small></div>`).join('')||'<p class="empty-state">Chưa có số liệu để hiển thị.</p>'}</div></section><div class="workspace-toolbar"><strong>Chi tiết lớp học phần</strong><button type="button" class="secondary-button" id="exportReports">Xuất CSV</button></div><div class="workspace-table-wrap"><table class="workspace-table"><thead><tr>${def.columns.map(([,label])=>`<th>${esc(label)}</th>`).join('')}<th></th></tr></thead><tbody>${rows||`<tr><td class="empty-state" colspan="${def.columns.length+1}">Không có dữ liệu phù hợp.</td></tr>`}</tbody></table></div><p class="table-summary">${number(records.length)} lớp học phần</p></section>`;
  const form=$('#reportFilters');for(const [key,value] of Object.entries(reportFilterState))if(form.elements[key])form.elements[key].value=value;
  form.addEventListener('submit',async event=>{event.preventDefault();reportFilterState=Object.fromEntries(new FormData(form).entries());await fetchReports(semesters);});
  $('#resetReportFilters').addEventListener('click',async()=>{reportFilterState={semester:'',courseCode:'',sectionCode:''};await fetchReports(semesters);});
  $('#exportReports').addEventListener('click',()=>exportCsv('bao-cao-dang-ky',def.columns,records));
  view.querySelectorAll('[data-report-detail]').forEach(button=>button.addEventListener('click',()=>showReportDetail(records[Number(button.dataset.reportDetail)])));
}
async function fetchReports(semesters) {
  const params=new URLSearchParams(Object.fromEntries(Object.entries(reportFilterState).filter(([,value])=>value)));
  try{records=await apiGet(`/api/reports${params.size?'?'+params:''}`);renderReports(semesters);}catch(error){showToast(error.message);}
}
function showReportDetail(row) {
  if(!row)return;$('#dialogEyebrow').textContent='BÁO CÁO ĐĂNG KÝ';$('#dialogTitle').textContent=`${row.sectionCode} · ${row.courseName}`;
  const fields=[['Học kỳ',row.semester],['Mã môn',row.courseCode],['Tên môn',row.courseName],['Lớp học phần',row.sectionCode],['Trạng thái lớp',statusCell(row.status)],['Đã đăng ký',number(row.enrolled)],['Sĩ số tối đa',number(row.capacity)],['Chờ trong danh sách',number(row.waitlisted)],['Tỷ lệ lấp đầy',row.capacity?`${Math.round(row.enrolled/row.capacity*100)}%`:'0%']];
  $('#dialogFields').innerHTML=fields.map(([label,value])=>`<div class="dialog-field"><label>${esc(label)}</label><p>${label==='Trạng thái lớp'?value:esc(value)}</p></div>`).join('');$('#dialogSave').hidden=true;dialog.showModal();
}
function renderResource(key,query='',page=1) {
  const definition=definitions[key];
  const filtered=records.filter(row=>JSON.stringify(row).toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')));
  const editable=!definition.readOnly&&canManageResource(key);
  const headers=definition.columns.map(([,label])=>`<th>${esc(label)}</th>`).join('')+(editable?'<th></th>':'');
  const pages=Math.max(1,Math.ceil(filtered.length/50));page=Math.min(page,pages);const offset=(page-1)*50;
  const rows=filtered.slice(offset,offset+50).map((row,index)=>`<tr>${definition.columns.map(([field])=>`<td>${field==='status'?statusCell(row[field]):field==='active'?statusCell(row[field]?'ACTIVE':'DISABLED'):esc(row[field]??'—')}</td>`).join('')}${editable?`<td><div class="row-actions">${key==='curricula'?`<button type="button" data-manage-curriculum="${esc(row.code)}" data-name="${esc(row.name)}">Môn học</button>`:''}<button type="button" data-edit="${offset+index}">Chỉnh sửa</button><button type="button" data-delete="${esc(row.id??row.code??row.username??index)}">Xóa</button></div></td>`:''}</tr>`).join('');
  view.innerHTML=`<section class="workspace-panel"><div class="workspace-toolbar"><input id="resourceSearch" class="workspace-search" type="search" placeholder="Tìm trong danh sách…" aria-label="Tìm trong danh sách"><button type="button" class="secondary-button" id="exportResource">Xuất CSV</button></div><div class="workspace-table-wrap"><table class="workspace-table"><thead><tr>${headers}</tr></thead><tbody>${rows||`<tr><td class="empty-state" colspan="${definition.columns.length+(editable?1:0)}">${query?'Không tìm thấy kết quả phù hợp.':'Chưa có dữ liệu.'}</td></tr>`}</tbody></table></div><p class="table-summary">${number(filtered.length)} mục</p></section>`;
  $('#resourceSearch').addEventListener('input',event=>{const query=event.target.value;renderResource(key,query);const next=$('#resourceSearch');next.focus();next.setSelectionRange(query.length,query.length);});
  $('#resourceSearch').value=query;
  if(pages>1){view.querySelector('.table-summary').insertAdjacentHTML('beforebegin',`<nav aria-label="Phân trang danh sách"><button type="button" class="secondary-button" id="resourcePrevious" ${page===1?'disabled':''}>Trang trước</button><span> Trang ${page} / ${pages} </span><button type="button" class="secondary-button" id="resourceNext" ${page===pages?'disabled':''}>Trang sau</button></nav>`);$('#resourcePrevious').addEventListener('click',()=>renderResource(key,query,page-1));$('#resourceNext').addEventListener('click',()=>renderResource(key,query,page+1));}
  $('#exportResource').addEventListener('click',()=>exportCsv(definition.title,definition.columns,filtered));
  $('#createRecord')?.addEventListener('click',()=>openRecordForm(key,null));
  view.querySelectorAll('[data-edit]').forEach(button=>button.addEventListener('click',()=>openRecordForm(key,filtered[Number(button.dataset.edit)])));
  view.querySelectorAll('[data-delete]').forEach(button=>button.addEventListener('click',()=>deleteRecord(key,button.dataset.delete)));
  view.querySelectorAll('[data-manage-curriculum]').forEach(button=>button.addEventListener('click',()=>manageCurriculum(button.dataset.manageCurriculum,button.dataset.name)));
  $('#pageActions').querySelector('#createRecord')?.addEventListener('click',()=>openRecordForm(key,null));
}
async function manageCurriculum(code,name){
  selectedCurriculumCode=code;$('#curriculumCoursesTitle').textContent=`Môn học · ${name}`;$('#curriculumCoursesBody').innerHTML='<div class="workspace-loading">Đang tải cấu trúc chương trình…</div>';$('#curriculumCoursesDialog').showModal();
  await reloadCurriculumCourses();
}
async function reloadCurriculumCourses(){
  const body=$('#curriculumCoursesBody');
  $('#curriculumCourseForm').hidden=!canManageResource('curricula');
  try{
    const courses=await apiGet(`/api/training/curricula/${encodeURIComponent(selectedCurriculumCode)}/courses`);
    const editable=canManageResource('curricula');
    const rows=courses.map(course=>`<tr><td>${esc(course.suggestedSemester)}</td><td><strong>${esc(course.courseCode)}</strong></td><td>${esc(course.courseName)}</td><td>${course.credits}</td><td>${course.requiredCourse?'Bắt buộc':'Tự chọn'}</td>${editable?`<td><div class="row-actions"><button type="button" data-edit-curriculum-course="${esc(course.courseCode)}">Sửa / sắp xếp</button><button type="button" class="curriculum-course-delete" data-remove-curriculum-course="${esc(course.courseCode)}">Gỡ</button></div></td>`:''}</tr>`).join('');
    body.innerHTML=`<div class="workspace-table-wrap"><table class="workspace-table"><thead><tr><th>Học kỳ đề xuất</th><th>Mã môn</th><th>Tên môn</th><th>Tín chỉ</th><th>Loại</th>${editable?'<th></th>':''}</tr></thead><tbody>${rows||`<tr><td class="empty-state" colspan="${editable?6:5}">Chương trình chưa có môn học.</td></tr>`}</tbody></table></div><div id="curriculumCourseEdit"></div>`;
    body.querySelectorAll('[data-edit-curriculum-course]').forEach(button=>button.addEventListener('click',()=>{
      const course=courses.find(item=>item.courseCode===button.dataset.editCurriculumCourse);if(!course)return;
      const editor=body.querySelector('#curriculumCourseEdit');
      editor.innerHTML=`<form id="curriculumCourseEditForm" class="curriculum-entry-form"><strong>${esc(course.courseCode)} · ${esc(course.courseName)}</strong><input name="courseCode" value="${esc(course.courseCode)}" type="hidden"><label>Học kỳ đề xuất<input name="suggestedSemester" value="${esc(course.suggestedSemester)}" required maxlength="40"></label><label>Thứ tự<input name="orderIndex" type="number" min="0" value="${Number(course.orderIndex)||0}" required></label><label>Loại học phần<select name="requiredCourse"><option value="true" ${course.requiredCourse?'selected':''}>Bắt buộc</option><option value="false" ${!course.requiredCourse?'selected':''}>Tự chọn</option></select></label><button class="primary-button" type="submit">Lưu</button><button class="secondary-button" type="button" id="cancelCurriculumCourseEdit">Hủy</button></form>`;
      editor.querySelector('#cancelCurriculumCourseEdit').addEventListener('click',()=>{editor.innerHTML='';});
      editor.querySelector('form').addEventListener('submit',async event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget).entries());data.requiredCourse=data.requiredCourse==='true';data.orderIndex=Number(data.orderIndex);try{await apiPut(`/api/training/curricula/${encodeURIComponent(selectedCurriculumCode)}/courses/${encodeURIComponent(course.courseCode)}`,data);await reloadCurriculumCourses();showToast('Đã cập nhật học kỳ và thứ tự môn học.');}catch(error){showToast(error.message);}});
      editor.scrollIntoView({behavior:'smooth',block:'nearest'});
    }));
    body.querySelectorAll('[data-remove-curriculum-course]').forEach(button=>button.addEventListener('click',async()=>{if(!confirm('Gỡ môn này khỏi khung chương trình?'))return;try{await apiDelete(`/api/training/curricula/${encodeURIComponent(selectedCurriculumCode)}/courses/${encodeURIComponent(button.dataset.removeCurriculumCourse)}`);await reloadCurriculumCourses();}catch(error){showToast(error.message);}}));
  }catch(error){body.innerHTML=`<div class="empty-state">${esc(error.message)}</div>`;}
}
function openRecordForm(key,record) {
  const definition=definitions[key]; editingId=record?.id??record?.code??record?.username??null;
  $('#dialogEyebrow').textContent=definition.title.toLocaleUpperCase('vi');
  $('#dialogTitle').textContent=`${record?'Cập nhật':'Tạo'} ${definition.title.toLocaleLowerCase('vi')}`;
  $('#dialogMessage').className='dialog-message';
  $('#dialogFields').innerHTML=definition.fields.filter(field=>!(field.createOnly&&record)).map(field=>{
    const value=record?.[field.name]??'';const type=field.type||'text';let control;
    if(type==='select')control=`<select name="${esc(field.name)}" ${field.required?'required':''}>${field.options.map(([v,l])=>`<option value="${esc(v)}" ${String(value)===v?'selected':''}>${esc(l)}</option>`).join('')}</select>`;
    else if(type==='textarea')control=`<textarea name="${esc(field.name)}" ${field.required?'required':''}>${esc(value)}</textarea>`;
    else control=`<input name="${esc(field.name)}" type="${esc(type)}" value="${esc(type==='password'?'':value)}" ${field.required?'required':''} ${field.min!==undefined?`min="${field.min}"`:''} ${field.max!==undefined?`max="${field.max}"`:''} ${type==='password'?'autocomplete="new-password"':''}>`;
    return `<div class="dialog-field ${field.wide?'full':''}"><label>${esc(field.label)}${field.required?' *':''}</label>${control}</div>`;
  }).join('');
  if(key==='sections'){
    $('#dialogFields').insertAdjacentHTML('beforeend','<div class="dialog-field full"><label>Các buổi học</label><p>Mỗi buổi có thứ, giờ, phòng và tuần riêng. Để trống tuần nếu học mọi tuần.</p><div id="meetingRows"></div><button type="button" class="secondary-button" id="addMeeting">Thêm buổi học</button></div>');
    const addMeeting=(meeting={})=>{
      const row=document.createElement('div');row.className='meeting-editor-row';row.dataset.meeting='';
      row.innerHTML=`<label>Thứ<select data-field="dayOfWeek" required>${[1,2,3,4,5,6,7].map(day=>`<option value="${day}" ${day===meeting.dayOfWeek?'selected':''}>${day===7?'Chủ nhật':'Thứ '+(day+1)}</option>`).join('')}</select></label><label>Bắt đầu<input data-field="startsAt" type="time" required value="${esc(meeting.startsAt?.slice(0,5)||'')}"></label><label>Kết thúc<input data-field="endsAt" type="time" required value="${esc(meeting.endsAt?.slice(0,5)||'')}"></label><label>Phòng<input data-field="room" value="${esc(meeting.room||'')}"></label><label>Tuần<input data-field="weeksExpression" placeholder="2-9,11-18" value="${esc(meeting.weeksExpression||'')}"></label><button type="button" class="secondary-button" data-remove-meeting>Xóa buổi</button>`;
      row.querySelector('[data-remove-meeting]').addEventListener('click',()=>row.remove());$('#meetingRows').append(row);
      if(!meeting.dayOfWeek)row.querySelector('[data-field="dayOfWeek"]').selectedIndex=-1;
    };
    (record?.meetings?.length?record.meetings:[{}]).forEach(addMeeting);
    $('#addMeeting').addEventListener('click',()=>addMeeting());
  }
  $('#dialogSave').hidden=false;$('#dialogSave').textContent=record?'Lưu thay đổi':'Tạo mới';dialog.showModal();
}
async function saveRecord() {
  const key=currentResource,definition=definitions[key],values=Object.fromEntries(new FormData(form).entries());
  definition.fields.forEach(field=>{if(field.type==='number'&&values[field.name]!=='')values[field.name]=Number(values[field.name]);});
  definition.fields.forEach(field=>{if(['date','datetime-local'].includes(field.type)&&values[field.name]==='')values[field.name]=null;if(field.type==='number'&&values[field.name]==='')delete values[field.name];});
  if('registrationAlwaysOpen' in values)values.registrationAlwaysOpen=values.registrationAlwaysOpen==='true';
  if(key==='sections')values.meetings=[...$('#meetingRows').querySelectorAll('[data-meeting]')].map(row=>Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input=>[input.dataset.field,input.dataset.field==='dayOfWeek'?Number(input.value):input.value])));
  if(values.password==='')delete values.password;
  $('#dialogSave').disabled=true;
  $('#dialogSave').hidden=false;
  try {
    const path=definition.endpoint+(editingId!==null?`/${encodeURIComponent(editingId)}`:'');
    const result=editingId!==null?await apiPut(path,values):await apiPost(definition.endpoint,values);
    dialog.close();showToast(result?.message||'Đã lưu thay đổi.');await loadResource(key);
  } catch(error) { const target=$('#dialogMessage');target.textContent=error.message;target.className='dialog-message show'; }
  finally { $('#dialogSave').disabled=false; }
}
async function deleteRecord(key,id) {
  if(!window.confirm('Bạn có chắc muốn xóa mục này? Dữ liệu đang được tham chiếu có thể không cho phép xóa.'))return;
  try {const result=await apiDelete(`${definitions[key].endpoint}/${encodeURIComponent(id)}`);showToast(result?.message||'Đã xóa mục.');await loadResource(key);}
  catch(error){showToast(error.message);}
}
function exportCsv(filename,columns,rows) {
  const lines=[columns.map(([,label])=>csvCell(label)).join(','),...rows.map(row=>columns.map(([field])=>csvCell(row[field])).join(','))];
  const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);link.download=`${filename.replace(/[^\p{L}\p{N}-]+/gu,'-').toLocaleLowerCase('vi')}.csv`;link.click();URL.revokeObjectURL(link.href);
}
function csvCell(value){return `"${String(value??'').replaceAll('"','""')}"`;}
async function openPage(key) {
  currentPage=key;menuFor(account.role);
  if(key==='overview'){try{await loadOverview();}catch(error){view.innerHTML=`<section class="workspace-panel empty-state">${esc(error.message)}</section>`;}}
  else if(key==='roster')await loadRoster();
  else if(key==='enrollments')await loadTrainingEnrollments();
  else if(key==='curricula'&&account.role==='LECTURER')await loadLecturerCurricula();
  else if(key==='permissions')await loadPermissions();
  else await loadResource(key);
}

async function loadTrainingEnrollments(page = 1) {
  setPageHeader('Duyệt & Hủy đăng ký học phần', 'Xử lý các bản ghi đăng ký chờ xác nhận (PENDING) và hỗ trợ hủy học phần hộ sinh viên khi đã quá hạn 7 ngày đầu học kỳ.');
  view.innerHTML = '<div class="workspace-loading">Đang tải danh sách đăng ký học phần…</div>';
  try {
    const [semesters, allRows] = await Promise.all([
      enrollmentSemesters.length ? Promise.resolve(enrollmentSemesters) : apiGet('/api/training/semesters'),
      apiGet('/api/training/enrollments')
    ]);
    enrollmentSemesters = semesters;
    records = allRows;
    renderTrainingEnrollments(page);
  } catch (error) {
    view.innerHTML = `<section class="workspace-panel empty-state">${esc(error.message)}</section>`;
  }
}

function renderTrainingEnrollments(page = 1) {
  const { semester, status, q } = enrollmentFilterState;
  const keyword = (q || '').trim().toLocaleLowerCase('vi');
  const pendingTotal = records.filter(r => r.status === 'PENDING').length;
  const enrolledTotal = records.filter(r => r.status === 'ENROLLED').length;
  const overdueTotal = records.filter(r => r.status === 'ENROLLED' && r.pastStudentDropWindow).length;
  const cancelledTotal = records.filter(r => r.status === 'CANCELLED').length;

  const filtered = records.filter(r =>
    (!semester || r.semesterCode === semester) &&
    (!status || r.status === status) &&
    (!keyword || `${r.studentCode} ${r.studentName} ${r.courseCode} ${r.courseName} ${r.sectionCode}`.toLocaleLowerCase('vi').includes(keyword))
  );
  const editable = account.permissions?.includes('TRAINING_MANAGE');
  const pages = Math.max(1, Math.ceil(filtered.length / 50));
  page = Math.min(Math.max(1, page), pages);
  const offset = (page - 1) * 50;
  const fmtTime = r => !r.enrolledAt ? '—' : r.enrollmentDateOnly
    ? new Date(r.enrolledAt).toLocaleDateString('vi-VN')
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(r.enrolledAt));

  const rowsHtml = filtered.slice(offset, offset + 50).map(r => {
    let actionsHtml = '';
    if (editable) {
      if (r.status === 'PENDING') {
        actionsHtml = `<div class="row-actions">
          <button type="button" class="btn-approve" data-approve-id="${r.id}">Duyệt</button>
          <button type="button" class="curriculum-course-delete" data-reject-id="${r.id}" data-label="${esc(r.studentCode + ' · ' + r.courseCode)}">Từ chối</button>
        </div>`;
      } else if (r.status === 'ENROLLED') {
        actionsHtml = `<div class="row-actions">
          <button type="button" class="curriculum-course-delete" data-admindrop-id="${r.id}" data-label="${esc(r.studentCode + ' · ' + r.courseCode)}">Hủy hộ SV</button>
        </div>`;
      }
    }
    return `<tr>
      <td><strong>${esc(r.studentCode)} · ${esc(r.studentName)}</strong><small>${esc(r.program || '—')} · ${esc(r.cohort || '—')}</small></td>
      <td><strong>${esc(r.semesterName)}</strong><small>${esc(r.semesterCode)}</small></td>
      <td><strong>${esc(r.courseCode)} · ${esc(r.courseName)}</strong><small>Lớp ${esc(r.sectionCode)} · ${r.credits} TC · ${esc(r.schedule)}</small></td>
      <td>${number(r.enrolledCount)} / ${number(r.capacity)}</td>
      <td>${statusCell(r.status)}${r.status === 'ENROLLED' && r.pastStudentDropWindow ? '<span class="overdue-tag">Quá hạn tự hủy</span>' : ''}</td>
      <td>${esc(fmtTime(r))}</td>
      ${editable ? `<td>${actionsHtml}</td>` : ''}
    </tr>`;
  }).join('');

  view.innerHTML = `
    <div class="workspace-stats">
      ${statCard('Chờ xác nhận (PENDING)', pendingTotal, 'Cần Ban Đào tạo duyệt / từ chối')}
      ${statCard('Đang đăng ký (ENROLLED)', enrolledTotal, 'Đang tính vào sĩ số lớp')}
      ${statCard('Quá hạn tự hủy 7 ngày', overdueTotal, 'Chỉ Ban Đào tạo mới hủy được')}
      ${statCard('Đã hủy / Từ chối', cancelledTotal)}
    </div>
    <section class="workspace-panel">
      <div class="enrollment-filters">
        <label>Học kỳ
          <select id="enrollmentSemesterFilter">
            <option value="">Tất cả học kỳ</option>
            ${enrollmentSemesters.map(s => `<option value="${esc(s.code)}" ${s.code === semester ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
          </select>
        </label>
        <label>Trạng thái
          <select id="enrollmentStatusFilter">
            <option value="">Tất cả trạng thái</option>
            <option value="PENDING" ${status === 'PENDING' ? 'selected' : ''}>Chờ xác nhận (PENDING)</option>
            <option value="ENROLLED" ${status === 'ENROLLED' ? 'selected' : ''}>Đang đăng ký (ENROLLED)</option>
            <option value="CANCELLED" ${status === 'CANCELLED' ? 'selected' : ''}>Đã hủy (CANCELLED)</option>
          </select>
        </label>
        <label>Tìm kiếm sinh viên / môn / lớp
          <input type="search" id="enrollmentQueryInput" value="${esc(q)}" placeholder="Nhập mã SV, họ tên, mã môn hoặc mã lớp…">
        </label>
        <button type="button" class="secondary-button" id="exportEnrollmentsCsv">Xuất CSV</button>
      </div>
      <div class="workspace-table-wrap">
        <table class="workspace-table">
          <thead>
            <tr><th>Sinh viên</th><th>Học kỳ</th><th>Học phần & Lớp</th><th>Sĩ số</th><th>Trạng thái</th><th>Thời gian</th>${editable ? '<th>Thao tác</th>' : ''}</tr>
          </thead>
          <tbody>
            ${rowsHtml || `<tr><td colspan="${editable ? 7 : 6}" class="empty-state">Không có bản ghi đăng ký phù hợp với bộ lọc.</td></tr>`}
          </tbody>
        </table>
      </div>
      ${pages > 1 ? `<nav aria-label="Phân trang đăng ký"><button type="button" class="secondary-button" id="enrollPrev" ${page === 1 ? 'disabled' : ''}>Trang trước</button><span> Trang ${page} / ${pages} </span><button type="button" class="secondary-button" id="enrollNext" ${page === pages ? 'disabled' : ''}>Trang sau</button></nav>` : ''}
      <p class="table-summary">${number(filtered.length)} bản ghi</p>
    </section>`;

  $('#enrollmentSemesterFilter').addEventListener('change', e => { enrollmentFilterState.semester = e.target.value; renderTrainingEnrollments(1); });
  $('#enrollmentStatusFilter').addEventListener('change', e => { enrollmentFilterState.status = e.target.value; renderTrainingEnrollments(1); });
  $('#enrollmentQueryInput').addEventListener('input', e => {
    const val = e.target.value;
    enrollmentFilterState.q = val;
    renderTrainingEnrollments(1);
    const input = $('#enrollmentQueryInput');
    input.focus();
    input.setSelectionRange(val.length, val.length);
  });
  $('#enrollPrev')?.addEventListener('click', () => renderTrainingEnrollments(page - 1));
  $('#enrollNext')?.addEventListener('click', () => renderTrainingEnrollments(page + 1));
  $('#exportEnrollmentsCsv').addEventListener('click', () => exportCsv('quan-ly-dang-ky', [
    ['studentCode', 'Mã SV'], ['studentName', 'Họ tên'], ['semesterCode', 'Học kỳ'],
    ['courseCode', 'Mã môn'], ['courseName', 'Tên môn'], ['sectionCode', 'Mã lớp'],
    ['credits', 'Tín chỉ'], ['status', 'Trạng thái'], ['enrolledAt', 'Thời gian']
  ], filtered));

  view.querySelectorAll('[data-approve-id]').forEach(btn => btn.addEventListener('click', async () => {
    if (!window.confirm('Xác nhận duyệt bản ghi đăng ký chờ xác nhận này vào danh sách lớp chính thức?')) return;
    try {
      const res = await apiPost(`/api/training/enrollments/${encodeURIComponent(btn.dataset.approveId)}/approve`, {});
      showToast(res.message || 'Đã duyệt đăng ký.');
      await loadTrainingEnrollments(page);
    } catch (error) { showToast(error.message); }
  }));

  view.querySelectorAll('[data-reject-id]').forEach(btn => btn.addEventListener('click', async () => {
    const reason = window.prompt(`Nhập lý do từ chối đăng ký (${btn.dataset.label}) — có thể để trống:`, '');
    if (reason === null) return;
    try {
      const res = await apiPost(`/api/training/enrollments/${encodeURIComponent(btn.dataset.rejectId)}/reject`, { reason });
      showToast(res.message || 'Đã từ chối đăng ký.');
      await loadTrainingEnrollments(page);
    } catch (error) { showToast(error.message); }
  }));

  view.querySelectorAll('[data-admindrop-id]').forEach(btn => btn.addEventListener('click', async () => {
    const reason = window.prompt(`Xác nhận hủy học phần hộ sinh viên (${btn.dataset.label}). Nhập ghi chú / lý do duyệt hủy (có thể để trống):`, '');
    if (reason === null) return;
    try {
      const res = await apiPost(`/api/training/enrollments/${encodeURIComponent(btn.dataset.admindropId)}/admin-drop`, { reason });
      showToast(res.message || 'Đã hủy học phần cho sinh viên.');
      await loadTrainingEnrollments(page);
    } catch (error) { showToast(error.message); }
  }));
}
async function loadRoster() {
  const data=await apiGet(`/api/workspace/lecturer${selectedLecturerSemester?`?semester=${encodeURIComponent(selectedLecturerSemester)}`:''}`);
  setPageHeader('Danh sách sinh viên','Chọn lớp được phân công để xem sinh viên đang theo học.');
  const rows=data.sections.map(section=>`<tr><td><strong>${esc(section.sectionCode)}</strong><small>${esc(section.courseCode)} · ${esc(section.courseName)}</small></td><td>${esc(section.schedule)}</td><td>${esc(section.room)}</td><td>${number(section.studentCount)} / ${number(section.capacity)}</td><td><button type="button" class="secondary-button" data-roster="${esc(section.id)}" data-title="${esc(section.sectionCode)}">Xem danh sách</button></td></tr>`).join('');
  view.innerHTML=`<section class="workspace-panel"><div class="workspace-table-wrap"><table class="workspace-table"><thead><tr><th>Lớp học phần</th><th>Lịch</th><th>Phòng</th><th>Sĩ số</th><th></th></tr></thead><tbody>${rows||'<tr><td class="empty-state" colspan="5">Bạn chưa được phân công lớp học phần nào.</td></tr>'}</tbody></table></div></section>`;
  view.querySelectorAll('[data-roster]').forEach(button=>button.addEventListener('click',async()=>{
    setPageHeader(`Danh sách ${button.dataset.title}`,'Sinh viên đang đăng ký lớp học phần.');view.innerHTML='<div class="workspace-loading">Đang tải danh sách…</div>';
    try{
      const students=await apiGet(`/api/workspace/lecturer/sections/${encodeURIComponent(button.dataset.roster)}/students`);
      const columns=[['studentCode','Mã sinh viên'],['fullName','Họ và tên'],['program','Ngành / khóa'],['email','Email'],['status','Trạng thái']];
      const panel=`<section class="workspace-panel"><div class="roster-toolbar"><input id="rosterSearch" class="workspace-search" type="search" placeholder="Tìm mã sinh viên, họ tên hoặc email…"><label>Sắp xếp<select id="rosterSort"><option value="studentCode">Mã sinh viên</option><option value="fullName">Họ tên</option><option value="program">Ngành</option></select></label><button id="exportRoster" class="secondary-button" type="button">Xuất CSV</button></div><div id="rosterTable"></div></section>`;
      view.innerHTML=panel;
      const rosterRows=students.map(student=>({...student,program:student.program||'—',status:student.status==='ENROLLED'?'Đang đăng ký':student.status}));
      const updateRoster=()=>{const q=$('#rosterSearch').value.toLocaleLowerCase('vi'),sort=$('#rosterSort').value;const visible=rosterRows.filter(student=>JSON.stringify(student).toLocaleLowerCase('vi').includes(q)).sort((a,b)=>String(a[sort]||'').localeCompare(String(b[sort]||''),'vi'));$('#rosterTable').innerHTML=tableMarkup(columns,visible,'Không tìm thấy sinh viên phù hợp.');$('#exportRoster').onclick=()=>exportCsv(`danh-sach-${button.dataset.title}`,columns,visible);};
      updateRoster();$('#rosterSearch').addEventListener('input',updateRoster);$('#rosterSort').addEventListener('change',updateRoster);
    }
    catch(error){view.innerHTML=`<section class="workspace-panel empty-state">${esc(error.message)}</section>`;}
  }));
}

async function loadPermissions() {
  setPageHeader('Quản lý phân quyền', 'Cấu hình quyền nghiệp vụ được áp dụng trực tiếp cho các API theo từng vai trò.');
  view.innerHTML='<div class="workspace-loading">Đang tải cấu hình quyền…</div>';
  try {
    const roles=await apiGet('/api/admin/permissions');
    const cards=roles.map(role=>`<article class="permission-role"><div class="permission-role-head"><strong>${esc(role.roleLabel)}</strong><small>${esc(role.role)}</small></div><form data-permission-role="${esc(role.role)}"><div class="permission-list">${role.permissions.map(permission=>{
      const locked=role.role==='ADMIN'&&['PERMISSIONS_MANAGE','ACCOUNTS_MANAGE'].includes(permission.key);
      return `<label class="permission-option"><input type="checkbox" name="permission" value="${esc(permission.key)}" ${role.granted.includes(permission.key)?'checked':''} ${locked?'disabled checked':''}><span><strong>${esc(permission.label)}</strong><small>${esc(permission.description)}</small></span></label>`;
    }).join('')}</div><button type="submit" class="primary-button">Lưu quyền</button></form></article>`).join('');
    view.innerHTML=`<section class="workspace-panel"><p class="permission-note">Thay đổi có hiệu lực ngay với API được bảo vệ. Tài khoản ADMIN luôn giữ quyền quản lý tài khoản và phân quyền.</p><div class="permission-grid">${cards}</div></section>`;
    view.querySelectorAll('[data-permission-role]').forEach(form=>form.addEventListener('submit',async event=>{
      event.preventDefault();const permissions=[...form.querySelectorAll('input[name="permission"]:checked')].map(input=>input.value);
      try{const result=await apiPut(`/api/admin/permissions/${encodeURIComponent(form.dataset.permissionRole)}`,{permissions});showToast(result.message||'Đã cập nhật quyền.');await loadPermissions();}
      catch(error){showToast(error.message);}
    }));
  } catch(error) { view.innerHTML=`<section class="workspace-panel empty-state">${esc(error.message)}</section>`; }
}

nav.addEventListener('click',event=>{const button=event.target.closest('[data-page]');if(button)openPage(button.dataset.page);});
$('#dialogSave').addEventListener('click',saveRecord);
$('#closeCurriculumCourses').addEventListener('click',()=>$('#curriculumCoursesDialog').close());
$('#curriculumCourseForm').addEventListener('submit',async event=>{event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget).entries());data.requiredCourse=event.currentTarget.elements.requiredCourse.checked;data.orderIndex=Number(data.orderIndex||0);try{await apiPost(`/api/training/curricula/${encodeURIComponent(selectedCurriculumCode)}/courses`,data);event.currentTarget.reset();event.currentTarget.elements.requiredCourse.checked=true;event.currentTarget.elements.orderIndex.value='0';await reloadCurriculumCourses();showToast('Đã thêm môn vào khung chương trình.');}catch(error){showToast(error.message);}});
$('#logoutButton').addEventListener('click',async()=>{try{await apiPost('/api/auth/logout',{});}catch{}location.replace('/login.html');});
try {
  account=await apiGet('/api/auth/me');
  if(account.role==='STUDENT')location.replace('/');
  else {
    if(account.role==='LECTURER'||account.role==='TRAINING_OFFICE') {
      const logoutButton=$('#logoutButton');
      logoutButton.className='top-logout-button';
      $('#workspaceTopActions').append(logoutButton);
    }
    $('#identityName').textContent=account.displayName;$('#identityRole').textContent=roleNames[account.role]||account.role;
    $('#identityAvatar').textContent=account.displayName.split(/\s+/).slice(-2).map(word=>word[0]).join('').toLocaleUpperCase('vi');
    $('#semesterLabel').textContent=account.semester||'Không có học kỳ';menuFor(account.role);await openPage('overview');
  }
} catch(error) { view.innerHTML=`<div class="workspace-loading">${esc(error.message)}</div>`; }
