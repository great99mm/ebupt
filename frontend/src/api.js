export async function api(path, options = {}, token) {
  const authToken = token || localStorage.getItem('ebupteam_token') || '';
  const headers = new Headers(options.headers || {});
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`);
  if (options.body && !headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, {
    credentials: 'include',
    ...options,
    headers,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const error = new Error(data.error || data.message || `请求失败 ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}
