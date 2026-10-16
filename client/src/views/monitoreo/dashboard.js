// Lógica del tablero gerencial: serie diaria simulada, periodos y agregados.
// Portada sin cambios del demo de Apps Script (SERIES, periodDef, agg, buckets).
import { rng, MONTHS, MSHORT, DAYS, cap } from '../../lib/format.js';

/* Serie diaria simulada desde enero de 2025 para comparar periodos completos. */
export function buildSeries(NOW) {
  const out = []; const r = rng(20250101);
  const startD = new Date(2025, 0, 1), endD = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
  const total = (endD - startD) / 864e5;
  const base = [0, 96, 92, 90, 90, 98, 34];
  let bdInMonth = 0, lastMonth = -1;
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    const wd = d.getDay(); if (wd === 0) continue;
    if (d.getMonth() !== lastMonth) { lastMonth = d.getMonth(); bdInMonth = 0; }
    if (wd !== 6) bdInMonth++;
    const p = Math.min(1, ((d - startD) / 864e5) / total);
    const prog = Math.round(base[wd] + (bdInMonth <= 5 && wd !== 6 ? 22 : 0) + (r() - 0.5) * 8);
    const comp = Math.min(0.996, 0.902 + 0.074 * p + (r() - 0.5) * 0.024);
    const ans = Math.min(0.999, 0.935 + 0.058 * p + (r() - 0.5) * 0.02);
    out.push({
      d: new Date(d), key: d.toISOString().slice(0, 10), wd, p, prog, done: Math.round(prog * comp), ans,
      hours: Math.max(0, (wd === 6 ? 1.5 : 4) + 22 * p + (r() - 0.5) * 3),
      cases: Math.round((wd === 6 ? 14 : 44) + (r() - 0.5) * 12), pqr: Math.round(2 + r() * 3), alerts: Math.round(2 + r() * 4)
    });
  }
  return out;
}

/** Evaluación promedio de clientes por mes: real de mayo a octubre de 2026, estimada antes. */
export function makeEvalFor(clientExtra) {
  const KNOWN_EVAL = {}; const keys = Object.keys(clientExtra);
  [4, 5, 6, 7, 8, 9].forEach((mm, i) => { KNOWN_EVAL['2026-' + mm] = keys.reduce((s, k) => s + clientExtra[k].score[i], 0) / keys.length; });
  return function evalFor(y, m) { const k = y + '-' + m; if (KNOWN_EVAL[k]) return KNOWN_EVAL[k]; const p = Math.max(0, Math.min(1, ((y - 2025) * 12 + m) / 16)); return 3.62 + 0.42 * p; };
}

export function periodDef(NOW, type, idx) {
  const Y = NOW.getFullYear(), M = NOW.getMonth();
  const today = new Date(Y, M, NOW.getDate());
  const clampEnd = (e) => (e > today ? today : e);
  let s, e, ps, pe, label, bucket, unitName;
  if (type === 'dia') {
    s = new Date(today); s.setDate(s.getDate() - idx); while (s.getDay() === 0) s.setDate(s.getDate() - 1);
    e = new Date(s); ps = new Date(s); ps.setDate(ps.getDate() - 7); pe = new Date(ps);
    label = cap(DAYS[s.getDay()]) + ' ' + s.getDate() + ' de ' + MONTHS[s.getMonth()]; bucket = 'hour'; unitName = 'el mismo día de la semana anterior';
  } else if (type === 'mes') {
    s = new Date(Y, M - idx, 1); e = new Date(Y, M - idx + 1, 0); ps = new Date(Y, M - idx - 1, 1); pe = new Date(Y, M - idx, 0);
    label = cap(MONTHS[s.getMonth()]) + ' ' + s.getFullYear(); bucket = 'day'; unitName = cap(MONTHS[ps.getMonth()]);
  } else if (type === 'bimestre') {
    const b = Math.floor(M / 2) - idx; s = new Date(Y, b * 2, 1); e = new Date(Y, b * 2 + 2, 0); ps = new Date(Y, b * 2 - 2, 1); pe = new Date(Y, b * 2, 0);
    label = cap(MONTHS[s.getMonth()]) + ' y ' + MONTHS[(s.getMonth() + 1) % 12] + ' ' + s.getFullYear(); bucket = 'week'; unitName = 'el bimestre anterior';
  } else if (type === 'trimestre') {
    const q = Math.floor(M / 3) - idx; s = new Date(Y, q * 3, 1); e = new Date(Y, q * 3 + 3, 0); ps = new Date(Y, q * 3 - 3, 1); pe = new Date(Y, q * 3, 0);
    label = 'T' + (Math.floor(s.getMonth() / 3) + 1) + ' ' + s.getFullYear() + ', ' + MONTHS[s.getMonth()] + ' a ' + MONTHS[(s.getMonth() + 2) % 12]; bucket = 'week'; unitName = 'el trimestre anterior';
  } else {
    const h = Math.floor(M / 6) - idx; s = new Date(Y, h * 6, 1); e = new Date(Y, h * 6 + 6, 0); ps = new Date(Y, h * 6 - 6, 1); pe = new Date(Y, h * 6, 0);
    label = 'S' + (Math.floor(s.getMonth() / 6) + 1) + ' ' + s.getFullYear() + ', ' + MONTHS[s.getMonth()] + ' a ' + MONTHS[(s.getMonth() + 5) % 12]; bucket = 'month'; unitName = 'el semestre anterior';
  }
  const partial = e > today && type !== 'dia';
  const prevSpan = partial ? Math.round((clampEnd(e) - s) / 864e5) : null;
  if (partial) { pe = new Date(ps); pe.setDate(pe.getDate() + prevSpan); }
  return { type, idx, s, e: clampEnd(e), fullEnd: e, ps, pe, label, bucket, partial, unitName };
}

