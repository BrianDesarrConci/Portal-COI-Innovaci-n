// Cifras del Modo Comité. Reutiliza la lógica del Tablero gerencial (dashboard.js)
// con el periodo "mes en curso", de modo que cada número coincide con Inicio.
import { hash, MONTHS, MSHORT, cap } from '../../lib/format.js';
import { buildSeries, makeEvalFor, periodDef, inRange, agg, isoLocal } from '../monitoreo/dashboard.js';

// Mismos desplazamientos por analista que usa el Tablero gerencial (Inicio.jsx).
const AN_OFF = [0.006, -0.004, 0.003, 0.001, -0.006, -0.009];
const AN_OFF_B = [0.002, -0.001, 0.006, -0.003, -0.002, -0.012];
export const TARGET = 95;

export function buildCommittee({ D, acts, clients, STATS, isAuto, NOW }, inicio, traza) {
  const SERIES = buildSeries(NOW);
  const evalFor = makeEvalFor(D.clientExtra);
  const pick = (P) => SERIES.filter((x) => inRange(x, P.s, P.e));

  /* Mes en curso frente al mismo tramo del mes anterior (igual que el tablero). */
  const P = periodDef(NOW, 'mes', 0);
  const A = agg(pick(P), evalFor);
  const B = agg(SERIES.filter((x) => inRange(x, P.ps, P.pe)), evalFor);
  const period = { label: P.label, partial: P.partial, prevName: P.unitName.toLowerCase(), month: MONTHS[NOW.getMonth()], text: MONTHS[NOW.getMonth()] + ' de ' + NOW.getFullYear(), year: NOW.getFullYear() };

  /* Serie mensual: últimos 12 meses. */
  const monthly = [];
  for (let i = 11; i >= 0; i--) {
    const q = periodDef(NOW, 'mes', i); const g = agg(pick(q), evalFor);
    monthly.push({ label: MSHORT[q.s.getMonth()], year: q.s.getFullYear(), full: cap(MONTHS[q.s.getMonth()]) + ' ' + q.s.getFullYear(), partial: q.partial, comp: g.comp * 100, ans: g.ans * 100, index: g.index, done: g.done, hours: g.hours });
  }
  const yStart = new Date(NOW.getFullYear(), 0, 1);
  const ytd = agg(SERIES.filter((x) => inRange(x, yStart, NOW)), evalFor);
  const first = monthly[0];

  /* Clientes: misma fórmula de ANS cumplido y evaluación del mes que el tablero. */
  const idxM = (NOW.getFullYear() - 2026) * 12 + NOW.getMonth() - 4;
  const evAt = (k, i) => { const sc = D.clientExtra[k].score; return i >= 0 && i <= 5 ? sc[i] : Math.max(3.2, sc[0] - 0.05 * (0 - i)); };
  const clientRows = Object.keys(clients).map((k) => {
    const off = (hash(k) % 100) / 100 * 0.04 - 0.02;
    const ans = Math.min(1, A.ans + off) * 100;
    const x = D.clientExtra[k];
    return { k, name: clients[k].name, desc: clients[k].desc, ansV: x.ans, ansDate: x.ansDate, ans, ev: evAt(k, idxM), evPrev: evAt(k, idxM - 1), evFirst: x.score[0], offices: x.offices };
  }).sort((p, q) => q.ev - p.ev || q.ans - p.ans);
  const belowAns = clientRows.filter((c) => c.ans < TARGET);
  const maxGain = clientRows.reduce((m, c) => (c.ev - c.evFirst > m.ev - m.evFirst ? c : m), clientRows[0]);

  /* Analistas: igual que la tabla del tablero, más la carga asignada. */
  const team = D.analysts.map((a, i) => {
    const cA = Math.min(0.998, A.comp + AN_OFF[i]), cB = Math.min(0.998, B.comp + AN_OFF_B[i]);
    const share = STATS[a.id].total / 104;
    return { ...a, color: i, comp: cA * 100, compPrev: cB * 100, done: Math.round(A.done * share), hours: A.hours * share * (a.id === 'hernan' ? 0.4 : 1), total: STATS[a.id].total, auto: STATS[a.id].auto };
  }).sort((p, q) => q.comp - p.comp);

  /* Procesos transversales y automatización. */
  const autoN = acts.filter(isAuto).length;
  const procs = D.processes.map((p) => ({ id: p.id, name: p.name, module: p.module, tech: p.tech, n: acts.filter((a) => a.p === p.id).length }));

  /* Hoja de ruta: hitos y comités mensuales siguientes. */
  const today = isoLocal(NOW);
  const milestones = (inicio?.milestones || []).map((m) => ({ date: m[0], text: m[1], done: m[0] <= today }));
  const committees = [];
  if (inicio?.committees) {
    for (let i = 0; i < 4; i++) {
      const d = new Date(NOW.getFullYear(), NOW.getMonth() + i, inicio.committees.day);
      committees.push({ date: isoLocal(d), text: 'Comités mensuales de ' + MONTHS[d.getMonth()] + ': ' + inicio.committees.text, done: isoLocal(d) <= today });
    }
  }

  /* Portafolio TRAZA. */
  let portfolio = null;
  if (Array.isArray(traza)) {
    const STATES = ['Recibida', 'En análisis', 'En desarrollo', 'En pruebas', 'En espera', 'Cerrada', 'Rechazada'];
    const by = Object.fromEntries(STATES.map((s) => [s, traza.filter((t) => t.state === s).length]));
    const open = traza.filter((t) => t.state !== 'Cerrada' && t.state !== 'Rechazada');
    const apps = {}; traza.forEach((t) => { apps[t.app] = (apps[t.app] || 0) + 1; });
    portfolio = {
      total: traza.length, open: open.length, closed: by['Cerrada'], rejected: by['Rechazada'], by, states: STATES,
      critical: open.filter((t) => t.prio === 'Crítica' || t.prio === 'Alta').length,
      hours: traza.reduce((s, t) => s + (Number(t.inv) || 0), 0),
      overdue: open.filter((t) => t.target && new Date(t.target) < NOW).length,
      apps: Object.entries(apps).sort((a, b) => b[1] - a[1])
    };
  }

  return { period, A, B, monthly, ytd, first, clientRows, belowAns, maxGain, team, autoN, totalActs: acts.length, procs, milestones, committees, portfolio };
}
