import {
  escapeHtml,
  formatRegistrationTimestamp,
  getStatusMeta,
  parseScheduleDisplay
} from './history-utils.js?v=20261125h';

const prefersReducedMotion = () =>
  Boolean(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

const counterFrames = new WeakMap();

/**
 * Smooth ease-out cubic counter animation (560ms).
 * Only animates when value actually changes; snaps immediately under prefers-reduced-motion.
 */
function animateCounter(el, targetValue, previousValue) {
  if (!el) return;
  const target = Number(targetValue) || 0;
  const prev = previousValue == null ? 0 : Number(previousValue) || 0;

  const existingRaf = counterFrames.get(el);
  if (existingRaf) cancelAnimationFrame(existingRaf);

  if (prefersReducedMotion() || (previousValue != null && prev === target)) {
    el.textContent = String(target);
    return;
  }

  const duration = 560;
  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(prev + (target - prev) * eased);
    el.textContent = String(current);
    if (progress < 1) {
      counterFrames.set(el, requestAnimationFrame(tick));
    } else {
      el.textContent = String(target);
      counterFrames.delete(el);
    }
  }

  counterFrames.set(el, requestAnimationFrame(tick));
}

export function renderHistoryStats(stats, prevStats = null) {
  animateCounter(document.getElementById('histStatTotal'), stats.total, prevStats?.total);
  document.getElementById('histStatTotalSub').textContent = stats.total
    ? 'Tổng bản ghi trong lịch sử'
    : 'Chưa có lượt đăng ký';

  animateCounter(document.getElementById('histStatEnrolled'), stats.enrolled, prevStats?.enrolled);
  document.getElementById('histStatEnrolledSub').textContent = stats.enrolled
    ? `${stats.enrolledCredits} tín chỉ đang ghi nhận`
    : 'Chưa có lớp đang đăng ký';

  animateCounter(document.getElementById('histStatPending'), stats.pending, prevStats?.pending);
  document.getElementById('histStatPendingSub').textContent = stats.pending
    ? 'Đang chờ phòng Đào tạo duyệt'
    : 'Không có yêu cầu chờ duyệt';

  animateCounter(document.getElementById('histStatCancelled'), stats.cancelled, prevStats?.cancelled);
  document.getElementById('histStatCancelledSub').textContent = stats.cancelled
    ? 'Các lớp đã hủy đăng ký'
    : 'Chưa có lớp bị hủy';
}

/**
 * Layout-matched 6-column table skeleton to prevent layout shift during fetch.
 */
export function renderHistoryLoading() {
  const skeletonRows = Array.from({ length: 5 }, () => `
    <tr>
      <td>
        <div class="hist-skel-stack">
          <span class="hist-skel-bar" style="width:72%;height:15px"></span>
          <div class="hist-skel-row-inline">
            <span class="hist-skel-bar" style="width:54px;height:16px"></span>
            <span class="hist-skel-bar" style="width:110px;height:12px"></span>
          </div>
        </div>
      </td>
      <td><span class="hist-skel-bar" style="width:112px;height:14px"></span></td>
      <td>
        <div class="hist-skel-stack">
          <span class="hist-skel-bar" style="width:140px;height:14px"></span>
          <span class="hist-skel-bar" style="width:78px;height:12px"></span>
        </div>
      </td>
      <td><span class="hist-skel-bar" style="width:104px;height:24px;border-radius:999px"></span></td>
      <td>
        <div class="hist-skel-stack">
          <span class="hist-skel-bar" style="width:76px;height:14px"></span>
          <span class="hist-skel-bar" style="width:46px;height:11px"></span>
        </div>
      </td>
      <td style="text-align:right">
        <span class="hist-skel-bar" style="width:72px;height:30px;border-radius:8px;margin-left:auto"></span>
      </td>
    </tr>
  `).join('');

  const mobileSkel = Array.from({ length: 3 }, () => `
    <div class="hist-mobile-card">
      <div class="hist-skel-stack">
        <span class="hist-skel-bar" style="width:65%;height:16px"></span>
        <span class="hist-skel-bar" style="width:45%;height:13px"></span>
        <span class="hist-skel-bar" style="width:85%;height:13px"></span>
      </div>
    </div>
  `).join('');

  return `
    <div class="hist-table-scroll" aria-label="Đang tải lịch sử đăng ký">
      <table class="hist-table hist-skel-table">
        <thead>
          <tr>
            <th>Môn học</th>
            <th>Lớp học phần</th>
            <th>Lịch học</th>
            <th>Trạng thái</th>
            <th>Thời gian đăng ký</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>${skeletonRows}</tbody>
      </table>
    </div>
    <div class="hist-mobile-list">${mobileSkel}</div>
  `;
}

