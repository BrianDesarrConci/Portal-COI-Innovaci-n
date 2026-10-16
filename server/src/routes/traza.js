import { Router } from 'express';
import { createStore } from '../store/jsonStore.js';
import { buildSeed, FLOW, PRIOS, TYPES, OWNERS, elapsedHrs } from '../data/traza-seed.js';

// TRAZA: radicación de solicitudes, avance por etapas y bitácora (estado, horas, notas, cierre).
// Persistencia en <DATA_DIR>/traza.json con la forma { solicitudes, bitacora, seqBitacora }.

let store;
const db = () => (store ||= createStore('traza', () => buildSeed()));

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const isOpen = (t) => t.state !== 'Cerrada' && t.state !== 'Rechazada';
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const SCORE = { 'Crítica': 90, 'Alta': 75, 'Media': 55, 'Baja': 30 };
const TARGET_DAYS = { 'Crítica': 2, 'Alta': 5, 'Media': 10, 'Baja': 15 };
const TYPE_ALIAS = { 'corrección de fallos': 'Corrección de falla', 'correccion de fallos': 'Corrección de falla' };

const bad = (res, error) => res.status(400).json({ error });
const notFound = (res, id) => res.status(404).json({ error: 'No existe la solicitud ' + id });

function addLog(data, idSolicitud, tipoEntrada, detalle, horas, autor, fecha = new Date()) {
  const entry = { idEntrada: 'BIT-' + String(++data.seqBitacora).padStart(5, '0'), idSolicitud, fecha: fecha.toISOString(), tipoEntrada, detalle, horas: horas ?? null, autor };
  data.bitacora.push(entry);
  return entry;
}
/** Bitácora de una solicitud, de la más reciente a la más antigua. */
function logOf(data, id) {
  return data.bitacora.filter((b) => b.idSolicitud === id)
    .map((b, i) => [b, i]).sort((x, y) => (y[0].fecha.localeCompare(x[0].fecha)) || (y[1] - x[1])).map((x) => x[0]);
}
const detail = (data, t) => ({ ...t, bitacora: logOf(data, t.id) });

const router = Router();

// Lista con filtros opcionales: estado (un estado o "abiertas"), app, owner, q.
router.get('/', (req, res) => {
  const { estado, app, owner, q } = req.query;
  const nq = norm(q);
  const list = db().get().solicitudes.filter((t) =>
    (!estado || (estado === 'abiertas' ? isOpen(t) : t.state === estado)) &&
    (!app || t.app === app) && (!owner || t.owner === owner) &&
    (!nq || norm(t.id + ' ' + t.title + ' ' + t.req).includes(nq)));
  res.json(list);
});

router.get('/:id', (req, res) => {
  const data = db().get();
  const t = data.solicitudes.find((x) => x.id === req.params.id);
  if (!t) return notFound(res, req.params.id);
  res.json(detail(data, t));
});

