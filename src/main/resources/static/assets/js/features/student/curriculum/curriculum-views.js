import {
  escapeHtml,
  getCourseProgressStatus,
  groupCoursesByTerm,
  safeHttpUrl
} from './curriculum-utils.js?v=20261125f';

export function renderCurriculumHeader(curriculum, stats) {
  document.getElementById('curMetaBadge').textContent = `${curriculum.program || '—'} · Khóa ${curriculum.cohort || '—'}`;
  document.getElementById('curHeroSubtitle').textContent = `${curriculum.name || 'Khung chương trình đào tạo'} · Phiên bản ${curriculum.version || '1.0'}`;

  document.getElementById('curProgramPills').innerHTML = `
    <span class="cur-info-chip"><b>Ngành</b> ${escapeHtml(curriculum.program || '—')}</span>
    <span class="cur-info-chip"><b>Khóa</b> ${escapeHtml(curriculum.cohort || '—')}</span>
    <span class="cur-info-chip"><b>Phiên bản</b> ${escapeHtml(curriculum.version || '—')}</span>
  `;

  document.getElementById('curStatCourses').textContent = String(stats.totalCourses);
  document.getElementById('curStatCoursesSub').textContent = `${stats.requiredCount} bắt buộc · ${stats.electiveCount} tự chọn`;

  document.getElementById('curStatCredits').textContent = String(stats.totalCredits);
  document.getElementById('curStatCreditsSub').textContent = `${stats.requiredCredits} tín chỉ bắt buộc`;

  document.getElementById('curStatTerms').textContent = String(stats.termCount);
  document.getElementById('curStatTermsSub').textContent = 'Học kỳ trong lộ trình đề xuất';

  document.getElementById('curStatProgress').textContent = `${stats.progressPct}%`;
  document.getElementById('curStatProgressSub').textContent = `${stats.completedCount}/${stats.totalCourses} môn (${stats.completedCredits} TC)${stats.enrolledCount ? ` · ${stats.enrolledCount} đang học` : ''}`;
  document.getElementById('curStatProgressBar').style.width = `${stats.progressPct}%`;
}

export function renderCurriculumLoading() {
  return `
    <div class="cur-skeleton-wrap" aria-label="Đang tải khung chương trình">
      <div class="cur-skeleton-row"></div>
      <div class="cur-skeleton-row"></div>
      <div class="cur-skeleton-row"></div>
      <div class="cur-skeleton-row"></div>
      <div class="cur-skeleton-row"></div>
    </div>
  `;
}

export function renderCurriculumError(message) {
  return `
    <div class="cur-state-box">
      <div class="cur-state-icon is-error" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
      </div>
      <h3>Không tải được khung chương trình</h3>
      <p>${escapeHtml(message || 'Không thể kết nối máy chủ. Vui lòng thử lại.')}</p>
      <button type="button" class="cur-btn cur-btn-primary" id="curRetryBtn">Thử lại</button>
    </div>
  `;
}

export function renderCurriculumEmpty(isFiltered) {
  if (isFiltered) {
    return `
      <div class="cur-state-box">
        <div class="cur-state-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <h3>Không tìm thấy học phần phù hợp</h3>
        <p>Thử xóa từ khóa hoặc đặt lại bộ lọc để xem toàn bộ lộ trình đào tạo.</p>
        <button type="button" class="cur-btn cur-btn-primary" id="curEmptyResetBtn">Đặt lại bộ lọc</button>
      </div>
    `;
  }
  return `
    <div class="cur-state-box">
      <div class="cur-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="6" cy="6" r="3"/><circle cx="18" cy="9" r="3"/><circle cx="9" cy="18" r="3"/><path d="M8.7 7.1 15 8.5M8.5 15.6 15.6 10.7M6.7 8.9l1.5 6.2"/></svg>
      </div>
      <h3>Khung chương trình chưa có học phần</h3>
      <p>Hiện chưa có học phần nào được cấu hình trong chương trình đào tạo này.</p>
    </div>
  `;
}

