/**
 * Registro de ingresos y salidas del portal (últimos 1000 eventos), para auditoría.
 * Se guarda en el almacén JSON (DATA_DIR/accesos.json); en Vercel es efímero como el resto de la demo.
 */
import { createStore } from '../store/jsonStore.js';

const MAX = 1000;
let store = null;

export function registrarAcceso(evento) {
  try {
    store ??= createStore('accesos', { eventos: [] });
    store.update((d) => {
      d.eventos.unshift({ fecha: new Date().toISOString(), ...evento });
      if (d.eventos.length > MAX) d.eventos.length = MAX;
    });
  } catch (e) {
    console.warn('[auth] no se pudo registrar el acceso:', e.message);
  }
}

export const listarAccesos = (n = 200) => (store ??= createStore('accesos', { eventos: [] })).get().eventos.slice(0, n);
