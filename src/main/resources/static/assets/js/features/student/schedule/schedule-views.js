import {
  WEEKDAYS,
  addDays,
  escapeHtml,
  formatCountdown,
  formatFullDate,
  formatMinutes,
  formatShortDate,
  getColorSwatch,
  getCourseColorClass,
  isEventActiveInWeek,
  isSameDay,
  layoutOverlappingEvents,
  safeHttpUrl
} from './schedule-utils.js?v=20261125l';

const prefersReducedMotion = () =>
  Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

const counterFrames = new WeakMap();

function animateCounter(el, targetValue, previousValue) {
  if (!el) return;
  const target = Number(targetValue) || 0;
  const prev = previousValue == null ? 0 : Number(previousValue) || 0;

  const existing = counterFrames.get(el);
  if (existing) cancelAnimationFrame(existing);

  if (prefersReducedMotion() || (previousValue != null && prev === target)) {
    el.textContent = String(target);
    return;
  }

  const duration = 580;
  const start = performance.now();

  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = String(Math.round(prev + (target - prev) * eased));
    if (t < 1) {
      counterFrames.set(el, requestAnimationFrame(tick));
    } else {
      el.textContent = String(target);
      counterFrames.delete(el);
    }
  }
  counterFrames.set(el, requestAnimationFrame(tick));
}

export function renderStatistics(stats, prevStats = null) {
  animateCounter(document.getElementById('statCourses'), stats.totalCourses, prevStats?.totalCourses);
  document.getElementById('statCoursesSub').textContent = stats.totalCourses
    ? `${stats.totalCourses} lớp học phần chính thức`
    : 'Chưa có học phần nào';

  animateCounter(document.getElementById('statCredits'), stats.totalCredits, prevStats?.totalCredits);
  document.getElementById('statCreditsSub').textContent = stats.totalCredits
    ? 'Tính theo danh sách đã đăng ký'
    : '0 tín chỉ trong kỳ';

  animateCounter(document.getElementById('statDays'), stats.studyDays, prevStats?.studyDays);
  document.getElementById('statDaysSub').textContent = stats.studyDayNames.length
    ? `Lịch vào ${stats.studyDayNames.join(', ')}`
    : 'Chưa có ngày học';

  animateCounter(document.getElementById('statPeriods'), stats.totalPeriods, prevStats?.totalPeriods);
  document.getElementById('statPeriodsSub').textContent = stats.totalHours
    ? `≈ ${stats.totalHours} giờ học / tuần`
    : '0 giờ học trong tuần';
}