export function renderHistoryError(message) {
  return `
    <div class="hist-state-box">
      <div class="hist-state-icon is-error" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
      </div>
      <h3>Không tải được lịch sử đăng ký</h3>
      <p>${escapeHtml(message || 'Không thể kết nối máy chủ. Vui lòng thử lại.')}</p>
      <button type="button" class="hist-btn hist-btn-primary" id="histRetryBtn">Thử lại</button>
    </div>
  `;
}

export function renderHistoryEmpty(isFiltered) {
  if (isFiltered) {
    return `
      <div class="hist-state-box">
        <div class="hist-state-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        <h3>Không tìm thấy bản ghi phù hợp</h3>
        <p>Không có học phần nào khớp với từ khóa hoặc bộ lọc đang chọn. Hãy đặt lại bộ lọc để xem toàn bộ lịch sử.</p>
        <button type="button" class="hist-btn hist-btn-primary" id="histEmptyResetBtn">Đặt lại bộ lọc</button>
      </div>
    `;
  }
  return `
    <div class="hist-state-box">
      <div class="hist-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/></svg>
      </div>
      <h3>Chưa có lịch sử đăng ký</h3>
      <p>Bạn chưa thực hiện đăng ký học phần nào. Chuyển sang mục Đăng ký học phần để bắt đầu chọn lớp.</p>
      <button type="button" class="hist-btn hist-btn-primary" data-hist-go-courses>Đi tới Đăng ký học phần</button>
    </div>
  `;
}

