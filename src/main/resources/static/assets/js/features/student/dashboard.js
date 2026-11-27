import { apiGet, apiPost } from '../../core/api.js';
import { initFutureShell } from '../../core/future-shell.js?v=20261127gn';
import { createScheduleController } from './schedule/schedule-app.js?v=20261125l';
import { createHistoryController } from './history/history-app.js?v=20261125h';
import { createTranscriptController } from './transcript/transcript-app.js?v=20261125j';
import { createCurriculumController } from './curriculum/curriculum-app.js?v=20261125f';
import { createLecturersController } from './lecturers/lecturers-app.js?v=20261125l';
import { createAssistantController } from './assistant/assistant-app.js?v=20261127sl';

const state = {
  courses: [],
  registered: [],
  credits: 0,
  maxCredits: 20,
  filter: 'all',
  query: '',
  department: '',
  weekday: '',
  creditsFilter: '',
  sort: 'code',
  page: 1,
  loaded: false,
  activeView: 'overview',
  advOpen: false,
  lastNumbers: {}
};

const $ = selector => document.querySelector(selector);
const list = $('#courseList');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const monogram = name => String(name || 'HP').split(/\s+/).slice(-2).map(part => part[0] || '').join('').toUpperCase() || 'HP';
const formatDate = value => value ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : 'Chưa thiết lập';
const WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
const WEEKDAY_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const prefersReducedMotion = () =>
  Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

function courseSessions(course) {
  if (!course.meetings?.length) return [course];
  return course.meetings.map(meeting => ({
    ...course,
    schedule: `${WEEKDAYS[meeting.dayOfWeek - 1] || 'Chưa xếp lịch'} · ${meeting.startsAt && meeting.endsAt ? `${meeting.startsAt.slice(0, 5)} – ${meeting.endsAt.slice(0, 5)}` : 'Giờ học cần xác nhận'}${meeting.weeksExpression ? ` · Tuần ${meeting.weeksExpression}` : ''}`,
    room: meeting.room || 'Chưa có phòng',
    meetingDay: meeting.dayOfWeek,
    meetingValid: meeting.valid
  }));
}

function animateNumber(el, target, { key = null, duration = 480, pad = 0 } = {}) {
  if (!el) return;
  const num = Number(target) || 0;
  const format = v => pad > 0 ? String(Math.round(v)).padStart(pad, '0') : String(Math.round(v));
  const prev = key && state.lastNumbers[key] !== undefined ? state.lastNumbers[key] : null;
  if (key) state.lastNumbers[key] = num;

  if (prefersReducedMotion() || prev === num) {
    el.textContent = format(num);
    return;
  }

  const from = prev !== null ? prev : 0;
  const start = performance.now();
  const tick = now => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = format(from + (num - from) * eased);
    if (progress < 1) requestAnimationFrame(tick);
    else el.textContent = format(num);
  };
  requestAnimationFrame(tick);
}

const entranceTimers = new WeakMap();
function triggerSectionEntrance(sectionEl) {
  if (!sectionEl || prefersReducedMotion()) return;
  const oldTimer = entranceTimers.get(sectionEl);
  if (oldTimer) window.clearTimeout(oldTimer);
  sectionEl.classList.remove('is-entering');
  void sectionEl.offsetWidth;
  sectionEl.classList.add('is-entering');
  const timer = window.setTimeout(() => sectionEl.classList.remove('is-entering'), 620);
  entranceTimers.set(sectionEl, timer);
}

function renderInitialSkeletons() {
  const skelCard = `
    <div class="dash-skeleton-card" aria-hidden="true">
      <div class="dash-skel dash-skel-box"></div>
      <div class="dash-skel-lines">
        <div class="dash-skel dash-skel-line w-60"></div>
        <div class="dash-skel dash-skel-line w-85"></div>
      </div>
      <div class="dash-skel dash-skel-btn"></div>
    </div>`;
  const ovList = $('#ovRegisteredList');
  if (ovList && !state.loaded) ovList.innerHTML = `<div class="dash-skeleton-list">${skelCard.repeat(3)}</div>`;
  if (list && !state.loaded) list.innerHTML = `<div class="dash-skeleton-list">${skelCard.repeat(4)}</div>`;
}

function renderOverviewWidgets() {
  const openCount = state.courses.length;
  const availableCount = state.courses.filter(c => (c.capacity - c.enrolled) > 0).length;
  const fullCount = openCount - availableCount;

  animateNumber($('#ovOpenCoursesCount'), openCount, { key: 'ovOpen' });
  const availSub = $('#ovAvailableCoursesSub');
  if (availSub) {
    availSub.textContent = openCount
      ? `${availableCount} lớp còn chỗ · ${fullCount} lớp đã đủ sĩ số`
      : 'Hiện chưa có lớp mở trong học kỳ';
  }

  animateNumber($('#ovRegisteredCount'), state.registered.length, { key: 'ovRegCount' });
  const ovRegSem = $('#ovRegisteredSemester');
  if (ovRegSem) ovRegSem.textContent = state.semesterName || 'Học kỳ hiện tại';

  const ovList = $('#ovRegisteredList');
  if (ovList) {
    if (!state.registered.length) {
      ovList.innerHTML = `
        <div class="ov-empty-box">
          <strong>Bạn chưa đăng ký học phần nào</strong>
          <p>Chuyển sang mục Đăng ký học phần để tìm kiếm lớp đang mở và sắp xếp lịch học phù hợp.</p>
          <button class="dash-btn dash-btn-primary" type="button" data-ov-empty-go="courses">Đi tới Đăng ký học phần →</button>
        </div>`;
    } else {
      ovList.innerHTML = state.registered.map((course, idx) => `
        <div class="ov-enrolled-item" style="--item-i:${Math.min(idx, 10)}">
          <span class="ov-enrolled-stripe ${escapeHtml(course.color || 'lavender')}"></span>
          <div class="ov-enrolled-copy">
            <div class="ov-enrolled-top">
              <span class="ov-enrolled-code">${escapeHtml(course.code)}</span>
              <strong>${escapeHtml(course.name)}</strong>
            </div>
            <div class="ov-enrolled-meta">
              <span>${escapeHtml(course.schedule)}</span>
              <span>· ${escapeHtml(course.room || 'Chưa có phòng')}</span>
              <span>· ${course.credits} tín chỉ</span>
            </div>
          </div>
          <div class="ov-enrolled-actions">
            <button class="ov-mini-btn" type="button" data-details="${escapeHtml(course.id)}">Chi tiết</button>
            <button class="ov-mini-btn is-danger" type="button" data-action="drop" data-id="${escapeHtml(course.id)}">Hủy lớp</button>
          </div>
        </div>`).join('');
    }
  }

  const weekPreview = $('#ovWeekPreview');
  if (weekPreview) {
    const byDay = new Map(WEEKDAYS.map(day => [day, []]));
    state.registered.flatMap(courseSessions).forEach(session => {
      const day = WEEKDAYS.find(d => String(session.schedule || '').startsWith(d));
      if (day) byDay.get(day).push(session);
    });
    const activeEntries = [...byDay.entries()].filter(([, items]) => items.length > 0);
    if (!activeEntries.length) {
      weekPreview.innerHTML = `
        <div class="ov-empty-box" style="grid-column:1 / -1">
          <strong>Chưa có lịch học trong tuần</strong>
          <p>Các buổi học sẽ tự động hiển thị tại đây ngay sau khi bạn đăng ký lớp học phần.</p>
        </div>`;
    } else {
      weekPreview.innerHTML = activeEntries.map(([day, items]) => `
        <div class="ov-week-day">
          <div class="ov-week-day-head">
            <strong>${escapeHtml(day)}</strong>
            <span>${items.length} lớp</span>
          </div>
          ${items.map(item => {
            const timePart = String(item.schedule || '').split(' · ').slice(1).join(' · ');
            return `
              <div class="ov-week-slot">
                <strong>${escapeHtml(item.code)} · ${escapeHtml(item.name)}</strong>
                <small>${escapeHtml(timePart || 'Đang cập nhật giờ')} · ${escapeHtml(item.room || 'Chưa có phòng')}</small>
              </div>`;
          }).join('')}
        </div>`).join('');
    }
  }
}

