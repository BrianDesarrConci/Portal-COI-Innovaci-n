// Piezas de presentación compartidas por los módulos migrados de COI V1 (prefijo CSS v1p-).
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../../../components/Icon.jsx';
import CountUp from '../../../components/CountUp.jsx';
import { gas } from '../../../lib/gas.js';
import { fmt } from '../../../lib/format.js';
import './portal.css';

/* ---------- Iconos adicionales (trazo 24x24, mismo estilo que Icon) ---------- */
const EXTRA = {
  brain: '<path d="M9 4.5a2.5 2.5 0 00-4.6 1.4A3 3 0 003 11a3 3 0 001.4 5.4A2.6 2.6 0 009 18.5V4.5z"/><path d="M15 4.5a2.5 2.5 0 014.6 1.4A3 3 0 0121 11a3 3 0 01-1.4 5.4A2.6 2.6 0 0115 18.5V4.5z"/><path d="M9 9h1.5M13.5 9H15M9 14h1.5M13.5 14H15"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
  external: '<path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  refresh: '<path d="M20 11a8 8 0 00-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0014.3 4.9L20 16"/><path d="M20 20v-4h-4"/>',
  map: '<path d="M9 4L3.5 6v14L9 18l6 2 5.5-2V4L15 6 9 4z"/><path d="M9 4v14M15 6v14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z"/>',
  database: '<ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6"/><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/>',
  cloud: '<path d="M7 18h10.5a4 4 0 00.6-8 6 6 0 00-11.6 1.5A3.3 3.3 0 007 18z"/>',
  zap: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6L13 3z"/>',
  printer: '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="8" rx="2"/><path d="M7 14h10v6H7z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  clipboard: '<rect x="5" y="4.5" width="14" height="16" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="M9 11l2 2 4-4"/><path d="M9 16.5h6"/>',
  rocket: '<path d="M12 15l-3-3c1-4.5 4.5-8 10-8.5-.5 5.5-4 9-8.5 10z"/><path d="M9 12l-4 .5L3.5 15l4.5.5M12 15l-.5 4L9 20.5 8.5 16"/><circle cx="15" cy="9" r="1.4"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  route: '<circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M8.2 18H15a3 3 0 000-6H9a3 3 0 010-6h6.8"/>',
  swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  network: '<circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="19" r="2.2"/><circle cx="19" cy="19" r="2.2"/><path d="M12 7.2v4.3M12 11.5L6.5 17.3M12 11.5l5.5 5.8"/>',
  headset: '<path d="M4 14v-2a8 8 0 0116 0v2"/><rect x="3.5" y="13.5" width="4" height="6" rx="1.5"/><rect x="16.5" y="13.5" width="4" height="6" rx="1.5"/><path d="M20 19.5a3 3 0 01-3 2.5h-3"/>',
  paperclip: '<path d="M20 11.5l-7.8 7.8a5 5 0 01-7.1-7.1l8.2-8.2a3.4 3.4 0 014.8 4.8l-8.2 8.2a1.7 1.7 0 01-2.4-2.4l7.5-7.5"/>',
  tag: '<path d="M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5-8.5-8.5z"/><circle cx="8" cy="8.5" r="1.3"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
  logo: '<path d="M4 12a8 8 0 0116 0"/><path d="M7.5 12a4.5 4.5 0 019 0"/><circle cx="12" cy="12" r="1.3"/><path d="M12 13.3V20"/>'
};
export function PIcon({ name, className = '', style }) {
  if (!EXTRA[name]) return <Icon name={name} className={className} style={style} />;
  return <svg className={'ic ' + className} viewBox="0 0 24 24" aria-hidden="true" style={style} dangerouslySetInnerHTML={{ __html: EXTRA[name] }} />;
}

/* ---------- Encabezado de módulo ---------- */
export function V1Hero({ eyebrow, title, sub, icon = 'layers', right, children, tone = 'navy' }) {
  return (
    <section className={'v1p-hero tone-' + tone}>
      <div className="v1p-hero-art" aria-hidden="true"><PIcon name={icon} /></div>
      <div className="v1p-hero-main">
        {eyebrow && <div className="v1p-eyebrow">{eyebrow}</div>}
        <h1 className="v1p-hero-title">{title}</h1>
        {sub && <p className="v1p-hero-sub">{sub}</p>}
        {children}
      </div>
      {right && <div className="v1p-hero-right">{right}</div>}
    </section>
  );
}

/* ---------- Indicador ---------- */
export function Stat({ label, value, sub, icon, color = 'var(--navy)', onClick, active, loading }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={'card v1p-stat' + (onClick ? ' click' : '') + (active ? ' on' : '')} style={{ '--c': color }} onClick={onClick} type={onClick ? 'button' : undefined}>
      <div className="v1p-stat-top"><span className="v1p-stat-ic"><PIcon name={icon} /></span><span className="v1p-stat-l">{label}</span></div>
      <div className="v1p-stat-v num">{loading ? <span className="v1p-sk" style={{ width: 56, height: 26 }} /> : <CountUp value={typeof value === 'number' ? fmt(value) : value} />}</div>
      {sub && <div className="v1p-stat-s">{sub}</div>}
    </Tag>
  );
}

/* ---------- Tarjeta con encabezado ---------- */
export function Panel({ title, sub, icon, right, children, className = '', flush, step, tone }) {
  return (
    <section className={'card v1p-panel ' + className + (tone ? ' tone-' + tone : '')}>
      <header className="v1p-panel-h">
        {step && <span className="v1p-step">{step}</span>}
        {icon && !step && <span className="v1p-panel-ic"><PIcon name={icon} /></span>}
        <div className="grow"><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
        {right}
      </header>
      <div className={'v1p-panel-b' + (flush ? ' flush' : '')}>{children}</div>
    </section>
  );
}

