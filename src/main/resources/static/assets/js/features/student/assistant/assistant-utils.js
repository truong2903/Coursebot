export const DEFAULT_SUGGESTIONS = [
  'Lịch học của tôi thế nào?',
  'Tôi đã đăng ký bao nhiêu tín chỉ?',
  'Gợi ý môn học phù hợp',
  'Tôi còn thiếu môn nào?',
  'Xem kết quả học tập',
  'Khi nào hết hạn đăng ký?'
];

export const STARTER_PROMPTS = [
  {
    title: 'Tra cứu lịch học tuần này',
    desc: 'Xem các buổi học, phòng và khung giờ đã đăng ký',
    question: 'Lịch học của tôi thế nào?'
  },
  {
    title: 'Kiểm tra tín chỉ & đăng ký',
    desc: 'Tổng số tín chỉ hiện tại và giới hạn tín chỉ học kỳ',
    question: 'Tôi đã đăng ký bao nhiêu tín chỉ?'
  },
  {
    title: 'Gợi ý môn học phù hợp',
    desc: 'Đề xuất học phần dựa trên điều kiện tiên quyết',
    question: 'Gợi ý môn học phù hợp'
  },
  {
    title: 'Rà soát môn còn thiếu',
    desc: 'Đối chiếu bảng điểm với khung chương trình đào tạo',
    question: 'Tôi còn thiếu môn nào?'
  }
];

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

export function formatClockTime(date = new Date()) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Safely renders plain/markdown-like bot responses (bold **text**, bullet lists, line breaks)
 * without ever allowing raw HTML injection.
 */
export function formatAssistantReplyHtml(rawText) {
  const safe = escapeHtml(String(rawText || '').trim());
  if (!safe) return '<p>Mình chưa có câu trả lời cho câu hỏi này.</p>';

  const applyInline = line => line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  const lines = safe.split(/\r?\n/);
  const blocks = [];
  let listItems = [];

  const flushList = () => {
    if (listItems.length) {
      blocks.push(`<ul>${listItems.map(li => `<li>${applyInline(li)}</li>`).join('')}</ul>`);
      listItems = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }
    const bulletMatch = line.match(/^[-•*]\s+(.+)$/);
    if (bulletMatch) {
      listItems.push(bulletMatch[1]);
    } else {
      flushList();
      blocks.push(`<p>${applyInline(line)}</p>`);
    }
  }
  flushList();
  return blocks.join('') || `<p>${applyInline(safe)}</p>`;
}

export function exportTranscriptLog(messages = [], studentName = 'Sinh viên') {
  if (!messages.length) return false;
  const header = [
    `HỘI THOẠI TRỢ LÝ AI HỌC VỤ — EDUPORTAL`,
    `Sinh viên: ${studentName}`,
    `Xuất lúc: ${new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}`,
    '------------------------------------------------------------',
    ''
  ];

  const body = messages.map(m => {
    const who = m.role === 'user' ? 'Bạn' : 'Trợ lý EduPortal';
    const src = m.sources?.length ? `\n[Nguồn tham chiếu: ${m.sources.join(' | ')}]` : '';
    return `[${m.time || ''}] ${who}:\n${m.content}${src}\n`;
  });

  const text = [...header, ...body].join('\n');
  const blob = new Blob(['\ufeff' + text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'hoi-thoai-tro-ly-ai.txt';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}