function renderRegistrationStats() {
  const pct = state.maxCredits > 0 ? Math.min(100, (state.credits / state.maxCredits) * 100) : 0;
  const availableCount = state.courses.filter(c => (c.capacity - c.enrolled) > 0).length;

  animateNumber($('#regStatCredits'), state.credits, { key: 'regCredits' });
  const limitEl = $('#regStatCreditLimit');
  if (limitEl) limitEl.textContent = `/ ${state.maxCredits} tín chỉ`;
  const progEl = $('#regStatProgress');
  if (progEl) progEl.style.width = `${pct}%`;

  animateNumber($('#regStatTotal'), state.courses.length, { key: 'regTotal' });
  animateNumber($('#regStatAvailable'), availableCount, { key: 'regAvail' });
  animateNumber($('#regStatEnrolled'), state.registered.length, { key: 'regEnrolled' });

  const deadlineSub = $('#regStatDeadlineSub');
  if (deadlineSub) {
    deadlineSub.textContent = state.registrationAlwaysOpen
      ? 'Mở đăng ký liên tục'
      : `Hạn: ${formatDate(state.registrationCloseAt)}`;
  }

  const cartText = $('#regCartCreditsText');
  if (cartText) cartText.textContent = `${state.credits} / ${state.maxCredits} TC`;
  const cartProg = $('#regCartProgress');
  if (cartProg) cartProg.style.width = `${pct}%`;
}

