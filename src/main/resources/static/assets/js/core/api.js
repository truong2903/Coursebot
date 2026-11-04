const DEFAULT_HEADERS = { Accept: 'application/json' };

function csrfCookie() {
  const entry = document.cookie.split('; ').find(value => value.startsWith('XSRF-TOKEN='));
  return entry ? decodeURIComponent(entry.slice('XSRF-TOKEN='.length)) : null;
}

export async function apiRequest(path, options = {}) {
  const headers = { ...DEFAULT_HEADERS, ...(options.headers || {}) };
  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS', 'TRACE'].includes(method)) {
    const token = csrfCookie();
    if (token) headers['X-XSRF-TOKEN'] = token;
  }
  const config = { credentials: 'same-origin', ...options, headers };
  if (config.body && !(config.body instanceof FormData) && typeof config.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(config.body);
  }

  let response;
  try {
    response = await fetch(path, config);
  } catch {
    throw new Error('Không kết nối được máy chủ. Vui lòng kiểm tra kết nối rồi thử lại.');
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '');

  if (!response.ok) {
    const message = typeof payload === 'object' && payload
      ? payload.message || payload.error || `Máy chủ trả về lỗi ${response.status}.`
      : payload || `Máy chủ trả về lỗi ${response.status}.`;
    if (response.status === 401 && !location.pathname.endsWith('/login.html')) location.assign('/login.html');
    throw new Error(message);
  }
  return payload;
}

export const apiGet = path => apiRequest(path);
export const apiPost = (path, body) => apiRequest(path, { method: 'POST', body });
export const apiPut = (path, body) => apiRequest(path, { method: 'PUT', body });
export const apiDelete = path => apiRequest(path, { method: 'DELETE' });
