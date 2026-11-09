import { apiGet, apiPost } from '../../core/api.js';

const form = document.querySelector('#loginForm');
const button = form.querySelector('button[type="submit"]');
const btnText = button.querySelector('.btn-text');
const btnSpinner = button.querySelector('.btn-spinner');
const message = document.querySelector('#authMessage');
const passwordInput = form.elements.password;
const togglePasswordBtn = document.querySelector('#togglePasswordBtn');
const showPassword = document.querySelector('#showPassword');
const overlay = document.querySelector('#loginLoadingOverlay');

// Eye toggle handling
if (togglePasswordBtn) {
  togglePasswordBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    const eyeOpen = togglePasswordBtn.querySelector('.eye-open');
    const eyeClosed = togglePasswordBtn.querySelector('.eye-closed');
    if (eyeOpen) eyeOpen.style.display = isPassword ? 'none' : 'block';
    if (eyeClosed) eyeClosed.style.display = isPassword ? 'block' : 'none';
    if (showPassword) showPassword.checked = isPassword;
  });
}

if (showPassword) {
  showPassword.addEventListener('change', () => {
    passwordInput.type = showPassword.checked ? 'text' : 'password';
  });
}

// Quick demo account chips
document.querySelectorAll('.demo-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    form.elements.username.value = chip.dataset.user || '';
    form.elements.password.value = chip.dataset.pass || '';
    message.className = 'auth-message';
    message.textContent = '';
    document.querySelectorAll('.demo-chip').forEach(c => c.classList.remove('selected'));
    chip.classList.add('selected');
    button.focus();
  });
});

function showMessage(text, kind = 'error') {
  message.textContent = text;
  message.className = `auth-message show ${kind}`;
}

try {
  const current = await apiGet('/api/auth/me');
  location.replace(current.role === 'STUDENT' ? '/' : '/workspace.html');
} catch (error) {
  if (!error.message.includes('đăng nhập')) {
    // A missing session is the expected state on the login page.
  }
}

try { await apiGet('/api/auth/csrf'); } catch { /* The form will report the API error on submit. */ }

form.addEventListener('submit', async event => {
  event.preventDefault();
  const username = form.elements.username.value.trim();
  const password = form.elements.password.value;
  if (!username || !password) return showMessage('Nhập tên đăng nhập và mật khẩu để tiếp tục.');

  button.disabled = true;
  if (btnText && btnSpinner) {
    btnText.style.display = 'none';
    btnSpinner.style.display = 'inline-flex';
  } else {
    button.textContent = 'Đang xác thực…';
  }

  try {
    const account = await apiPost('/api/auth/login', { username, password });
    if (overlay) {
      overlay.classList.add('active');
    }
    setTimeout(() => {
      location.replace(account.role === 'STUDENT' ? '/' : '/workspace.html');
    }, overlay ? 450 : 0);
  } catch (error) {
    if (overlay) overlay.classList.remove('active');
    showMessage(error.message);
  } finally {
    button.disabled = false;
    if (btnText && btnSpinner) {
      btnText.style.display = 'inline';
      btnSpinner.style.display = 'none';
    } else {
      button.textContent = 'Đăng nhập';
    }
  }
});