async function loadDashboard() {
  if (!state.loaded) renderInitialSkeletons();
  const currentAccount = await apiGet('/api/auth/me');
  if (currentAccount.role !== 'STUDENT') {
    location.replace('/workspace.html');
    return;
  }

  Object.assign(state, await apiGet('/api/dashboard'));
  state.loaded = true;

  $('#copyrightYear').textContent = new Date().getFullYear();
  const initials = monogram(state.student.name);
  $('#sidebarName').textContent = state.student.name;
  $('#topName').textContent = state.student.name;
  $('#sidebarAvatar').textContent = initials;
  $('#topAvatar').textContent = initials;
  $('#welcomeName').textContent = state.student.name.split(' ').at(-1);
  $('#sidebarId').textContent = state.student.id;
  $('#semesterName').textContent = state.semesterName;
  $('#registeredSemester').textContent = state.semesterName;

  const ovSemBadge = $('#ovSemesterBadge');
  if (ovSemBadge) ovSemBadge.textContent = state.semesterName;
  const regSemBadge = $('#regSemesterBadge');
  if (regSemBadge) regSemBadge.textContent = state.semesterName;

  const statusPill = $('#registrationStatus');
  if (statusPill) {
    statusPill.innerHTML = `<span class="ov-status-dot"></span><span>${state.registrationOpen ? 'CỔNG ĐĂNG KÝ ĐANG MỞ' : 'CỔNG ĐĂNG KÝ ĐANG ĐÓNG'}</span>`;
    statusPill.classList.toggle('is-closed', !state.registrationOpen);
  }

  const statusCard = $('#registrationStatusCard');
  if (statusCard) {
    statusCard.textContent = state.registrationOpen ? 'Đang mở đăng ký' : 'Đã đóng đăng ký';
  }

  $('#registrationDeadline').textContent = state.registrationAlwaysOpen ? 'Đến khi có thông báo' : formatDate(state.registrationCloseAt);
  $('#registrationDates').textContent = state.registrationAlwaysOpen
    ? 'Mở đăng ký liên tục (tạm thời)'
    : `${formatDate(state.registrationOpenAt)} – ${formatDate(state.registrationCloseAt)}`;

  const openBadge = document.querySelector('#coursesViewSection .open-badge');
  if (openBadge) {
    openBadge.innerHTML = `<i></i> ${state.registrationOpen ? 'ĐANG MỞ' : 'ĐANG ĐÓNG'}`;
    openBadge.classList.toggle('closed', !state.registrationOpen);
  }

  const pickerStrong = document.querySelector('.semester-picker strong');
  if (pickerStrong) pickerStrong.textContent = state.semesterName;

  animateNumber($('#creditValue'), state.credits, { key: 'ovCredits' });
  $('#creditLimitLabel').textContent = `/ ${state.maxCredits} tín chỉ`;
  const pct = state.maxCredits > 0 ? Math.min(100, (state.credits / state.maxCredits) * 100) : 0;
  $('#creditProgress').style.width = `${pct}%`;
  $('#courseCount').textContent = `${state.registered.length} học phần đã đăng ký`;

  const policyText = state.registrationAlwaysOpen && !state.semesterStartsAt
    ? 'Đang mở đăng ký và hủy lớp tạm thời. Thời hạn chính thức sẽ được cập nhật khi có ngày bắt đầu học kỳ.'
    : `Bạn có thể tự hủy học phần trong ${state.dropWindowDays} ngày đầu học kỳ. Sau thời hạn này, vui lòng liên hệ Ban Đào tạo.`;
  $('#dropPolicy').textContent = policyText;
  const regPolicy = $('#regDropPolicy');
  if (regPolicy) regPolicy.textContent = policyText;

  animateNumber($('#registeredCount'), state.registered.length, { key: 'cartCount', pad: 2 });

  const activeDays = new Set(
    state.registered
      .flatMap(courseSessions)
      .map(course => String(course.schedule || '').split(' · ')[0])
      .filter(day => WEEKDAYS.includes(day))
  );
  animateNumber($('#weekdayCount'), activeDays.size, { key: 'ovDays' });
  $('#weekdayDots').setAttribute('aria-label', activeDays.size ? `Lịch học ${[...activeDays].join(', ')}` : 'Chưa có ngày học');
  $('#weekdayDots').innerHTML = WEEKDAYS.map((day, idx) => `<span class="${activeDays.has(day) ? 'on' : ''}">${WEEKDAY_SHORT[idx]}</span>`).join('');

  const departments = [...new Set(state.courses.map(course => course.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
  const departmentFilter = $('#departmentFilter');
  departmentFilter.innerHTML = '<option value="">Tất cả khoa</option>' + departments.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  departmentFilter.value = state.department;

  const creditOptions = [...new Set(state.courses.map(course => course.credits))].sort((a, b) => a - b);
  $('#creditFilter').innerHTML = '<option value="">Tất cả</option>' + creditOptions.map(c => `<option value="${c}">${c} tín chỉ</option>`).join('');
  $('#creditFilter').value = state.creditsFilter;

  renderOverviewWidgets();
  renderRegistrationStats();
  syncRegistrationToolbarState();
  renderCourses({ crossfade: false });
  renderRegistered();
  syncFutureNotifications();
}

function countAdvancedFilters() {
  let n = 0;
  if (state.department) n++;
  if (state.weekday) n++;
  if (state.creditsFilter) n++;
  if (state.sort && state.sort !== 'code') n++;
  return n;
}

function hasAnyRegFilter() {
  return Boolean(state.query.trim() || state.filter !== 'all' || countAdvancedFilters() > 0);
}

function syncRegistrationToolbarState() {
  const hasQuery = Boolean(state.query.trim());
  $('#regSearchWrap')?.classList.toggle('has-value', hasQuery);
  $('#regSearchClearBtn')?.classList.toggle('is-visible', hasQuery);

  const advCount = countAdvancedFilters();
  const advBadge = $('#regAdvCount');
  if (advBadge) {
    advBadge.textContent = String(advCount);
    advBadge.classList.toggle('hidden', advCount === 0);
  }
  $('#regResetAllBtn')?.classList.toggle('hidden', !hasAnyRegFilter());
}

function resetRegistrationFilters() {
  state.filter = 'all';
  state.query = '';
  state.department = '';
  state.weekday = '';
  state.creditsFilter = '';
  state.sort = 'code';
  state.page = 1;

  const searchInput = $('#searchInput');
  if (searchInput) searchInput.value = '';
  if ($('#departmentFilter')) $('#departmentFilter').value = '';
  if ($('#weekdayFilter')) $('#weekdayFilter').value = '';
  if ($('#creditFilter')) $('#creditFilter').value = '';
  if ($('#sortFilter')) $('#sortFilter').value = 'code';

  document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.filter === 'all');
  });

  syncRegistrationToolbarState();
  renderCourses({ crossfade: true });
}

