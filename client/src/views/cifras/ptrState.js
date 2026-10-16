// Estado simulado de transacciones PTR del día. Vive a nivel de módulo, como en el demo,
// para que el acumulado siga creciendo al salir y volver a la vista.
import { rng, hhmm } from '../../lib/format.js';

let state = null;

/** Devuelve (creándolo una vez por día) el estado { total, series, labels, neg }. */
export function getPtr({ daySeed, NOW_MIN, negocios }) {
  if (state && state.seed === daySeed) return state;
  const s = { seed: daySeed, total: 0, series: [], labels: [], neg: {} };
  const r = rng(daySeed ^ 3131);
  for (let m = 8 * 60; m <= NOW_MIN; m += 15) {
    const h = m / 60;
    const wave = Math.max(0.15, Math.sin((h - 7.4) / 11 * Math.PI)) * (1 + (h > 11 && h < 13 ? 0.25 : 0));
    const v = Math.round(1800 * wave + r() * 300);
    s.series.push(v); s.labels.push(hhmm(m).replace(' a. m.', '').replace(' p. m.', '')); s.total += v;
  }
  negocios.forEach(([k, share]) => { s.neg[k] = Math.round(s.total * share); });
  state = s;
  return s;
}

/** Suma un lote aleatorio de transacciones a la última franja y a uno de los tres primeros negocios. */
export function tickPtr(s) {
  const add = 4 + Math.floor(Math.random() * 18);
  s.total += add; s.series[s.series.length - 1] += add;
  const keys = Object.keys(s.neg); s.neg[keys[Math.floor(Math.random() * 3)]] += add;
}