/* ---------- Segmentado ---------- */
export function Seg({ items, value, onChange, size }) {
  return (
    <div className={'v1p-seg' + (size === 'lg' ? ' lg' : '')} role="tablist">
      {items.map(([k, label, n]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
          {label}{n !== undefined && <span className="v1p-seg-n num">{fmt(n)}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------- Estado vacío ---------- */
export function Empty({ icon = 'check', title, children }) {
  return (
    <div className="v1p-empty">
      <span className="v1p-empty-ic"><PIcon name={icon} /></span>
      <b>{title}</b>
      {children && <p>{children}</p>}
    </div>
  );
}

/* ---------- Ventana modal propia (formularios con estado) ---------- */
export function Modal({ title, icon, onClose, children, foot, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const first = ref.current && ref.current.querySelector('input:not([disabled]), select, textarea, button');
    if (first) first.focus();
    document.body.classList.add('v1p-noscroll');
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('v1p-noscroll'); };
  }, [onClose]);
  return createPortal(
    <div className="v1p-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'v1p-modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} ref={ref}>
        <header className="v1p-modal-h">
          {icon && <span className="v1p-panel-ic"><PIcon name={icon} /></span>}
          <h3 className="grow">{title}</h3>
          <button type="button" className="v1p-x" aria-label="Cerrar" onClick={onClose}><Icon name="x" /></button>
        </header>
        <div className="v1p-modal-b">{children}</div>
        {foot && <footer className="v1p-modal-f">{foot}</footer>}
      </div>
    </div>,
    document.body
  );
}

/* ---------- Campo de formulario ---------- */
export function F({ label, req, hint, children, wide, error }) {
  return (
    <label className={'v1p-f' + (wide ? ' wide' : '') + (error ? ' err' : '')}>
      <span className="v1p-f-l">{label}{req && <i aria-hidden="true">*</i>}</span>
      {children}
      {(hint || error) && <small className="v1p-f-h">{error || hint}</small>}
    </label>
  );
}

/* ---------- Estado de una novedad / registro ---------- */
const PILL = {
  PENDIENTE: ['b-bad', 'Pendiente'], CUBIERTA: ['b-info', 'Cubierta'], RESUELTA: ['b-ok', 'Resuelta'], EXTENDIDA: ['b-warn', 'Extendida'],
  RADICADA: ['b-info', 'Radicada'], ACTIVO: ['b-ok', 'Activo'], INACTIVO: ['b-mute', 'Inactivo']
};
export function Pill({ v }) {
  const k = String(v || '').trim().toUpperCase();
  const p = PILL[k] || ['b-mute', v || '—'];
  return <span className={'badge ' + p[0]}>{p[1]}</span>;
}

/* ---------- Iniciales ---------- */
export const initials = (s) => String(s || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
export function Avatar({ name, tone = 0, size }) {
  return <span className={'v1p-av t' + (tone % 5) + (size ? ' ' + size : '')} aria-hidden="true">{initials(name)}</span>;
}
export const toneOf = (s) => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 5; };

/* ---------- Carga de datos ---------- */
/** Llama varias funciones de COI V1 y devuelve { data, error, loading, reload }. */
export function useV1Data(loader, deps) {
  const [st, setSt] = useState({ data: null, error: null, loading: true });
  const alive = useRef(true);
  const run = useCallback(async () => {
    setSt((s) => ({ ...s, loading: true }));
    try { const data = await loader(); if (alive.current) setSt({ data, error: null, loading: false }); }
    catch (error) { if (alive.current) setSt((s) => ({ data: s.data, error, loading: false })); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { alive.current = true; run(); return () => { alive.current = false; }; }, [run]);
  return { ...st, reload: run };
}
export { gas };

/** Esqueleto de carga. */
export function Skeleton({ rows = 4, h = 18 }) {
  return <div className="v1p-skel" aria-busy="true">{Array.from({ length: rows }, (_, i) => <span key={i} className="v1p-sk" style={{ height: h, width: (92 - (i % 3) * 14) + '%' }} />)}</div>;
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="v1p-error" role="alert">
      <Icon name="alert" /><div className="grow"><b>No se pudieron cargar los datos.</b><small>{error && error.message}</small></div>
      {onRetry && <button type="button" className="btn btn-o btn-sm" onClick={onRetry}><PIcon name="refresh" />Reintentar</button>}
    </div>
  );
}

/** Barras horizontales compactas: rows = [[etiqueta, valor, color?]]. */
export function Bars({ rows, color = 'var(--green)', onPick, active, max: maxO }) {
  const max = maxO || Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="v1p-bars">
      {rows.map((r) => {
        const B = onPick ? 'button' : 'div';
        return (
          <B key={r[0]} type={onPick ? 'button' : undefined} className={'v1p-bar-row' + (onPick ? ' click' : '') + (active === r[0] ? ' on' : '')} onClick={onPick ? () => onPick(r[0]) : undefined}>
            <span className="ellip" title={r[0]}>{r[0]}</span>
            <span className="v1p-bar"><i style={{ width: Math.max(2, (r[1] / max) * 100) + '%', background: r[2] || color }} /></span>
            <b className="num">{fmt(r[1])}</b>
          </B>
        );
      })}
    </div>
  );
}

/** Lee un archivo como base64 (sin el prefijo data:). */
export const fileToBase64 = (file) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).replace(/^data:[^,]*,/, ''));
  r.onerror = () => rej(r.error);
  r.readAsDataURL(file);
});

export const fmtBytes = (n) => (n < 1024 ? n + ' B' : n < 1048576 ? fmt(n / 1024, 0) + ' KB' : fmt(n / 1048576, 1) + ' MB');