function renderCourses({ crossfade = false } = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const registrationNotStarted = Boolean(!state.registrationAlwaysOpen && state.registrationOpenAt && new Date(`${state.registrationOpenAt}T00:00:00`) > today);

  const queryNorm = state.query.trim().toLocaleLowerCase('vi');
  const filtered = state.courses.filter(course => {
    const matchesQuery = !queryNorm || `${course.code} ${course.name} ${course.department} ${course.instructor} ${course.schedule}`.toLocaleLowerCase('vi').includes(queryNorm);
    const matchesFilter = state.filter === 'all'
      || (state.filter === 'available' && course.enrolled < course.capacity)
      || (state.filter === 'full' && course.enrolled >= course.capacity)
      || (state.filter === 'registered' && course.registered);
    const matchesDepartment = !state.department || course.department === state.department;
    const matchesWeekday = !state.weekday || courseSessions(course).some(session => String(session.schedule || '').startsWith(state.weekday));
    const matchesCredits = !state.creditsFilter || String(course.credits) === state.creditsFilter;
    return matchesQuery && matchesFilter && matchesDepartment && matchesWeekday && matchesCredits;
  }).sort((a, b) => {
    if (state.sort === 'name') return a.name.localeCompare(b.name, 'vi');
    if (state.sort === 'credits') return a.credits - b.credits || a.code.localeCompare(b.code);
    if (state.sort === 'seats') return (b.capacity - b.enrolled) - (a.capacity - a.enrolled);
    return a.code.localeCompare(b.code, 'vi');
  });

  $('#visibleCount').textContent = filtered.length;
  $('#emptyState').classList.toggle('hidden', filtered.length > 0);
  list.classList.toggle('hidden', filtered.length === 0);

  const pages = Math.max(1, Math.ceil(filtered.length / 50));
  state.page = Math.min(state.page || 1, pages);
  let pager = $('#coursePager');
  if (!pager) {
    pager = document.createElement('nav');
    pager.id = 'coursePager';
    pager.setAttribute('aria-label', 'Phân trang lớp học phần');
    list.insertAdjacentElement('afterend', pager);
  }
  pager.innerHTML = filtered.length > 50
    ? `<button type="button" class="dash-btn" data-page-step="-1" ${state.page === 1 ? 'disabled' : ''}>← Trang trước</button><span>Trang <strong>${state.page}</strong> / ${pages} · ${filtered.length} lớp</span><button type="button" class="dash-btn" data-page-step="1" ${state.page === pages ? 'disabled' : ''}>Trang sau →</button>`
    : '';
  pager.querySelectorAll('[data-page-step]').forEach(button => {
    button.addEventListener('click', () => {
      state.page += Number(button.dataset.pageStep);
      renderCourses({ crossfade: true });
      list.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    });
  });

  const clockSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
  const userSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  const pinSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>';

  const pageSlice = filtered.slice((state.page - 1) * 50, state.page * 50);
  list.innerHTML = pageSlice.map((course, idx) => {
    const available = Math.max(0, course.capacity - course.enrolled);
    const isFull = available <= 0;
    const isLow = !isFull && available <= 5;
    const seatClass = isFull ? 'is-full' : isLow ? 'is-low' : '';

    const action = course.registered
      ? `<button class="reg-card-btn is-drop" type="button" data-action="drop" data-id="${escapeHtml(course.id)}">Hủy lớp</button>`
      : course.waitlisted
        ? `<button class="reg-card-btn is-drop" type="button" data-action="waitlist/leave" data-id="${escapeHtml(course.id)}">Rời hàng chờ #${course.waitlistPosition}</button>`
        : !state.registrationOpen
          ? `<button class="reg-card-btn" type="button" disabled>${registrationNotStarted ? 'Chưa đến đợt ĐK' : 'Đã hết đợt ĐK'}</button>`
          : course.scheduleReviewRequired
            ? '<button class="reg-card-btn" type="button" disabled>Chờ xác nhận lịch</button>'
            : `<button class="reg-card-btn ${isFull ? 'is-waitlist' : 'is-enroll'}" type="button" data-action="enroll" data-id="${escapeHtml(course.id)}" ${!course.prerequisiteMet ? 'disabled' : ''} ${!course.prerequisiteMet && course.unmetConditionMessage ? `title="${escapeHtml(course.unmetConditionMessage)}"` : ''}>${!course.prerequisiteMet ? escapeHtml(course.conditionBlockReason || 'Thiếu điều kiện') : isFull ? 'Vào hàng chờ' : 'Đăng ký lớp ↗'}</button>`;

    const conditionText = /^(Tiên quyết|Học trước|Song hành):/i.test(course.prerequisite || '')
      ? escapeHtml(course.prerequisite)
      : `Điều kiện: ${escapeHtml(course.prerequisite || 'Không có')}`;

    return `
      <article class="reg-course-card ${course.registered ? 'is-registered' : ''}" style="--card-i:${Math.min(idx, 12)}">
        <div class="reg-course-symbol ${escapeHtml(course.color || 'lavender')}">${escapeHtml(monogram(course.code))}</div>
        <div class="reg-course-main">
          <div class="reg-course-head">
            <h3>${escapeHtml(course.name)}</h3>
            <span class="reg-code-tag">${escapeHtml(course.code)}</span>
          </div>
          <div class="reg-course-meta">
            <span>${clockSvg}${escapeHtml(course.schedule)}</span>
            <span>${userSvg}${course.lecturerCode
              ? `<button type="button" class="lec-inline-link" data-open-lecturer="${escapeHtml(course.lecturerCode)}" title="Xem hồ sơ giảng viên">${escapeHtml(course.instructor)}</button>`
              : escapeHtml(course.instructor)}</span>
            <span>${pinSvg}${escapeHtml(course.room)}</span>
          </div>
          <div class="reg-course-tags">
            <span class="reg-pill is-credits">${course.credits} tín chỉ</span>
            <span class="reg-pill is-seats ${seatClass}">${isFull ? 'Đã đủ chỗ' : `Còn ${available}/${course.capacity} chỗ`}</span>
            <span class="reg-pill is-prereq">${conditionText}</span>
            ${course.registered ? '<span class="reg-pill is-enrolled">✓ Đã đăng ký</span>' : course.waitlisted ? `<span class="reg-pill is-waitlist">◷ Hàng chờ #${course.waitlistPosition}</span>` : ''}
          </div>
        </div>
        <div class="reg-course-actions">
          ${action}
          <button class="reg-card-btn" type="button" data-details="${escapeHtml(course.id)}">Chi tiết</button>
        </div>
      </article>`;
  }).join('');

  if (crossfade && !prefersReducedMotion()) {
    list.classList.remove('is-updating');
    void list.offsetWidth;
    list.classList.add('is-updating');
  }
}

function renderRegistered() {
  const container = $('#registeredList');
  if (!container) return;
  container.innerHTML = state.registered.length
    ? state.registered.map(course => `
        <div class="reg-cart-item">
          <span class="ov-enrolled-stripe ${escapeHtml(course.color || 'lavender')}"></span>
          <div class="reg-cart-item-body">
            <strong>${escapeHtml(course.code)} · ${escapeHtml(course.name)}</strong>
            <small>${escapeHtml(course.schedule)} · ${course.credits} tín chỉ</small>
          </div>
          <button class="reg-cart-drop" type="button" data-action="drop" data-id="${escapeHtml(course.id)}" title="Hủy học phần" aria-label="Hủy ${escapeHtml(course.code)}">×</button>
        </div>`).join('')
    : '<div class="ov-empty-box"><strong>Chưa có lớp đăng ký</strong><p>Chọn một lớp ở danh sách bên trái để đăng ký ngay.</p></div>';
}

async function changeEnrollment(action, courseId, triggerBtn = null) {
  if (action === 'drop' && !window.confirm('Bạn có chắc muốn hủy đăng ký lớp học phần này?')) return;
  if (triggerBtn) triggerBtn.classList.add('is-busy');
  try {
    const result = await apiPost(`/api/${action}`, { courseId });
    showToast(result.message || 'Đã cập nhật đăng ký.');
    if (result.success) {
      await loadDashboard();
      scheduleController.refresh();
      historyController.refresh();
      curriculumController.refresh();
      assistantController.refreshContext();
    }
  } catch (error) {
    showToast(error.message || 'Không kết nối được máy chủ. Vui lòng thử lại.');
  } finally {
    if (triggerBtn) triggerBtn.classList.remove('is-busy');
  }
}

function showToast(message) {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

let courseModalClosingTimer = null;
let lastCourseModalTrigger = null;

function closeCourseDialogSmooth() {
  const dialog = $('#courseDialog');
  if (!dialog || !dialog.open) return;
  if (prefersReducedMotion()) {
    dialog.close();
    document.body.classList.remove('dash-modal-open');
    lastCourseModalTrigger?.focus?.();
    return;
  }
  window.clearTimeout(courseModalClosingTimer);
  dialog.classList.add('is-closing');
  courseModalClosingTimer = window.setTimeout(() => {
    dialog.classList.remove('is-closing');
    if (dialog.open) dialog.close();
    document.body.classList.remove('dash-modal-open');
    lastCourseModalTrigger?.focus?.();
  }, 170);
}

async function showCourseDetails(sectionId, triggerEl = null) {
  const dialog = $('#courseDialog');
  const body = $('#courseDialogBody');
  lastCourseModalTrigger = triggerEl || document.activeElement;
  $('#courseDialogTitle').textContent = 'Đang tải thông tin…';
  body.innerHTML = '<div class="dialog-empty">Đang lấy dữ liệu lớp học phần…</div>';
  dialog.classList.remove('is-closing');
  if (!dialog.open) dialog.showModal();
  document.body.classList.add('dash-modal-open');

  try {
    const course = await apiGet(`/api/courses/${encodeURIComponent(sectionId)}`);
    $('#courseDialogTitle').textContent = `${course.code} · ${course.name}`;
    const syllabusUrl = safeHttpUrl(course.syllabusUrl);
    body.innerHTML = `
      <dl class="detail-grid">
        <div><dt>Mã lớp học phần</dt><dd>${escapeHtml(course.sectionCode)}</dd></div>
        <div><dt>Số tín chỉ</dt><dd>${course.credits}</dd></div>
        <div><dt>Giảng viên</dt><dd>${course.lecturerCode
          ? `<button type="button" class="lec-inline-link" data-open-lecturer="${escapeHtml(course.lecturerCode)}" title="Xem hồ sơ giảng viên">${escapeHtml(course.instructor)} ↗</button>`
          : escapeHtml(course.instructor)}</dd></div>
        <div><dt>Lịch học</dt><dd>${escapeHtml(course.schedule)}</dd></div>
        <div><dt>Phòng học</dt><dd>${escapeHtml(course.room)}</dd></div>
        <div><dt>Sĩ số</dt><dd>${course.enrolled} / ${course.capacity} · còn ${Math.max(0, course.capacity - course.enrolled)} chỗ</dd></div>
        <div><dt>Điều kiện học phần</dt><dd>${escapeHtml(course.prerequisite || 'Không có')}</dd></div>
        <div><dt>Đề cương môn học</dt><dd>${syllabusUrl ? `<a href="${escapeHtml(syllabusUrl)}" target="_blank" rel="noopener noreferrer">Xem / tải đề cương ↗</a>` : 'Chưa có đề cương'}</dd></div>
        <div class="detail-grid-wide"><dt>Mô tả môn học</dt><dd>${escapeHtml(course.description || 'Chưa có mô tả.')}</dd></div>
        <div><dt>Trạng thái của bạn</dt><dd>${course.registered ? 'Đã đăng ký' : course.waitlisted ? `Danh sách chờ #${course.waitlistPosition}` : course.prerequisiteMet ? 'Có thể đăng ký' : escapeHtml(course.unmetConditionMessage || 'Chưa đủ điều kiện học phần')}</dd></div>
      </dl>
      ${course.meetings?.length ? `<div class="history-table-wrap"><table class="history-table"><thead><tr><th>Buổi học và tuần</th><th>Phòng</th></tr></thead><tbody>${courseSessions(course).map(session => `<tr><td>${escapeHtml(session.schedule)}</td><td>${escapeHtml(session.room)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
  } catch (error) {
    $('#courseDialogTitle').textContent = 'Không tải được thông tin';
    body.innerHTML = `<div class="dialog-empty">${escapeHtml(error.message)}</div>`;
  }
}

/* ==========================================================================
   SPA VIEW NAVIGATION (ZERO PAGE RELOAD, PERMANENT SIDEBAR + TOPBAR)
   ========================================================================== */

const overviewViewSection = $('#overviewViewSection');
const coursesViewSection = $('#coursesViewSection');
const scheduleViewSection = $('#scheduleViewSection');
const historyViewSection = $('#historyViewSection');
const transcriptViewSection = $('#transcriptViewSection');
const curriculumViewSection = $('#curriculumViewSection');
const lecturersViewSection = $('#lecturersViewSection');
const assistantViewSection = $('#assistantViewSection');
const topbarCrumb = $('#topbarCrumb');

const navItems = Array.from(document.querySelectorAll('.main-nav .nav-item'));
const overviewNavLink = document.querySelector('.main-nav a[href="#overview"]');
const coursesNavLink = document.querySelector('.main-nav a[href="#courses"]');

function setActiveNav(targetEl) {
  if (!targetEl) return;
  navItems.forEach(item => item.classList.remove('active'));
  targetEl.classList.add('active');
}

function hideAllViews() {
  overviewViewSection?.classList.add('hidden');
  coursesViewSection?.classList.add('hidden');
  scheduleViewSection?.classList.add('hidden');
  historyViewSection?.classList.add('hidden');
  transcriptViewSection?.classList.add('hidden');
  curriculumViewSection?.classList.add('hidden');
  lecturersViewSection?.classList.add('hidden');
  assistantViewSection?.classList.add('hidden');
}

function showOverviewView() {
  if (!overviewViewSection) return;
  hideAllViews();
  overviewViewSection.classList.remove('hidden');
  state.activeView = 'overview';
  if (topbarCrumb) topbarCrumb.textContent = 'Tổng quan';
  setActiveNav(overviewNavLink);
  history.replaceState(null, '', '#overview');
  window.scrollTo({ top: 0, behavior: 'instant' });
  triggerSectionEntrance(overviewViewSection);
}

function showCoursesView() {
  if (!coursesViewSection) return;
  hideAllViews();
  coursesViewSection.classList.remove('hidden');
  state.activeView = 'courses';
  if (topbarCrumb) topbarCrumb.textContent = 'Đăng ký học phần';
  setActiveNav(coursesNavLink);
  history.replaceState(null, '', '#courses');
  window.scrollTo({ top: 0, behavior: 'instant' });
  triggerSectionEntrance(coursesViewSection);
}

function showScheduleView() {
  if (!scheduleViewSection) return;
  hideAllViews();
  scheduleViewSection.classList.remove('hidden');
  state.activeView = 'schedule';
  if (topbarCrumb) topbarCrumb.textContent = 'Thời khóa biểu';
  setActiveNav($('#scheduleOpen'));
  history.replaceState(null, '', '#schedule-view');
  window.scrollTo({ top: 0, behavior: 'instant' });
  scheduleController.open(state.semesterCode);
}

function showHistoryView() {
  if (!historyViewSection) return;
  hideAllViews();
  historyViewSection.classList.remove('hidden');
  state.activeView = 'history';
  if (topbarCrumb) topbarCrumb.textContent = 'Lịch sử đăng ký';
  setActiveNav($('#historyOpen'));
  history.replaceState(null, '', '#history-view');
  window.scrollTo({ top: 0, behavior: 'instant' });
  historyController.open();
}

function showTranscriptView() {
  if (!transcriptViewSection) return;
  hideAllViews();
  transcriptViewSection.classList.remove('hidden');
  state.activeView = 'transcript';
  if (topbarCrumb) topbarCrumb.textContent = 'Kết quả học tập';
  setActiveNav($('#transcriptOpen'));
  history.replaceState(null, '', '#transcript-view');
  window.scrollTo({ top: 0, behavior: 'instant' });
  transcriptController.open();
}

function showCurriculumView() {
  if (!curriculumViewSection) return;
  hideAllViews();
  curriculumViewSection.classList.remove('hidden');
  state.activeView = 'curriculum';
  if (topbarCrumb) topbarCrumb.textContent = 'Khung chương trình';
  setActiveNav($('#curriculumOpen'));
  history.replaceState(null, '', '#curriculum-view');
  window.scrollTo({ top: 0, behavior: 'instant' });
  curriculumController.open();
}

function showLecturersView() {
  if (!lecturersViewSection) return;
  hideAllViews();
  lecturersViewSection.classList.remove('hidden');
  state.activeView = 'lecturers';
  if (topbarCrumb) topbarCrumb.textContent = 'Đội ngũ giảng viên';
  setActiveNav($('#lecturersOpen'));
  history.replaceState(null, '', '#lecturers-view');
  window.scrollTo({ top: 0, behavior: 'instant' });
  lecturersController.open();
}

function showAssistantView() {
  if (!assistantViewSection) return;
  hideAllViews();
  assistantViewSection.classList.remove('hidden');
  state.activeView = 'assistant';
  if (topbarCrumb) topbarCrumb.textContent = 'Trợ lý AI';
  setActiveNav($('#assistantOpen'));
  history.replaceState(null, '', '#assistant-view');
  window.scrollTo({ top: 0, behavior: 'instant' });
  assistantController.open();
}

function navigateToTarget(target) {
  if (target === 'courses') showCoursesView();
  else if (target === 'schedule') showScheduleView();
  else if (target === 'history') showHistoryView();
  else if (target === 'transcript') showTranscriptView();
  else if (target === 'curriculum') showCurriculumView();
  else if (target === 'lecturers') showLecturersView();
  else if (target === 'assistant') showAssistantView();
  else showOverviewView();
}

/* ==========================================================================
   CONTROLLERS FOR EMBEDDED SUB-VIEWS
   ========================================================================== */

const scheduleController = createScheduleController({
  onToast: showToast,
  onGoToCourses: () => showCoursesView(),
  getStudent: () => ({
    fullName: state.student?.name,
    studentCode: state.student?.id
  })
});

const historyController = createHistoryController({
  onToast: showToast,
  onGoToCourses: () => showCoursesView(),
  onOpenCourseDetails: sectionId => showCourseDetails(sectionId)
});

const transcriptController = createTranscriptController({
  onToast: showToast
});

const curriculumController = createCurriculumController({
  onToast: showToast,
  getEnrolledCourseCodes: () => (state.registered || []).map(c => c.code)
});

const lecturersController = createLecturersController({
  onToast: showToast,
  onOpenCourseDetails: sectionId => showCourseDetails(sectionId)
});

const assistantController = createAssistantController({
  onToast: showToast,
  getContext: () => ({
    studentName: state.student?.name,
    initials: state.student?.name ? monogram(state.student.name) : 'SV',
    semesterName: state.semesterName,
    credits: state.credits,
    maxCredits: state.maxCredits,
    registeredCount: state.registered?.length || 0,
    registrationOpen: state.registrationOpen
  }),
  onNavigate: target => navigateToTarget(target)
});

/* ==========================================================================
   EVENT BINDINGS
   ========================================================================== */

// Sidebar primary links
overviewNavLink?.addEventListener('click', event => {
  event.preventDefault();
  showOverviewView();
});

coursesNavLink?.addEventListener('click', event => {
  event.preventDefault();
  showCoursesView();
});

$('#scheduleOpen')?.addEventListener('click', showScheduleView);
$('#historyOpen')?.addEventListener('click', showHistoryView);
$('#transcriptOpen')?.addEventListener('click', showTranscriptView);
$('#curriculumOpen')?.addEventListener('click', showCurriculumView);
$('#lecturersOpen')?.addEventListener('click', showLecturersView);
$('#assistantOpen')?.addEventListener('click', showAssistantView);

document.querySelector('.brand[href="#top"]')?.addEventListener('click', event => {
  event.preventDefault();
  showOverviewView();
});

document.querySelector('.help-card a[href="#assistant"]')?.addEventListener('click', event => {
  event.preventDefault();
  showAssistantView();
});

// Cross-view back / CTA buttons
$('#ovGoCoursesBtn')?.addEventListener('click', showCoursesView);
$('#ovManageCoursesBtn')?.addEventListener('click', showCoursesView);
$('#ovGoScheduleBtn')?.addEventListener('click', showScheduleView);
$('#ovOpenScheduleLink')?.addEventListener('click', showScheduleView);
$('#regGoScheduleBtn')?.addEventListener('click', showScheduleView);
$('#regBackToOverviewBtn')?.addEventListener('click', showOverviewView);
$('#viewSchedule')?.addEventListener('click', showScheduleView);
$('#btnBackToOverview')?.addEventListener('click', showCoursesView);
$('#histBackToOverviewBtn')?.addEventListener('click', showOverviewView);
$('#trBackToOverviewBtn')?.addEventListener('click', showOverviewView);
$('#curBackToOverviewBtn')?.addEventListener('click', showOverviewView);
$('#lecBackToOverviewBtn')?.addEventListener('click', showOverviewView);
$('#aiBackToOverviewBtn')?.addEventListener('click', showOverviewView);

document.addEventListener('click', event => {
  const lecBtn = event.target.closest('[data-open-lecturer]');
  if (lecBtn) {
    event.preventDefault();
    event.stopPropagation();
    lecturersController.openProfile(lecBtn.dataset.openLecturer, lecBtn);
  }
});

document.querySelectorAll('[data-ov-nav]').forEach(btn => {
  btn.addEventListener('click', () => navigateToTarget(btn.dataset.ovNav));
});

// Overview enrolled list delegation (Details / Drop / Empty CTA)
$('#ovRegisteredList')?.addEventListener('click', event => {
  const goBtn = event.target.closest('[data-ov-empty-go]');
  if (goBtn) { navigateToTarget(goBtn.dataset.ovEmptyGo); return; }
  const detailsBtn = event.target.closest('[data-details]');
  if (detailsBtn) { showCourseDetails(detailsBtn.dataset.details, detailsBtn); return; }
  const actionBtn = event.target.closest('[data-action]');
  if (actionBtn) changeEnrollment(actionBtn.dataset.action, actionBtn.dataset.id, actionBtn);
});

// Course catalog & cart delegation
list?.addEventListener('click', event => {
  const detailsBtn = event.target.closest('[data-details]');
  if (detailsBtn) { showCourseDetails(detailsBtn.dataset.details, detailsBtn); return; }
  const actionBtn = event.target.closest('[data-action]');
  if (actionBtn) changeEnrollment(actionBtn.dataset.action, actionBtn.dataset.id, actionBtn);
});

$('#registeredList')?.addEventListener('click', event => {
  const btn = event.target.closest('[data-action="drop"]');
  if (btn) changeEnrollment('drop', btn.dataset.id, btn);
});

// Course search & filters
$('#searchInput')?.addEventListener('input', event => {
  state.page = 1;
  state.query = event.target.value;
  syncRegistrationToolbarState();
  renderCourses({ crossfade: true });
});

$('#regSearchClearBtn')?.addEventListener('click', () => {
  const input = $('#searchInput');
  if (input) {
    input.value = '';
    input.focus();
  }
  state.page = 1;
  state.query = '';
  syncRegistrationToolbarState();
  renderCourses({ crossfade: true });
});

document.querySelectorAll('.filter-chip').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelector('.filter-chip.selected')?.classList.remove('selected');
    button.classList.add('selected');
    state.filter = button.dataset.filter;
    state.page = 1;
    syncRegistrationToolbarState();
    renderCourses({ crossfade: true });
  });
});

