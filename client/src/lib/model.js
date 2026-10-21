import { MONTHS } from './format.js';

export const ST = { none: ['Sin registro', 'b-mute'], done: ['Cerrada con evidencia', 'b-ok'], progress: ['En curso', 'b-info'], scheduled: ['Programada', 'b-mute'], risk: ['En riesgo', 'b-warn'] };
export const MODULE_VIEW = { N1: 'validacion', N2: 'novedades', N3: 'pqr', N4: 'alertas', N5: 'reporteria', N6: 'facturacion', N7: 'oficinas', N8: 'fincomercio', N9: 'ptr', G1: 'malas', G2: 'papeleria', G3: 'usuarios', G4: 'cheques', G5: 'agrario', G6: 'ingresos', TRAZA: 'traza', N0: 'inicio' };
export const PROC_VIEW = { T1: 'validacion', T2: 'pqr', T3: 'malas', T4: 'novedades', T5: 'alertas', T6: 'usuarios', T7: 'ptr', T8: 'reporteria', T9: 'facturacion', T10: 'fincomercio', T11: 'oficinas' };

/**
 * Modelo derivado del catálogo del área (/api/catalog): actividades, analistas y procesos.
 * Aún no existe el registro diario de actividades (bitácora), así que el estado de cada actividad es
 * "Sin registro" y los indicadores de cumplimiento quedan en cero. No se simula ningún dato.
 */
export function buildModel(D) {
  const acts = D.BASE.acts;
  const clients = D.BASE.clients;
  const AN = {}; D.analysts.forEach((a, i) => { AN[a.id] = Object.assign({ color: i % 6 }, a); });
  const PR = {}; D.processes.forEach((p) => { PR[p.id] = p; });
  const procName = (id) => id === 'M' ? 'Se mantiene (monitoreo)' : id === 'P0' ? 'Tablero gerencial' : (PR[id] ? PR[id].name : id);
  const isAuto = (a) => a.p !== 'M' && a.p !== 'P0';
  const firstName = (id) => AN[id] ? AN[id].name.split(' ')[0] : 'Gerencia';

  const NOW = new Date();
  const PREV_MONTH = MONTHS[(NOW.getMonth() + 11) % 12];

  const todayState = {};
  acts.forEach((a) => { todayState[a.n] = 'none'; });

  function analystStats(id) {
    const list = acts.filter((a) => a.a === id);
    return { list, auto: list.filter(isAuto).length, total: list.length, done: 0, risk: 0, due: 0, comp: 0, series: [], month: 0, freed: 0 };
  }
  const STATS = {}; D.analysts.forEach((a) => { STATS[a.id] = analystStats(a.id); });
  const clientActs = (cid) => acts.filter((a) => a.c.indexOf(cid) >= 0);

  return { D, acts, clients, AN, PR, procName, isAuto, firstName, NOW, PREV_MONTH, todayState, STATS, clientActs };
}
