(function () {
  var STORAGE_KEY = 'eduportal-theme';
  var root = document.documentElement;

  function getSystemTheme() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function getStoredTheme() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (_) {}
    return null;
  }

  function resolveTheme() {
    // Future Campus defaults to Deep Space Dark Mode unless user explicitly chose Light Mode
    return getStoredTheme() || 'dark';
  }

  function syncMetaThemeColor(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#080E1B' : '#F3F6FC');
    }
  }

  function syncToggleButtons(theme) {
    var isDark = theme === 'dark';
    var nextLabel = isDark ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
    var textLabel = isDark ? 'Sáng' : 'Tối';
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      btn.setAttribute('aria-pressed', String(isDark));
      btn.setAttribute('aria-label', nextLabel);
      btn.setAttribute('title', nextLabel);
      var labelEl = btn.querySelector('.theme-label');
      if (labelEl) labelEl.textContent = textLabel;
    });
  }

  function applyTheme(theme, withTransition) {
    if (withTransition) {
      root.classList.add('theme-transitioning');
      window.setTimeout(function () {
        root.classList.remove('theme-transitioning');
      }, 240);
    }
    root.setAttribute('data-theme', theme);
    syncMetaThemeColor(theme);
    syncToggleButtons(theme);
  }

  // Apply synchronously before first paint to prevent light/dark flash
  var initialTheme = resolveTheme();
  root.setAttribute('data-theme', initialTheme);

  function toggleTheme() {
    var current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    var next = current === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (_) {}
    applyTheme(next, true);
  }

  function initThemeControls() {
    var theme = root.getAttribute('data-theme') || resolveTheme();
    syncMetaThemeColor(theme);
    syncToggleButtons(theme);

    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      if (btn.dataset.themeBound === '1') return;
      btn.dataset.themeBound = '1';
      btn.addEventListener('click', toggleTheme);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeControls);
  } else {
    initThemeControls();
  }

  // Sync theme across browser tabs
  window.addEventListener('storage', function (event) {
    if (event.key === STORAGE_KEY && (event.newValue === 'dark' || event.newValue === 'light')) {
      applyTheme(event.newValue, true);
    }
  });

  // Follow OS theme if user has not explicitly saved a preference
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onSystemChange = function (e) {
      if (!getStoredTheme()) {
        applyTheme(e.matches ? 'dark' : 'light', true);
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onSystemChange);
    else if (mq.addListener) mq.addListener(onSystemChange);
  }
})();