$('#departmentFilter')?.addEventListener('change', event => {
  state.page = 1;
  state.department = event.target.value;
  syncRegistrationToolbarState();
  renderCourses({ crossfade: true });
});

$('#weekdayFilter')?.addEventListener('change', event => {
  state.page = 1;
  state.weekday = event.target.value;
  syncRegistrationToolbarState();
  renderCourses({ crossfade: true });
});

$('#creditFilter')?.addEventListener('change', event => {
  state.page = 1;
  state.creditsFilter = event.target.value;
  syncRegistrationToolbarState();
  renderCourses({ crossfade: true });
});

$('#sortFilter')?.addEventListener('change', event => {
  state.page = 1;
  state.sort = event.target.value;
  syncRegistrationToolbarState();
  renderCourses({ crossfade: true });
});

let advCloseTimer = null;
$('#filterButton')?.addEventListener('click', () => {
  const panel = $('#filterRow');
  const btn = $('#filterButton');
  if (!panel) return;
  window.clearTimeout(advCloseTimer);
  if (panel.classList.contains('hidden')) {
    panel.classList.remove('hidden', 'is-closing');
    state.advOpen = true;
    btn?.setAttribute('aria-expanded', 'true');
  } else if (prefersReducedMotion()) {
    panel.classList.add('hidden');
    state.advOpen = false;
    btn?.setAttribute('aria-expanded', 'false');
  } else {
    panel.classList.add('is-closing');
    state.advOpen = false;
    btn?.setAttribute('aria-expanded', 'false');
    advCloseTimer = window.setTimeout(() => {
      panel.classList.add('hidden');
      panel.classList.remove('is-closing');
    }, 150);
  }
});

