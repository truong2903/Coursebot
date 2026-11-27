import { apiGet } from '../../../core/api.js';
import {
  computeHistoryStats,
  escapeHtml,
  exportHistoryToCsv,
  filterAndSortHistory
} from './history-utils.js?v=20261125h';
import {
  populateRegistrationDetailModal,
  renderHistoryData,
  renderHistoryEmpty,
  renderHistoryError,
  renderHistoryLoading,
  renderHistoryStats
} from './history-views.js?v=20261125h';

const PAGE_SIZE = 10;

const prefersReducedMotion = () =>
  Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

export function createHistoryController({ onToast, onGoToCourses, onOpenCourseDetails } = {}) {
  const state = {
    records: [],
    filtered: [],
    sectionCache: new Map(),
    lastStats: null,
    selectedRecordId: null,
    lastFocusedEl: null,
    page: 1,
    initialized: false,
    hasAnimatedEntrance: false,
    popoverClosingTimer: null,
    modalClosingTimer: null,
    entranceTimer: null,
    filters: {
      semester: '',
      status: '',
      search: '',
      credits: '',
      weekday: '',
      sort: 'newest'
    }
  };

  const notify = msg => { if (typeof onToast === 'function') onToast(msg); };

  function triggerPageEntrance() {
    const section = document.getElementById('historyViewSection');
    if (!section || prefersReducedMotion()) return;
    window.clearTimeout(state.entranceTimer);
    section.classList.remove('is-entering');
    void section.offsetWidth; // trigger single entrance transition on view open
    section.classList.add('is-entering');
    state.entranceTimer = window.setTimeout(() => {
      section.classList.remove('is-entering');
    }, 620);
  }

  function countAdvancedFilters() {
    let n = 0;
    if (state.filters.credits) n++;
    if (state.filters.weekday) n++;
    if (state.filters.sort && state.filters.sort !== 'newest') n++;
    return n;
  }

  function hasAnyFilter() {
    const f = state.filters;
    return Boolean(f.semester || f.status || f.search.trim() || f.credits || f.weekday || (f.sort && f.sort !== 'newest'));
  }

  function syncSearchClearButton() {
    const clearBtn = document.getElementById('histSearchClearBtn');
    if (!clearBtn) return;
    clearBtn.classList.toggle('is-visible', Boolean(state.filters.search.trim()));
  }

  function syncToolbarMeta() {
    syncSearchClearButton();

    const countBadge = document.getElementById('histAdvCount');
    const advCount = countAdvancedFilters();
    if (countBadge) {
      countBadge.textContent = String(advCount);
      countBadge.classList.toggle('hidden', advCount === 0);
    }

    const resetBtn = document.getElementById('histResetAllBtn');
    if (resetBtn) resetBtn.classList.toggle('hidden', !hasAnyFilter());

    const summaryEl = document.getElementById('histResultSummary');
    if (summaryEl) {
      summaryEl.innerHTML = state.filtered.length === state.records.length
        ? `Tổng cộng <strong>${state.records.length}</strong> bản ghi đăng ký`
        : `Hiển thị <strong>${state.filtered.length}</strong> / ${state.records.length} bản ghi phù hợp`;
    }
  }

  function populateFilterDropdowns() {
    const semesters = [...new Map(state.records.map(r => [r.semesterCode, r.semesterName])).entries()];
    const semSelect = document.getElementById('histSemesterFilter');
    semSelect.innerHTML = '<option value="">Tất cả học kỳ</option>'
      + semesters.map(([code, name]) => `<option value="${escapeHtml(code)}">${escapeHtml(name)}</option>`).join('');
    semSelect.value = state.filters.semester;

    const credits = [...new Set(state.records.map(r => r.credits).filter(c => c != null))].sort((a, b) => a - b);
    const credSelect = document.getElementById('histCreditsFilter');
    credSelect.innerHTML = '<option value="">Tất cả tín chỉ</option>'
      + credits.map(c => `<option value="${c}">${c} tín chỉ</option>`).join('');
    credSelect.value = state.filters.credits;
  }

  function syncSelectedRowHighlight() {
    const surface = document.getElementById('historySurface');
    if (!surface) return;
    surface.querySelectorAll('[data-hist-detail]').forEach(el => {
      if (el.tagName === 'TR' || el.classList.contains('hist-mobile-card')) {
        el.classList.toggle('is-selected', state.selectedRecordId != null && String(el.dataset.histDetail) === String(state.selectedRecordId));
      }
    });
  }

  function render({ animateRows = false } = {}) {
    state.filtered = filterAndSortHistory(state.records, state.filters);
    syncToolbarMeta();

    const surface = document.getElementById('historySurface');
    if (!state.records.length) {
      surface.innerHTML = renderHistoryEmpty(false);
      return;
    }
    if (!state.filtered.length) {
      surface.innerHTML = renderHistoryEmpty(true);
      return;
    }

    const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    const pageItems = state.filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    surface.innerHTML = renderHistoryData(pageItems, state.filtered.length, state.page, totalPages, PAGE_SIZE, {
      animateRows,
      selectedRecordId: state.selectedRecordId
    });
  }

  function resetFilters() {
    state.filters = {
      semester: '',
      status: '',
      search: '',
      credits: '',
      weekday: '',
      sort: 'newest'
    };
    state.page = 1;
    document.getElementById('histSemesterFilter').value = '';
    document.getElementById('histStatusFilter').value = '';
    document.getElementById('histSearchInput').value = '';
    document.getElementById('histCreditsFilter').value = '';
    document.getElementById('histWeekdayFilter').value = '';
    document.getElementById('histSortFilter').value = 'newest';
    render({ animateRows: false });
  }

  function closeDetailModalGracefully(onClosed = null) {
    const modal = document.getElementById('registrationDetailModal');
    if (!modal || !modal.open) {
      document.body.classList.remove('hist-modal-open');
      if (typeof onClosed === 'function') onClosed();
      return;
    }

    window.clearTimeout(state.modalClosingTimer);
    const finishClose = () => {
      modal.classList.remove('is-closing');
      if (modal.open) modal.close();
      document.body.classList.remove('hist-modal-open');
      state.selectedRecordId = null;
      syncSelectedRowHighlight();
      if (state.lastFocusedEl && typeof state.lastFocusedEl.focus === 'function') {
        state.lastFocusedEl.focus({ preventScroll: true });
      }
      state.lastFocusedEl = null;
      if (typeof onClosed === 'function') onClosed();
    };

    if (prefersReducedMotion()) {
      finishClose();
      return;
    }

    modal.classList.add('is-closing');
    state.modalClosingTimer = window.setTimeout(finishClose, 180);
  }

  async function openDetailById(recordId, triggerEl = null) {
    const record = state.records.find(r => String(r.id) === String(recordId));
    if (!record) return;

    state.selectedRecordId = record.id;
    state.lastFocusedEl = triggerEl || document.activeElement;
    syncSelectedRowHighlight();

    const cached = record.sectionId ? state.sectionCache.get(record.sectionId) : null;
    if (cached) {
      populateRegistrationDetailModal(record, cached, false);
      return;
    }

    populateRegistrationDetailModal(record, null, Boolean(record.sectionId));
    if (!record.sectionId) return;

    try {
      const detail = await apiGet(`/api/courses/${encodeURIComponent(record.sectionId)}`);
      state.sectionCache.set(record.sectionId, detail);
      const modal = document.getElementById('registrationDetailModal');
      if (modal.open && !modal.classList.contains('is-closing') && String(state.selectedRecordId) === String(record.id)) {
        populateRegistrationDetailModal(record, detail, false);
      }
    } catch {
      const modal = document.getElementById('registrationDetailModal');
      if (modal.open && !modal.classList.contains('is-closing') && String(state.selectedRecordId) === String(record.id)) {
        populateRegistrationDetailModal(record, null, false);
      }
    }
  }

  async function loadHistory({ animateRows = true } = {}) {
    const surface = document.getElementById('historySurface');
    let skeletonShown = false;

    // Avoid flashing skeleton on fast LAN responses (< 140ms)
    const skeletonTimer = window.setTimeout(() => {
      skeletonShown = true;
      surface.innerHTML = renderHistoryLoading();
    }, state.records.length ? 140 : 60);

    try {
      const data = await apiGet('/api/enrollments/history');
      window.clearTimeout(skeletonTimer);

      state.records = Array.isArray(data) ? data : [];
      state.page = 1;

      const nextStats = computeHistoryStats(state.records);
      renderHistoryStats(nextStats, state.lastStats);
      state.lastStats = nextStats;

      populateFilterDropdowns();
      render({ animateRows: animateRows || skeletonShown });
    } catch (error) {
      window.clearTimeout(skeletonTimer);
      surface.innerHTML = renderHistoryError(error.message);
    }
  }

  function setPopoverState(open) {
    const advBtn = document.getElementById('histAdvBtn');
    const advPopover = document.getElementById('histAdvPopover');
    if (!advBtn || !advPopover) return;

    window.clearTimeout(state.popoverClosingTimer);
    if (open) {
      advPopover.hidden = false;
      advPopover.classList.remove('is-closing');
      advPopover.classList.add('is-open');
      advBtn.setAttribute('aria-expanded', 'true');
    } else {
      if (advPopover.hidden) return;
      advBtn.setAttribute('aria-expanded', 'false');
      if (prefersReducedMotion()) {
        advPopover.classList.remove('is-open', 'is-closing');
        advPopover.hidden = true;
        return;
      }
      advPopover.classList.remove('is-open');
      advPopover.classList.add('is-closing');
      state.popoverClosingTimer = window.setTimeout(() => {
        advPopover.classList.remove('is-closing');
        advPopover.hidden = true;
      }, 150);
    }
  }

  function bindEventsOnce() {
    if (state.initialized) return;
    state.initialized = true;

    document.getElementById('histSemesterFilter').addEventListener('change', e => {
      state.filters.semester = e.target.value;
      state.page = 1;
      render({ animateRows: false });
    });
    document.getElementById('histStatusFilter').addEventListener('change', e => {
      state.filters.status = e.target.value;
      state.page = 1;
      render({ animateRows: false });
    });
    document.getElementById('histSearchInput').addEventListener('input', e => {
      state.filters.search = e.target.value;
      state.page = 1;
      render({ animateRows: false });
    });
    document.getElementById('histSearchClearBtn')?.addEventListener('click', () => {
      const input = document.getElementById('histSearchInput');
      state.filters.search = '';
      state.page = 1;
      if (input) {
        input.value = '';
        input.focus();
      }
      render({ animateRows: false });
    });
    document.getElementById('histCreditsFilter').addEventListener('change', e => {
      state.filters.credits = e.target.value;
      state.page = 1;
      render({ animateRows: false });
    });
    document.getElementById('histWeekdayFilter').addEventListener('change', e => {
      state.filters.weekday = e.target.value;
      state.page = 1;
      render({ animateRows: false });
    });
    document.getElementById('histSortFilter').addEventListener('change', e => {
      state.filters.sort = e.target.value;
      state.page = 1;
      render({ animateRows: false });
    });

    const advWrap = document.getElementById('histAdvWrap');
    const advBtn = document.getElementById('histAdvBtn');
    const advPopover = document.getElementById('histAdvPopover');
    advBtn.addEventListener('click', () => setPopoverState(advPopover.hidden));
    document.addEventListener('pointerdown', e => {
      if (!advWrap.contains(e.target) && !advPopover.hidden) setPopoverState(false);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !advPopover.hidden) {
        setPopoverState(false);
        advBtn.focus();
      }
    });

    document.getElementById('histResetAllBtn').addEventListener('click', () => {
      resetFilters();
      setPopoverState(false);
    });
    document.getElementById('histAdvResetBtn').addEventListener('click', () => {
      state.filters.credits = '';
      state.filters.weekday = '';
      state.filters.sort = 'newest';
      document.getElementById('histCreditsFilter').value = '';
      document.getElementById('histWeekdayFilter').value = '';
      document.getElementById('histSortFilter').value = 'newest';
      state.page = 1;
      render({ animateRows: false });
    });

    const exportBtn = document.getElementById('histExportCsvBtn');
    exportBtn.addEventListener('click', () => {
      const ok = exportHistoryToCsv(state.filtered);
      if (ok) {
        exportBtn.classList.add('is-success');
        const label = exportBtn.querySelector('span');
        const prevText = label?.textContent || 'Xuất CSV';
        if (label) label.textContent = 'Đã xuất';
        window.setTimeout(() => {
          exportBtn.classList.remove('is-success');
          if (label) label.textContent = prevText;
        }, 1200);
        notify('Đã xuất file CSV lịch sử đăng ký.');
      } else {
        notify('Không có bản ghi để xuất.');
      }
    });

    const surface = document.getElementById('historySurface');
    surface.addEventListener('click', e => {
      const pageBtn = e.target.closest('[data-hist-page]');
      if (pageBtn && !pageBtn.disabled) {
        state.page = Number(pageBtn.dataset.histPage);
        render({ animateRows: true });
        return;
      }
      if (e.target.closest('#histEmptyResetBtn')) {
        resetFilters();
        return;
      }
      if (e.target.closest('#histRetryBtn')) {
        loadHistory({ animateRows: true });
        return;
      }
      if (e.target.closest('[data-hist-go-courses]') && typeof onGoToCourses === 'function') {
        onGoToCourses();
        return;
      }
      const detailTarget = e.target.closest('[data-hist-detail]');
      if (detailTarget) {
        openDetailById(detailTarget.dataset.histDetail, detailTarget);
      }
    });

    surface.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const row = e.target.closest('tr[data-hist-detail]');
      if (row) {
        e.preventDefault();
        openDetailById(row.dataset.histDetail, row);
      }
    });

    const modal = document.getElementById('registrationDetailModal');
    document.getElementById('closeRegDetailModal').addEventListener('click', () => closeDetailModalGracefully());
    document.getElementById('closeRegDetailBtn').addEventListener('click', () => closeDetailModalGracefully());
    modal.addEventListener('click', e => {
      if (e.target === modal) closeDetailModalGracefully();
    });
    modal.addEventListener('cancel', e => {
      e.preventDefault();
      closeDetailModalGracefully();
    });

    document.getElementById('regDetailOpenCourseBtn')?.addEventListener('click', e => {
      const sectionId = e.currentTarget.dataset.sectionId;
      if (sectionId && typeof onOpenCourseDetails === 'function') {
        closeDetailModalGracefully(() => onOpenCourseDetails(sectionId));
      }
    });
  }

  return {
    open() {
      bindEventsOnce();
      triggerPageEntrance();
      return loadHistory({ animateRows: true });
    },
    refresh() {
      if (!state.initialized) return;
      return loadHistory({ animateRows: false });
    }
  };
}
