// Cliente 360: piezas compartidas (datos con caché, formatos, gráficos ligeros y estados).
import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import CountUp from '../../components/CountUp.jsx';
import { gas } from '../../lib/gas.js';
import { fmt, MONTHS, MSHORT, norm } from '../../lib/format.js';
import './cliente360.css';

// ---------- datos ----------
const MEM = new Map(); // clave -> { t, p }
const TTL = 60 * 1000;
function cargar(fn, args, fresh) {
  const key = fn + JSON.stringify(args);
  const hit = MEM.get(key);
  if (!fresh && hit && Date.now() - hit.t < TTL) return hit.p;
  const p = gas(fn, ...args);
  MEM.set(key, { t: Date.now(), p });
  p.catch(() => MEM.delete(key));
  return p;
}
/** Llama una función RPC con caché de 60 s en el navegador (las vistas se reabren sin esperar). */
export function useC360(fn, ...args) {
  const key = JSON.stringify(args);
  const [st, setSt] = useState({ data: null, error: null });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let vivo = true;
    setSt((s) => ({ data: tick ? s.data : null, error: null }));
    cargar(fn, JSON.parse(key), tick > 0).then((data) => vivo && setSt({ data, error: null }), (error) => vivo && setSt({ data: null, error }));
    return () => { vivo = false; };
  }, [fn, key, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...st, reload };
}

// ---------- formatos ----------
export const mesLargo = (m) => { if (!m) return ''; const [y, mm] = m.split('-'); return MONTHS[+mm - 1] + ' ' + y; };
export const mesCorto = (m) => { if (!m) return ''; const [y, mm] = m.split('-'); return MSHORT[+mm - 1] + ' ' + y.slice(2); };
export const n0 = (v) => (v === null || v === undefined ? '—' : fmt(v));
export const pctTxt = (v) => (v === null || v === undefined ? '—' : fmt(v) + ' %');
export const money = (v) => '$ ' + fmt(Math.round(v || 0));
export const moneyCorto = (v) => {
  const a = Math.abs(v || 0);
  if (a >= 1e9) return '$ ' + fmt(a / 1e9, 1) + ' mil M';
  if (a >= 1e6) return '$ ' + fmt(a / 1e6, 1) + ' M';
  return '$ ' + fmt(a);
};
/** "BANCO DE BOGOTA" → "Banco De Bogota" (para nombres en mayúsculas de los Sheets). */
const SIGLAS = new Set(['RM', 'MP', 'BBVA', 'BBOG', 'BPOP', 'BCOL', 'BAGR', 'BOCC', 'SNR', 'ATM', 'ORIP', 'VUS', 'CADE', 'UNE', 'SAS', 'II', 'III', 'IV', 'CC', 'BAT', 'DC', 'MM', 'ITAU', 'CITI', 'AV', 'BCS', 'BDB', 'TI']);
export const titulo = (s) => String(s || '').split(/(\s+|[()/-])/).map((w, i) => {
  if (!w.trim() || /^[()/-]$/.test(w)) return w;
  const up = w.toUpperCase();
  if (i > 0 && ['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'E', 'EN'].includes(up)) return up.toLowerCase();
  if (SIGLAS.has(up) || (/^[A-ZÑ0-9.]+$/.test(w) && !/[AEIOUÁÉÍÓÚ]/.test(up) && w.length <= 4)) return up;
  const lo = w.toLowerCase();
  if (i > 0 && ['de', 'del', 'la', 'las', 'los', 'y', 'e', 'en'].includes(lo)) return lo;
  return lo.charAt(0).toUpperCase() + lo.slice(1);
}).join('');
export const buscar = (q, ...campos) => { const t = norm(q.trim()); return !t || campos.some((c) => norm(c || '').includes(t)); };
export const mono = (name) => name.replace(/^Banco (de )?/, '').replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ ]/g, '').slice(0, 2).toUpperCase();
/** Tono del cumplimiento (umbral de los tableros de Arqueos: ≥ 90 / ≥ 60). */
export const tono = (p) => (p === null || p === undefined ? 'mute' : p >= 90 ? 'ok' : p >= 60 ? 'info' : 'warn');