$('#regResetAllBtn')?.addEventListener('click', resetRegistrationFilters);
$('#regEmptyResetBtn')?.addEventListener('click', resetRegistrationFilters);

$('#refreshButton')?.addEventListener('click', async () => {
  const btn = $('#refreshButton');
  btn?.classList.add('is-spinning');
  try {
    await loadDashboard();
    showToast('Danh sách học phần đã được làm mới.');
    btn?.classList.remove('is-spinning');
    btn?.classList.add('is-success');
    window.setTimeout(() => btn?.classList.remove('is-success'), 1400);
  } catch {
    btn?.classList.remove('is-spinning');
    showToast('Không tải được danh sách.');
  }
});

// Course Detail Dialog smooth close
$('#closeCourseDialog')?.addEventListener('click', closeCourseDialogSmooth);
$('#courseDialog')?.addEventListener('click', event => {
  if (event.target === $('#courseDialog')) closeCourseDialogSmooth();
});
$('#courseDialog')?.addEventListener('cancel', event => {
  event.preventDefault();
  closeCourseDialogSmooth();
});

// Account menu & Logout
const accountMenu = $('#accountMenu');
const accountMenuToggle = $('#accountMenuToggle');
const accountMenuPanel = $('#accountMenuPanel');
function setAccountMenu(open) {
  if (!accountMenuPanel || !accountMenuToggle) return;
  accountMenuPanel.hidden = !open;
  accountMenuToggle.setAttribute('aria-expanded', String(open));
}
accountMenuToggle?.addEventListener('click', () => setAccountMenu(accountMenuPanel.hidden));
accountMenuToggle?.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    setAccountMenu(true);
    accountMenuPanel.querySelector('a')?.focus();
  }
});
document.addEventListener('pointerdown', event => { if (accountMenu && !accountMenu.contains(event.target)) setAccountMenu(false); });
document.addEventListener('focusin', event => { if (accountMenu && !accountMenu.contains(event.target)) setAccountMenu(false); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && accountMenuPanel && !accountMenuPanel.hidden) {
    setAccountMenu(false);
    accountMenuToggle?.focus();
  }
});

