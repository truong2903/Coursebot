import { apiGet } from '../../../core/api.js';
import {
  addDays,
  computeStatistics,
  detectConflicts,
  escapeHtml,
  findUpcomingClass,
  formatFullDate,
  formatMinutes,
  formatShortDate,
  getAcademicWeekNumber,
  getIsoWeekday,
  getMondayOfWeek,
  getSessionBucket,
  isEventActiveInWeek,
  normalizeScheduleEvents
} from './schedule-utils.js?v=20261125l';
import {
  populateCourseDetailModal,
  renderAgendaView,
  renderConflictBanner,
  renderCourseFilterChips,
  renderEmptyState,
  renderErrorState,
  renderLoadingState,
  renderMobileDayTabs,
  renderPrintSections,
  renderStatistics,
  renderUpcomingWidget,
  renderWeeklyTimeGrid
} from './schedule-views.js?v=20261125l';
import { exportScheduleToCsv, printOrExportPdf } from './schedule-export.js?v=20261125i';

const MOBILE_BREAKPOINT = 768;

const prefersReducedMotion = () =>
  Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

export function createScheduleController({ onToast, onGoToCourses, getStudent } = {}) {
  const state = {
    scheduleData: null,
    allEvents: [],
    unscheduled: [],
    conflicts: [],
    lastStats: null,
    lastUpcomingKey: null,
    selectedCourseId: null,
    lastFocusedEl: null,
    selectedSemesterCode: '',
    weekMonday: getMondayOfWeek(new Date()),
    viewMode: window.innerWidth < MOBILE_BREAKPOINT ? 'agenda' : 'week',
    mobileDay: getIsoWeekday(new Date()),
    initialized: false,
    navToken: 0,
    navTimer: null,
    entranceTimer: null,
    popoverTimer: null,
    modalTimer: null,
    filters: {
      courseCode: '',
      search: '',
      session: '',
      lecturer: '',
      room: '',
      onlyCurrentWeek: false,
      onlyConflicts: false
    }
  };

  const notify = message => {
    if (typeof onToast === 'function') onToast(message);
  };

  function triggerPageEntrance() {
    const section = document.getElementById('scheduleViewSection');
    if (!section || prefersReducedMotion()) return;
    window.clearTimeout(state.entranceTimer);
    section.classList.remove('is-entering');
    void section.offsetWidth;
    section.classList.add('is-entering');
    state.entranceTimer = window.setTimeout(() => {
      section.classList.remove('is-entering');
    }, 620);
  }

  function getSelectedSemesterObj() {
    if (!state.scheduleData?.semesters) return null;
    return state.scheduleData.semesters.find(s => s.code === state.scheduleData.semesterCode) || null;
  }

  function getFilteredEvents() {
    const { courseCode, search, session, lecturer, room, onlyCurrentWeek, onlyConflicts } = state.filters;
    const query = search.trim().toLocaleLowerCase('vi');
    const academicWeek = getAcademicWeekNumber(state.weekMonday, getSelectedSemesterObj());

    return state.allEvents.filter(ev => {
      if (courseCode && ev.code !== courseCode) return false;
      if (session && getSessionBucket(ev.startMinutes) !== session) return false;
      if (lecturer && ev.instructor !== lecturer) return false;
      if (room && ev.room !== room) return false;
      if (onlyCurrentWeek && !isEventActiveInWeek(ev, academicWeek)) return false;
      if (onlyConflicts && !ev.isConflict) return false;
      if (query) {
        const hay = `${ev.code} ${ev.name} ${ev.sectionCode} ${ev.instructor} ${ev.room} ${ev.department}`.toLocaleLowerCase('vi');
        if (!hay.includes(query)) return false;
      }
      return true;
    });
  }

  function countActiveAdvancedFilters() {
    const { search, session, lecturer, room, onlyCurrentWeek, onlyConflicts } = state.filters;
    let count = 0;
    if (search.trim()) count++;
    if (session) count++;
    if (lecturer) count++;
    if (room) count++;
    if (onlyCurrentWeek) count++;
    if (onlyConflicts) count++;
    return count;
  }

  function syncAdvancedFilterBadge() {
    const count = countActiveAdvancedFilters();
    const badge = document.getElementById('activeFilterCount');
    if (!badge) return;
    badge.textContent = String(count);
    badge.classList.toggle('hidden', count === 0);
  }

  function populateAdvancedFilterOptions() {
    const lecturers = [...new Set(state.allEvents.map(e => e.instructor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
    const rooms = [...new Set(state.allEvents.map(e => e.room).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));

    const lecturerSelect = document.getElementById('filterLecturer');
    lecturerSelect.innerHTML = '<option value="">Tất cả giảng viên</option>'
      + lecturers.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
    lecturerSelect.value = state.filters.lecturer;

    const roomSelect = document.getElementById('filterRoom');
    roomSelect.innerHTML = '<option value="">Tất cả phòng học</option>'
      + rooms.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join('');
    roomSelect.value = state.filters.room;
  }

  function updateWeekLabel({ animate = false } = {}) {
    const sunday = addDays(state.weekMonday, 6);
    const semester = getSelectedSemesterObj();
    const academicWeek = getAcademicWeekNumber(state.weekMonday, semester);
    const rangeText = `${formatShortDate(state.weekMonday)} – ${formatFullDate(sunday)}`;
    const weekTitle = academicWeek ? `Tuần học thứ ${academicWeek}` : 'Lịch theo tuần';

    const labelEl = document.getElementById('weekRangeLabel');
    if (labelEl) {
      labelEl.innerHTML = `<strong>${escapeHtml(weekTitle)}</strong><small>${escapeHtml(rangeText)}</small>`;
      if (animate && !prefersReducedMotion()) {
        labelEl.classList.remove('is-swapping');
        void labelEl.offsetWidth;
        labelEl.classList.add('is-swapping');
      }
    }
    return `${weekTitle} (${rangeText})`;
  }

  function syncViewTabs() {
    const weekTab = document.getElementById('tabWeekView');
    const agendaTab = document.getElementById('tabAgendaView');
    if (!weekTab || !agendaTab) return;
    const isWeek = state.viewMode === 'week';
    weekTab.classList.toggle('active', isWeek);
    weekTab.setAttribute('aria-selected', String(isWeek));
    agendaTab.classList.toggle('active', !isWeek);
    agendaTab.setAttribute('aria-selected', String(!isWeek));
  }

  function syncSelectedCardHighlight() {
    const surface = document.getElementById('scheduleSurface');
    if (!surface) return;
    surface.querySelectorAll('[data-open-course]').forEach(el => {
      el.classList.toggle('is-selected', state.selectedCourseId != null && String(el.dataset.openCourse) === String(state.selectedCourseId));
    });
  }

  function updateNowIndicatorInPlace() {
    const indicator = document.querySelector('#scheduleSurface [data-now-indicator]');
    if (!indicator) return;
    const now = new Date();
    const startHour = Number(indicator.dataset.startHour);
    const endHour = Number(indicator.dataset.endHour);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const totalMinutes = (endHour - startHour) * 60;
    if (nowMinutes < startHour * 60 || nowMinutes > endHour * 60 || totalMinutes <= 0) {
      indicator.style.display = 'none';
      return;
    }
    indicator.style.display = '';
    const pct = ((nowMinutes - startHour * 60) / totalMinutes) * 100;
    indicator.style.top = `${pct.toFixed(3)}%`;
    const badge = indicator.querySelector('.sched-now-badge');
    if (badge) badge.textContent = formatMinutes(nowMinutes);
  }

  function updateUpcomingSmart() {
    if (!state.scheduleData) return;
    const upcoming = findUpcomingClass(state.allEvents);
    const nextKey = upcoming ? `${upcoming.status}:${upcoming.event.uid}` : 'none';
    const changed = state.lastUpcomingKey !== null && state.lastUpcomingKey !== nextKey;
    state.lastUpcomingKey = nextKey;
    renderUpcomingWidget(upcoming, (state.scheduleData.courses || []).length > 0, { animateChange: changed });
  }

  function renderSchedule({
    staggerCards = false,
    stageClass = '',
    flashToday = false,
    animateLabel = false
  } = {}) {
    if (!state.scheduleData) return;

    const semester = getSelectedSemesterObj();
    const academicWeek = getAcademicWeekNumber(state.weekMonday, semester);
    const weekText = updateWeekLabel({ animate: animateLabel });
    const filteredEvents = getFilteredEvents();
    const isMobile = window.innerWidth < MOBILE_BREAKPOINT;
    const now = new Date();
    const student = typeof getStudent === 'function' ? getStudent() : null;

    syncViewTabs();
    syncAdvancedFilterBadge();
    renderCourseFilterChips(state.scheduleData.courses, state.filters.courseCode);
    renderMobileDayTabs(state.weekMonday, filteredEvents, state.mobileDay, academicWeek);
    renderPrintSections(student, state.scheduleData, filteredEvents, weekText);

    const surface = document.getElementById('scheduleSurface');
    if (!state.scheduleData.courses.length) {
      surface.innerHTML = renderEmptyState(
        'Chưa có học phần trong học kỳ này',
        'Bạn chưa đăng ký lớp học phần nào cho học kỳ đang chọn. Hãy chuyển sang mục Đăng ký học phần để chọn môn.',
        false
      );
      return;
    }

    const hasFilter = Boolean(state.filters.courseCode) || countActiveAdvancedFilters() > 0;
    if (!filteredEvents.length && !state.unscheduled.length) {
      surface.innerHTML = renderEmptyState(
        'Không tìm thấy lịch học phù hợp',
        'Không có buổi học nào khớp với bộ lọc hiện tại. Bạn có thể đặt lại bộ lọc để xem toàn bộ thời khóa biểu.',
        hasFilter
      );
      return;
    }

    const effectiveStageClass = prefersReducedMotion() ? '' : stageClass;
    const renderOpts = {
      staggerCards,
      selectedCourseId: state.selectedCourseId,
      flashToday,
      stageClass: effectiveStageClass
    };

    if (isMobile) {
      surface.innerHTML = renderAgendaView(filteredEvents, state.weekMonday, academicWeek, state.mobileDay, now, renderOpts);
    } else if (state.viewMode === 'agenda') {
      surface.innerHTML = renderAgendaView(filteredEvents, state.weekMonday, academicWeek, null, now, renderOpts);
    } else {
      surface.innerHTML = renderWeeklyTimeGrid(filteredEvents, state.unscheduled, state.weekMonday, academicWeek, now, renderOpts);
    }
  }

  /**
   * Synchronized horizontal week/day navigation transition (safe against rapid clicks).
   * direction: 'next' | 'prev' | 'fade'
   */
  function transitionCalendar(direction, mutateState, { flashToday = false, animateLabel = true } = {}) {
    const token = ++state.navToken;
    window.clearTimeout(state.navTimer);

    const stage = document.getElementById('schedCalendarStage');
    if (!stage || prefersReducedMotion() || direction === 'fade') {
      mutateState();
      renderSchedule({
        stageClass: direction === 'fade' ? 'sched-stage-crossfade' : '',
        flashToday,
        animateLabel
      });
      return;
    }

    const outClass = direction === 'next' ? 'sched-stage-out-left' : 'sched-stage-out-right';
    const inClass = direction === 'next' ? 'sched-stage-in-right' : 'sched-stage-in-left';

    stage.classList.remove('sched-stage-in-right', 'sched-stage-in-left', 'sched-stage-out-left', 'sched-stage-out-right', 'sched-stage-crossfade');
    stage.classList.add(outClass);

    state.navTimer = window.setTimeout(() => {
      if (token !== state.navToken) return;
      mutateState();
      renderSchedule({ stageClass: inClass, flashToday, animateLabel });
    }, 110);
  }

  function resetAllFilters() {
    state.filters = {
      courseCode: '',
      search: '',
      session: '',
      lecturer: '',
      room: '',
      onlyCurrentWeek: false,
      onlyConflicts: false
    };
    document.getElementById('filterSearch').value = '';
    document.getElementById('filterSession').value = '';
    document.getElementById('filterLecturer').value = '';
    document.getElementById('filterRoom').value = '';
    document.getElementById('filterOnlyCurrentWeek').checked = false;
    document.getElementById('filterOnlyConflicts').checked = false;
    renderSchedule({ stageClass: 'sched-stage-crossfade' });
  }

  function setFilterPopover(open) {
    const filterBtn = document.getElementById('btnAdvancedFilter');
    const filterMenu = document.getElementById('advancedFilterMenu');
    if (!filterBtn || !filterMenu) return;

    window.clearTimeout(state.popoverTimer);
    if (open) {
      filterMenu.hidden = false;
      filterMenu.classList.remove('is-closing');
      filterMenu.classList.add('is-open');
      filterBtn.setAttribute('aria-expanded', 'true');
    } else {
      if (filterMenu.hidden) return;
      filterBtn.setAttribute('aria-expanded', 'false');
      if (prefersReducedMotion()) {
        filterMenu.classList.remove('is-open', 'is-closing');
        filterMenu.hidden = true;
        return;
      }
      filterMenu.classList.remove('is-open');
      filterMenu.classList.add('is-closing');
      state.popoverTimer = window.setTimeout(() => {
        filterMenu.classList.remove('is-closing');
        filterMenu.hidden = true;
      }, 150);
    }
  }

  function closeCourseModalGracefully() {
    const modal = document.getElementById('courseDetailModal');
    if (!modal || !modal.open) {
      document.body.classList.remove('sched-modal-open');
      return;
    }

    window.clearTimeout(state.modalTimer);
    const finish = () => {
      modal.classList.remove('is-closing');
      if (modal.open) modal.close();
      document.body.classList.remove('sched-modal-open');
      state.selectedCourseId = null;
      syncSelectedCardHighlight();
      if (state.lastFocusedEl && typeof state.lastFocusedEl.focus === 'function') {
        state.lastFocusedEl.focus({ preventScroll: true });
      }
      state.lastFocusedEl = null;
    };

    if (prefersReducedMotion()) {
      finish();
      return;
    }

    modal.classList.add('is-closing');
    state.modalTimer = window.setTimeout(finish, 180);
  }

  async function loadSchedule(semesterCode = '', { staggerCards = true } = {}) {
    const surface = document.getElementById('scheduleSurface');
    let skeletonShown = false;

    const skeletonTimer = window.setTimeout(() => {
      skeletonShown = true;
      surface.innerHTML = renderLoadingState();
    }, state.scheduleData ? 140 : 60);

    try {
      const query = semesterCode ? `?semester=${encodeURIComponent(semesterCode)}` : '';
      const data = await apiGet(`/api/student/schedule${query}`);
      window.clearTimeout(skeletonTimer);

      state.scheduleData = data;
      state.selectedSemesterCode = data.semesterCode;

      const pill = document.getElementById('headerSemesterPill');
      if (pill) pill.textContent = data.semesterName || data.semesterCode;

      const semSelect = document.getElementById('semesterSelect');
      semSelect.innerHTML = (data.semesters || [])
        .map(s => `<option value="${escapeHtml(s.code)}" ${s.code === data.semesterCode ? 'selected' : ''}>${escapeHtml(s.name)}</option>`)
        .join('');

      const { events, unscheduled } = normalizeScheduleEvents(data.courses || []);
      state.allEvents = events;
      state.unscheduled = unscheduled;
      state.conflicts = detectConflicts(events);

      const nextStats = computeStatistics(data.courses || [], events);
      renderStatistics(nextStats, state.lastStats);
      state.lastStats = nextStats;

      updateUpcomingSmart();
      renderConflictBanner(state.conflicts);
      populateAdvancedFilterOptions();

      if (window.innerWidth < MOBILE_BREAKPOINT && events.length) {
        const todayDow = getIsoWeekday(new Date());
        const hasToday = events.some(e => e.dayOfWeek === todayDow);
        state.mobileDay = hasToday ? todayDow : events[0].dayOfWeek;
      }

      renderSchedule({
        staggerCards: staggerCards || skeletonShown,
        stageClass: skeletonShown ? 'sched-stage-crossfade' : ''
      });
    } catch (error) {
      window.clearTimeout(skeletonTimer);
      surface.innerHTML = renderErrorState(error.message);
    }
  }

  function openCourseById(courseId, triggerEl = null) {
    const course = state.scheduleData?.courses?.find(c => String(c.id) === String(courseId));
    if (!course) return;
    state.selectedCourseId = course.id;
    state.lastFocusedEl = triggerEl || document.activeElement;
    syncSelectedCardHighlight();
    populateCourseDetailModal(course);
  }

  function navigateToday() {
    const today = new Date();
    const targetMonday = getMondayOfWeek(today);
    const diff = targetMonday.getTime() - state.weekMonday.getTime();
    const dir = diff > 0 ? 'next' : diff < 0 ? 'prev' : 'fade';

    transitionCalendar(dir, () => {
      state.weekMonday = targetMonday;
      state.mobileDay = getIsoWeekday(today);
    }, { flashToday: true, animateLabel: diff !== 0 });

    notify('Đã chuyển về tuần hiện tại.');
  }

  function bindEventsOnce() {
    if (state.initialized) return;
    state.initialized = true;

    document.getElementById('semesterSelect').addEventListener('change', event => {
      resetAllFilters();
      loadSchedule(event.target.value, { staggerCards: true });
    });

    document.getElementById('btnPrevWeek').addEventListener('click', () => {
      transitionCalendar('prev', () => { state.weekMonday = addDays(state.weekMonday, -7); });
    });
    document.getElementById('btnNextWeek').addEventListener('click', () => {
      transitionCalendar('next', () => { state.weekMonday = addDays(state.weekMonday, 7); });
    });
    document.getElementById('btnToday').addEventListener('click', navigateToday);

    document.querySelectorAll('[data-view]').forEach(tab => {
      tab.addEventListener('click', () => {
        if (state.viewMode === tab.dataset.view) return;
        transitionCalendar('fade', () => { state.viewMode = tab.dataset.view; }, { animateLabel: false });
      });
    });

    document.getElementById('courseFilterChips').addEventListener('click', event => {
      const chip = event.target.closest('[data-course-filter]');
      if (!chip) return;
      state.filters.courseCode = chip.dataset.courseFilter;
      renderSchedule({ stageClass: 'sched-stage-crossfade' });
    });

    document.getElementById('mobileDayTabs').addEventListener('click', event => {
      const btn = event.target.closest('[data-mobile-day]');
      if (!btn) return;
      const nextDay = Number(btn.dataset.mobileDay);
      if (nextDay === state.mobileDay) return;
      const dir = nextDay > state.mobileDay ? 'next' : 'prev';
      transitionCalendar(dir, () => { state.mobileDay = nextDay; }, { animateLabel: false });
    });

    const filterBtn = document.getElementById('btnAdvancedFilter');
    const filterMenu = document.getElementById('advancedFilterMenu');
    const filterWrap = document.getElementById('advancedFilterWrap');
    filterBtn.addEventListener('click', () => setFilterPopover(filterMenu.hidden));
    document.addEventListener('pointerdown', event => {
      if (!filterWrap.contains(event.target) && !filterMenu.hidden) setFilterPopover(false);
    });

    document.getElementById('filterSearch').addEventListener('input', e => {
      state.filters.search = e.target.value;
      renderSchedule();
    });
    document.getElementById('filterSession').addEventListener('change', e => {
      state.filters.session = e.target.value;
      renderSchedule({ stageClass: 'sched-stage-crossfade' });
    });
    document.getElementById('filterLecturer').addEventListener('change', e => {
      state.filters.lecturer = e.target.value;
      renderSchedule({ stageClass: 'sched-stage-crossfade' });
    });
    document.getElementById('filterRoom').addEventListener('change', e => {
      state.filters.room = e.target.value;
      renderSchedule({ stageClass: 'sched-stage-crossfade' });
    });
    document.getElementById('filterOnlyCurrentWeek').addEventListener('change', e => {
      state.filters.onlyCurrentWeek = e.target.checked;
      renderSchedule({ stageClass: 'sched-stage-crossfade' });
    });
    document.getElementById('filterOnlyConflicts').addEventListener('change', e => {
      state.filters.onlyConflicts = e.target.checked;
      renderSchedule({ stageClass: 'sched-stage-crossfade' });
    });
    document.getElementById('btnResetFilters').addEventListener('click', () => {
      resetAllFilters();
      setFilterPopover(false);
    });

    document.getElementById('scheduleSurface').addEventListener('click', event => {
      const openBtn = event.target.closest('[data-open-course]');
      if (openBtn) {
        openCourseById(openBtn.dataset.openCourse, openBtn);
        return;
      }
      if (event.target.closest('#emptyResetBtn')) {
        resetAllFilters();
        return;
      }
      if (event.target.closest('#retryLoadBtn')) {
        loadSchedule(state.selectedSemesterCode, { staggerCards: true });
        return;
      }
      if (event.target.closest('[data-go-courses]') && typeof onGoToCourses === 'function') {
        event.preventDefault();
        onGoToCourses();
      }
    });

    document.getElementById('upcomingClassWidget').addEventListener('click', event => {
      const openBtn = event.target.closest('[data-open-course]');
      if (openBtn) {
        openCourseById(openBtn.dataset.openCourse, openBtn);
        return;
      }
      if (event.target.closest('[data-go-courses]') && typeof onGoToCourses === 'function') {
        event.preventDefault();
        onGoToCourses();
      }
    });

    const modal = document.getElementById('courseDetailModal');
    document.getElementById('closeDetailModal').addEventListener('click', closeCourseModalGracefully);
    document.getElementById('closeDetailModalBtn').addEventListener('click', closeCourseModalGracefully);
    modal.addEventListener('click', event => {
      if (event.target === modal) closeCourseModalGracefully();
    });
    modal.addEventListener('cancel', event => {
      event.preventDefault();
      closeCourseModalGracefully();
    });

    const exportCsvBtn = document.getElementById('btnExportCsv');
    exportCsvBtn.addEventListener('click', () => {
      const ok = exportScheduleToCsv(state.scheduleData, getFilteredEvents());
      if (ok) {
        exportCsvBtn.classList.add('is-success');
        const label = exportCsvBtn.querySelector('span');
        const prev = label?.textContent || 'CSV';
        if (label) label.textContent = 'Đã xuất';
        window.setTimeout(() => {
          exportCsvBtn.classList.remove('is-success');
          if (label) label.textContent = prev;
        }, 1200);
        notify('Đã tải xuống file CSV thời khóa biểu.');
      } else {
        notify('Không có dữ liệu để xuất CSV.');
      }
    });

    const preparePrintView = () => {
      if (!state.scheduleData) return;
      const semester = getSelectedSemesterObj();
      const academicWeek = getAcademicWeekNumber(state.weekMonday, semester);
      const filteredEvents = getFilteredEvents();
      const weekText = updateWeekLabel();
      const student = typeof getStudent === 'function' ? getStudent() : null;
      renderPrintSections(student, state.scheduleData, filteredEvents, weekText);
      if (state.viewMode !== 'week' || window.innerWidth < MOBILE_BREAKPOINT) {
        const surface = document.getElementById('scheduleSurface');
        surface.innerHTML = renderWeeklyTimeGrid(filteredEvents, state.unscheduled, state.weekMonday, academicWeek);
        window.addEventListener('afterprint', () => renderSchedule(), { once: true });
      }
    };

    document.getElementById('btnExportPdf').addEventListener('click', () => {
      if (!state.scheduleData?.courses?.length) return notify('Không có dữ liệu để xuất PDF.');
      printOrExportPdf({ isPdf: true, beforePrint: preparePrintView, onToast: notify });
    });

    document.getElementById('btnPrint').addEventListener('click', () => {
      if (!state.scheduleData?.courses?.length) return notify('Không có dữ liệu để in.');
      printOrExportPdf({ isPdf: false, beforePrint: preparePrintView });
    });

    document.addEventListener('keydown', event => {
      const section = document.getElementById('scheduleViewSection');
      if (!section || section.classList.contains('hidden')) return;
      if (event.target.matches('input, select, textarea') || modal.open) return;
      if (event.key === 'ArrowLeft') {
        transitionCalendar('prev', () => { state.weekMonday = addDays(state.weekMonday, -7); });
      } else if (event.key === 'ArrowRight') {
        transitionCalendar('next', () => { state.weekMonday = addDays(state.weekMonday, 7); });
      } else if (event.key.toLowerCase() === 't') {
        navigateToday();
      } else if (event.key === 'Escape' && !filterMenu.hidden) {
        setFilterPopover(false);
        filterBtn.focus();
      }
    });

    let lastMobile = window.innerWidth < MOBILE_BREAKPOINT;
    window.addEventListener('resize', () => {
      const section = document.getElementById('scheduleViewSection');
      if (!section || section.classList.contains('hidden')) return;
      const nowMobile = window.innerWidth < MOBILE_BREAKPOINT;
      if (nowMobile !== lastMobile) {
        lastMobile = nowMobile;
        renderSchedule();
      }
    });

    // Precision 60s tick: updates Current Time Indicator in-place (zero grid flicker) + Upcoming countdown
    window.setInterval(() => {
      const section = document.getElementById('scheduleViewSection');
      if (!section || section.classList.contains('hidden') || !state.scheduleData) return;
      updateUpcomingSmart();
      updateNowIndicatorInPlace();
    }, 60_000);
  }

  return {
    open(semesterCode = '') {
      bindEventsOnce();
      triggerPageEntrance();
      return loadSchedule(semesterCode || state.selectedSemesterCode, { staggerCards: true });
    },
    refresh() {
      if (!state.initialized) return;
      return loadSchedule(state.selectedSemesterCode, { staggerCards: false });
    }
  };
}
