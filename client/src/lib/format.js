// Utilidades de formato (portadas del demo en Apps Script).
export const fmt = (n, d) => Number(n).toLocaleString('es-CO', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
export const pct = (n, d) => fmt(n, d === undefined ? 1 : d) + ' %';
export const money = (n) => '$ ' + fmt(n);

export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const MSHORT = MONTHS.map((m) => m.slice(0, 3));
export const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const longDate = (d) => DAYS[d.getDay()] + ' ' + d.getDate() + ' de ' + MONTHS[d.getMonth()] + ' de ' + d.getFullYear();
export const shortDate = (iso) => { const d = new Date(iso + 'T12:00:00'); return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear(); };
export const dshort = (d) => d.getDate() + ' ' + MSHORT[d.getMonth()];
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const toMin = (t) => { const p = t.split(':').map(Number); return p[0] * 60 + p[1]; };
export const hhmm = (min) => { const h = Math.floor(min / 60), m = min % 60; return (h > 12 ? h - 12 : h) + ':' + String(m).padStart(2, '0') + (h >= 12 ? ' p. m.' : ' a. m.'); };
export const leftTime = (m) => m < 60 ? m + ' min' : m < 1440 ? Math.round(m / 60) + ' h' : Math.round(m / 1440) + ' d';
/** Minúsculas sin tildes, para búsquedas. */
export const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