const futureShell = initFutureShell({
  sidebarSelector: '.sidebar',
  navSelector: '.main-nav .nav-item',
  getCommands: () => [
    { group: 'Điều hướng sinh viên', title: 'Tổng quan học tập', subtitle: 'Bảng điều khiển tín chỉ, hạn đăng ký và lịch tuần', tag: 'HOME', action: showOverviewView },
    { group: 'Điều hướng sinh viên', title: 'Đăng ký học phần', subtitle: 'Tìm kiếm, lọc và đăng ký lớp học kỳ hiện tại', tag: 'REG', action: () => { showCoursesView(); requestAnimationFrame(() => $('#searchInput')?.focus()); } },
    { group: 'Điều hướng sinh viên', title: 'Thời khóa biểu thông minh', subtitle: 'Xem lịch tuần, lịch trình và xuất PDF/CSV', tag: 'CAL', action: showScheduleView },
    { group: 'Điều hướng sinh viên', title: 'Lịch sử đăng ký', subtitle: 'Tra cứu toàn bộ thao tác đăng ký và hủy lớp', tag: 'HIST', action: showHistoryView },
    { group: 'Điều hướng sinh viên', title: 'Kết quả học tập', subtitle: 'Bảng điểm tích lũy, GPA hệ 10 và tín chỉ đạt', tag: 'GPA', action: showTranscriptView },
    { group: 'Điều hướng sinh viên', title: 'Khung chương trình', subtitle: 'Lộ trình học phần và điều kiện tiên quyết', tag: 'ROADMAP', action: showCurriculumView },
    { group: 'Điều hướng sinh viên', title: 'Đội ngũ giảng viên', subtitle: 'Tra cứu hồ sơ, chuyên môn và giờ tiếp sinh viên', tag: 'FACULTY', action: showLecturersView },
    { group: 'Điều hướng sinh viên', title: 'Trợ lý AI học vụ', subtitle: 'Hỏi đáp học vụ trực tiếp theo dữ liệu cá nhân', tag: 'AI', action: showAssistantView },
    { group: 'Thao tác nhanh', title: 'Làm mới danh sách học phần', subtitle: 'Tải lại sĩ số và trạng thái lớp mới nhất', tag: 'SYNC', action: () => loadDashboard().then(() => showToast('Đã đồng bộ dữ liệu học vụ mới nhất.')) },
    { group: 'Thao tác nhanh', title: 'Đổi mật khẩu tài khoản', subtitle: 'Mở trang cập nhật mật khẩu bảo mật', tag: 'SEC', action: () => location.assign('/change-password.html') }
  ]
});