export const PERIOD_OPTS = { dia: 6, mes: 6, bimestre: 4, trimestre: 4, semestre: 3 };
export const PERIOD_TYPES = [['dia', 'Día'], ['mes', 'Mes'], ['bimestre', 'Bimestre'], ['trimestre', 'Trimestre'], ['semestre', 'Semestre']];
export const inRange = (x, s, e) => x.d >= s && x.d <= new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59);

export function agg(list, evalFor) {
  const prog = list.reduce((a, x) => a + x.prog, 0), done = list.reduce((a, x) => a + x.done, 0);
  const ans = list.length ? list.reduce((a, x) => a + x.ans * x.prog, 0) / (prog || 1) : 0;
  const hours = list.reduce((a, x) => a + x.hours, 0), cases = list.reduce((a, x) => a + x.cases + x.pqr, 0), alerts = list.reduce((a, x) => a + x.alerts, 0);
  const months = {}; list.forEach((x) => { months[x.d.getFullYear() + '-' + x.d.getMonth()] = [x.d.getFullYear(), x.d.getMonth()]; });
  const mk = Object.keys(months); const ev = mk.length ? mk.reduce((a, k) => a + evalFor(months[k][0], months[k][1]), 0) / mk.length : 0;
  const comp = prog ? done / prog : 0;
  const index = comp * 100 * 0.5 + ans * 100 * 0.3 + (ev / 5) * 100 * 0.2;
  return { prog, done, comp, ans, hours, cases, alerts, ev, index, days: list.length };
}

export function buckets(P, list, NOW_MIN, evalFor) {
  const out = [];
  if (P.bucket === 'hour') {
    const x = list[list.length - 1] || { done: 0, prog: 0 };
    const shape = [3, 6, 9, 13, 16, 9, 6, 9, 11, 8, 6, 4]; const sum = shape.reduce((a, b) => a + b, 0);
    const isToday = P.idx === 0; const lim = isToday ? Math.floor(NOW_MIN / 60) : 19;
    shape.forEach((w, i) => { const h = 8 + i; const v = h <= lim ? Math.round(x.done * w / sum) : 0; out.push({ label: (h > 12 ? h - 12 : h) + (h >= 12 ? ' p. m.' : ' a. m.'), vol: v, comp: v ? Math.min(100, (x.prog ? x.done / x.prog : 0) * 100 + (i % 3 - 1) * 0.8) : null, future: h > lim }); });
    return out;
  }
  const groups = {};
  list.forEach((x) => {
    let k, l;
    if (P.bucket === 'day') { k = x.key; l = x.d.getDate() + ''; }
    else if (P.bucket === 'week') { const m = new Date(x.d); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); k = m.toISOString().slice(0, 10); l = m.getDate() + ' ' + MSHORT[m.getMonth()]; }
    else { k = x.d.getFullYear() + '-' + String(x.d.getMonth() + 1).padStart(2, '0'); l = MSHORT[x.d.getMonth()]; }
    (groups[k] = groups[k] || { label: l, items: [] }).items.push(x);
  });
  Object.keys(groups).sort().forEach((k) => { const g = agg(groups[k].items, evalFor); out.push({ label: groups[k].label, vol: g.done, comp: g.comp * 100, ans: g.ans * 100, hours: g.hours }); });
  return out;
}

/** Fecha local en formato AAAA-MM-DD. */
export const isoLocal = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