export function renderUpcomingWidget(upcoming, hasCourses, { animateChange = false } = {}) {
  const container = document.getElementById('upcomingClassWidget');
  if (!container) return;

  if (animateChange && !prefersReducedMotion()) {
    container.classList.remove('is-updating');
    void container.offsetWidth;
    container.classList.add('is-updating');
  }

  if (!hasCourses) {
    container.innerHTML = `
      <div class="sched-upcoming-main">
        <span class="sched-upcoming-badge">Lịch học</span>
        <div class="sched-upcoming-info">
          <strong>Chưa có lớp học sắp tới</strong>
          <p>Bạn chưa đăng ký học phần nào trong học kỳ này.</p>
        </div>
      </div>
      <a class="sched-btn sched-btn-primary" href="#courses" data-go-courses>Đăng ký học phần</a>
    `;
    return;
  }

  if (!upcoming) {
    container.innerHTML = `
      <div class="sched-upcoming-main">
        <span class="sched-upcoming-badge">Lịch học</span>
        <div class="sched-upcoming-info">
          <strong>Các học phần chưa có khung giờ cụ thể</strong>
          <p>Kiểm tra lại thông báo lịch học từ phòng Đào tạo.</p>
        </div>
      </div>
    `;
    return;
  }

  const { status, event } = upcoming;
  const dayLabel = WEEKDAYS[event.dayOfWeek - 1]?.label || '';
  const isLive = status === 'live';
  const badgeHtml = isLive
    ? `<span class="sched-upcoming-badge is-live"><span class="sched-live-dot"></span>Đang diễn ra</span>`
    : `<span class="sched-upcoming-badge">Tiết học tiếp theo</span>`;

  const timingText = isLive
    ? `${dayLabel} · ${event.startLabel} – ${event.endLabel} (còn ${upcoming.minutesLeft} phút)`
    : `${upcoming.dayDiff === 0 ? 'Hôm nay' : upcoming.dayDiff === 1 ? 'Ngày mai' : dayLabel} · ${event.startLabel} – ${event.endLabel} (${formatCountdown(upcoming.minutesUntil)})`;

  container.innerHTML = `
    <div class="sched-upcoming-main">
      ${badgeHtml}
      <div class="sched-upcoming-info">
        <strong>${escapeHtml(event.code)} · ${escapeHtml(event.name)}</strong>
        <p>${escapeHtml(timingText)}</p>
      </div>
    </div>
    <div class="sched-upcoming-meta">
      <span class="sched-meta-pill">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
        ${escapeHtml(event.room)}
      </span>
      <span class="sched-meta-pill">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        ${event.lecturerCode
          ? `<button type="button" class="lec-inline-link" data-open-lecturer="${escapeHtml(event.lecturerCode)}" title="Xem hồ sơ giảng viên">${escapeHtml(event.instructor)}</button>`
          : escapeHtml(event.instructor)}
      </span>
      <button type="button" class="sched-btn" data-open-course="${escapeHtml(event.courseId)}">Chi tiết</button>
    </div>
  `;
}

export function renderConflictBanner(conflicts) {
  const banner = document.getElementById('conflictBanner');
  if (!conflicts.length) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
    return;
  }

  banner.classList.remove('hidden');
  banner.innerHTML = `
    <div class="sched-conflict-content">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      <div>
        <strong>Phát hiện ${conflicts.length} cặp lịch học trùng giờ</strong>
        <ul>
          ${conflicts.map(c => `<li>${escapeHtml(c.dayLabel)}: <b>${escapeHtml(c.first.code)}</b> (${escapeHtml(c.first.startLabel)}–${escapeHtml(c.first.endLabel)}) trùng với <b>${escapeHtml(c.second.code)}</b> (${escapeHtml(c.second.startLabel)}–${escapeHtml(c.second.endLabel)})</li>`).join('')}
        </ul>
      </div>
    </div>
  `;
}

export function renderCourseFilterChips(courses, selectedCourseCode) {
  const container = document.getElementById('courseFilterChips');
  if (!courses.length) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const uniqueCourses = [];
  const seen = new Set();
  courses.forEach(c => {
    if (!seen.has(c.code)) {
      seen.add(c.code);
      uniqueCourses.push(c);
    }
  });

  container.innerHTML = `
    <button type="button" class="sched-chip ${!selectedCourseCode ? 'active' : ''}" data-course-filter="">
      Tất cả (${courses.length})
    </button>
    ${uniqueCourses.map(course => {
      const colorClass = getCourseColorClass(course);
      const swatch = getColorSwatch(colorClass);
      const active = selectedCourseCode === course.code;
      return `<button type="button" class="sched-chip ${active ? 'active' : ''}" data-course-filter="${escapeHtml(course.code)}" title="${escapeHtml(course.name)}">
        <span class="sched-chip-dot" style="background:${swatch}"></span>
        <span>${escapeHtml(course.code)} · ${escapeHtml(course.name)}</span>
      </button>`;
    }).join('')}
  `;
}

