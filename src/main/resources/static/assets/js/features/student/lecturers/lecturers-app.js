import { apiGet } from '../../../core/api.js';

const escapeHtml = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const monogram = name => String(name || 'GV').trim().split(/\s+/).slice(-2).map(p => p[0] || '').join('').toUpperCase() || 'GV';
const prefersReducedMotion = () => Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

function safeHttpUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function titlePrefix(lecturer) {
  return [lecturer.academicTitle, lecturer.academicDegree].filter(Boolean).join(' · ');
}

function toneFor(text) {
  let hash = 0;
  const str = String(text || '');
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  return `tone-${Math.abs(hash) % 4}`;
}

export function createLecturersController({ onToast, onOpenCourseDetails } = {}) {
  const state = {
    lecturers: [],
    loaded: false,
    loading: false,
    filters: {
      search: '',
      department: '',
      subjectGroup: '',
      onlyTeaching: false
    },
    lastCounts: {},
    entranceTimer: null,
    modalCloseTimer: null,
    lastFocusedEl: null,
    bound: false
  };

  const notify = msg => { if (typeof onToast === 'function') onToast(msg); };

  function animateCounter(el, target, key) {
    if (!el) return;
    const num = Number(target) || 0;
    const prev = state.lastCounts[key];
    state.lastCounts[key] = num;
    if (prefersReducedMotion() || prev === num) {
      el.textContent = String(num);
      return;
    }
    const from = prev ?? 0;
    const start = performance.now();
    const tick = now => {
      const t = Math.min(1, (now - start) / 460);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(from + (num - from) * eased));
      if (t < 1) requestAnimationFrame(tick);
      else el.textContent = String(num);
    };
    requestAnimationFrame(tick);
  }

  function triggerEntrance() {
    const section = document.getElementById('lecturersViewSection');
    if (!section || prefersReducedMotion()) return;
    window.clearTimeout(state.entranceTimer);
    section.classList.remove('is-entering');
    void section.offsetWidth;
    section.classList.add('is-entering');
    state.entranceTimer = window.setTimeout(() => section.classList.remove('is-entering'), 620);
  }

  function renderSkeleton() {
    const surface = document.getElementById('lecturersSurface');
    if (!surface) return;
    const card = `
      <div class="lec-card" aria-hidden="true" style="cursor:default">
        <div class="lec-card-head">
          <div class="lec-skel" style="width:46px;height:46px;border-radius:13px;flex-shrink:0"></div>
          <div style="flex:1;display:grid;gap:7px">
            <div class="lec-skel" style="height:12px;width:45%"></div>
            <div class="lec-skel" style="height:15px;width:78%"></div>
          </div>
        </div>
        <div class="lec-skel" style="height:12px;width:90%"></div>
        <div class="lec-skel" style="height:12px;width:65%"></div>
      </div>`;
    surface.innerHTML = `<div class="lec-grid">${card.repeat(6)}</div>`;
  }

  function renderStats() {
    const total = state.lecturers.length;
    const teaching = state.lecturers.filter(l => (l.activeSectionCount || 0) > 0).length;
    const departments = new Set(state.lecturers.map(l => l.department).filter(Boolean)).size;
    const groups = new Set(state.lecturers.map(l => l.subjectGroup).filter(Boolean)).size;

    animateCounter(document.getElementById('lecStatTotal'), total, 'total');
    animateCounter(document.getElementById('lecStatTeaching'), teaching, 'teaching');
    animateCounter(document.getElementById('lecStatDepartments'), departments, 'departments');
    animateCounter(document.getElementById('lecStatGroups'), groups, 'groups');

    const badge = document.getElementById('lecTotalBadge');
    if (badge) badge.textContent = `${total} giảng viên`;
  }

  function populateFilters() {
    const depts = [...new Set(state.lecturers.map(l => l.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
    const groups = [...new Set(state.lecturers.map(l => l.subjectGroup).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));

    const deptEl = document.getElementById('lecDepartmentFilter');
    if (deptEl) {
      deptEl.innerHTML = '<option value="">Tất cả khoa / viện</option>' + depts.map(d => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
      deptEl.value = state.filters.department;
    }

    const groupEl = document.getElementById('lecGroupFilter');
    if (groupEl) {
      groupEl.innerHTML = '<option value="">Tất cả bộ môn</option>' + groups.map(g => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join('');
      groupEl.value = state.filters.subjectGroup;
    }
  }

  function hasActiveFilters() {
    const f = state.filters;
    return Boolean(f.search.trim() || f.department || f.subjectGroup || f.onlyTeaching);
  }

  function getFilteredLecturers() {
    const q = state.filters.search.trim().toLocaleLowerCase('vi');
    return state.lecturers.filter(l => {
      if (state.filters.department && l.department !== state.filters.department) return false;
      if (state.filters.subjectGroup && l.subjectGroup !== state.filters.subjectGroup) return false;
      if (state.filters.onlyTeaching && (l.activeSectionCount || 0) === 0) return false;
      if (q) {
        const hay = `${l.lecturerCode} ${l.fullName} ${l.department} ${l.subjectGroup || ''} ${l.academicDegree || ''} ${l.academicTitle || ''} ${l.researchInterests || ''} ${l.email || ''}`.toLocaleLowerCase('vi');
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function renderGrid({ crossfade = false } = {}) {
    const filtered = getFilteredLecturers();

    document.getElementById('lecSearchClearBtn')?.classList.toggle('is-visible', Boolean(state.filters.search.trim()));
    document.getElementById('lecResetBtn')?.classList.toggle('hidden', !hasActiveFilters());

    const summaryEl = document.getElementById('lecResultSummary');
    if (summaryEl) {
      summaryEl.innerHTML = filtered.length === state.lecturers.length
        ? `Hiển thị toàn bộ <strong>${state.lecturers.length}</strong> giảng viên`
        : `Hiển thị <strong>${filtered.length}</strong> / ${state.lecturers.length} giảng viên phù hợp`;
    }

    const surface = document.getElementById('lecturersSurface');
    if (!surface) return;

    if (!filtered.length) {
      surface.innerHTML = `
        <div class="ov-empty-box">
          <strong>Không tìm thấy giảng viên phù hợp</strong>
          <p>Thử tìm theo tên khác, khoa/bộ môn khác hoặc đặt lại bộ lọc.</p>
          ${hasActiveFilters() ? '<button class="dash-btn" type="button" id="lecEmptyResetBtn">Đặt lại bộ lọc</button>' : ''}
        </div>`;
      surface.querySelector('#lecEmptyResetBtn')?.addEventListener('click', resetFilters);
      return;
    }

    const cardsHtml = filtered.map((lec, idx) => {
      const prefix = titlePrefix(lec);
      const bioPreview = lec.bio || lec.researchInterests || 'Bấm để xem thông tin liên hệ, giờ tiếp sinh viên và các học phần phụ trách.';
      return `
        <button class="lec-card" type="button" data-lec-code="${escapeHtml(lec.lecturerCode)}" style="--card-i:${Math.min(idx, 12)}">
          <div class="lec-card-head">
            <span class="lec-avatar ${toneFor(lec.department || lec.fullName)}">${escapeHtml(monogram(lec.fullName))}</span>
            <div class="lec-card-identity">
              ${prefix ? `<span class="lec-card-title-prefix">${escapeHtml(prefix)}</span>` : ''}
              <strong>${escapeHtml(lec.fullName)}</strong>
              <small>${escapeHtml(lec.lecturerCode)}</small>
            </div>
          </div>
          <div class="lec-card-tags">
            <span class="lec-tag">${escapeHtml(lec.department || 'Chưa cập nhật khoa')}</span>
            ${lec.subjectGroup ? `<span class="lec-tag">${escapeHtml(lec.subjectGroup)}</span>` : ''}
            ${lec.activeSectionCount > 0 ? `<span class="lec-tag is-teaching">Đang dạy ${lec.activeSectionCount} lớp</span>` : ''}
          </div>
          <p class="lec-card-bio">${escapeHtml(bioPreview)}</p>
          <div class="lec-card-foot">
            <span class="lec-card-foot-email">${escapeHtml(lec.email || lec.officeLocation || 'Chưa cập nhật email')}</span>
            <span class="lec-card-cta">Xem hồ sơ →</span>
          </div>
        </button>`;
    }).join('');

    surface.innerHTML = `<div class="lec-grid ${crossfade && !prefersReducedMotion() ? 'is-updating' : ''}">${cardsHtml}</div>`;
  }

  function resetFilters() {
    state.filters = { search: '', department: '', subjectGroup: '', onlyTeaching: false };
    const searchEl = document.getElementById('lecSearchInput');
    if (searchEl) searchEl.value = '';
    const deptEl = document.getElementById('lecDepartmentFilter');
    if (deptEl) deptEl.value = '';
    const grpEl = document.getElementById('lecGroupFilter');
    if (grpEl) grpEl.value = '';
    document.getElementById('lecOnlyTeachingToggle')?.classList.remove('selected');
    renderGrid({ crossfade: true });
  }

  function closeModalSmooth() {
    const modal = document.getElementById('lecturerProfileModal');
    if (!modal || !modal.open) return;
    if (prefersReducedMotion()) {
      modal.close();
      document.body.classList.remove('lec-modal-open');
      state.lastFocusedEl?.focus?.();
      return;
    }
    window.clearTimeout(state.modalCloseTimer);
    modal.classList.add('is-closing');
    state.modalCloseTimer = window.setTimeout(() => {
      modal.classList.remove('is-closing');
      if (modal.open) modal.close();
      document.body.classList.remove('lec-modal-open');
      state.lastFocusedEl?.focus?.();
    }, 170);
  }

  function renderProfileModalContent(profile) {
    const avatarEl = document.getElementById('lecModalAvatar');
    const badgesEl = document.getElementById('lecModalBadges');
    const titleEl = document.getElementById('lecModalTitle');
    const deptEl = document.getElementById('lecModalDept');
    const bodyEl = document.getElementById('lecModalBody');

    if (avatarEl) avatarEl.textContent = monogram(profile.fullName);
    if (titleEl) titleEl.textContent = profile.fullName || 'Hồ sơ giảng viên';
    if (deptEl) {
      deptEl.textContent = [profile.department, profile.subjectGroup].filter(Boolean).join(' · ') || 'Đơn vị giảng dạy';
    }
    if (badgesEl) {
      const badges = [
        `<span class="lec-badge">${escapeHtml(profile.lecturerCode)}</span>`,
        profile.academicTitle ? `<span class="lec-tag">${escapeHtml(profile.academicTitle)}</span>` : '',
        profile.academicDegree ? `<span class="lec-tag">${escapeHtml(profile.academicDegree)}</span>` : '',
        profile.activeSectionCount > 0 ? `<span class="lec-tag is-teaching">Đang dạy ${profile.activeSectionCount} lớp kỳ này</span>` : ''
      ].filter(Boolean);
      badgesEl.innerHTML = badges.join('');
    }

    const safeWeb = safeHttpUrl(profile.websiteUrl);
    const interests = String(profile.researchInterests || '')
      .split(/[,;\n]+/)
      .map(s => s.trim())
      .filter(Boolean);

    const contactCards = [
      `<div class="lec-contact-item">
        <span class="lec-contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></span>
        <div class="lec-contact-copy">
          <small>Email liên hệ</small>
          ${profile.email ? `<a href="mailto:${escapeHtml(profile.email)}">${escapeHtml(profile.email)}</a>` : '<strong>Chưa cập nhật</strong>'}
        </div>
        ${profile.email ? `<button type="button" class="lec-copy-btn" data-copy-email="${escapeHtml(profile.email)}">Sao chép</button>` : ''}
      </div>`,
      `<div class="lec-contact-item">
        <span class="lec-contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></span>
        <div class="lec-contact-copy">
          <small>Phòng làm việc</small>
          <strong>${escapeHtml(profile.officeLocation || 'Chưa cập nhật')}</strong>
        </div>
      </div>`,
      `<div class="lec-contact-item">
        <span class="lec-contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
        <div class="lec-contact-copy">
          <small>Giờ tiếp sinh viên</small>
          <strong>${escapeHtml(profile.officeHours || 'Liên hệ qua email để đặt lịch')}</strong>
        </div>
      </div>`,
      `<div class="lec-contact-item">
        <span class="lec-contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></span>
        <div class="lec-contact-copy">
          <small>${profile.phone ? 'Điện thoại' : 'Liên kết học thuật'}</small>
          ${profile.phone
            ? `<strong>${escapeHtml(profile.phone)}</strong>`
            : safeWeb
              ? `<a href="${escapeHtml(safeWeb)}" target="_blank" rel="noopener noreferrer">${escapeHtml(safeWeb.replace(/^https?:\/\//, ''))} ↗</a>`
              : '<strong>Chưa công khai</strong>'}
        </div>
      </div>`
    ];

    const extraLinkHtml = profile.phone && safeWeb
      ? `<div class="lec-contact-item" style="grid-column:1 / -1">
          <span class="lec-contact-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" x2="22" y1="12" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg></span>
          <div class="lec-contact-copy">
            <small>Trang học thuật / Google Scholar</small>
            <a href="${escapeHtml(safeWeb)}" target="_blank" rel="noopener noreferrer">${escapeHtml(safeWeb)} ↗</a>
          </div>
        </div>`
      : '';

    const sections = profile.currentSections || [];
    const sectionsHtml = sections.length
      ? `<div class="lec-section-list">
          ${sections.map(s => `
            <div class="lec-section-row">
              <div class="lec-section-info">
                <strong>${escapeHtml(s.courseCode)} · ${escapeHtml(s.courseName)} (${escapeHtml(s.sectionCode)})</strong>
                <small>${escapeHtml(s.schedule)} · Phòng ${escapeHtml(s.room)} · ${s.credits} TC · Sĩ số ${s.enrolled}/${s.capacity}</small>
              </div>
              <button type="button" class="dash-btn" data-lec-open-section="${escapeHtml(s.sectionId)}">Xem lớp</button>
            </div>`).join('')}
        </div>`
      : '<p>Hiện chưa có lớp học phần được phân công trong học kỳ này.</p>';

    bodyEl.innerHTML = `
      <div class="lec-contact-grid">${contactCards.join('')}${extraLinkHtml}</div>

      <div class="lec-profile-block">
        <h3>Giới thiệu & Kinh nghiệm giảng dạy</h3>
        <p>${escapeHtml(profile.bio || 'Giảng viên chưa cập nhật phần giới thiệu cá nhân.')}</p>
      </div>

      ${interests.length ? `
        <div class="lec-profile-block">
          <h3>Hướng nghiên cứu & Chuyên môn</h3>
          <div class="lec-interest-pills">${interests.map(item => `<span class="lec-interest-pill">${escapeHtml(item)}</span>`).join('')}</div>
        </div>` : ''}

      <div class="lec-profile-block">
        <h3><span>Lớp học phần phụ trách học kỳ này</span><span class="lec-badge">${sections.length} lớp</span></h3>
        ${sectionsHtml}
      </div>
    `;
  }

  async function openProfile(lecturerCode, triggerEl = null) {
    if (!lecturerCode) {
      notify('Lớp học phần này chưa có mã giảng viên cụ thể.');
      return;
    }
    bindEventsOnce();
    const modal = document.getElementById('lecturerProfileModal');
    const bodyEl = document.getElementById('lecModalBody');
    const titleEl = document.getElementById('lecModalTitle');
    const deptEl = document.getElementById('lecModalDept');
    const badgesEl = document.getElementById('lecModalBadges');
    const avatarEl = document.getElementById('lecModalAvatar');
    if (!modal || !bodyEl) return;

    state.lastFocusedEl = triggerEl || document.activeElement;
    modal.classList.remove('is-closing');

    // Pre-fill from directory cache if available for instant perceived speed
    const cached = state.lecturers.find(l => l.lecturerCode?.toLowerCase() === String(lecturerCode).toLowerCase());
    if (cached) {
      renderProfileModalContent(cached);
    } else {
      if (avatarEl) avatarEl.textContent = 'GV';
      if (titleEl) titleEl.textContent = 'Đang tải hồ sơ giảng viên…';
      if (deptEl) deptEl.textContent = '';
      if (badgesEl) badgesEl.innerHTML = '';
      bodyEl.innerHTML = '<div class="lec-skel" style="height:140px;width:100%"></div>';
    }

    document.body.classList.add('lec-modal-open');
    if (!modal.open) modal.showModal();

    try {
      const fresh = await apiGet(`/api/student/lecturers/${encodeURIComponent(lecturerCode)}`);
      renderProfileModalContent(fresh);
    } catch (error) {
      if (!cached) {
        if (titleEl) titleEl.textContent = 'Không tải được hồ sơ';
        bodyEl.innerHTML = `<div class="ov-empty-box"><strong>Không thể tải hồ sơ giảng viên</strong><p>${escapeHtml(error.message)}</p></div>`;
      } else {
        notify(error.message || 'Không thể làm mới hồ sơ giảng viên.');
      }
    }
  }

  async function loadLecturers({ force = false } = {}) {
    if (state.loading) return;
    if (state.loaded && !force) {
      renderStats();
      renderGrid({ crossfade: false });
      return;
    }
    state.loading = true;
    let skeletonTimer = null;
    if (!state.loaded) {
      skeletonTimer = window.setTimeout(renderSkeleton, 120);
    }
    try {
      state.lecturers = await apiGet('/api/student/lecturers');
      state.loaded = true;
      window.clearTimeout(skeletonTimer);
      populateFilters();
      renderStats();
      renderGrid({ crossfade: false });
    } catch (error) {
      window.clearTimeout(skeletonTimer);
      const surface = document.getElementById('lecturersSurface');
      if (surface) {
        surface.innerHTML = `<div class="ov-empty-box"><strong>Không tải được danh bạ giảng viên</strong><p>${escapeHtml(error.message)}</p><button class="dash-btn" type="button" id="lecRetryBtn">Thử lại</button></div>`;
        surface.querySelector('#lecRetryBtn')?.addEventListener('click', () => loadLecturers({ force: true }));
      }
    } finally {
      state.loading = false;
    }
  }

  function bindEventsOnce() {
    if (state.bound) return;
    state.bound = true;

    document.getElementById('lecSearchInput')?.addEventListener('input', e => {
      state.filters.search = e.target.value;
      renderGrid({ crossfade: true });
    });

    document.getElementById('lecSearchClearBtn')?.addEventListener('click', () => {
      const el = document.getElementById('lecSearchInput');
      if (el) { el.value = ''; el.focus(); }
      state.filters.search = '';
      renderGrid({ crossfade: true });
    });

    document.getElementById('lecDepartmentFilter')?.addEventListener('change', e => {
      state.filters.department = e.target.value;
      renderGrid({ crossfade: true });
    });

    document.getElementById('lecGroupFilter')?.addEventListener('change', e => {
      state.filters.subjectGroup = e.target.value;
      renderGrid({ crossfade: true });
    });

    document.getElementById('lecOnlyTeachingToggle')?.addEventListener('click', e => {
      state.filters.onlyTeaching = !state.filters.onlyTeaching;
      e.currentTarget.classList.toggle('selected', state.filters.onlyTeaching);
      renderGrid({ crossfade: true });
    });

    document.getElementById('lecResetBtn')?.addEventListener('click', resetFilters);

    document.getElementById('lecturersSurface')?.addEventListener('click', e => {
      const card = e.target.closest('[data-lec-code]');
      if (card) openProfile(card.dataset.lecCode, card);
    });

    const modal = document.getElementById('lecturerProfileModal');
    document.getElementById('closeLecModal')?.addEventListener('click', closeModalSmooth);
    document.getElementById('closeLecModalBtn')?.addEventListener('click', closeModalSmooth);
    modal?.addEventListener('click', e => {
      if (e.target === modal) closeModalSmooth();
    });
    modal?.addEventListener('cancel', e => {
      e.preventDefault();
      closeModalSmooth();
    });

    document.getElementById('lecModalBody')?.addEventListener('click', async e => {
      const copyBtn = e.target.closest('[data-copy-email]');
      if (copyBtn) {
        const email = copyBtn.dataset.copyEmail;
        try {
          await navigator.clipboard.writeText(email);
          copyBtn.textContent = 'Đã chép ✓';
          window.setTimeout(() => { copyBtn.textContent = 'Sao chép'; }, 1500);
          notify(`Đã sao chép email ${email}`);
        } catch {
          notify('Không thể sao chép tự động.');
        }
        return;
      }

      const secBtn = e.target.closest('[data-lec-open-section]');
      if (secBtn && typeof onOpenCourseDetails === 'function') {
        const sectionId = secBtn.dataset.lecOpenSection;
        closeModalSmooth();
        window.setTimeout(() => onOpenCourseDetails(sectionId), 190);
      }
    });
  }

  return {
    open() {
      bindEventsOnce();
      triggerEntrance();
      loadLecturers();
    },
    openProfile(lecturerCode, triggerEl) {
      openProfile(lecturerCode, triggerEl);
    },
    refresh() {
      state.loaded = false;
    }
  };
}
