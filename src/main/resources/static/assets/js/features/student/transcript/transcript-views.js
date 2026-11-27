import {
  escapeHtml,
  getGradeBarTone,
  getLetterGradeClass,
  grade10ToGpa4
} from './transcript-utils.js?v=20261125j';

const prefersReducedMotion = () =>
  Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

const counterFrames = new WeakMap();

function animateCounter(el, targetValue, previousValue, decimals = 0) {
  if (!el) return;
  if (targetValue == null || Number.isNaN(Number(targetValue))) {
    el.textContent = '—';
    return;
  }
  const target = Number(targetValue);
  const prev = previousValue == null || Number.isNaN(Number(previousValue)) ? 0 : Number(previousValue);

  const existing = counterFrames.get(el);
  if (existing) cancelAnimationFrame(existing);

  const fmt = val => decimals > 0 ? val.toFixed(decimals) : String(Math.round(val));

  if (prefersReducedMotion() || (previousValue != null && prev === target)) {
    el.textContent = fmt(target);
    return;
  }

  const duration = 580;
  const start = performance.now();

  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = fmt(prev + (target - prev) * eased);
    if (t < 1) {
      counterFrames.set(el, requestAnimationFrame(tick));
    } else {
      el.textContent = fmt(target);
      counterFrames.delete(el);
    }
  }
  counterFrames.set(el, requestAnimationFrame(tick));
}

export function renderTranscriptStats(summary, transcriptData, prevSummary = null) {
  const badge = document.getElementById('trProgramBadge');
  if (badge) {
    const parts = [transcriptData?.program, transcriptData?.cohort].filter(Boolean);
    badge.textContent = parts.length ? parts.join(' · ') : 'Hồ sơ học tập';
  }

  animateCounter(document.getElementById('trStatCredits'), summary.accumulatedCredits, prevSummary?.accumulatedCredits, 0);
  document.getElementById('trStatCreditsSub').textContent = 'Tính 1 lần mỗi học phần Đạt';

  animateCounter(document.getElementById('trStatAvg10'), summary.weightedAvg10, prevSummary?.weightedAvg10, 2);
  document.getElementById('trStatAvg10Sub').textContent = summary.gpa4 != null
    ? `≈ ${summary.gpa4.toFixed(2)} / 4.0 · ${summary.rank}`
    : summary.rank;

  animateCounter(document.getElementById('trStatCompleted'), summary.completedCourseCount, prevSummary?.completedCourseCount, 0);
  document.getElementById('trStatCompletedSub').textContent = summary.totalRecords
    ? `Tỷ lệ đạt ${summary.passRate}% (${summary.passedCount}/${summary.totalRecords} lượt)`
    : 'Chưa có học phần hoàn thành';

  animateCounter(document.getElementById('trStatRecords'), summary.totalRecords, prevSummary?.totalRecords, 0);
  document.getElementById('trStatRecordsSub').textContent = summary.failedCount > 0
    ? `Gồm ${summary.failedCount} lượt chưa đạt`
    : 'Không có môn chưa đạt';
}

export function renderSemesterStrip(semesters, selectedSemester, { animateBars = false } = {}) {
  const container = document.getElementById('trSemesterStrip');
  if (!semesters.length) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }
  container.classList.remove('hidden');
  container.classList.toggle('is-animating', Boolean(animateBars) && !prefersReducedMotion());

  container.innerHTML = semesters.map(s => {
    const active = selectedSemester === s.semesterCode;
    const pct = s.avg10 != null ? Math.min(100, Math.max(0, (s.avg10 / 10) * 100)) : 0;
    return `
      <button type="button" class="tr-sem-card ${active ? 'active' : ''}" data-tr-semester="${escapeHtml(s.semesterCode)}" title="Bấm để lọc theo ${escapeHtml(s.semesterName)}">
        <div class="tr-sem-card-head">
          <strong>${escapeHtml(s.semesterName)}</strong>
          <span class="tr-sem-gpa">${s.avg10 != null ? s.avg10.toFixed(2) : '—'}</span>
        </div>
        <div class="tr-sem-bar"><span style="width:${pct.toFixed(1)}%"></span></div>
        <div class="tr-sem-card-meta">
          <span>${s.passedCount}/${s.count} môn đạt</span>
          <span>${s.passedCredits} tín chỉ</span>
        </div>
      </button>
    `;
  }).join('');
}

