// Datos y utilidades de los tableros de Control de Arqueos (COI V1).
// Las funciones del servidor tienen el mismo nombre, parámetros y forma de respuesta
// que Código.gs (obtenerDashboard, obtenerDashboardClientes, obtenerResumenRegional,
// obtenerAnalitica, obtenerTendencias, obtenerMesesDisponibles).
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { llamar, invalidarFront } from '../shared.jsx';

/* ------------------------------------------------------------------
   Memoria de consultas: se usa la misma FCACHE del módulo operativo
   (shared.jsx, 3 minutos, como V1), de modo que «Actualizar» y cualquier
   escritura (gestión, normalización, nuevo arqueo) refrescan también los
   tableros. La respuesta de obtenerDashboard se comparte entre Dashboard,
   Cumplimiento por líder y Faltantes / Sobrantes.
   ------------------------------------------------------------------ */
const INFLIGHT = new Map();

export function invalidar() { invalidarFront(); }

/** Error de "la función todavía no existe en el servidor" (404 del RPC). */
export const esNoDisponible = (e) => !!e && /no disponible/i.test(String(e.message || e));

function consultar(fn, args) {
  const key = 'aqd|' + fn + '|' + JSON.stringify(args);
  if (INFLIGHT.has(key)) return INFLIGHT.get(key);
  const p = llamar(key, fn, ...args).then((v) => {
    INFLIGHT.delete(key);
    if (v && (v.error || v.success === false)) throw new Error(v.message || v.error || 'Error en ' + fn);
    return v;
  }, (e) => { INFLIGHT.delete(key); throw e; });
  INFLIGHT.set(key, p);
  return p;
}

/** Consulta con estado. `args` = arreglo de argumentos; `skip` evita la llamada. */
export function useRpc(fn, args, skip) {
  const key = JSON.stringify(args);
  const [st, setSt] = useState({ data: null, error: null, loading: !skip });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (skip) return undefined;
    let vivo = true;
    setSt((s) => ({ data: s.data, error: null, loading: true }));
    consultar(fn, JSON.parse(key))
      .then((data) => vivo && setSt({ data, error: null, loading: false }))
      .catch((error) => vivo && setSt({ data: null, error, loading: false }));
    return () => { vivo = false; };
  }, [fn, key, tick, skip]);
  const reload = useCallback(() => { invalidar(); setTick((t) => t + 1); }, []);
  return { ...st, reload, noDisponible: esNoDisponible(st.error) };
}

/* ------------------------------------------------------------------
   Mes seleccionado, compartido por todas las pestañas (mesActual en V1).
   ------------------------------------------------------------------ */
let MES = null;
const subs = new Set();
const setMesGlobal = (m) => { MES = m; subs.forEach((f) => f()); };
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };

export const mesHoy = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

/** Meses disponibles (obtenerMesesDisponibles) y mes activo. Por defecto el mes en curso, como V1. */
export function useMes(user) {
  const meses = useRpc('obtenerMesesDisponibles', [user.idUsuario, user.rol]);
  const mes = useSyncExternalStore(subscribe, () => MES);
  const lista = Array.isArray(meses.data) ? meses.data : [];
  let activo = mes;
  if (!activo) activo = lista.includes(mesHoy()) ? mesHoy() : (lista[0] || mesHoy());
  return { mes: activo, meses: lista.length ? lista : [activo], setMes: setMesGlobal, cargandoMeses: meses.loading };
}

/* ------------------------------------------------------------------
   Formato (es-CO)
   ------------------------------------------------------------------ */
export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export function mesNombre(mes) { if (!mes) return ''; const [y, m] = String(mes).split('-'); return (MESES[parseInt(m, 10) - 1] || '') + ' ' + y; }
export const n0 = (v) => Number(v || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });
export const n1 = (v) => Number(v || 0).toLocaleString('es-CO', { maximumFractionDigits: 1 });
export const n2 = (v) => Number(v || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 });
/** $ 1.234.567 (como fmt de V1). */
export const cop = (v) => '$ ' + Math.round(Math.abs(Number(v) || 0)).toLocaleString('es-CO');
/** Monto con signo: +$ 1.000 / −$ 1.000. */
export const copSigno = (v) => (Number(v) < 0 ? '−' : '+') + cop(v);
/** Monto compacto para ejes y héroes: $ 1,2 M · $ 850 mil. */
export function copCorto(v) {
  const a = Math.abs(Number(v) || 0);
  if (a >= 1e9) return '$ ' + (a / 1e9).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' mil M';
  if (a >= 1e6) return '$ ' + (a / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' M';
  if (a >= 1e3) return '$ ' + Math.round(a / 1e3).toLocaleString('es-CO') + ' mil';
  return '$ ' + Math.round(a).toLocaleString('es-CO');
}
export const norm = (v) => String(v === null || v === undefined ? '' : v).trim().toUpperCase();
export const sinTildes = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/* ------------------------------------------------------------------
   Semáforo (mismos estados que obtenerDashboard)
   ------------------------------------------------------------------ */
export const SEM = {
  verde: { color: '#048C38', soft: '#E4F3EA', ink: '#037030', cls: 'ok' },
  amarillo: { color: '#E0B520', soft: '#FDF6DA', ink: '#8A6A00', cls: 'warn' },
  rojo: { color: '#D6453D', soft: '#FBE9E8', ink: '#B0302A', cls: 'bad' }
};
export const semColor = (s) => (SEM[s] || SEM.rojo).color;
/** Orden de severidad para ordenar estados. */
export const ESTADO_ORDEN = { 'CRÍTICO': 0, 'NO CUMPLIDA': 1, 'EN RIESGO': 2, 'SIN INICIAR': 3, 'EN RUTA': 4, 'META CUMPLIDA': 5 };
/** Umbrales de calor de V1: ≥ 90 verde, ≥ 60 amarillo, resto rojo. */
export const heatNivel = (p) => (p >= 90 ? 'ok' : p >= 60 ? 'warn' : 'bad');

export const FMT = { EFECTIVO: 'FOR-GOR-020-09', CHEQUES: 'FOR-GOR-048-01', ATM: 'FOR-GOR-099-02' };
export const DIFE = { PENDIENTE: 'PENDIENTE EXPLICACION', RECUPERADO: 'RECUPERADO', NO_RECUPERADO: 'NO RECUPERADO', CRUZADO: 'CRUZADO / COMPENSADO', NO_CRUZADO: 'NO COMPENSADO' };

/** Paleta categórica de marca (orden fijo, nunca por rango). */
export const CAT = ['#242A54', '#048C38', '#21BBEA', '#C99A00', '#6C74A8', '#1A8FB5', '#5CC6A0', '#9AA0C8'];
export const C = { navy: '#242A54', green: '#048C38', cyan: '#21BBEA', gold: '#F6CF46', goldInk: '#C99A00', red: '#D6453D', mute: '#C9CDE3', mute2: '#9AA0C8' };
