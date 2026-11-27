import { apiGet } from '../../../core/api.js';
import {
  computeCurriculumStats,
  escapeHtml,
  exportCurriculumToCsv,
  filterCurriculumCourses
} from './curriculum-utils.js?v=20261125f';
import {
  populateCurriculumDetailModal,
  renderCurriculumContent,
  renderCurriculumEmpty,
  renderCurriculumError,
  renderCurriculumHeader,
  renderCurriculumLoading,
  renderCurriculumPrintHeader
} from './curriculum-views.js?v=20261125f';

export function createCurriculumController({ onToast, getEnrolledCourseCodes } = {}) {
  const state = {
    options: [],
    curriculum: null,
    courses: [],
    filtered: [],
    completedCodes: new Set(),
    initialized: false,
    filters: {
      term: '',
      type: '',
      progress: '',
      credits: '',
      search: '',
      layout: 'grouped'
    }
  };

  const notify = msg => { if (typeof onToast === 'function') onToast(msg); };

  function getEnrolledSet() {
    const raw = typeof getEnrolledCourseCodes === 'function' ? getEnrolledCourseCodes() : [];
    return new Set(raw.map(c => String(c || '').toUpperCase()));
  }

  function countAdvancedFilters() {
    let n = 0;
    if (state.filters.progress) n++;
    if (state.filters.credits) n++;
    if (state.filters.layout && state.filters.layout !== 'grouped') n++;
    return n;
  }

  function hasAnyFilter() {
    const f = state.filters;
    return Boolean(f.term || f.type || f.progress || f.credits || f.search.trim());
  }

  function syncToolbarMeta() {
    const advCount = countAdvancedFilters();
    const badge = document.getElementById('curAdvCount');
    if (badge) {
      badge.textContent = String(advCount);
      badge.classList.toggle('hidden', advCount === 0);
    }

    const resetBtn = document.getElementById('curResetAllBtn');
    if (resetBtn) resetBtn.classList.toggle('hidden', !hasAnyFilter());

    const summaryEl = document.getElementById('curResultSummary');
    if (summaryEl) {
      summaryEl.innerHTML = state.filtered.length === state.courses.length
        ? `Hiển thị toàn bộ <strong>${state.courses.length}</strong> học phần trong khung`
        : `Hiển thị <strong>${state.filtered.length}</strong> / ${state.courses.length} học phần phù hợp`;
    }
  }

  function populateFilterOptions() {
    const terms = [...new Set(state.courses.map(c => c.suggestedSemester || 'Chưa phân kỳ'))];
    const termSelect = document.getElementById('curTermFilter');
    termSelect.innerHTML = '<option value="">Tất cả học kỳ đề xuất</option>'
      + terms.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    termSelect.value = state.filters.term;

    const credits = [...new Set(state.courses.map(c => c.credits).filter(c => c != null))].sort((a, b) => a - b);
    const credSelect = document.getElementById('curCreditsFilter');
    credSelect.innerHTML = '<option value="">Tất cả tín chỉ</option>'
      + credits.map(c => `<option value="${c}">${c} tín chỉ</option>`).join('');
    credSelect.value = state.filters.credits;
  }

  function render() {
    if (!state.curriculum) return;
    const enrolledCodes = getEnrolledSet();
    const stats = computeCurriculumStats(state.courses, state.completedCodes, enrolledCodes);
    renderCurriculumHeader(state.curriculum, stats);
    renderCurriculumPrintHeader(state.curriculum, stats);

    state.filtered = filterCurriculumCourses(state.courses, state.filters, state.completedCodes, enrolledCodes);
    syncToolbarMeta();

    const surface = document.getElementById('curriculumSurface');
    if (!state.courses.length) {
      surface.innerHTML = renderCurriculumEmpty(false);
      return;
    }
    if (!state.filtered.length) {
      surface.innerHTML = renderCurriculumEmpty(true);
      return;
    }

    surface.innerHTML = renderCurriculumContent(state.filtered, state.filters.layout, state.completedCodes, enrolledCodes);
  }

  function resetFilters() {
    state.filters.term = '';
    state.filters.type = '';
    state.filters.progress = '';
    state.filters.credits = '';
    state.filters.search = '';
    document.getElementById('curTermFilter').value = '';
    document.getElementById('curTypeFilter').value = '';
    document.getElementById('curProgressFilter').value = '';
    document.getElementById('curCreditsFilter').value = '';
    document.getElementById('curSearchInput').value = '';
    render();
  }

  async function loadCurriculum(code = '') {
    const surface = document.getElementById('curriculumSurface');
    surface.innerHTML = renderCurriculumLoading();

    try {
      const [options, selected, transcript] = await Promise.all([
        state.options.length ? Promise.resolve(state.options) : apiGet('/api/student/curricula'),
        apiGet(code ? `/api/student/curriculum?code=${encodeURIComponent(code)}` : '/api/student/curriculum'),
        apiGet('/api/student/transcript').catch(() => null)
      ]);

      state.options = Array.isArray(options) ? options : [];
      state.curriculum = selected?.curriculum || null;
      state.courses = Array.isArray(selected?.courses) ? selected.courses : [];

      const passedSet = new Set();
      if (Array.isArray(transcript?.results)) {
        transcript.results.forEach(r => {
          if (r.passed && r.courseCode) passedSet.add(String(r.courseCode).toUpperCase());
        });
      }
      state.completedCodes = passedSet;

      const selector = document.getElementById('curProgramSelect');
      selector.innerHTML = state.options
        .map(opt => `<option value="${escapeHtml(opt.code)}" ${opt.code === state.curriculum?.code ? 'selected' : ''}>${escapeHtml(opt.name)} · Khóa ${escapeHtml(opt.cohort)}</option>`)
        .join('');

      populateFilterOptions();
      render();
    } catch (error) {
      surface.innerHTML = renderCurriculumError(error.message);
    }
  }

  function bindEventsOnce() {
    if (state.initialized) return;
    state.initialized = true;

    document.getElementById('curProgramSelect').addEventListener('change', e => {
      resetFilters();
      loadCurriculum(e.target.value);
    });
    document.getElementById('curTermFilter').addEventListener('change', e => {
      state.filters.term = e.target.value;
      render();
    });
    document.getElementById('curTypeFilter').addEventListener('change', e => {
      state.filters.type = e.target.value;
      render();
    });
    document.getElementById('curSearchInput').addEventListener('input', e => {
      state.filters.search = e.target.value;
      render();
    });
    document.getElementById('curProgressFilter').addEventListener('change', e => {
      state.filters.progress = e.target.value;
      render();
    });
    document.getElementById('curCreditsFilter').addEventListener('change', e => {
      state.filters.credits = e.target.value;
      render();
    });
    document.getElementById('curLayoutFilter').addEventListener('change', e => {
      state.filters.layout = e.target.value;
      render();
    });

    const advWrap = document.getElementById('curAdvWrap');
    const advBtn = document.getElementById('curAdvBtn');
    const advPopover = document.getElementById('curAdvPopover');
    const setAdvOpen = open => {
      advPopover.hidden = !open;
      advBtn.setAttribute('aria-expanded', String(open));
    };
    advBtn.addEventListener('click', () => setAdvOpen(advPopover.hidden));
    document.addEventListener('pointerdown', e => {
      if (!advWrap.contains(e.target)) setAdvOpen(false);
    });

    document.getElementById('curResetAllBtn').addEventListener('click', () => {
      resetFilters();
      setAdvOpen(false);
    });
    document.getElementById('curAdvResetBtn').addEventListener('click', () => {
      state.filters.progress = '';
      state.filters.credits = '';
      state.filters.layout = 'grouped';
      document.getElementById('curProgressFilter').value = '';
      document.getElementById('curCreditsFilter').value = '';
      document.getElementById('curLayoutFilter').value = 'grouped';
      render();
    });

    document.getElementById('curExportCsvBtn').addEventListener('click', () => {
      const ok = exportCurriculumToCsv(state.curriculum, state.filtered, state.completedCodes, getEnrolledSet());
      notify(ok ? 'Đã xuất file CSV khung chương trình.' : 'Không có dữ liệu để xuất.');
    });

    document.getElementById('curPrintBtn').addEventListener('click', () => {
      if (!state.courses.length) return notify('Chưa có dữ liệu để in.');
      document.body.classList.add('printing-curriculum');
      window.addEventListener('afterprint', () => document.body.classList.remove('printing-curriculum'), { once: true });
      window.setTimeout(() => window.print(), 60);
    });

    const surface = document.getElementById('curriculumSurface');
    surface.addEventListener('click', e => {
      if (e.target.closest('#curEmptyResetBtn')) {
        resetFilters();
        return;
      }
      if (e.target.closest('#curRetryBtn')) {
        loadCurriculum(state.curriculum?.code || '');
        return;
      }
      const target = e.target.closest('[data-cur-detail]');
      if (target) {
        const item = state.courses.find(c => String(c.id) === String(target.dataset.curDetail));
        if (item) populateCurriculumDetailModal(item, state.completedCodes, getEnrolledSet());
      }
    });

    surface.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const row = e.target.closest('tr[data-cur-detail]');
      if (row) {
        e.preventDefault();
        const item = state.courses.find(c => String(c.id) === String(row.dataset.curDetail));
        if (item) populateCurriculumDetailModal(item, state.completedCodes, getEnrolledSet());
      }
    });

    const modal = document.getElementById('curriculumDetailModal');
    document.getElementById('closeCurDetailModal').addEventListener('click', () => modal.close());
    document.getElementById('closeCurDetailBtn').addEventListener('click', () => modal.close());
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.close();
    });
  }

  return {
    open() {
      bindEventsOnce();
      return loadCurriculum(state.curriculum?.code || '');
    },
    refresh() {
      if (!state.initialized) return;
      render();
    }
  };
}