export function renderTranscriptLoading() {
  const rows = Array.from({ length: 5 }, () => `
    <tr>
      <td>
        <div class="tr-skel-stack">
          <span class="tr-skel-bar" style="width:70%;height:15px"></span>
          <div class="tr-skel-inline">
            <span class="tr-skel-bar" style="width:52px;height:16px"></span>
            <span class="tr-skel-bar" style="width:98px;height:12px"></span>
          </div>
        </div>
      </td>
      <td><span class="tr-skel-bar" style="width:36px;height:24px;border-radius:8px"></span></td>
      <td>
        <div class="tr-skel-stack">
          <span class="tr-skel-bar" style="width:42px;height:15px"></span>
          <span class="tr-skel-bar" style="width:86px;height:5px;border-radius:999px"></span>
        </div>
      </td>
      <td><span class="tr-skel-bar" style="width:36px;height:28px;border-radius:8px"></span></td>
      <td><span class="tr-skel-bar" style="width:82px;height:24px;border-radius:999px"></span></td>
      <td style="text-align:right"><span class="tr-skel-bar" style="width:72px;height:30px;border-radius:8px;margin-left:auto"></span></td>
    </tr>
  `).join('');

  const mobileSkel = Array.from({ length: 3 }, () => `
    <div class="tr-mobile-card">
      <div class="tr-skel-stack">
        <span class="tr-skel-bar" style="width:65%;height:16px"></span>
        <span class="tr-skel-bar" style="width:45%;height:13px"></span>
        <span class="tr-skel-bar" style="width:85%;height:13px"></span>
      </div>
    </div>
  `).join('');

  return `
    <div class="tr-table-scroll" aria-label="Đang tải bảng điểm">
      <table class="tr-table">
        <thead>
          <tr><th>Môn học</th><th>Tín chỉ</th><th>Điểm hệ 10</th><th>Điểm chữ</th><th>Kết quả</th><th>Thao tác</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="tr-mobile-list">${mobileSkel}</div>
  `;
}

export function renderTranscriptError(message) {
  return `
    <div class="tr-state-box">
      <div class="tr-state-icon is-error" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
      </div>
      <h3>Không tải được kết quả học tập</h3>
      <p>${escapeHtml(message || 'Không thể kết nối máy chủ. Vui lòng thử lại.')}</p>
      <button type="button" class="tr-btn tr-btn-primary" id="trRetryBtn">Thử lại</button>
    </div>
  `;
}

export function renderTranscriptEmpty(isFiltered) {
  if (isFiltered) {
    return `
      <div class="tr-state-box">
        <div class="tr-state-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <h3>Không có kết quả học tập phù hợp</h3>
        <p>Thử xóa từ khóa hoặc đặt lại bộ lọc để xem toàn bộ bảng điểm.</p>
        <button type="button" class="tr-btn tr-btn-primary" id="trEmptyResetBtn">Đặt lại bộ lọc</button>
      </div>
    `;
  }
  return `
    <div class="tr-state-box">
      <div class="tr-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
      </div>
      <h3>Chưa có dữ liệu bảng điểm</h3>
      <p>Hệ thống chưa ghi nhận điểm tổng kết học phần nào cho tài khoản của bạn.</p>
    </div>
  `;
}

