export const HISTORY_STATUSES = {
  ENROLLED: {
    key: 'ENROLLED',
    label: 'Đang đăng ký',
    cssClass: 'is-enrolled',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>'
  },
  PENDING: {
    key: 'PENDING',
    label: 'Chờ xác nhận',
    cssClass: 'is-pending',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
  },
  CANCELLED: {
    key: 'CANCELLED',
    label: 'Đã hủy',
    cssClass: 'is-cancelled',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>'
  }
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

export function getStatusMeta(status) {
  return HISTORY_STATUSES[status] || {
    key: status || 'UNKNOWN',
    label: status || 'Không xác định',
    cssClass: 'is-cancelled',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>'
  };
}

/**
 * Splits schedule strings like "Thứ 3 · 09:55 – 12:35 · Tuần 1-15" into
 * { primary: "Thứ 3 · 09:55 – 12:35", weeks: "Tuần 1-15" }.
 */
export function parseScheduleDisplay(schedule) {
  const raw = String(schedule || '').trim();
  if (!raw) return { primary: 'Chưa xếp lịch', weeks: '' };

  const parts = raw.split(/\s*·\s*/).filter(Boolean);
  const weekPart = parts.find(p => /^Tuần\b/i.test(p)) || '';
  const mainParts = parts.filter(p => p !== weekPart);

  return {
    primary: mainParts.join(' · ') || raw,
    weeks: weekPart.replace(/-/g, '–')
  };
}

export function formatRegistrationTimestamp(enrolledAt, dateOnly = false) {
  if (!enrolledAt) return { date: '—', time: '' };
  const dt = new Date(enrolledAt);
  if (Number.isNaN(dt.getTime())) return { date: String(enrolledAt), time: '' };

  const dd = String(dt.getDate()).padStart(2, '0');
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const yyyy = dt.getFullYear();
  const date = `${dd}/${mm}/${yyyy}`;

  if (dateOnly) {
    return { date, time: 'Theo ngày' };
  }
  const hh = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  return { date, time: `${hh}:${min}` };
}

export function computeHistoryStats(records = []) {
  let enrolled = 0;
  let enrolledCredits = 0;
  let pending = 0;
  let cancelled = 0;

  for (const r of records) {
    if (r.status === 'ENROLLED') {
      enrolled++;
      enrolledCredits += Number(r.credits) || 0;
    } else if (r.status === 'PENDING') {
      pending++;
    } else if (r.status === 'CANCELLED') {
      cancelled++;
    }
  }

  return {
    total: records.length,
    enrolled,
    enrolledCredits,
    pending,
    cancelled
  };
}

export function filterAndSortHistory(records = [], filters = {}) {
  const {
    semester = '',
    status = '',
    search = '',
    credits = '',
    weekday = '',
    sort = 'newest'
  } = filters;

  const query = search.trim().toLocaleLowerCase('vi');

  const filtered = records.filter(item => {
    if (semester && item.semesterCode !== semester) return false;
    if (status && item.status !== status) return false;
    if (credits && String(item.credits) !== String(credits)) return false;
    if (weekday && !String(item.schedule || '').includes(weekday)) return false;
    if (query) {
      const haystack = `${item.courseCode} ${item.courseName} ${item.sectionCode} ${item.semesterName} ${item.schedule}`.toLocaleLowerCase('vi');
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (sort === 'oldest') {
      return new Date(a.enrolledAt || 0) - new Date(b.enrolledAt || 0);
    }
    if (sort === 'code') {
      return String(a.courseCode || '').localeCompare(String(b.courseCode || ''), 'vi');
    }
    if (sort === 'credits') {
      return (Number(b.credits) || 0) - (Number(a.credits) || 0)
        || String(a.courseCode || '').localeCompare(String(b.courseCode || ''), 'vi');
    }
    // default: newest
    return new Date(b.enrolledAt || 0) - new Date(a.enrolledAt || 0);
  });

  return sorted;
}

export function exportHistoryToCsv(records = []) {
  if (!records.length) return false;
  const headers = ['Mã môn', 'Tên học phần', 'Tín chỉ', 'Học kỳ', 'Mã lớp học phần', 'Lịch học', 'Trạng thái', 'Thời gian đăng ký'];
  const cell = v => `"${String(v ?? '').replaceAll('"', '""')}"`;

  const rows = records.map(item => {
    const ts = formatRegistrationTimestamp(item.enrolledAt, item.enrollmentDateOnly);
    const meta = getStatusMeta(item.status);
    return [
      item.courseCode,
      item.courseName,
      item.credits,
      item.semesterName,
      item.sectionCode,
      item.schedule,
      meta.label,
      ts.time && ts.time !== 'Theo ngày' ? `${ts.date} ${ts.time}` : ts.date
    ];
  });

  const csv = '\ufeff' + [headers, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'lich-su-dang-ky.csv';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}
