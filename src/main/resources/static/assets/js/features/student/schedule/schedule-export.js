import { WEEKDAYS } from './schedule-utils.js';

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export function exportScheduleToCsv(scheduleData, events) {
  if (!scheduleData || !events.length) return false;

  const headers = [
    'Mã học phần',
    'Tên học phần',
    'Mã lớp học phần',
    'Số tín chỉ',
    'Thứ',
    'Giờ bắt đầu',
    'Giờ kết thúc',
    'Số tiết',
    'Phòng học',
    'Giảng viên',
    'Tuần học',
    'Trạng thái'
  ];

  const rows = events.map(ev => [
    ev.code,
    ev.name,
    ev.sectionCode,
    ev.credits,
    WEEKDAYS[ev.dayOfWeek - 1]?.label || '',
    ev.startLabel,
    ev.endLabel,
    ev.periods,
    ev.room,
    ev.instructor,
    ev.weeksExpression ? `Tuần ${ev.weeksExpression}` : 'Theo học kỳ',
    ev.course?.registered ? 'Đã đăng ký' : (ev.course?.status || '')
  ]);

  const csv = '\ufeff' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `thoi-khoa-bieu-${scheduleData.semesterCode || 'hoc-ky'}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}

export function printOrExportPdf({ isPdf = false, beforePrint, onToast } = {}) {
  if (typeof beforePrint === 'function') beforePrint();
  if (isPdf && typeof onToast === 'function') {
    onToast('Trong hộp thoại in, chọn "Save as PDF" (Lưu dưới dạng PDF) để lưu file chuẩn tiếng Việt.');
  }
  window.setTimeout(() => window.print(), isPdf ? 180 : 40);
}
