/* ==========================================================================
   FUTURE CAMPUS — SHARED FUTURISTIC SHELL CONTROLLER
   Provides: Collapsible Sidebar, Mobile Drawer, Command Palette (Ctrl+K),
             Real-Data Notification Center (Strict Role Authorization)
   ========================================================================== */

import { attachGooeyNav } from './gooey-nav.js?v=20261127gn';

const SIDEBAR_STATE_KEY = 'fc-sidebar-collapsed';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function initFutureShell({
  sidebarSelector = '.sidebar',
  navSelector = '.main-nav .nav-item',
  getCommands = () => [],
  onCommandRun = null
} = {}) {
  const sidebar = document.querySelector(sidebarSelector);
  const backdrop = document.getElementById('fcSidebarBackdrop');
  const collapseBtn = document.getElementById('fcSidebarCollapseBtn');
  const mobileBtn = document.getElementById('fcMobileMenuBtn');
  const cmdTrigger = document.getElementById('fcCmdTrigger');
  const palette = document.getElementById('fcCommandPalette');
  const cmdInput = document.getElementById('fcCmdInput');
  const cmdList = document.getElementById('fcCmdList');
  const notifBtn = document.getElementById('fcNotifBtn');
  const notifPanel = document.getElementById('fcNotifPanel');
  const notifDot = document.getElementById('fcNotifDot');
  const notifList = document.getElementById('fcNotifList');
  const notifCount = document.getElementById('fcNotifCount');

  let activeCmdIndex = 0;
  let visibleCommands = [];
  let notifications = [];

  const navContainer = sidebar?.querySelector('.main-nav, #workspaceNav, .workspace-nav');
  const gooeyItemSelector = navContainer?.id === 'workspaceNav' || navContainer?.classList.contains('workspace-nav')
    ? 'button[data-page]'
    : '.nav-item';
  const gooeyNav = navContainer ? attachGooeyNav(navContainer, { itemSelector: gooeyItemSelector }) : null;

  // 1. Collapsible Sidebar Persistence + Tooltips
  function syncNavTooltips() {
    document.querySelectorAll(navSelector).forEach(el => {
      const label = el.textContent.replace(/\s+/g, ' ').trim();
      if (label && !el.dataset.fcTip) {
        el.dataset.fcTip = label;
      }
    });
    gooeyNav?.syncItems();
  }

  function applyCollapsed(collapsed) {
    document.body.classList.toggle('fc-sidebar-collapsed', Boolean(collapsed));
    if (collapseBtn) {
      collapseBtn.setAttribute('aria-expanded', String(!collapsed));
      collapseBtn.title = collapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng';
    }
    try {
      localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? '1' : '0');
    } catch (_) {}
    gooeyNav?.syncLayout();
    setTimeout(() => gooeyNav?.syncLayout(), 260);
  }

  try {
    if (localStorage.getItem(SIDEBAR_STATE_KEY) === '1' && window.innerWidth > 960) {
      applyCollapsed(true);
    }
  } catch (_) {}

  syncNavTooltips();

  collapseBtn?.addEventListener('click', () => {
    const next = !document.body.classList.contains('fc-sidebar-collapsed');
    applyCollapsed(next);
  });

  // 2. Mobile Navigation Drawer
  function setMobileNav(open) {
    document.body.classList.toggle('fc-mobile-nav-open', Boolean(open));
    mobileBtn?.setAttribute('aria-expanded', String(Boolean(open)));
  }

  mobileBtn?.addEventListener('click', () => {
    setMobileNav(!document.body.classList.contains('fc-mobile-nav-open'));
  });

  backdrop?.addEventListener('click', () => setMobileNav(false));

  sidebar?.addEventListener('click', event => {
    if (window.innerWidth <= 960 && event.target.closest(navSelector)) {
      setMobileNav(false);
    }
  });

  // 3. Command Palette (Ctrl + K) — Authorized Commands Only
  function collectCommands() {
    const custom = typeof getCommands === 'function' ? getCommands() : [];
    const base = [
      {
        id: 'toggle-theme',
        group: 'Hệ thống',
        title: 'Chuyển giao diện Sáng / Tối',
        subtitle: 'Chuyển đổi giữa Deep Space Dark Mode và Crystal Light Mode',
        tag: 'THEME',
        action: () => document.querySelector('[data-theme-toggle]')?.click()
      },
      {
        id: 'toggle-sidebar',
        group: 'Hệ thống',
        title: 'Thu gọn / Mở rộng thanh điều hướng',
        subtitle: 'Tối ưu không gian hiển thị bảng và lịch học',
        tag: 'UI',
        action: () => collapseBtn?.click()
      }
    ];
    return [...custom, ...base];
  }

  function renderPaletteList(query = '') {
    if (!cmdList) return;
    const q = query.trim().toLocaleLowerCase('vi');
    const all = collectCommands();
    visibleCommands = q
      ? all.filter(c => `${c.title} ${c.subtitle || ''} ${c.group || ''} ${c.tag || ''}`.toLocaleLowerCase('vi').includes(q))
      : all;
    activeCmdIndex = 0;

    if (!visibleCommands.length) {
      cmdList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:13px">Không tìm thấy lệnh hoặc trang phù hợp.</div>';
      return;
    }

    let currentGroup = '';
    const html = visibleCommands.map((cmd, idx) => {
      const groupHead = cmd.group && cmd.group !== currentGroup
        ? `<div class="fc-cmd-group">${esc(cmd.group)}</div>`
        : '';
      currentGroup = cmd.group || currentGroup;
      return `${groupHead}
        <button type="button" class="fc-cmd-item ${idx === 0 ? 'is-active' : ''}" data-cmd-idx="${idx}">
          <span class="fc-cmd-item-copy">
            <strong>${esc(cmd.title)}</strong>
            ${cmd.subtitle ? `<small>${esc(cmd.subtitle)}</small>` : ''}
          </span>
          ${cmd.tag ? `<span class="fc-cmd-item-tag">${esc(cmd.tag)}</span>` : ''}
        </button>`;
    }).join('');
    cmdList.innerHTML = html;
  }

  function highlightActiveCmd() {
    if (!cmdList) return;
    cmdList.querySelectorAll('.fc-cmd-item').forEach((btn, i) => {
      const active = i === activeCmdIndex;
      btn.classList.toggle('is-active', active);
      if (active) btn.scrollIntoView({ block: 'nearest' });
    });
  }

  function executeCommand(index) {
    const cmd = visibleCommands[index];
    if (!cmd) return;
    closePalette();
    if (typeof cmd.action === 'function') cmd.action();
    if (typeof onCommandRun === 'function') onCommandRun(cmd);
  }

  function openPalette() {
    if (!palette) return;
    setNotifOpen(false);
    if (cmdInput) cmdInput.value = '';
    renderPaletteList('');
    if (!palette.open) palette.showModal();
    requestAnimationFrame(() => cmdInput?.focus());
  }

  function closePalette() {
    if (palette?.open) palette.close();
  }

  cmdTrigger?.addEventListener('click', openPalette);
  cmdInput?.addEventListener('input', e => renderPaletteList(e.target.value));
  cmdInput?.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (visibleCommands.length) {
        activeCmdIndex = (activeCmdIndex + 1) % visibleCommands.length;
        highlightActiveCmd();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (visibleCommands.length) {
        activeCmdIndex = (activeCmdIndex - 1 + visibleCommands.length) % visibleCommands.length;
        highlightActiveCmd();
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      executeCommand(activeCmdIndex);
    }
  });

  cmdList?.addEventListener('click', e => {
    const btn = e.target.closest('[data-cmd-idx]');
    if (btn) executeCommand(Number(btn.dataset.cmdIdx));
  });

  palette?.addEventListener('click', e => {
    if (e.target === palette) closePalette();
  });

  // 4. Notification Center (Real State Driven)
  function setNotifOpen(open) {
    if (!notifPanel || !notifBtn) return;
    notifPanel.hidden = !open;
    notifBtn.setAttribute('aria-expanded', String(Boolean(open)));
    if (open && notifDot) notifDot.classList.add('hidden');
  }

  function renderNotifications() {
    if (!notifList) return;
    if (notifCount) notifCount.textContent = `${notifications.length} mục`;
    if (notifDot) notifDot.classList.toggle('hidden', notifications.length === 0);

    if (!notifications.length) {
      notifList.innerHTML = '<div style="padding:14px;text-align:center;color:var(--muted);font-size:12.5px">Hiện chưa có thông báo học vụ mới.</div>';
      return;
    }

    notifList.innerHTML = notifications.map((item, idx) => `
      <button type="button" class="fc-notif-item" data-notif-idx="${idx}">
        <span class="fc-notif-pill ${item.tone ? `is-${esc(item.tone)}` : ''}"></span>
        <span>
          <strong>${esc(item.title)}</strong>
          <small>${esc(item.body)}</small>
        </span>
      </button>`).join('');
  }

  notifBtn?.addEventListener('click', () => {
    setNotifOpen(notifPanel?.hidden);
  });

  notifList?.addEventListener('click', e => {
    const btn = e.target.closest('[data-notif-idx]');
    if (!btn) return;
    const item = notifications[Number(btn.dataset.notifIdx)];
    setNotifOpen(false);
    if (item && typeof item.action === 'function') item.action();
  });

  document.addEventListener('pointerdown', e => {
    const wrap = document.getElementById('fcNotifWrap');
    if (wrap && !wrap.contains(e.target)) setNotifOpen(false);
  });

  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (palette?.open) closePalette();
      else openPalette();
    } else if (e.key === 'Escape') {
      setNotifOpen(false);
      setMobileNav(false);
    }
  });

  renderNotifications();

  return {
    openPalette,
    syncNavTooltips,
    updateNotifications(items = []) {
      notifications = Array.isArray(items) ? items : [];
      renderNotifications();
    }
  };
}