export function renderMobileDayTabs(weekMonday, events, selectedDay, academicWeek) {
  const container = document.getElementById('mobileDayTabs');
  const today = new Date();
  container.innerHTML = WEEKDAYS.map((w, idx) => {
    const date = addDays(weekMonday, idx);
    const hasEvents = events.some(ev => ev.dayOfWeek === w.day && isEventActiveInWeek(ev, academicWeek));
    const isActive = selectedDay === w.day;
    const isToday = isSameDay(date, today);
    return `<button type="button" class="sched-mobile-day-btn ${isActive ? 'active' : ''} ${hasEvents ? 'has-events' : ''}" data-mobile-day="${w.day}" aria-pressed="${isActive}">
      <span>${w.short}</span>
      <strong>${date.getDate()}</strong>
      <span class="day-count-dot" title="${isToday ? 'Hôm nay' : ''}"></span>
    </button>`;
  }).join('');
}

export function getGridHourBounds(events) {
  let startHour = 7;
  let endHour = 21;
  events.forEach(ev => {
    startHour = Math.min(startHour, Math.floor(ev.startMinutes / 60));
    endHour = Math.max(endHour, Math.ceil(ev.endMinutes / 60));
  });
  startHour = Math.max(6, startHour);
  endHour = Math.min(23, Math.max(startHour + 8, endHour));
  return { startHour, endHour };
}

