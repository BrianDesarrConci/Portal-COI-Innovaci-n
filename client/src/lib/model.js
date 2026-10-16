import { rng, hash, demoNow, MONTHS } from './format.js';

export const ST = { done: ['Cerrada con evidencia', 'b-ok'], progress: ['En curso', 'b-info'], scheduled: ['Programada', 'b-mute'], risk: ['En riesgo', 'b-warn'] };
export const MODULE_VIEW = { N1: 'validacion', N2: 'novedades', N3: 'pqr', N4: 'alertas', N5: 'reporteria', N6: 'facturacion', N7: 'oficinas', N8: 'fincomercio', N9: 'ptr', G1: 'malas', G2: 'papeleria', G3: 'usuarios', G4: 'cheques', G5: 'agrario', G6: 'ingresos', TRAZA: 'traza', N0: 'inicio' };
export const PROC_VIEW = { T1: 'validacion', T2: 'pqr', T3: 'malas', T4: 'novedades', T5: 'alertas', T6: 'usuarios', T7: 'ptr', T8: 'reporteria', T9: 'facturacion', T10: 'fincomercio', T11: 'oficinas' };

/**
 * Modelo derivado a partir del catálogo que entrega el API (/api/catalog).
 * Replica el estado simulado del día (determinístico por fecha) del demo original.
 */
export function buildModel(D) {
  const acts = D.BASE.acts;
  const clients = D.BASE.clients;
  const AN = {}; D.analysts.forEach((a, i) => { AN[a.id] = Object.assign({ color: i % 6 }, a); });
  const PR = {}; D.processes.forEach((p) => { PR[p.id] = p; });
  const procName = (id) => id === 'M' ? 'Se mantiene (monitoreo)' : id === 'P0' ? 'Tablero gerencial' : (PR[id] ? PR[id].name : id);
  const isAuto = (a) => a.p !== 'M' && a.p !== 'P0';
  const firstName = (id) => AN[id] ? AN[id].name.split(' ')[0] : 'Gerencia';

  const NOW = demoNow();
  const NOW_MIN = NOW.getHours() * 60 + NOW.getMinutes();
  const daySeed = NOW.getFullYear() * 1000 + NOW.getMonth() * 40 + NOW.getDate();
  const PREV_MONTH = MONTHS[(NOW.getMonth() + 11) % 12];

  const todayState = {};
  acts.forEach((a) => {
    const r = rng(hash('act' + a.n) ^ daySeed)();
    let st;
    if (/Por evento|Proyecto/.test(a.f)) st = r < 0.82 ? 'done' : 'progress';
    else if (/Mensual|Bimensual|Semestral|Anual|Quincenal/.test(a.f)) st = r < 0.9 ? 'done' : 'scheduled';
    else st = r < 0.84 ? 'done' : r < 0.95 ? 'progress' : 'scheduled';
    if (a.n === 61 || a.n === 49 || a.n === 77) st = 'done';
    if (a.n === 20) st = 'risk';
    todayState[a.n] = st;
  });

  function analystStats(id) {
    const list = acts.filter((a) => a.a === id);
    const auto = list.filter(isAuto).length;
    const done = list.filter((a) => todayState[a.n] === 'done').length;
    const risk = list.filter((a) => todayState[a.n] === 'risk').length;
    const due = list.filter((a) => todayState[a.n] !== 'scheduled').length;
    const r = rng(hash(id));
    const series = Array.from({ length: 30 }, (_, i) => 94 + r() * 5.6 + i * 0.03);
    const freed = id === 'hernan' ? 6.5 : AN[id].baseHours * 5 * (0.52 + r() * 0.12);
    return { list, auto, total: list.length, done, risk, due, comp: due ? (done / due) * 100 : 100, series, month: series.slice(-20).reduce((s, v) => s + v, 0) / 20, freed };
  }
  const STATS = {}; D.analysts.forEach((a) => { STATS[a.id] = analystStats(a.id); });
  const clientActs = (cid) => acts.filter((a) => a.c.indexOf(cid) >= 0);

  return { D, acts, clients, AN, PR, procName, isAuto, firstName, NOW, NOW_MIN, daySeed, PREV_MONTH, todayState, STATS, clientActs };
}
