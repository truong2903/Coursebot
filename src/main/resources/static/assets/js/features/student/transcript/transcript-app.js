import { apiGet } from '../../../core/api.js';
import {
  computeSemesterSummaries,
  computeTranscriptSummary,
  escapeHtml,
  exportTranscriptToCsv,
  filterAndSortTranscript
} from './transcript-utils.js?v=20261125j';
import {
  populateTranscriptDetailModal,
  renderSemesterStrip,
  renderTranscriptData,
  renderTranscriptEmpty,
  renderTranscriptError,
  renderTranscriptLoading,
  renderTranscriptPrintHeader,
  renderTranscriptStats
} from './transcript-views.js?v=20261125j';

const PAGE_SIZE = 12;

const prefersReducedMotion = () =>
  Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

export function createTranscriptController({ onToast } = {}) {
  const state = {
    data: null,
    results: [],
    filtered: [],
    semesters: [],
    lastSummary: null,
    selectedId: null,
    lastFocusedEl: null,
    page: 1,
    initialized: false,
    entranceTimer: null,
    popoverTimer: null,
    modalTimer: null,
    filters: {
      semester: '',
      outcome: '',
      search: '',
      letterGrade: '',
      credits: '',
      sort: 'semesterDesc'
    }
  };

  const notify = msg => { if (typeof onToast === 'function') onToast(msg); };

  function triggerPageEntrance() {
    const section = document.getElementById('transcriptViewSection');
    if (!section || prefersReducedMotion()) return;
    window.clearTimeout(state.entranceTimer);
    section.classList.remove('is-entering');
    void section.offsetWidth;
    section.classList.add('is-entering');
    state.entranceTimer = window.setTimeout(() => {
      section.classList.remove('is-entering');
    }, 620);
  }

  function countAdvancedFilters() {
    let n = 0;
    if (state.filters.letterGrade) n++;
    if (state.filters.credits) n++;
    if (state.filters.sort && state.filters.sort !== 'semesterDesc') n++;
    return n;
  }

  function hasAnyFilter() {
    const f = state.filters;
    return Boolean(f.semester || f.outcome || f.search.trim() || f.letterGrade || f.credits || (f.sort && f.sort !== 'semesterDesc'));
  }

  function syncToolbarMeta() {
    const clearBtn = document.getElementById('trSearchClearBtn');
    if (clearBtn) clearBtn.classList.toggle('is-visible', Boolean(state.filters.search.trim()));

    const advCount = countAdvancedFilters();
    const badge = document.getElementById('trAdvCount');
    if (badge) {
      badge.textContent = String(advCount);
      badge.classList.toggle('hidden', advCount === 0);
    }

    const resetBtn = document.getElementById('trResetAllBtn');
    if (resetBtn) resetBtn.classList.toggle('hidden', !hasAnyFilter());

    const summaryEl = document.getElementById('trResultSummary');
    if (summaryEl) {
      summaryEl.innerHTML = state.filtered.length === state.results.length
        ? `Tổng cộng <strong>${state.results.length}</strong> kết quả học phần`
        : `Hiển thị <strong>${state.filtered.length}</strong> / ${state.results.length} kết quả phù hợp`;
    }
  }

  function populateFilterDropdowns() {
    const semSelect = document.getElementById('trSemesterFilter');
    semSelect.innerHTML = '<option value="">Tất cả học kỳ</option>'
      + state.semesters.map(s => `<option value="${escapeHtml(s.semesterCode)}">${escapeHtml(s.semesterName)}</option>`).join('');
    semSelect.value = state.filters.semester;

    const letters = [...new Set(state.results.map(r => r.letterGrade).filter(Boolean))].sort();
    const letterSelect = document.getElementById('trLetterFilter');
    letterSelect.innerHTML = '<option value="">Tất cả điểm chữ</option>'
      + letters.map(l => `<option value="${escapeHtml(l)}">Điểm ${escapeHtml(l)}</option>`).join('');
    letterSelect.value = state.filters.letterGrade;

    const credits = [...new Set(state.results.map(r => r.credits).filter(c => c != null))].sort((a, b) => a - b);
    const credSelect = document.getElementById('trCreditsFilter');
    credSelect.innerHTML = '<option value="">Tất cả tín chỉ</option>'
      + credits.map(c => `<option value="${c}">${c} tín chỉ</option>`).join('');
    credSelect.value = state.filters.credits;
  }

  function syncSelectedHighlight() {
    const surface = document.getElementById('transcriptSurface');
    if (!surface) return;
    surface.querySelectorAll('[data-tr-detail]').forEach(el => {
      if (el.tagName === 'TR' || el.classList.contains('tr-mobile-card')) {
        el.classList.toggle('is-selected', state.selectedId != null && String(el.dataset.trDetail) === String(state.selectedId));
      }
    });
  }

  function render({ animateRows = false, animateBars = false, crossfade = false } = {}) {
    state.filtered = filterAndSortTranscript(state.results, state.filters);
    syncToolbarMeta();
    renderSemesterStrip(state.semesters, state.filters.semester, { animateBars });

    const surface = document.getElementById('transcriptSurface');
    if (!state.results.length) {
      surface.innerHTML = renderTranscriptEmpty(false);
      return;
    }
    if (!state.filtered.length) {
      surface.innerHTML = renderTranscriptEmpty(true);
      return;
    }

    const totalPages = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    state.page = Math.min(Math.max(1, state.page), totalPages);
    const pageItems = state.filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    surface.innerHTML = renderTranscriptData(pageItems, state.filtered.length, state.page, totalPages, PAGE_SIZE, {
      animateRows,
      selectedId: state.selectedId,
      crossfade
    });
  }

  function resetFilters() {
    state.filters = {
      semester: '',
      outcome: '',
      search: '',
      letterGrade: '',
      credits: '',
      sort: 'semesterDesc'
    };
    state.page = 1;
    document.getElementById('trSemesterFilter').value = '';
    document.getElementById('trOutcomeFilter').value = '';
    document.getElementById('trSearchInput').value = '';
    document.getElementById('trLetterFilter').value = '';
    document.getElementById('trCreditsFilter').value = '';
    document.getElementById('trSortFilter').value = 'semesterDesc';
    render({ crossfade: true });
  }

  function setAdvPopover(open) {
    const advBtn = document.getElementById('trAdvBtn');
    const advPopover = document.getElementById('trAdvPopover');
    if (!advBtn || !advPopover) return;

    window.clearTimeout(state.popoverTimer);
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
      state.popoverTimer = window.setTimeout(() => {
        advPopover.classList.remove('is-closing');
        advPopover.hidden = true;
      }, 150);
    }
  }

  function closeModalGracefully() {
    const modal = document.getElementById('transcriptDetailModal');
    if (!modal || !modal.open) {
      document.body.classList.remove('tr-modal-open');
      return;
    }

    window.clearTimeout(state.modalTimer);
    const finish = () => {
      modal.classList.remove('is-closing');
      if (modal.open) modal.close();
      document.body.classList.remove('tr-modal-open');
      state.selectedId = null;
      syncSelectedHighlight();
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

  function openDetail(itemId, triggerEl = null) {
    const item = state.results.find(r => String(r.id) === String(itemId));
    if (!item) return;
    state.selectedId = item.id;
    state.lastFocusedEl = triggerEl || document.activeElement;
    syncSelectedHighlight();
    populateTranscriptDetailModal(item);
  }

  async function loadTranscript({ animateRows = true } = {}) {
    const surface = document.getElementById('transcriptSurface');
    let skeletonShown = false;

    const skeletonTimer = window.setTimeout(() => {
      skeletonShown = true;
      surface.innerHTML = renderTranscriptLoading();
    }, state.results.length ? 140 : 60);

    try {
      const data = await apiGet('/api/student/transcript');
      window.clearTimeout(skeletonTimer);

      state.data = data;
      state.results = Array.isArray(data?.results) ? data.results : [];
      state.semesters = computeSemesterSummaries(state.results);
      state.page = 1;

      const summary = computeTranscriptSummary(data);
      renderTranscriptStats(summary, data, state.lastSummary);
      state.lastSummary = summary;
      renderTranscriptPrintHeader(data, summary);
      populateFilterDropdowns();
      render({ animateRows: animateRows || skeletonShown, animateBars: true });
    } catch (error) {
      window.clearTimeout(skeletonTimer);
      surface.innerHTML = renderTranscriptError(error.message);
    }
  }

  function bindEventsOnce() {
    if (state.initialized) return;
    state.initialized = true;

    document.getElementById('trSemesterFilter').addEventListener('change', e => {
      state.filters.semester = e.target.value;
      state.page = 1;
      render({ crossfade: true });
    });
    document.getElementById('trOutcomeFilter').addEventListener('change', e => {
      state.filters.outcome = e.target.value;
      state.page = 1;
      render({ crossfade: true });
    });
    document.getElementById('trSearchInput').addEventListener('input', e => {
      state.filters.search = e.target.value;
      state.page = 1;
      render();
    });
    document.getElementById('trSearchClearBtn')?.addEventListener('click', () => {
      const input = document.getElementById('trSearchInput');
      state.filters.search = '';
      state.page = 1;
      if (input) {
        input.value = '';
        input.focus();
      }
      render();
    });
    document.getElementById('trLetterFilter').addEventListener('change', e => {
      state.filters.letterGrade = e.target.value;
      state.page = 1;
      render({ crossfade: true });
    });
    document.getElementById('trCreditsFilter').addEventListener('change', e => {
      state.filters.credits = e.target.value;
      state.page = 1;
      render({ crossfade: true });
    });
    document.getElementById('trSortFilter').addEventListener('change', e => {
      state.filters.sort = e.target.value;
      state.page = 1;
      render({ crossfade: true });
    });

    document.getElementById('trSemesterStrip').addEventListener('click', e => {
      const card = e.target.closest('[data-tr-semester]');
      if (!card) return;
      const sem = card.dataset.trSemester;
      state.filters.semester = state.filters.semester === sem ? '' : sem;
      document.getElementById('trSemesterFilter').value = state.filters.semester;
      state.page = 1;
      render({ crossfade: true });
    });

    const advWrap = document.getElementById('trAdvWrap');
    const advBtn = document.getElementById('trAdvBtn');
    const advPopover = document.getElementById('trAdvPopover');
    advBtn.addEventListener('click', () => setAdvPopover(advPopover.hidden));
    document.addEventListener('pointerdown', e => {
      if (!advWrap.contains(e.target) && !advPopover.hidden) setAdvPopover(false);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !advPopover.hidden) {
        setAdvPopover(false);
        advBtn.focus();
      }
    });

    document.getElementById('trResetAllBtn').addEventListener('click', () => {
      resetFilters();
      setAdvPopover(false);
    });
    document.getElementById('trAdvResetBtn').addEventListener('click', () => {
      state.filters.letterGrade = '';
      state.filters.credits = '';
      state.filters.sort = 'semesterDesc';
      document.getElementById('trLetterFilter').value = '';
      document.getElementById('trCreditsFilter').value = '';
      document.getElementById('trSortFilter').value = 'semesterDesc';
      state.page = 1;
      render({ crossfade: true });
    });

    const exportBtn = document.getElementById('trExportCsvBtn');
    exportBtn.addEventListener('click', () => {
      const ok = exportTranscriptToCsv(state.data, state.filtered);
      if (ok) {
        exportBtn.classList.add('is-success');
        const label = exportBtn.querySelector('span');
        const prev = label?.textContent || 'Xuất CSV';
        if (label) label.textContent = 'Đã xuất';
        window.setTimeout(() => {
          exportBtn.classList.remove('is-success');
          if (label) label.textContent = prev;
        }, 1200);
        notify('Đã xuất file CSV bảng điểm học tập.');
      } else {
        notify('Chưa có dữ liệu bảng điểm để xuất.');
      }
    });

    document.getElementById('trPrintBtn').addEventListener('click', () => {
      if (!state.results.length) return notify('Chưa có dữ liệu bảng điểm để in.');
      document.body.classList.add('printing-transcript');
      window.addEventListener('afterprint', () => document.body.classList.remove('printing-transcript'), { once: true });
      window.setTimeout(() => window.print(), 60);
    });

    const surface = document.getElementById('transcriptSurface');
    surface.addEventListener('click', e => {
      const pageBtn = e.target.closest('[data-tr-page]');
      if (pageBtn && !pageBtn.disabled) {
        state.page = Number(pageBtn.dataset.trPage);
        render({ animateRows: true });
        return;
      }
      if (e.target.closest('#trEmptyResetBtn')) {
        resetFilters();
        return;
      }
      if (e.target.closest('#trRetryBtn')) {
        loadTranscript({ animateRows: true });
        return;
      }
      const detailTarget = e.target.closest('[data-tr-detail]');
      if (detailTarget) {
        openDetail(detailTarget.dataset.trDetail, detailTarget);
      }
    });

    surface.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const row = e.target.closest('tr[data-tr-detail]');
      if (row) {
        e.preventDefault();
        openDetail(row.dataset.trDetail, row);
      }
    });

    const modal = document.getElementById('transcriptDetailModal');
    document.getElementById('closeTrDetailModal').addEventListener('click', closeModalGracefully);
    document.getElementById('closeTrDetailBtn').addEventListener('click', closeModalGracefully);
    modal.addEventListener('click', e => {
      if (e.target === modal) closeModalGracefully();
    });
    modal.addEventListener('cancel', e => {
      e.preventDefault();
      closeModalGracefully();
    });
  }

  return {
    open() {
      bindEventsOnce();
      triggerPageEntrance();
      return loadTranscript({ animateRows: true });
    }
  };
}