export function renderWeeklyTimeGrid(
  events,
  unscheduled,
  weekMonday,
  academicWeek,
  now = new Date(),
  { staggerCards = false, selectedCourseId = null, flashToday = false, stageClass = '' } = {}
) {
  const { startHour, endHour } = getGridHourBounds(events);
  const totalMinutes = (endHour - startHour) * 60;
  const hourCount = endHour - startHour;
  const hours = Array.from({ length: hourCount }, (_, i) => startHour + i);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNowLine = nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60;
  const nowPercent = showNowLine ? ((nowMinutes - startHour * 60) / totalMinutes) * 100 : null;
  const shouldStagger = staggerCards && events.length <= 24;
  let cardCounter = 0;

  const headerHtml = `
    <div class="sched-cal-header">
      <div class="sched-time-corner">Giờ</div>
      ${WEEKDAYS.map((w, idx) => {
        const colDate = addDays(weekMonday, idx);
        const isToday = isSameDay(colDate, now);
        return `<div class="sched-day-head ${isToday ? 'is-today' : ''} ${isToday && flashToday ? 'is-today-flash' : ''}">
          <span class="day-name">${w.label}</span>
          <span class="day-date">${formatShortDate(colDate)}</span>
        </div>`;
      }).join('')}
    </div>
  `;

  const timeAxisHtml = `
    <div class="sched-time-axis" aria-hidden="true">
      ${hours.map(h => `<div class="sched-time-slot-label">${String(h).padStart(2, '0')}:00</div>`).join('')}
    </div>
  `;

  const dayColumnsHtml = WEEKDAYS.map((w, idx) => {
    const colDate = addDays(weekMonday, idx);
    const isToday = isSameDay(colDate, now);
    const dayEvents = events.filter(ev => ev.dayOfWeek === w.day);
    const positioned = layoutOverlappingEvents(dayEvents);

    const eventsHtml = positioned.map(ev => {
      const topPct = ((ev.startMinutes - startHour * 60) / totalMinutes) * 100;
      const heightPct = Math.max(((ev.endMinutes - ev.startMinutes) / totalMinutes) * 100, 4.2);
      const widthPct = 100 / ev.colCount;
      const leftPct = ev.colIndex * widthPct;
      const activeThisWeek = isEventActiveInWeek(ev, academicWeek);
      const gap = ev.colCount > 1 ? 3 : 4;
      const isSelected = selectedCourseId != null && String(selectedCourseId) === String(ev.courseId);
      const cardIndex = Math.min(cardCounter++, 10);
      const tooltip = `${ev.code} - ${ev.name}\n${ev.startLabel} – ${ev.endLabel} | Phòng ${ev.room}\nGV: ${ev.instructor}${ev.weeksExpression ? `\nTuần: ${ev.weeksExpression}` : ''}`;

      return `<button
        type="button"
        class="sched-event ${ev.colorClass} ${ev.isConflict ? 'is-conflict' : ''} ${!activeThisWeek ? 'is-inactive-week' : ''} ${isSelected ? 'is-selected' : ''}"
        data-open-course="${escapeHtml(ev.courseId)}"
        title="${escapeHtml(tooltip)}"
        style="--card-i:${cardIndex}; top:${topPct.toFixed(3)}%; height:calc(${heightPct.toFixed(3)}% - 3px); left:calc(${leftPct.toFixed(3)}% + ${gap}px); width:calc(${widthPct.toFixed(3)}% - ${gap * 2}px);"
      >
        <div class="sched-event-top">
          <span class="sched-event-code">${escapeHtml(ev.code)}</span>
          ${ev.isConflict ? '<span class="sched-event-conflict-dot">Trùng</span>' : ''}
        </div>
        <div class="sched-event-title">${escapeHtml(ev.name)}</div>
        <div class="sched-event-time">${escapeHtml(ev.startLabel)} – ${escapeHtml(ev.endLabel)}</div>
        <div class="sched-event-meta">
          <span>Phòng ${escapeHtml(ev.room)}</span>
          <span>${escapeHtml(ev.instructor)}</span>
        </div>
        ${ev.weeksExpression ? `<div class="sched-event-weeks">Tuần ${escapeHtml(ev.weeksExpression)}</div>` : ''}
      </button>`;
    }).join('');

    const nowIndicatorHtml = isToday && showNowLine
      ? `<div class="sched-now-indicator" data-now-indicator data-start-hour="${startHour}" data-end-hour="${endHour}" style="top:${nowPercent.toFixed(3)}%"><span class="sched-now-badge">${formatMinutes(nowMinutes)}</span></div>`
      : '';

    return `<div class="sched-day-col ${isToday ? 'is-today' : ''}" style="height:calc(var(--hour-height) * ${hourCount});">
      ${eventsHtml}
      ${nowIndicatorHtml}
    </div>`;
  }).join('');

  const unscheduledHtml = unscheduled.length ? `
    <div class="sched-unscheduled-box">
      <strong>Học phần chưa có lịch giờ cụ thể (${unscheduled.length})</strong>
      ${unscheduled.map(item => `<div>• ${escapeHtml(item.course.code)} · ${escapeHtml(item.course.name)} — ${escapeHtml(item.reason)}</div>`).join('')}
    </div>
  ` : '';

  return `
    <div class="sched-grid-scroll">
      <div class="sched-calendar ${shouldStagger ? 'is-staggering' : ''} ${stageClass}" id="schedCalendarStage">
        ${headerHtml}
        <div class="sched-cal-body">
          ${timeAxisHtml}
          ${dayColumnsHtml}
        </div>
      </div>
    </div>
    ${unscheduledHtml}
  `;
}