// Radicar una solicitud.
router.post('/', (req, res) => {
  const b = req.body || {};
  const f = { req: str(b.req), area: str(b.area), email: str(b.email), app: str(b.app), type: str(b.type), prio: str(b.prio) || 'Media', title: str(b.title), desc: str(b.desc) };
  f.type = TYPE_ALIAS[norm(f.type)] || f.type;
  const missing = [['req', 'nombre completo'], ['area', 'área'], ['email', 'correo electrónico'], ['app', 'aplicativo'], ['type', 'tipo de solicitud'], ['title', 'título'], ['desc', 'descripción']].filter(([k]) => !f[k]).map((x) => x[1]);
  if (missing.length) return bad(res, 'Complete los campos obligatorios: ' + missing.join(', ') + '.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return bad(res, 'El correo electrónico no es válido.');
  if (!TYPES.includes(f.type)) return bad(res, 'Tipo de solicitud no válido: ' + f.type + '.');
  if (!PRIOS.includes(f.prio)) return bad(res, 'Prioridad no válida: ' + f.prio + '.');
  const est = b.est === undefined || b.est === '' ? 8 : Number(b.est);
  if (!Number.isFinite(est) || est < 0) return bad(res, 'Las horas estimadas deben ser un número mayor o igual a cero.');
  let target;
  if (b.target) { target = new Date(b.target); if (isNaN(target)) return bad(res, 'La fecha objetivo no es válida.'); }

  const t = db().update((data) => {
    const max = data.solicitudes.reduce((m, x) => Math.max(m, parseInt(x.id.slice(4), 10) || 0), 0);
    const now = new Date();
    const id = 'TRZ-' + String(max + 1).padStart(4, '0');
    const owner = OWNERS[b.owner] ? b.owner : f.app === 'Analítica transaccional' ? 'hernan' : 'brian';
    const row = {
      id, title: f.title, app: f.app, type: f.type, prio: f.prio, score: SCORE[f.prio], state: 'Recibida',
      req: f.req, area: f.area, owner, email: f.email, desc: f.desc, est, inv: 0,
      created: now.toISOString(), target: (target || new Date(now.getTime() + TARGET_DAYS[f.prio] * 864e5)).toISOString(),
      stateAt: now.toISOString(), closedAt: null, resolution: '', totalHrs: null
    };
    data.solicitudes.unshift(row);
    addLog(data, id, 'ESTADO', 'Solicitud radicada por ' + f.req, null, f.req, now);
    return detail(data, row);
  });
  res.status(201).json(t);
});

/** Busca la solicitud abierta o responde el error. */
function withOpen(req, res, fn) {
  const data = db().get();
  const t = data.solicitudes.find((x) => x.id === req.params.id);
  if (!t) return notFound(res, req.params.id);
  if (!isOpen(t)) return bad(res, 'La solicitud ' + t.id + ' está ' + t.state.toLowerCase() + ' y no admite cambios de estado.');
  return fn(t);
}
function close(data, t, state, resolution, autor) {
  const prev = t.state, now = new Date();
  t.state = state; t.stateAt = now.toISOString();
  t.closedAt = now.toISOString(); t.totalHrs = elapsedHrs(t.created, t.closedAt); t.resolution = resolution;
  addLog(data, t.id, 'CIERRE', 'Cambio de estado: ' + prev + ' → ' + state, null, autor, now);
}

// Avanza a la siguiente etapa del flujo (igual que tzadv: "En espera" retoma después de desarrollo).
router.post('/:id/avanzar', (req, res) => withOpen(req, res, (t) => {
  const autor = str((req.body || {}).autor) || OWNERS[t.owner];
  const out = db().update((data) => {
    const prev = t.state;
    const i = FLOW.indexOf(prev === 'En espera' ? 'En desarrollo' : prev);
    const next = FLOW[Math.min(FLOW.length - 1, i + 1)];
    if (next === 'Cerrada') close(data, t, next, str((req.body || {}).resolucion) || 'Entregada en producción y aprobada por el solicitante.', autor);
    else {
      t.state = next; t.stateAt = new Date().toISOString();
      addLog(data, t.id, 'ESTADO', 'Cambio de estado: ' + prev + ' → ' + next, null, autor);
    }
    return detail(data, t);
  });
  res.json(out);
}));

// Rechaza la solicitud con motivo (CIERRE + NOTA en la bitácora).
router.post('/:id/rechazar', (req, res) => withOpen(req, res, (t) => {
  const motivo = str((req.body || {}).motivo);
  if (!motivo) return bad(res, 'Escriba el motivo del rechazo.');
  const autor = str(req.body.autor) || OWNERS[t.owner];
  res.json(db().update((data) => { close(data, t, 'Rechazada', motivo, autor); addLog(data, t.id, 'NOTA', 'Motivo del rechazo: ' + motivo, null, autor); return detail(data, t); }));
}));

// Registra horas (tipo HORAS, suma a HorasInvertidas) o una nota (tipo NOTA).
router.post('/:id/bitacora', (req, res) => {
  const data = db().get();
  const t = data.solicitudes.find((x) => x.id === req.params.id);
  if (!t) return notFound(res, req.params.id);
  const b = req.body || {};
  const tipo = str(b.tipo).toUpperCase();
  const detalle = str(b.detalle);
  const autor = str(b.autor) || OWNERS[t.owner];
  if (tipo !== 'HORAS' && tipo !== 'NOTA') return bad(res, 'Tipo de entrada no válido. Use HORAS o NOTA.');
  let horas = null;
  if (tipo === 'HORAS') {
    horas = typeof b.horas === 'string' ? Number(b.horas.replace(',', '.')) : Number(b.horas);
    if (!Number.isFinite(horas) || horas <= 0) return bad(res, 'Las horas deben ser un número mayor que cero.');
    if (horas > 24) return bad(res, 'No se pueden registrar más de 24 horas en una sola entrada.');
  }
  if (!detalle) return bad(res, tipo === 'HORAS' ? 'Describa qué se hizo en las horas registradas.' : 'Escriba el texto de la nota.');
  const out = db().update((d) => {
    const entry = addLog(d, t.id, tipo, detalle, horas, autor);
    if (tipo === 'HORAS') t.inv = Math.round((t.inv + horas) * 100) / 100;
    return { entrada: entry, solicitud: detail(d, t) };
  });
  res.status(201).json(out);
});

export default router;
