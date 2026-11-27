export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

export function grade10ToGpa4(grade10) {
  if (grade10 === null || grade10 === undefined || Number.isNaN(Number(grade10))) return null;
  const g = Number(grade10);
  if (g >= 8.5) return 4.0;
  if (g >= 8.0) return 3.5;
  if (g >= 7.0) return 3.0;
  if (g >= 6.5) return 2.5;
  if (g >= 5.5) return 2.0;
  if (g >= 5.0) return 1.5;
  if (g >= 4.0) return 1.0;
  return 0.0;
}

export function getAcademicRank(avgGrade10) {
  if (avgGrade10 === null || avgGrade10 === undefined || Number.isNaN(Number(avgGrade10))) return 'Chưa có xếp loại';
  const g = Number(avgGrade10);
  if (g >= 9.0) return 'Xuất sắc';
  if (g >= 8.0) return 'Giỏi';
  if (g >= 7.0) return 'Khá';
  if (g >= 5.5) return 'Trung bình';
  if (g >= 4.0) return 'Trung bình yếu';
  return 'Cảnh báo học tập';
}

export function getLetterGradeClass(letterGrade) {
  const clean = String(letterGrade || '').trim().toUpperCase();
  if (clean.startsWith('A')) return 'is-a';
  if (clean.startsWith('B')) return 'is-b';
  if (clean.startsWith('C')) return 'is-c';
  if (clean.startsWith('D')) return 'is-d';
  if (clean === 'F') return 'is-f';
  return 'is-d';
}

export function getGradeBarTone(grade10) {
  if (grade10 === null || grade10 === undefined) return 'is-good';
  const g = Number(grade10);
  if (g >= 8.0) return 'is-high';
  if (g >= 6.5) return 'is-good';
  if (g >= 4.0) return 'is-mid';
  return 'is-low';
}

export function computeTranscriptSummary(transcriptData) {
  const results = Array.isArray(transcriptData?.results) ? transcriptData.results : [];
  const passedCount = results.filter(r => r.passed).length;
  const failedCount = results.filter(r => !r.passed).length;
  const passRate = results.length ? Math.round((passedCount / results.length) * 100) : 0;

  // Weighted GPA 4.0 reference using best grade per course
  const bestByCourse = new Map();
  for (const r of results) {
    if (r.grade != null && r.credits > 0) {
      const prev = bestByCourse.get(r.courseCode);
      if (!prev || Number(r.grade) > Number(prev.grade)) {
        bestByCourse.set(r.courseCode, r);
      }
    }
  }
  let sum4 = 0;
  let cr4 = 0;
  for (const r of bestByCourse.values()) {
    const g4 = grade10ToGpa4(r.grade);
    if (g4 !== null) {
      sum4 += g4 * Number(r.credits);
      cr4 += Number(r.credits);
    }
  }
  const gpa4 = cr4 > 0 ? Math.round((sum4 / cr4) * 100) / 100 : null;

  return {
    accumulatedCredits: Number(transcriptData?.accumulatedCredits) || 0,
    completedCourseCount: Number(transcriptData?.completedCourseCount) || 0,
    totalRecords: Number(transcriptData?.totalRecords) || results.length,
    weightedAvg10: transcriptData?.weightedAverageGrade10 != null ? Number(transcriptData.weightedAverageGrade10) : null,
    gpa4,
    rank: getAcademicRank(transcriptData?.weightedAverageGrade10),
    passedCount,
    failedCount,
    passRate
  };
}

export function computeSemesterSummaries(results = []) {
  const map = new Map();
  for (const item of results) {
    const code = item.semesterCode || 'KHAC';
    if (!map.has(code)) {
      map.set(code, {
        semesterCode: code,
        semesterName: item.semesterName || code,
        count: 0,
        passedCount: 0,
        passedCredits: 0,
        weightedSum: 0,
        gradedCredits: 0
      });
    }
    const bucket = map.get(code);
    bucket.count++;
    if (item.passed) {
      bucket.passedCount++;
      bucket.passedCredits += Number(item.credits) || 0;
    }
    if (item.grade != null && item.credits > 0) {
      bucket.weightedSum += Number(item.grade) * Number(item.credits);
      bucket.gradedCredits += Number(item.credits);
    }
  }

  return [...map.values()].map(b => ({
    ...b,
    avg10: b.gradedCredits > 0 ? Math.round((b.weightedSum / b.gradedCredits) * 100) / 100 : null
  }));
}

export function filterAndSortTranscript(results = [], filters = {}) {
  const {
    semester = '',
    outcome = '',
    search = '',
    letterGrade = '',
    credits = '',
    sort = 'semesterDesc'
  } = filters;

  const query = search.trim().toLocaleLowerCase('vi');

  const filtered = results.filter(item => {
    if (semester && item.semesterCode !== semester) return false;
    if (outcome === 'PASSED' && !item.passed) return false;
    if (outcome === 'FAILED' && item.passed) return false;
    if (letterGrade && String(item.letterGrade || '').toUpperCase() !== letterGrade) return false;
    if (credits && String(item.credits) !== String(credits)) return false;
    if (query) {
      const hay = `${item.courseCode} ${item.courseName} ${item.semesterCode} ${item.semesterName} ${item.letterGrade || ''}`.toLocaleLowerCase('vi');
      if (!hay.includes(query)) return false;
    }
    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (sort === 'semesterAsc') {
      return String(a.semesterCode || '').localeCompare(String(b.semesterCode || ''))
        || String(a.courseCode || '').localeCompare(String(b.courseCode || ''));
    }
    if (sort === 'gradeDesc') {
      return (Number(b.grade ?? -1) - Number(a.grade ?? -1))
        || String(a.courseCode || '').localeCompare(String(b.courseCode || ''));
    }
    if (sort === 'gradeAsc') {
      return (Number(a.grade ?? 99) - Number(b.grade ?? 99))
        || String(a.courseCode || '').localeCompare(String(b.courseCode || ''));
    }
    if (sort === 'code') {
      return String(a.courseCode || '').localeCompare(String(b.courseCode || ''), 'vi');
    }
    // default: semesterDesc
    return String(b.semesterCode || '').localeCompare(String(a.semesterCode || ''))
      || String(a.courseCode || '').localeCompare(String(b.courseCode || ''));
  });

  return sorted;
}

export function exportTranscriptToCsv(transcriptData, rows = []) {
  if (!rows.length) return false;
  const headers = ['Mã học kỳ', 'Học kỳ', 'Mã học phần', 'Tên học phần', 'Tín chỉ', 'Điểm hệ 10', 'Điểm hệ 4 (tham khảo)', 'Điểm chữ', 'Kết quả', 'Ghi chú'];
  const cell = v => `"${String(v ?? '').replaceAll('"', '""')}"`;

  const dataRows = rows.map(item => {
    const g4 = grade10ToGpa4(item.grade);
    return [
      item.semesterCode,
      item.semesterName,
      item.courseCode,
      item.courseName,
      item.credits,
      item.grade != null ? Number(item.grade).toFixed(2) : '',
      g4 != null ? g4.toFixed(1) : '',
      item.letterGrade || '',
      item.outcome || (item.passed ? 'Đạt' : 'Chưa đạt'),
      item.retakenAndPassed ? 'Đã học lại Đạt' : ''
    ];
  });

  const csv = '\ufeff' + [headers, ...dataRows].map(r => r.map(cell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bang-diem-${transcriptData?.studentCode || 'sinh-vien'}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}