export function renderTranscriptData(
  pageItems,
  totalFiltered,
  page,
  totalPages,
  pageSize,
  { animateRows = false, selectedId = null, crossfade = false } = {}
) {
  const startIdx = (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, totalFiltered);
  const shouldStagger = animateRows && pageItems.length <= 16;

  const checkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';
  const failIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>';

  const rowsHtml = pageItems.map((item, idx) => {
    const gradeVal = item.grade != null ? Number(item.grade) : null;
    const gradeStr = gradeVal != null ? gradeVal.toFixed(2) : '—';
    const gradePct = gradeVal != null ? Math.min(100, Math.max(0, (gradeVal / 10) * 100)) : 0;
    const barTone = getGradeBarTone(gradeVal);
    const letterClass = getLetterGradeClass(item.letterGrade);
    const isSelected = selectedId != null && String(selectedId) === String(item.id);
    const staggerStyle = shouldStagger ? ` style="--row-i:${Math.min(idx, 10)}"` : '';

    return `
      <tr class="${isSelected ? 'is-selected' : ''}" data-tr-detail="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="Xem chi tiết điểm ${escapeHtml(item.courseCode)} ${escapeHtml(item.courseName)}"${staggerStyle}>
        <td>
          <div class="tr-course-cell">
            <span class="tr-course-name">${escapeHtml(item.courseName)}</span>
            <div class="tr-course-meta">
              <span class="tr-code-tag">${escapeHtml(item.courseCode)}</span>
              <span>${escapeHtml(item.semesterName)}</span>
            </div>
          </div>
        </td>
        <td><span class="tr-credits-pill">${Number(item.credits) || 0}</span></td>
        <td>
          <div class="tr-grade-cell">
            <span class="tr-grade-num">${gradeStr}</span>
            ${gradeVal != null ? `<div class="tr-grade-bar ${barTone}"><span style="width:${gradePct.toFixed(1)}%"></span></div>` : ''}
          </div>
        </td>
        <td><span class="tr-letter-pill ${letterClass}">${escapeHtml(item.letterGrade || '—')}</span></td>
        <td>
          <div class="tr-outcome-wrap">
            <span class="tr-outcome-badge ${item.passed ? 'is-passed' : 'is-failed'}">
              ${item.passed ? checkIcon : failIcon}
              <span>${escapeHtml(item.outcome || (item.passed ? 'Đạt' : 'Chưa đạt'))}</span>
            </span>
            ${item.retakenAndPassed ? '<span class="tr-retaken-note">Đã học lại Đạt</span>' : ''}
          </div>
        </td>
        <td class="tr-actions-cell">
          <button type="button" class="tr-action-btn" data-tr-detail="${escapeHtml(item.id)}" data-tr-tooltip="Xem chi tiết điểm">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            <span>Chi tiết</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  const mobileHtml = pageItems.map((item, idx) => {
    const gradeVal = item.grade != null ? Number(item.grade) : null;
    const gradeStr = gradeVal != null ? gradeVal.toFixed(2) : '—';
    const g4 = grade10ToGpa4(gradeVal);
    const letterClass = getLetterGradeClass(item.letterGrade);
    const isSelected = selectedId != null && String(selectedId) === String(item.id);
    const staggerStyle = shouldStagger ? ` style="--row-i:${Math.min(idx, 8)}"` : '';

    return `
      <article class="tr-mobile-card ${isSelected ? 'is-selected' : ''}" data-tr-detail="${escapeHtml(item.id)}"${staggerStyle}>
        <div class="tr-mobile-card-top">
          <div class="tr-mobile-card-title">
            <div class="tr-course-meta">
              <span class="tr-code-tag">${escapeHtml(item.courseCode)}</span>
              <span>${Number(item.credits) || 0} TC</span>
            </div>
            <strong>${escapeHtml(item.courseName)}</strong>
          </div>
          <span class="tr-outcome-badge ${item.passed ? 'is-passed' : 'is-failed'}">
            ${item.passed ? checkIcon : failIcon}
            <span>${escapeHtml(item.outcome || (item.passed ? 'Đạt' : 'Chưa đạt'))}</span>
          </span>
        </div>
        <div class="tr-mobile-metrics">
          <div><span>Điểm hệ 10</span><b>${gradeStr}</b></div>
          <div><span>Điểm hệ 4</span><b>${g4 != null ? g4.toFixed(1) : '—'}</b></div>
          <div><span>Điểm chữ</span><span class="tr-letter-pill ${letterClass}">${escapeHtml(item.letterGrade || '—')}</span></div>
        </div>
        <div class="tr-mobile-foot">
          <span>${escapeHtml(item.semesterName)}${item.retakenAndPassed ? ' · Đã học lại Đạt' : ''}</span>
          <button type="button" class="tr-action-btn" data-tr-detail="${escapeHtml(item.id)}">Chi tiết →</button>
        </div>
      </article>
    `;
  }).join('');

  const paginationHtml = totalPages > 1 ? `
    <div class="tr-pagination">
      <span>Hiển thị <strong>${startIdx}–${endIdx}</strong> trên tổng <strong>${totalFiltered}</strong> kết quả</span>
      <div class="tr-page-controls">
        <button type="button" class="tr-btn" data-tr-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Trang trước</button>
        <span>Trang <strong>${page}</strong> / ${totalPages}</span>
        <button type="button" class="tr-btn" data-tr-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Trang sau</button>
      </div>
    </div>
  ` : '';

  return `
    <div class="${crossfade && !prefersReducedMotion() ? 'tr-surface-crossfade' : ''}">
      <div class="tr-table-scroll">
        <table class="tr-table ${shouldStagger ? 'is-animating-rows' : ''}">
          <thead>
            <tr>
              <th>Môn học</th>
              <th>Tín chỉ</th>
              <th>Điểm hệ 10</th>
              <th>Điểm chữ</th>
              <th>Kết quả</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
      <div class="tr-mobile-list ${shouldStagger ? 'is-animating-rows' : ''}">${mobileHtml}</div>
      ${paginationHtml}
    </div>
  `;
}

export function populateTranscriptDetailModal(item) {
  const modal = document.getElementById('transcriptDetailModal');
  const badges = document.getElementById('trDetailBadges');
  const title = document.getElementById('trDetailTitle');
  const body = document.getElementById('trDetailBody');

  const gradeVal = item.grade != null ? Number(item.grade) : null;
  const g4 = grade10ToGpa4(gradeVal);
  const checkIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';
  const failIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>';

  badges.innerHTML = `
    <span class="tr-code-tag">${escapeHtml(item.courseCode)}</span>
    <span class="tr-outcome-badge ${item.passed ? 'is-passed' : 'is-failed'}">
      ${item.passed ? checkIcon : failIcon}
      <span>${escapeHtml(item.outcome || (item.passed ? 'Đạt' : 'Chưa đạt'))}</span>
    </span>
  `;
  title.textContent = item.courseName || 'Chi tiết kết quả học tập';

  body.innerHTML = `
    <div class="tr-score-showcase">
      <div class="tr-score-tile">
        <span>Điểm hệ 10</span>
        <strong>${gradeVal != null ? gradeVal.toFixed(2) : '—'}</strong>
      </div>
      <div class="tr-score-tile">
        <span>Điểm hệ 4</span>
        <strong>${g4 != null ? g4.toFixed(1) : '—'}</strong>
      </div>
      <div class="tr-score-tile">
        <span>Điểm chữ</span>
        <strong>${escapeHtml(item.letterGrade || '—')}</strong>
      </div>
    </div>

    <dl class="tr-detail-grid">
      <div class="tr-detail-cell">
        <dt>Mã học phần</dt>
        <dd>${escapeHtml(item.courseCode)}</dd>
      </div>
      <div class="tr-detail-cell">
        <dt>Số tín chỉ</dt>
        <dd>${Number(item.credits) || 0} tín chỉ</dd>
      </div>
      <div class="tr-detail-cell">
        <dt>Học kỳ</dt>
        <dd>${escapeHtml(item.semesterName)}</dd>
      </div>
      <div class="tr-detail-cell">
        <dt>Mã học kỳ</dt>
        <dd>${escapeHtml(item.semesterCode)}</dd>
      </div>
      <div class="tr-detail-cell is-full">
        <dt>Ghi nhận kết quả</dt>
        <dd>${item.passed ? 'Đã hoàn thành và tích lũy tín chỉ học phần.' : item.retakenAndPassed ? 'Lần học này chưa đạt nhưng sinh viên đã học lại và Đạt ở học kỳ khác.' : 'Chưa đạt — cần đăng ký học lại theo kế hoạch đào tạo.'}</dd>
      </div>
    </dl>
  `;

  modal.classList.remove('is-closing');
  document.body.classList.add('tr-modal-open');
  if (!modal.open) modal.showModal();
}

export function renderTranscriptPrintHeader(transcriptData, summary) {
  const el = document.getElementById('trPrintHeader');
  if (!el) return;
  const printedAt = new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());
  el.innerHTML = `
    <div>
      <h1>BẢNG ĐIỂM KẾT QUẢ HỌC TẬP SINH VIÊN</h1>
      <p>Sinh viên: <b>${escapeHtml(transcriptData?.fullName || '—')}</b> · MSSV: <b>${escapeHtml(transcriptData?.studentCode || '—')}</b> · ${escapeHtml(transcriptData?.program || '—')} (${escapeHtml(transcriptData?.cohort || '—')})</p>
    </div>
    <p>Tín chỉ tích lũy: <b>${summary.accumulatedCredits}</b> · TB hệ 10: <b>${summary.weightedAvg10 != null ? summary.weightedAvg10.toFixed(2) : '—'}</b> · In lúc ${escapeHtml(printedAt)}</p>
  `;
}
