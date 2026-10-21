import { useCallback, useEffect, useState } from 'react';

/**
 * Cliente HTTP de un módulo: todas las rutas son relativas a /api/m/<id>.
 *   const api = crearApi('mi-modulo');  await api.get('/registros');  await api.post('/registros', { ... });
 * Los errores llegan como Error con el mensaje del servidor y `status`.
 */
export function crearApi(id) {
  const base = '/api/m/' + id;
  async function pedir(metodo, ruta = '', cuerpo) {
    const res = await fetch(base + (ruta && !ruta.startsWith('/') ? '/' : '') + ruta, {
      method: metodo,
      credentials: 'same-origin',
      headers: cuerpo !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error((data && data.error) || 'Error ' + res.status), { status: res.status });
    return data;
  }
  return {
    base,
    get: (ruta) => pedir('GET', ruta),
    post: (ruta, cuerpo) => pedir('POST', ruta, cuerpo === undefined ? {} : cuerpo),
    put: (ruta, cuerpo) => pedir('PUT', ruta, cuerpo === undefined ? {} : cuerpo),
    patch: (ruta, cuerpo) => pedir('PATCH', ruta, cuerpo === undefined ? {} : cuerpo),
    del: (ruta) => pedir('DELETE', ruta),
  };
}

/** Carga un recurso del módulo. Devuelve { data, error, loading, reload }. Con ruta null no carga. */
export function useRecurso(api, ruta) {
  const [state, setState] = useState({ data: null, error: null, loading: ruta != null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (ruta == null) return undefined;
    let vivo = true;
    setState((s) => ({ ...s, loading: true }));
    api.get(ruta)
      .then((data) => vivo && setState({ data, error: null, loading: false }))
      .catch((error) => vivo && setState((s) => ({ data: s.data, error, loading: false })));
    return () => { vivo = false; };
  }, [api, ruta, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
