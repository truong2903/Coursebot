import { apiGet, apiPost } from '../../../core/api.js';
import { createSlingButton } from '../../../core/sling-button.js?v=20261127sl';
import {
  DEFAULT_SUGGESTIONS,
  exportTranscriptLog,
  formatClockTime
} from './assistant-utils.js?v=20261125g';
import {
  renderAcademicContext,
  renderAssistantStatus,
  renderMessagesList,
  renderSuggestionsBar
} from './assistant-views.js?v=20261125g';

export function createAssistantController({ onToast, getContext, onNavigate } = {}) {
  let slingSendBtn = null;
  const state = {
    messages: [],
    historyPayload: [],
    suggestions: [...DEFAULT_SUGGESTIONS],
    busy: false,
    initialized: false,
    statusLoaded: false
  };

  const notify = msg => { if (typeof onToast === 'function') onToast(msg); };

  function getCtx() {
    return typeof getContext === 'function' ? (getContext() || {}) : {};
  }

  function updateComposerControls() {
    const input = document.getElementById('aiPromptInput');
    const sendBtn = document.getElementById('aiSendBtn');
    const clearBtn = document.getElementById('aiClearBtn');
    const charCounter = document.getElementById('aiCharCount');
    const countPill = document.getElementById('aiMsgCountPill');
    const isDisabled = state.busy || !input?.value.trim();

    if (charCounter && input) charCounter.textContent = `${input.value.length} / 1000`;
    if (slingSendBtn) slingSendBtn.setDisabled(isDisabled);
    else if (sendBtn) sendBtn.disabled = isDisabled;
    if (clearBtn) clearBtn.disabled = state.busy || state.messages.length === 0;
    if (countPill) countPill.textContent = `${state.messages.length} tin nhắn`;
    document.querySelector('#assistantViewSection .fc-ai-orb')?.classList.toggle('is-thinking', Boolean(state.busy));
  }

  function autoResizeInput() {
    const input = document.getElementById('aiPromptInput');
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
  }

  function render() {
    const ctx = getCtx();
    const container = document.getElementById('aiMessagesContainer');
    const firstName = ctx.studentName ? String(ctx.studentName).trim().split(/\s+/).at(-1) : 'bạn';
    const initials = ctx.initials || 'SV';

    renderAcademicContext(ctx);
    container.innerHTML = renderMessagesList(state.messages, initials, firstName, state.busy);
    renderSuggestionsBar(state.suggestions, state.busy);
    updateComposerControls();
    container.scrollTop = container.scrollHeight;
  }

  async function loadStatus() {
    try {
      const status = await apiGet('/api/chat/status');
      state.statusLoaded = true;
      renderAssistantStatus(status);
    } catch {
      renderAssistantStatus({
        aiConfigured: false,
        message: 'Trợ lý tra cứu học vụ tại hệ thống. Gửi câu hỏi để bắt đầu.'
      });
    }
  }

  async function sendQuestion(rawText) {
    const clean = String(rawText || '').trim();
    if (!clean || state.busy) return;
    if (clean.length > 1000) {
      notify('Câu hỏi tối đa 1.000 ký tự.');
      return;
    }

    const input = document.getElementById('aiPromptInput');
    if (input) {
      input.value = '';
      autoResizeInput();
    }

    state.busy = true;
    state.messages.push({ role: 'user', content: clean, time: formatClockTime() });
    render();

    try {
      const result = await apiPost('/api/chat', {
        message: clean,
        history: state.historyPayload.slice(-12)
      });

      const reply = result.reply || 'Mình chưa có câu trả lời cho câu hỏi này.';
      state.historyPayload.push(
        { role: 'user', content: clean },
        { role: 'assistant', content: reply.slice(0, 6000) }
      );
      if (state.historyPayload.length > 12) {
        state.historyPayload.splice(0, state.historyPayload.length - 12);
      }

      state.messages.push({
        role: 'assistant',
        content: reply,
        sources: Array.isArray(result.sources) ? result.sources : [],
        time: formatClockTime()
      });

      if (Array.isArray(result.suggestions) && result.suggestions.length) {
        state.suggestions = result.suggestions;
      }

      const pill = document.getElementById('aiModePill');
      if (pill) {
        pill.classList.toggle('is-local', !result.aiPowered);
        pill.innerHTML = `<span class="ai-mode-dot"></span><span>${result.aiPowered ? 'AI trực tuyến + dữ liệu học vụ' : 'Tra cứu học vụ tại hệ thống'}</span>`;
      }
    } catch (error) {
      state.messages.push({
        role: 'assistant',
        content: error.message || 'Chưa nhận được câu trả lời từ máy chủ. Bạn thử lại nhé.',
        sources: [],
        time: formatClockTime()
      });
    } finally {
      state.busy = false;
      render();
      input?.focus();
    }
  }

  function clearConversation() {
    if (state.busy) return;
    state.messages = [];
    state.historyPayload = [];
    state.suggestions = [...DEFAULT_SUGGESTIONS];
    render();
    notify('Đã tạo cuộc trò chuyện mới.');
  }

  function bindEventsOnce() {
    if (state.initialized) return;
    state.initialized = true;

    const form = document.getElementById('aiComposerForm');
    const input = document.getElementById('aiPromptInput');
    const slingMount = document.getElementById('aiSendSlingMount');

    if (slingMount && !slingSendBtn) {
      slingSendBtn = createSlingButton(slingMount, {
        buttonId: 'aiSendBtn',
        ariaLabel: 'Gửi câu hỏi',
        title: 'Kéo nút như ná cao su rồi thả để bắn, hoặc bấm để gửi (Enter)',
        size: 44,
        strokeWidth: 2.5,
        armAt: 40,
        maxPull: 128,
        launchSpeed: 2400,
        recoil: 0.2,
        flight: 110,
        particles: 14,
        spread: 60,
        tapSends: true,
        disabled: true,
        onSend: () => sendQuestion(input.value)
      });
    }

    form.addEventListener('submit', e => {
      e.preventDefault();
      if (input.value.trim() && !state.busy) slingSendBtn?.fireVisual();
      sendQuestion(input.value);
    });

    input.addEventListener('input', () => {
      autoResizeInput();
      updateComposerControls();
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (input.value.trim() && !state.busy) slingSendBtn?.fireVisual();
        sendQuestion(input.value);
      }
    });

    document.getElementById('aiClearBtn').addEventListener('click', clearConversation);

    document.getElementById('aiExportBtn').addEventListener('click', () => {
      const ok = exportTranscriptLog(state.messages, getCtx().studentName);
      notify(ok ? 'Đã tải xuống nội dung hội thoại.' : 'Chưa có tin nhắn nào để xuất.');
    });

    const section = document.getElementById('assistantViewSection');
    section.addEventListener('click', async e => {
      const promptBtn = e.target.closest('[data-ai-prompt]');
      if (promptBtn) {
        sendQuestion(promptBtn.dataset.aiPrompt);
        return;
      }
      const copyBtn = e.target.closest('[data-ai-copy]');
      if (copyBtn) {
        const msg = state.messages[Number(copyBtn.dataset.aiCopy)];
        if (msg?.content) {
          try {
            await navigator.clipboard.writeText(msg.content);
            notify('Đã sao chép câu trả lời.');
          } catch {
            notify('Không thể sao chép trên trình duyệt này.');
          }
        }
        return;
      }
      const navBtn = e.target.closest('[data-ai-nav]');
      if (navBtn && typeof onNavigate === 'function') {
        onNavigate(navBtn.dataset.aiNav);
      }
    });
  }

  return {
    open() {
      bindEventsOnce();
      if (!state.statusLoaded) loadStatus();
      render();
      document.getElementById('aiPromptInput')?.focus();
    },
    refreshContext() {
      if (!state.initialized) return;
      renderAcademicContext(getCtx());
    }
  };
}
