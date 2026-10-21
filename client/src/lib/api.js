// Cliente HTTP del API Node.js. En desarrollo Vite redirige /api al puerto 4000.
async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // Sesión vencida o cerrada en el servidor: App vuelve a la pantalla de ingreso.
    if (res.status === 401 && data && data.sesion === false) window.dispatchEvent(new Event('coi:sesion-vencida'));
    const err = new Error((data && data.error) || 'Error ' + res.status);
    err.status = res.status; err.data = data;
    throw err;
  }
  return data;
}
export const api = {
  get: (url) => request('GET', url),
  post: (url, body) => request('POST', url, body),
  patch: (url, body) => request('PATCH', url, body),
  put: (url, body) => request('PUT', url, body),
  del: (url) => request('DELETE', url)
};