function renderCourseRows(items, completedCodes, enrolledCodes, showTerm = false) {
  return items.map(item => {
    const progress = getCourseProgressStatus(item.courseCode, completedCodes, enrolledCodes);
    const typeClass = item.requiredCourse ? 'is-required' : 'is-elective';
    const typeLabel = item.requiredCourse ? 'Bắt buộc' : 'Tự chọn';
    const prereq = item.prerequisite && item.prerequisite.trim() ? item.prerequisite : 'Không có';

    return `
      <tr data-cur-detail="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="Xem chi tiết ${escapeHtml(item.courseCode)} ${escapeHtml(item.courseName)}">
        <td>
          <div class="cur-course-cell">
            <span class="cur-course-name">${escapeHtml(item.courseName)}</span>
            <div class="cur-course-meta">
              <span class="cur-code-tag">${escapeHtml(item.courseCode)}</span>
              ${showTerm ? `<span>${escapeHtml(item.suggestedSemester || 'Chưa phân kỳ')}</span>` : ''}
            </div>
          </div>
        </td>
        <td><span class="cur-credits-pill">${Number(item.credits) || 0}</span></td>
        <td><span class="cur-type-badge ${typeClass}">${typeLabel}</span></td>
        <td><span class="cur-prereq-text">${escapeHtml(prereq)}</span></td>
        <td>
          <span class="cur-progress-badge ${progress.cssClass}">
            ${progress.icon}
            <span>${progress.label}</span>
          </span>
        </td>
        <td class="cur-actions-cell">
          <button type="button" class="cur-action-btn" data-cur-detail="${escapeHtml(item.id)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>Chi tiết</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderMobileCards(items, completedCodes, enrolledCodes) {
  return items.map(item => {
    const progress = getCourseProgressStatus(item.courseCode, completedCodes, enrolledCodes);
    const typeClass = item.requiredCourse ? 'is-required' : 'is-elective';
    const typeLabel = item.requiredCourse ? 'Bắt buộc' : 'Tự chọn';

    return `
      <article class="cur-mobile-card" data-cur-detail="${escapeHtml(item.id)}">
        <div class="cur-mobile-top">
          <div class="cur-mobile-title">
            <div class="cur-course-meta">
              <span class="cur-code-tag">${escapeHtml(item.courseCode)}</span>
              <span class="cur-type-badge ${typeClass}">${typeLabel}</span>
            </div>
            <strong>${escapeHtml(item.courseName)}</strong>
          </div>
          <span class="cur-progress-badge ${progress.cssClass}">${progress.icon}<span>${progress.label}</span></span>
        </div>
        <div class="cur-mobile-meta">
          <div><span>Số tín chỉ</span><b>${Number(item.credits) || 0} tín chỉ</b></div>
          <div><span>Học kỳ đề xuất</span><b>${escapeHtml(item.suggestedSemester || 'Chưa phân kỳ')}</b></div>
          <div style="grid-column: 1 / -1;"><span>Tiên quyết</span><b>${escapeHtml(item.prerequisite || 'Không có')}</b></div>
        </div>
        <div class="cur-mobile-foot">
          <span class="cur-course-meta">${item.syllabusUrl ? 'Có đề cương môn học' : 'Chưa đính kèm đề cương'}</span>
          <button type="button" class="cur-action-btn" data-cur-detail="${escapeHtml(item.id)}">Xem chi tiết →</button>
        </div>
      </article>
    `;
  }).join('');
}

export function renderCurriculumContent(filteredCourses, layoutMode, completedCodes, enrolledCodes) {
  if (layoutMode === 'flat') {
    return `
      <section class="cur-term-card">
        <div class="cur-table-scroll">
          <table class="cur-table">
            <thead>
              <tr>
                <th>Môn học</th>
                <th>Tín chỉ</th>
                <th>Loại</th>
                <th>Tiên quyết</th>
                <th>Tiến độ</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>${renderCourseRows(filteredCourses, completedCodes, enrolledCodes, true)}</tbody>
          </table>
        </div>
        <div class="cur-mobile-list">${renderMobileCards(filteredCourses, completedCodes, enrolledCodes)}</div>
      </section>
    `;
  }

  const groups = groupCoursesByTerm(filteredCourses);
  return `
    <div class="cur-terms-stack">
      ${groups.map(group => {
        const doneInTerm = group.items.filter(c => completedCodes.has(String(c.courseCode || '').toUpperCase())).length;
        return `
          <section class="cur-term-card">
            <div class="cur-term-head">
              <div class="cur-term-title">
                <h2>${escapeHtml(group.term)}</h2>
                <span class="cur-term-badge">${group.items.length} môn · ${group.totalCredits} tín chỉ</span>
              </div>
              <div class="cur-term-summary">
                <span class="${doneInTerm === group.items.length && group.items.length > 0 ? 'is-done' : ''}">Hoàn thành ${doneInTerm}/${group.items.length} môn</span>
              </div>
            </div>
            <div class="cur-table-scroll">
              <table class="cur-table">
                <thead>
                  <tr>
                    <th>Môn học</th>
                    <th>Tín chỉ</th>
                    <th>Loại</th>
                    <th>Tiên quyết</th>
                    <th>Tiến độ</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>${renderCourseRows(group.items, completedCodes, enrolledCodes, false)}</tbody>
              </table>
            </div>
            <div class="cur-mobile-list">${renderMobileCards(group.items, completedCodes, enrolledCodes)}</div>
          </section>
        `;
      }).join('')}
    </div>
  `;
}

export function populateCurriculumDetailModal(item, completedCodes, enrolledCodes) {
  const modal = document.getElementById('curriculumDetailModal');
  const badges = document.getElementById('curDetailBadges');
  const title = document.getElementById('curDetailTitle');
  const body = document.getElementById('curDetailBody');
  const syllabusLink = document.getElementById('curDetailSyllabusLink');

  const progress = getCourseProgressStatus(item.courseCode, completedCodes, enrolledCodes);
  const typeClass = item.requiredCourse ? 'is-required' : 'is-elective';
  const typeLabel = item.requiredCourse ? 'Bắt buộc' : 'Tự chọn';

  badges.innerHTML = `
    <span class="cur-code-tag">${escapeHtml(item.courseCode)}</span>
    <span class="cur-type-badge ${typeClass}">${typeLabel}</span>
    <span class="cur-progress-badge ${progress.cssClass}">${progress.icon}<span>${progress.label}</span></span>
  `;
  title.textContent = item.courseName || 'Chi tiết học phần';

  body.innerHTML = `
    <dl class="cur-detail-grid">
      <div class="cur-detail-cell">
        <dt>Mã học phần</dt>
        <dd>${escapeHtml(item.courseCode)}</dd>
      </div>
      <div class="cur-detail-cell">
        <dt>Số tín chỉ</dt>
        <dd>${Number(item.credits) || 0} tín chỉ</dd>
      </div>
      <div class="cur-detail-cell">
        <dt>Loại học phần</dt>
        <dd>${typeLabel}</dd>
      </div>
      <div class="cur-detail-cell">
        <dt>Học kỳ đề xuất</dt>
        <dd>${escapeHtml(item.suggestedSemester || 'Chưa phân kỳ')}</dd>
      </div>
      <div class="cur-detail-cell is-full">
        <dt>Điều kiện tiên quyết / học trước</dt>
        <dd>${escapeHtml(item.prerequisite || 'Không có môn tiên quyết')}</dd>
      </div>
      <div class="cur-detail-cell is-full">
        <dt>Mô tả học phần</dt>
        <dd>${escapeHtml(item.description || 'Chưa có mô tả chi tiết cho học phần này.')}</dd>
      </div>
    </dl>
  `;

  const url = safeHttpUrl(item.syllabusUrl);
  if (url) {
    syllabusLink.href = url;
    syllabusLink.classList.remove('hidden');
  } else {
    syllabusLink.classList.add('hidden');
  }

  if (!modal.open) modal.showModal();
}

export function renderCurriculumPrintHeader(curriculum, stats) {
  const el = document.getElementById('curPrintHeader');
  if (!el) return;
  const printedAt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());
  el.innerHTML = `
    <div>
      <h1>KHUNG CHƯƠNG TRÌNH ĐÀO TẠO — ${escapeHtml(curriculum.name)}</h1>
      <p>Ngành: <b>${escapeHtml(curriculum.program)}</b> · Khóa: <b>${escapeHtml(curriculum.cohort)}</b> · Phiên bản: <b>${escapeHtml(curriculum.version)}</b></p>
    </div>
    <p>${stats.totalCourses} học phần · ${stats.totalCredits} tín chỉ · In lúc ${escapeHtml(printedAt)}</p>
  `;
}
