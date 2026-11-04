import { apiGet, apiPost } from '../../core/api.js';

const form = document.querySelector('#loginForm');
const button = form.querySelector('button[type="submit"]');
const message = document.querySelector('#authMessage');
const passwordInput = form.elements.password;
const showPassword = document.querySelector('#showPassword');

showPassword.addEventListener('change', () => {
  passwordInput.type = showPassword.checked ? 'text' : 'password';
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
  button.textContent = 'Đang xác thực…';
  try {
    const account = await apiPost('/api/auth/login', { username, password });
    location.replace(account.role === 'STUDENT' ? '/' : '/workspace.html');
  } catch (error) {
    showMessage(error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Đăng nhập';
  }
});