export function renderHistoryData(
  pageItems,
  totalFiltered,
  page,
  totalPages,
  pageSize,
  { animateRows = false, selectedRecordId = null } = {}
) {
  const startIdx = (page - 1) * pageSize + 1;
  const endIdx = Math.min(page * pageSize, totalFiltered);
  const shouldStagger = animateRows && pageItems.length <= 15;

  const tableRowsHtml = pageItems.map((item, idx) => {
    const sched = parseScheduleDisplay(item.schedule);
    const status = getStatusMeta(item.status);
    const ts = formatRegistrationTimestamp(item.enrolledAt, item.enrollmentDateOnly);
    const isSelected = selectedRecordId != null && String(selectedRecordId) === String(item.id);
    const staggerStyle = shouldStagger ? ` style="--row-i:${Math.min(idx, 9)}"` : '';

    return `
      <tr class="${isSelected ? 'is-selected' : ''}" data-hist-detail="${escapeHtml(item.id)}" tabindex="0" role="button" aria-label="Xem chi tiết ${escapeHtml(item.courseCode)} ${escapeHtml(item.courseName)}"${staggerStyle}>
        <td>
          <div class="hist-course-cell">
            <span class="hist-course-name">${escapeHtml(item.courseName)}</span>
            <div class="hist-course-meta">
              <span class="hist-code-tag">${escapeHtml(item.courseCode)}</span>
              <span>${Number(item.credits) || 0} tín chỉ</span>
              <span>·</span>
              <span>${escapeHtml(item.semesterName)}</span>
            </div>
          </div>
        </td>
        <td><span class="hist-section-code">${escapeHtml(item.sectionCode)}</span></td>
        <td>
          <div class="hist-schedule-cell">
            <span class="hist-schedule-main">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${escapeHtml(sched.primary)}
            </span>
            ${sched.weeks ? `<span class="hist-schedule-weeks">${escapeHtml(sched.weeks)}</span>` : ''}
          </div>
        </td>
        <td>
          <span class="hist-status-badge ${status.cssClass}">
            ${status.icon}
            <span>${escapeHtml(status.label)}</span>
          </span>
        </td>
        <td>
          <div class="hist-time-cell">
            <span class="hist-time-date">${escapeHtml(ts.date)}</span>
            ${ts.time ? `<span class="hist-time-clock">${escapeHtml(ts.time)}</span>` : ''}
          </div>
        </td>
        <td class="hist-actions-cell">
          <div class="hist-row-actions">
            <button type="button" class="hist-action-btn" data-hist-detail="${escapeHtml(item.id)}" data-hist-tooltip="Xem chi tiết đăng ký">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              <span>Chi tiết</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const mobileCardsHtml = pageItems.map((item, idx) => {
    const sched = parseScheduleDisplay(item.schedule);
    const status = getStatusMeta(item.status);
    const ts = formatRegistrationTimestamp(item.enrolledAt, item.enrollmentDateOnly);
    const isSelected = selectedRecordId != null && String(selectedRecordId) === String(item.id);
    const staggerStyle = shouldStagger ? ` style="--row-i:${Math.min(idx, 8)}"` : '';

    return `
      <article class="hist-mobile-card ${isSelected ? 'is-selected' : ''}" data-hist-detail="${escapeHtml(item.id)}"${staggerStyle}>
        <div class="hist-mobile-card-top">
          <div class="hist-mobile-card-title">
            <div class="hist-course-meta">
              <span class="hist-code-tag">${escapeHtml(item.courseCode)}</span>
              <span>${Number(item.credits) || 0} TC</span>
              <span>· ${escapeHtml(item.semesterName)}</span>
            </div>
            <strong>${escapeHtml(item.courseName)}</strong>
          </div>
          <span class="hist-status-badge ${status.cssClass}">
            ${status.icon}
            <span>${escapeHtml(status.label)}</span>
          </span>
        </div>
        <div class="hist-mobile-card-grid">
          <div>
            <span>Lớp học phần</span>
            <b>${escapeHtml(item.sectionCode)}</b>
          </div>
          <div>
            <span>Thời gian đăng ký</span>
            <b>${escapeHtml(ts.date)}${ts.time ? ` · ${escapeHtml(ts.time)}` : ''}</b>
          </div>
          <div style="grid-column: 1 / -1;">
            <span>Lịch học</span>
            <b>${escapeHtml(sched.primary)}${sched.weeks ? ` (${escapeHtml(sched.weeks)})` : ''}</b>
          </div>
        </div>
        <div class="hist-mobile-card-foot">
          <span class="hist-section-code">ID #${escapeHtml(item.id)}</span>
          <button type="button" class="hist-action-btn" data-hist-detail="${escapeHtml(item.id)}">Xem chi tiết →</button>
        </div>
      </article>
    `;
  }).join('');

  const paginationHtml = totalPages > 1 ? `
    <div class="hist-pagination">
      <span>Hiển thị <strong>${startIdx}–${endIdx}</strong> trên tổng <strong>${totalFiltered}</strong> bản ghi</span>
      <div class="hist-page-controls">
        <button type="button" class="hist-btn" data-hist-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Trang trước</button>
        <span>Trang <strong>${page}</strong> / ${totalPages}</span>
        <button type="button" class="hist-btn" data-hist-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Trang sau</button>
      </div>
    </div>
  ` : '';

  return `
    <div class="hist-table-scroll">
      <table class="hist-table ${shouldStagger ? 'is-animating-rows' : ''}">
        <thead>
          <tr>
            <th>Môn học</th>
            <th>Lớp học phần</th>
            <th>Lịch học</th>
            <th>Trạng thái</th>
            <th>Thời gian đăng ký</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>${tableRowsHtml}</tbody>
      </table>
    </div>
    <div class="hist-mobile-list ${shouldStagger ? 'is-animating-rows' : ''}">${mobileCardsHtml}</div>
    ${paginationHtml}
  `;
}

export function populateRegistrationDetailModal(record, sectionDetail = null, loadingExtra = false) {
  const modal = document.getElementById('registrationDetailModal');
  const badges = document.getElementById('regDetailBadges');
  const title = document.getElementById('regDetailTitle');
  const body = document.getElementById('regDetailBody');
  const courseLinkBtn = document.getElementById('regDetailOpenCourseBtn');

  const status = getStatusMeta(record.status);
  const ts = formatRegistrationTimestamp(record.enrolledAt, record.enrollmentDateOnly);
  const sched = parseScheduleDisplay(record.schedule);

  badges.innerHTML = `
    <span class="hist-code-tag">${escapeHtml(record.courseCode)}</span>
    <span class="hist-status-badge ${status.cssClass}">${status.icon}<span>${escapeHtml(status.label)}</span></span>
  `;
  title.textContent = record.courseName || 'Chi tiết đăng ký học phần';

  const instructor = sectionDetail?.instructor || (loadingExtra ? 'Đang tải…' : 'Chưa có thông tin');
  const room = sectionDetail?.room || (loadingExtra ? 'Đang tải…' : 'Chưa có thông tin');
  const weeks = sectionDetail?.meetings?.length
    ? [...new Set(sectionDetail.meetings.map(m => m.weeksExpression).filter(Boolean))].map(w => `Tuần ${w}`).join(', ')
    : (sched.weeks || 'Theo kế hoạch học kỳ');

  body.innerHTML = `
    <section class="hist-detail-section">
      <div class="hist-detail-section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
        <span>Thông tin học phần</span>
      </div>
      <dl class="hist-detail-grid">
        <div class="hist-detail-cell">
          <dt>Mã học phần</dt>
          <dd>${escapeHtml(record.courseCode)}</dd>
        </div>
        <div class="hist-detail-cell">
          <dt>Số tín chỉ</dt>
          <dd>${Number(record.credits) || 0} tín chỉ</dd>
        </div>
        <div class="hist-detail-cell">
          <dt>Mã lớp học phần</dt>
          <dd>${escapeHtml(record.sectionCode)}</dd>
        </div>
        <div class="hist-detail-cell">
          <dt>Học kỳ</dt>
          <dd>${escapeHtml(record.semesterName)}</dd>
        </div>
        <div class="hist-detail-cell is-full">
          <dt>Mã định danh lớp (Section ID)</dt>
          <dd>${escapeHtml(record.sectionId)}</dd>
        </div>
      </dl>
    </section>

    <section class="hist-detail-section">
      <div class="hist-detail-section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        <span>Lịch học & giảng dạy</span>
      </div>
      <dl class="hist-detail-grid">
        <div class="hist-detail-cell">
          <dt>Giảng viên</dt>
          <dd>${escapeHtml(instructor)}</dd>
        </div>
        <div class="hist-detail-cell">
          <dt>Phòng học</dt>
          <dd>${escapeHtml(room)}</dd>
        </div>
        <div class="hist-detail-cell is-full">
          <dt>Lịch học</dt>
          <dd>${escapeHtml(sched.primary)}</dd>
        </div>
        <div class="hist-detail-cell is-full">
          <dt>Tuần học</dt>
          <dd>${escapeHtml(weeks)}</dd>
        </div>
      </dl>
    </section>

    <section class="hist-detail-section">
      <div class="hist-detail-section-title">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span>Trạng thái & thời điểm đăng ký</span>
      </div>
      <dl class="hist-detail-grid">
        <div class="hist-detail-cell">
          <dt>Trạng thái</dt>
          <dd>${escapeHtml(status.label)}</dd>
        </div>
        <div class="hist-detail-cell">
          <dt>Thời gian ghi nhận</dt>
          <dd>${escapeHtml(ts.date)}${ts.time ? ` · ${escapeHtml(ts.time)}` : ''}</dd>
        </div>
      </dl>
    </section>
  `;

  if (courseLinkBtn) {
    courseLinkBtn.dataset.sectionId = record.sectionId || '';
    courseLinkBtn.classList.toggle('hidden', !record.sectionId);
  }

  modal.classList.remove('is-closing');
  document.body.classList.add('hist-modal-open');
  if (!modal.open) modal.showModal();
}