// ---------- piezas ----------
export function Tile({ label, value, unit, sub, icon, tone = 'navy', onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={'c360-tile t-' + tone + (onClick ? ' click' : '')} onClick={onClick}>
      <div className="c360-tile-l"><span className="c360-tile-ic"><Icon name={icon} /></span><span>{label}</span></div>
      <div className="c360-tile-v num"><CountUp value={value} />{unit && <small>{unit}</small>}</div>
      {sub && <div className="c360-tile-s">{sub}</div>}
    </Tag>
  );
}

/** Anillo de porcentaje. */
export function Ring({ v, size = 64, stroke = 7, label, light }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, f = Math.max(0, Math.min(100, v || 0)) / 100;
  const col = v === null || v === undefined ? '#C9CEDF' : v >= 90 ? '#048C38' : v >= 60 ? '#21BBEA' : '#F6CF46';
  return (
    <div className={'c360-ring' + (light ? ' light' : '')} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="trk" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke={col} strokeLinecap="round"
          strokeDasharray={(c * f).toFixed(1) + ' ' + c.toFixed(1)} transform={`rotate(-90 ${size / 2} ${size / 2})`} className="arc" />
      </svg>
      <span className="num" style={size < 60 ? { fontSize: size < 50 ? 10.5 : 12 } : undefined}>{v === null || v === undefined ? '—' : fmt(v) + '%'}</span>
      {label && <em>{label}</em>}
    </div>
  );
}

/** Barras horizontales con valor. rows = [{ nombre, n }]. */
export function Barras({ rows, total, max = 8, color = 'var(--navy)', onPick, active, fmtNombre = titulo }) {
  const [all, setAll] = useState(false);
  const lista = all ? rows : rows.slice(0, max);
  const top = Math.max(1, ...rows.map((r) => r.n));
  if (!rows.length) return <Empty icon="chart" title="Sin datos para agrupar" />;
  return (
    <div className="c360-bars">
      {lista.map((r) => (
        <button type="button" key={r.nombre} className={'c360-bar' + (active === r.nombre ? ' on' : '') + (onPick ? ' click' : '')} onClick={onPick ? () => onPick(active === r.nombre ? null : r.nombre) : undefined} disabled={!onPick}>
          <span className="nm ellip" title={r.nombre}>{fmtNombre(r.nombre)}</span>
          <span className="tr"><i style={{ width: (r.n / top) * 100 + '%', background: color }} /></span>
          <span className="vl num">{fmt(r.n)}{total ? <small> · {fmt((r.n / total) * 100)}%</small> : null}</span>
        </button>
      ))}
      {rows.length > max && <button type="button" className="c360-more" onClick={() => setAll((a) => !a)}>{all ? 'Ver menos' : 'Ver los ' + rows.length}</button>}
    </div>
  );
}

/**
 * Serie mensual: columnas = arqueos del mes; línea = % de cumplimiento.
 * serie = [{ mes, pct, arqueos, conDatos }]
 */
