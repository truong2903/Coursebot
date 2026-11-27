export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

export function safeHttpUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export function getCourseProgressStatus(courseCode, completedCodes, enrolledCodes) {
  const code = String(courseCode || '').toUpperCase();
  if (completedCodes?.has(code)) {
    return {
      key: 'COMPLETED',
      label: 'Đã hoàn thành',
      cssClass: 'is-completed',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>'
    };
  }
  if (enrolledCodes?.has(code)) {
    return {
      key: 'ENROLLED',
      label: 'Đang học',
      cssClass: 'is-enrolled',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
    };
  }
  return {
    key: 'PENDING',
    label: 'Chưa học',
    cssClass: 'is-pending',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>'
  };
}

export function computeCurriculumStats(courses = [], completedCodes = new Set(), enrolledCodes = new Set()) {
  const totalCourses = courses.length;
  const requiredCount = courses.filter(c => c.requiredCourse).length;
  const electiveCount = totalCourses - requiredCount;
  const totalCredits = courses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
  const requiredCredits = courses.filter(c => c.requiredCourse).reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
  const terms = new Set(courses.map(c => c.suggestedSemester || 'Chưa phân kỳ'));

  let completedCount = 0;
  let completedCredits = 0;
  let enrolledCount = 0;

  for (const c of courses) {
    const code = String(c.courseCode || '').toUpperCase();
    if (completedCodes.has(code)) {
      completedCount++;
      completedCredits += Number(c.credits) || 0;
    } else if (enrolledCodes.has(code)) {
      enrolledCount++;
    }
  }

  const progressPct = totalCourses > 0 ? Math.round((completedCount / totalCourses) * 100) : 0;

  return {
    totalCourses,
    requiredCount,
    electiveCount,
    totalCredits,
    requiredCredits,
    termCount: terms.size,
    completedCount,
    completedCredits,
    enrolledCount,
    progressPct
  };
}

export function filterCurriculumCourses(courses = [], filters = {}, completedCodes = new Set(), enrolledCodes = new Set()) {
  const {
    term = '',
    type = '',
    progress = '',
    credits = '',
    search = ''
  } = filters;

  const query = search.trim().toLocaleLowerCase('vi');

  return courses.filter(item => {
    const itemTerm = item.suggestedSemester || 'Chưa phân kỳ';
    if (term && itemTerm !== term) return false;
    if (type === 'REQUIRED' && !item.requiredCourse) return false;
    if (type === 'ELECTIVE' && item.requiredCourse) return false;
    if (credits && String(item.credits) !== String(credits)) return false;

    if (progress) {
      const st = getCourseProgressStatus(item.courseCode, completedCodes, enrolledCodes).key;
      if (st !== progress) return false;
    }

    if (query) {
      const hay = `${item.courseCode} ${item.courseName} ${itemTerm} ${item.prerequisite || ''} ${item.description || ''}`.toLocaleLowerCase('vi');
      if (!hay.includes(query)) return false;
    }
    return true;
  });
}

export function groupCoursesByTerm(courses = []) {
  const map = new Map();
  for (const item of courses) {
    const term = item.suggestedSemester || 'Chưa phân kỳ';
    if (!map.has(term)) map.set(term, []);
    map.get(term).push(item);
  }
  return [...map.entries()].map(([term, items]) => ({
    term,
    items,
    totalCredits: items.reduce((s, c) => s + (Number(c.credits) || 0), 0)
  }));
}

export function exportCurriculumToCsv(curriculum, courses = [], completedCodes = new Set(), enrolledCodes = new Set()) {
  if (!courses.length) return false;
  const headers = ['Học kỳ đề xuất', 'Mã học phần', 'Tên học phần', 'Tín chỉ', 'Loại học phần', 'Điều kiện tiên quyết', 'Tiến độ'];
  const cell = v => `"${String(v ?? '').replaceAll('"', '""')}"`;

  const rows = courses.map(item => {
    const st = getCourseProgressStatus(item.courseCode, completedCodes, enrolledCodes);
    return [
      item.suggestedSemester || 'Chưa phân kỳ',
      item.courseCode,
      item.courseName,
      item.credits,
      item.requiredCourse ? 'Bắt buộc' : 'Tự chọn',
      item.prerequisite || 'Không có',
      st.label
    ];
  });

  const csv = '\ufeff' + [headers, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `khung-chuong-trinh-${curriculum?.code || 'dao-tao'}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}
