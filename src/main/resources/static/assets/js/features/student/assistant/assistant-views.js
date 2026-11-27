import {
  STARTER_PROMPTS,
  escapeHtml,
  formatAssistantReplyHtml
} from './assistant-utils.js?v=20261125g';

const SPARKLE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/></svg>';
const COPY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>';

export function renderAssistantStatus(status) {
  const pill = document.getElementById('aiModePill');
  const note = document.getElementById('aiStatusNote');
  if (!pill || !note) return;

  const isOnline = Boolean(status?.aiConfigured);
  pill.classList.toggle('is-local', !isOnline);
  pill.innerHTML = `<span class="ai-mode-dot"></span><span>${isOnline ? `AI trực tuyến · ${escapeHtml(status.provider || 'Cloud')}` : 'Tra cứu học vụ tại hệ thống'}</span>`;
  note.textContent = status?.message || 'Tra cứu trực tiếp dữ liệu học vụ của bạn.';
}

export function renderAcademicContext(ctx) {
  const listEl = document.getElementById('aiContextList');
  if (!listEl || !ctx) return;

  listEl.innerHTML = `
    <div class="ai-context-row"><dt>Sinh viên</dt><dd>${escapeHtml(ctx.studentName || '—')}</dd></div>
    <div class="ai-context-row"><dt>Học kỳ</dt><dd>${escapeHtml(ctx.semesterName || '—')}</dd></div>
    <div class="ai-context-row"><dt>Tín chỉ đã ĐK</dt><dd>${Number(ctx.credits) || 0} / ${Number(ctx.maxCredits) || 20} TC</dd></div>
    <div class="ai-context-row"><dt>Số lớp đã ĐK</dt><dd>${Number(ctx.registeredCount) || 0} học phần</dd></div>
    <div class="ai-context-row"><dt>Cổng đăng ký</dt><dd>${ctx.registrationOpen ? 'Đang mở' : 'Đang đóng'}</dd></div>
  `;
}

export function renderWelcomeCard(studentFirstName) {
  return `
    <div class="ai-welcome-box">
      <div class="ai-welcome-head">
        <span class="ai-bot-badge" aria-hidden="true">${SPARKLE_SVG}</span>
        <div>
          <strong>Xin chào ${escapeHtml(studentFirstName || 'bạn')}! Mình là Trợ lý Học vụ EduPortal</strong>
          <p>Hỏi mình về lịch học, số tín chỉ, môn tiên quyết, bảng điểm hoặc lộ trình khung chương trình.</p>
        </div>
      </div>
      <div class="ai-starter-grid">
        ${STARTER_PROMPTS.map(item => `
          <button type="button" class="ai-starter-card" data-ai-prompt="${escapeHtml(item.question)}">
            <strong>${escapeHtml(item.title)}</strong>
            <small>${escapeHtml(item.desc)}</small>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

export function renderMessagesList(messages, studentInitials, studentFirstName, isBusy) {
  const welcome = messages.length === 0 ? renderWelcomeCard(studentFirstName) : '';

  const rendered = messages.map((msg, idx) => {
    if (msg.role === 'user') {
      return `
        <div class="ai-msg-row is-user">
          <span class="ai-msg-avatar is-user" aria-hidden="true">${escapeHtml(studentInitials || 'SV')}</span>
          <div class="ai-msg-stack">
            <div class="ai-bubble">${escapeHtml(msg.content).replace(/\r?\n/g, '<br>')}</div>
            <div class="ai-msg-foot"><span>Bạn · ${escapeHtml(msg.time)}</span></div>
          </div>
        </div>
      `;
    }

    const sourcesHtml = msg.sources?.length ? `
      <div class="ai-sources">
        <span class="ai-sources-label">Nguồn đối chiếu</span>
        ${msg.sources.map(s => `<span class="ai-source-tag">${escapeHtml(s)}</span>`).join('')}
      </div>
    ` : '';

    return `
      <div class="ai-msg-row is-bot">
        <span class="ai-msg-avatar is-bot" aria-hidden="true">${SPARKLE_SVG}</span>
        <div class="ai-msg-stack">
          <div class="ai-bubble">
            ${formatAssistantReplyHtml(msg.content)}
            ${sourcesHtml}
          </div>
          <div class="ai-msg-foot">
            <span>EduPortal · ${escapeHtml(msg.time)}</span>
            <button type="button" class="ai-copy-btn" data-ai-copy="${idx}" title="Sao chép câu trả lời">
              ${COPY_SVG}
              <span>Sao chép</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const typingHtml = isBusy ? `
    <div class="ai-typing-row">
      <span class="ai-msg-avatar is-bot" aria-hidden="true">${SPARKLE_SVG}</span>
      <div class="ai-typing-bubble">
        <span class="ai-typing-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>EduPortal đang đối chiếu dữ liệu học vụ…</span>
      </div>
    </div>
  ` : '';

  return `${welcome}${rendered}${typingHtml}`;
}

export function renderSuggestionsBar(suggestions, isBusy) {
  const bar = document.getElementById('aiSuggestionsBar');
  if (!bar) return;
  if (!suggestions?.length) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    return;
  }
  bar.classList.remove('hidden');
  bar.innerHTML = suggestions.map(q => `
    <button type="button" class="ai-suggestion-chip" data-ai-prompt="${escapeHtml(q)}" ${isBusy ? 'disabled' : ''}>
      ${escapeHtml(q)}
    </button>
  `).join('');
}