export function renderAgendaView(
  events,
  weekMonday,
  academicWeek,
  singleDay = null,
  now = new Date(),
  { staggerCards = false, selectedCourseId = null, stageClass = '' } = {}
) {
  const daysToShow = singleDay
    ? WEEKDAYS.filter(w => w.day === singleDay)
    : WEEKDAYS;

  let cardCounter = 0;

  const sections = daysToShow.map(w => {
    const colDate = addDays(weekMonday, w.day - 1);
    const isToday = isSameDay(colDate, now);
    const dayEvents = events
      .filter(ev => ev.dayOfWeek === w.day)
      .sort((a, b) => a.startMinutes - b.startMinutes);

    if (!singleDay && dayEvents.length === 0) return '';

    const cardsHtml = dayEvents.length
      ? `<div class="sched-agenda-list">${dayEvents.map(ev => {
          const activeThisWeek = isEventActiveInWeek(ev, academicWeek);
          const isSelected = selectedCourseId != null && String(selectedCourseId) === String(ev.courseId);
          const idx = Math.min(cardCounter++, 8);
          return `<button type="button" class="sched-agenda-card ${ev.colorClass} ${ev.isConflict ? 'is-conflict' : ''} ${!activeThisWeek ? 'is-inactive-week' : ''} ${isSelected ? 'is-selected' : ''}" data-open-course="${escapeHtml(ev.courseId)}" style="--card-i:${idx}">
            <div class="sched-agenda-time">
              <strong>${escapeHtml(ev.startLabel)} – ${escapeHtml(ev.endLabel)}</strong>
              <small>${ev.periods} tiết · ${ev.credits} TC</small>
            </div>
            <div class="sched-agenda-info">
              <div class="sched-agenda-info-top">
                <span class="sched-event-code">${escapeHtml(ev.code)}</span>
                <h4>${escapeHtml(ev.name)}</h4>
                ${ev.isConflict ? '<span class="sched-event-conflict-dot">Trùng lịch</span>' : ''}
              </div>
              <div class="sched-agenda-details">
                <span>Phòng: <b>${escapeHtml(ev.room)}</b></span>
                <span>GV: <b>${escapeHtml(ev.instructor)}</b></span>
                ${ev.weeksExpression ? `<span>Tuần: <b>${escapeHtml(ev.weeksExpression)}</b></span>` : ''}
                <span>Lớp HP: ${escapeHtml(ev.sectionCode)}</span>
              </div>
            </div>
            <span class="sched-btn">Chi tiết</span>
          </button>`;
        }).join('')}</div>`
      : `<div class="sched-agenda-empty-day">Không có lịch học trong ngày ${w.label} (${formatShortDate(colDate)}).</div>`;

    return `<section class="sched-agenda-day">
      <div class="sched-agenda-day-head">
        <div class="sched-agenda-day-title">
          <h3>${w.label}</h3>
          ${isToday ? '<span class="sched-agenda-today-tag">Hôm nay</span>' : ''}
        </div>
        <span class="sched-agenda-day-date">${formatFullDate(colDate)}</span>
      </div>
      ${cardsHtml}
    </section>`;
  }).filter(Boolean).join('');

  if (!sections) {
    return renderEmptyState('Không có lịch học phù hợp', 'Thử bỏ bớt điều kiện lọc hoặc chọn học kỳ khác để xem thời khóa biểu.', true);
  }
  return `<div class="sched-agenda ${staggerCards ? 'is-staggering' : ''} ${stageClass}" id="schedCalendarStage">${sections}</div>`;
}

export function renderEmptyState(title, description, showReset = false) {
  return `
    <div class="sched-empty-state">
      <div class="sched-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
      </div>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
      ${showReset
        ? '<button type="button" class="sched-btn sched-btn-primary" id="emptyResetBtn">Đặt lại bộ lọc</button>'
        : '<a class="sched-btn sched-btn-primary" href="#courses" data-go-courses>Đi tới Đăng ký học phần</a>'}
    </div>
  `;
}

export function renderErrorState(message) {
  return `
    <div class="sched-error-state">
      <div class="sched-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
      </div>
      <h3>Không tải được thời khóa biểu</h3>
      <p>${escapeHtml(message || 'Đã xảy ra lỗi khi kết nối máy chủ.')}</p>
      <button type="button" class="sched-btn sched-btn-primary" id="retryLoadBtn">Thử lại</button>
    </div>
  `;
}

/**
 * Calendar-matched weekly grid skeleton (time axis + weekday headers + course placeholders)
 */