function syncFutureNotifications() {
  const items = [];
  if (state.registrationOpen) {
    items.push({
      tone: 'success',
      title: 'Cổng đăng ký học phần đang mở',
      body: state.registrationAlwaysOpen
        ? `${state.semesterName} · Đang mở đăng ký liên tục.`
        : `${state.semesterName} · Hạn đăng ký: ${formatDate(state.registrationCloseAt)}.`,
      action: showCoursesView
    });
  } else {
    items.push({
      tone: 'danger',
      title: 'Cổng đăng ký học phần đang đóng',
      body: `${state.semesterName} · Thời gian: ${formatDate(state.registrationOpenAt)} – ${formatDate(state.registrationCloseAt)}.`,
      action: showOverviewView
    });
  }

  const ratio = state.maxCredits > 0 ? state.credits / state.maxCredits : 0;
  items.push({
    tone: ratio >= 0.85 ? 'warning' : 'info',
    title: `Đã đăng ký ${state.credits} / ${state.maxCredits} tín chỉ`,
    body: `${state.registered.length} lớp học phần chính thức trong học kỳ hiện tại.`,
    action: showScheduleView
  });

  if (state.courses.length) {
    const avail = state.courses.filter(c => (c.capacity - c.enrolled) > 0).length;
    items.push({
      tone: 'info',
      title: `${avail} / ${state.courses.length} lớp còn chỗ trống`,
      body: 'Mở Trung tâm Đăng ký học phần để lọc theo khoa, ngày học và điều kiện.',
      action: showCoursesView
    });
  }
  futureShell.updateNotifications(items);
}

$('#studentLogoutButton')?.addEventListener('click', async () => {
  try { await apiPost('/api/auth/logout', {}); } catch { /* ignore */ }
  location.replace('/login.html');
});

// Keep legacy modal close handlers safe if any element remains in DOM
$('#closeDialog')?.addEventListener('click', () => $('#scheduleDialog')?.close());
$('#closeHistoryDialog')?.addEventListener('click', () => $('#historyDialog')?.close());
$('#closeTranscriptDialog')?.addEventListener('click', () => $('#transcriptDialog')?.close());
$('#closeCurriculumDialog')?.addEventListener('click', () => $('#curriculumDialog')?.close());

/* ==========================================================================
   INITIAL BOOTSTRAP (Default to Tổng quan)
   ========================================================================== */

loadDashboard().then(() => {
  assistantController.refreshContext();
  const openTarget = new URLSearchParams(location.search).get('open');
  if (location.hash === '#courses') { showCoursesView(); }
  else if (location.hash === '#schedule-view') { showScheduleView(); }
  else if (location.hash === '#history-view' || openTarget === 'history') { showHistoryView(); }
  else if (location.hash === '#transcript-view' || openTarget === 'transcript') { showTranscriptView(); }
  else if (location.hash === '#curriculum-view' || openTarget === 'curriculum') { showCurriculumView(); }
  else if (location.hash === '#lecturers-view' || openTarget === 'lecturers') { showLecturersView(); }
  else if (location.hash === '#assistant-view' || openTarget === 'assistant') { showAssistantView(); }
  else { showOverviewView(); }
  if (openTarget) history.replaceState(null, '', '/');
}).catch(error => {
  showToast(error.message || 'Không kết nối được máy chủ.');
  if (list) {
    list.innerHTML = '<div class="ov-empty-box"><strong>Không kết nối được máy chủ</strong><p>Hãy kiểm tra máy chủ và tải lại trang.</p></div>';
  }
});