export function SerieMeses({ serie, h = 190 }) {
  const narrow = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
  const W = narrow ? 380 : 560, H = narrow ? 200 : h, pl = 30, pr = 40, pt = 22, pb = 30;
  const iw = W - pl - pr, ih = H - pt - pb, n = serie.length || 1, bw = Math.min(46, (iw / n) * 0.5);
  const maxA = Math.max(1, ...serie.map((s) => s.arqueos));
  const x = (i) => pl + (iw / n) * (i + 0.5);
  const yP = (p) => pt + ih - (p / 100) * ih;
  const last = serie.length - 1;
  const pts = serie.map((s, i) => (s.pct !== null && (s.arqueos > 0 || (i === last && s.conDatos !== false)) ? [x(i), yP(s.pct), s] : null)).filter(Boolean);
  return (
    <div className="c360-serie">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cumplimiento de arqueos por mes">
        {[0, 50, 100].map((g) => <g key={g}><line x1={pl} x2={W - pr} y1={yP(g)} y2={yP(g)} className="grid" /><text x={W - pr + 6} y={yP(g) + 4} className="ax">{g}%</text></g>)}
        {serie.map((s, i) => {
          const bh = (s.arqueos / maxA) * ih * 0.82;
          return (
            <g key={s.mes}>
              <rect x={x(i) - bw / 2} y={pt + ih - bh} width={bw} height={Math.max(bh, s.arqueos ? 2 : 0)} rx="5" className="col"><title>{mesLargo(s.mes) + ': ' + fmt(s.arqueos) + ' arqueos'}</title></rect>
              {s.arqueos > 0 && (bh > 22 ? <text x={x(i)} y={pt + ih - 8} textAnchor="middle" className="cv in">{fmt(s.arqueos)}</text> : <text x={x(i)} y={pt + ih - bh - 6} textAnchor="middle" className="cv">{fmt(s.arqueos)}</text>)}
              <text x={x(i)} y={H - 10} textAnchor="middle" className={'ax' + (s.conDatos === false ? ' off' : '')}>{mesCorto(s.mes)}</text>
            </g>
          );
        })}
        {pts.length > 1 && <polyline points={pts.map((p) => p[0] + ',' + p[1]).join(' ')} className="ln" />}
        {pts.map((p) => <g key={p[2].mes}><circle cx={p[0]} cy={p[1]} r="4.5" className="dt"><title>{mesLargo(p[2].mes) + ': ' + p[2].pct + ' % de oficinas cumplen'}</title></circle><text x={p[0]} y={p[1] - 10} textAnchor="middle" className="pv">{p[2].pct}%</text></g>)}
      </svg>
      <div className="c360-legend"><span><i className="sq" />Arqueos registrados</span><span><i className="ln" />% de oficinas que cumplen</span></div>
    </div>
  );
}

export function Empty({ icon = 'check', title, children }) {
  return (
    <div className="c360-empty">
      <span className="ic-wrap"><Icon name={icon} /></span>
      <b>{title}</b>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Skel({ hero = true }) {
  return (
    <div className="c360-skel" aria-busy="true" aria-label="Cargando">
      {hero && <div className="sk c360-sk-hero" />}
      <div className="c360-tiles">{[0, 1, 2, 3].map((i) => <div key={i} className="sk c360-sk-tile" />)}</div>
      <div className="c360-grid2 mt"><div className="sk c360-sk-card" /><div className="sk c360-sk-card" /></div>
    </div>
  );
}

export function Seg({ items, value, onChange, label }) {
  return (
    <div className="seg c360-seg" role="group" aria-label={label}>
      {items.map((it) => <button type="button" key={it[0]} className={value === it[0] ? 'on' : ''} aria-pressed={value === it[0]} onClick={() => onChange(it[0])}>{it[1]}</button>)}
    </div>
  );
}

export function Search({ value, onChange, placeholder }) {
  return (
    <label className="c360-search">
      <Icon name="search" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
  );
}

/** Paginación por "ver más" para tablas largas. */
export function usePaged(rows, step = 25) {
  const [n, setN] = useState(step);
  useEffect(() => { setN(step); }, [rows, step]);
  const vis = useMemo(() => rows.slice(0, n), [rows, n]);
  const more = rows.length > n ? <div className="c360-pager"><span className="small muted">Mostrando {fmt(vis.length)} de {fmt(rows.length)}</span><button type="button" className="btn btn-o btn-sm" onClick={() => setN((x) => x + step * 2)}>Ver más</button></div> : rows.length > step ? <div className="c360-pager"><span className="small muted">{fmt(rows.length)} registros</span></div> : null;
  return [vis, more];
}

/** Estado del mes de una oficina → etiqueta y tono. */
export const ESTADO = {
  'AL DIA': ['Al día', 'b-ok'],
  'CUMPLE CON EXTEMPORANEO': ['Cumple (extemporáneo)', 'b-info'],
  PARCIAL: ['Parcial', 'b-warn'],
  'SIN ARQUEO': ['Sin arqueo', 'b-mute'],
  'SIN DATO': ['Sin dato', 'b-mute']
};
export const EstadoTag = ({ e }) => { const x = ESTADO[e] || ESTADO['SIN DATO']; return <span className={'badge ' + x[1]}>{x[0]}</span>; };