export function renderLoadingState() {
  const hours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
  const sampleBlocks = {
    0: [{ top: '2%', height: '24%' }],
    1: [{ top: '28%', height: '25%' }],
    2: [{ top: '55%', height: '25%' }],
    3: [{ top: '4%', height: '24%' }, { top: '60%', height: '22%' }],
    4: [{ top: '30%', height: '24%' }],
    5: [{ top: '12%', height: '22%' }],
    6: []
  };

  return `
    <div class="sched-grid-scroll" aria-label="Đang tải thời khóa biểu">
      <div class="sched-calendar">
        <div class="sched-cal-header">
          <div class="sched-time-corner">Giờ</div>
          ${WEEKDAYS.map(() => `
            <div class="sched-day-head">
              <span class="sched-skel-bar" style="width:44px;height:12px"></span>
              <span class="sched-skel-bar" style="width:52px;height:18px;border-radius:999px;margin-top:3px"></span>
            </div>
          `).join('')}
        </div>
        <div class="sched-cal-body">
          <div class="sched-time-axis" aria-hidden="true">
            ${hours.map(h => `<div class="sched-time-slot-label">${String(h).padStart(2, '0')}:00</div>`).join('')}
          </div>
          ${WEEKDAYS.map((_, idx) => `
            <div class="sched-day-col" style="height:calc(var(--hour-height) * ${hours.length});">
              ${(sampleBlocks[idx] || []).map(b => `<div class="sched-skel-event" style="top:${b.top};height:${b.height}"></div>`).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

export function populateCourseDetailModal(course) {
  const modal = document.getElementById('courseDetailModal');
  const badges = document.getElementById('detailModalBadges');
  const title = document.getElementById('detailModalTitle');
  const body = document.getElementById('detailModalBody');
  const syllabusLink = document.getElementById('detailSyllabusLink');

  badges.innerHTML = `
    <span class="sched-status-pill is-code">${escapeHtml(course.code)}</span>
    <span class="sched-status-pill">${course.registered ? 'Đã đăng ký chính thức' : escapeHtml(course.status || 'Đang mở')}</span>
  `;
  title.textContent = course.name || 'Chi tiết học phần';

  const meetings = Array.isArray(course.meetings) && course.meetings.length
    ? course.meetings.map(m => {
        const day = WEEKDAYS[(Number(m.dayOfWeek) || 1) - 1]?.label || 'Chưa rõ ngày';
        const time = m.startsAt && m.endsAt ? `${String(m.startsAt).slice(0, 5)} – ${String(m.endsAt).slice(0, 5)}` : 'Chưa rõ giờ';
        const weeks = m.weeksExpression ? `Tuần ${m.weeksExpression}` : 'Toàn học kỳ';
        const room = m.room || course.room || 'Chưa xếp phòng';
        return `<div class="sched-meeting-pill">
          <span><b>${escapeHtml(day)}</b> · ${escapeHtml(time)}</span>
          <span>Phòng <b>${escapeHtml(room)}</b> · ${escapeHtml(weeks)}</span>
        </div>`;
      }).join('')
    : `<div class="sched-meeting-pill"><span>${escapeHtml(course.schedule || 'Chưa xếp lịch')}</span><span>Phòng ${escapeHtml(course.room || '—')}</span></div>`;

  const weekSummary = Array.isArray(course.meetings) && course.meetings.some(m => m.weeksExpression)
    ? [...new Set(course.meetings.map(m => m.weeksExpression).filter(Boolean))].map(w => `Tuần ${w}`).join(', ')
    : 'Theo kế hoạch học kỳ';

  body.innerHTML = `
    <dl class="sched-detail-grid">
      <div class="sched-detail-item">
        <dt>Mã học phần</dt>
        <dd>${escapeHtml(course.code)}</dd>
      </div>
      <div class="sched-detail-item">
        <dt>Mã lớp học phần</dt>
        <dd>${escapeHtml(course.sectionCode || course.id)}</dd>
      </div>
      <div class="sched-detail-item">
        <dt>Giảng viên phụ trách</dt>
        <dd>${course.lecturerCode
          ? `<button type="button" class="lec-inline-link" data-open-lecturer="${escapeHtml(course.lecturerCode)}" title="Xem hồ sơ giảng viên">${escapeHtml(course.instructor || 'Chưa phân công')} ↗</button>`
          : escapeHtml(course.instructor || 'Chưa phân công')}</dd>
      </div>
      <div class="sched-detail-item">
        <dt>Số tín chỉ</dt>
        <dd>${Number(course.credits) || 0} tín chỉ</dd>
      </div>
      <div class="sched-detail-item">
        <dt>Phòng học</dt>
        <dd>${escapeHtml(course.room || 'Chưa xếp phòng')}</dd>
      </div>
      <div class="sched-detail-item">
        <dt>Tuần học</dt>
        <dd>${escapeHtml(weekSummary)}</dd>
      </div>
      <div class="sched-detail-item">
        <dt>Khoa / Viện</dt>
        <dd>${escapeHtml(course.department || '—')}</dd>
      </div>
      <div class="sched-detail-item">
        <dt>Trạng thái đăng ký</dt>
        <dd>${course.registered ? 'Đã đăng ký (ENROLLED)' : escapeHtml(course.status || '—')} · Sĩ số ${course.enrolled}/${course.capacity}</dd>
      </div>
      <div class="sched-detail-item is-full">
        <dt>Chi tiết các buổi học</dt>
        <dd><div class="sched-meetings-list">${meetings}</div></dd>
      </div>
      ${course.description ? `<div class="sched-detail-item is-full"><dt>Mô tả học phần</dt><dd>${escapeHtml(course.description)}</dd></div>` : ''}
    </dl>
  `;

  const url = safeHttpUrl(course.syllabusUrl);
  if (url) {
    syllabusLink.href = url;
    syllabusLink.classList.remove('hidden');
  } else {
    syllabusLink.classList.add('hidden');
  }

  modal.classList.remove('is-closing');
  document.body.classList.add('sched-modal-open');
  if (!modal.open) modal.showModal();
}

export function renderPrintSections(student, scheduleData, events, weekRangeText) {
  const printHeader = document.getElementById('printHeader');
  const printTable = document.getElementById('printCourseTable');
  const printedAt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());

  printHeader.innerHTML = `
    <div>
      <h1>THỜI KHÓA BIỂU SINH VIÊN — ${escapeHtml(scheduleData.semesterName)}</h1>
      <p>Sinh viên: <b>${escapeHtml(student?.fullName || student?.username || '—')}</b> · MSSV: <b>${escapeHtml(student?.studentCode || student?.username || '—')}</b> · ${escapeHtml(weekRangeText)}</p>
    </div>
    <p>Xuất từ EduPortal · ${escapeHtml(printedAt)}</p>
  `;

  printTable.innerHTML = `
    <h3>Danh sách lớp học phần (${scheduleData.courses.length} môn)</h3>
    <table class="sched-print-table">
      <thead>
        <tr>
          <th>Mã môn</th>
          <th>Tên học phần</th>
          <th>Mã lớp HP</th>
          <th>TC</th>
          <th>Thứ</th>
          <th>Giờ học</th>
          <th>Phòng</th>
          <th>Giảng viên</th>
          <th>Tuần học</th>
        </tr>
      </thead>
      <tbody>
        ${events.map(ev => `<tr>
          <td>${escapeHtml(ev.code)}</td>
          <td>${escapeHtml(ev.name)}</td>
          <td>${escapeHtml(ev.sectionCode)}</td>
          <td>${ev.credits}</td>
          <td>${escapeHtml(WEEKDAYS[ev.dayOfWeek - 1]?.label || '')}</td>
          <td>${escapeHtml(ev.startLabel)} – ${escapeHtml(ev.endLabel)}</td>
          <td>${escapeHtml(ev.room)}</td>
          <td>${escapeHtml(ev.instructor)}</td>
          <td>${escapeHtml(ev.weeksExpression || '—')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
}
