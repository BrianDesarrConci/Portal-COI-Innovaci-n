// Componentes de presentación de COI. Equivalen a los ayudantes HTML del demo
// (head, kpi, card, T, tabs, gasFrame, spark, lineChart, hbars, docRow, listRow).
import { useId, useState } from 'react';
import Icon from './Icon.jsx';
import CountUp from './CountUp.jsx';
import { useApp } from '../context/AppContext.jsx';
import { ST } from '../lib/model.js';
import { fmt } from '../lib/format.js';

/** Estado del día de una actividad: done | progress | scheduled | risk. */
export const StatusBadge = ({ st }) => <span className={'badge ' + ST[st][1]}>{ST[st][0]}</span>;
export const Tag = ({ cls = 'b-mute', children }) => <span className={'badge ' + cls}>{children}</span>;
export const Bar = ({ v, cls = '' }) => <div className={'bar ' + cls}><i style={{ width: Math.max(0, Math.min(100, v)) + '%' }} /></div>;
export const Num = ({ children, className = '' }) => <span className={'num ' + className}>{children}</span>;

/** Enlace interno. `client` fija (o limpia con null) el cliente en contexto. */
export function GoLink({ to, client, className = 'linkbtn', children, title, style }) {
  const { go } = useApp();
  return <button type="button" className={className} title={title} style={style} onClick={(e) => { e.preventDefault(); go(to, { client }); }}>{children}</button>;
}

export function PageHead({ title, sub, right, crumb, code }) {
  return (
    <>
      {crumb && <div className="crumb">{crumb}</div>}
      <div className="page-head">
        <div>
          <h1>{title}{code && <> <span className="chip" style={{ verticalAlign: 'middle', fontFamily: 'var(--font-body)', fontSize: 12 }}>Módulo {code}</span></>}</h1>
          {sub && <p>{sub}</p>}
        </div>
        {right && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>{right}</div>}
      </div>
    </>
  );
}

export function Kpi({ label, value, sub, icon, unit }) {
  return (
    <div className="card kpi">
      <div className="lbl"><span className="kx-ic"><Icon name={icon} /></span>{label}</div>
      <div className="val num"><CountUp value={value} />{unit && <small>{unit}</small>}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
/** Fila de 4 KPI. `items` = [[label, value, sub, icon, unit], ...]. */
export const Kpis = ({ items }) => <div className="grid g4">{items.map((k, i) => <Kpi key={i} label={k[0]} value={k[1]} sub={k[2]} icon={k[3]} unit={k[4]} />)}</div>;

export function Card({ title, sub, right, flush, className = '', children }) {
  return (
    <div className={'card ' + className}>
      <div className="card-h"><div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>{right}</div>
      <div className={'card-b ' + (flush ? 'flush scroll-x' : '')}>{children}</div>
    </div>
  );
}

const plain = (h) => typeof h === 'string' ? h : '';
/**
 * Tabla estándar. `rows` es una lista de arreglos de celdas o de objetos
 * { cells, go, client, onClick, key }. `align` = ['', 'c', 'r', ...].
 */
export function Table({ headers, rows, align = [] }) {
  const { go } = useApp();
  return (
    <table className="t">
      <thead><tr>{headers.map((h, i) => <th key={i} className={align[i] || ''}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, ri) => {
          const cells = Array.isArray(r) ? r : r.cells;
          const click = !Array.isArray(r) && (r.go || r.onClick);
          const onClick = click ? () => (r.onClick ? r.onClick() : go(r.go, { client: r.client })) : undefined;
          return (
            <tr key={(!Array.isArray(r) && r.key) || ri} className={click ? 'click' : undefined} onClick={onClick}>
              {cells.map((c, i) => <td key={i} className={align[i] || ''} data-label={plain(headers[i])}>{c}</td>)}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
/** Celda con texto principal y secundario. */
export const Cell = ({ main, sub }) => <><div className="cell-main">{main}</div>{sub && <div className="cell-sub">{sub}</div>}</>;

/** Pestañas. `items` = [[etiqueta, contenido], ...]. */
export function Tabs({ items, initial = 0, onChange }) {
  const [on, setOn] = useState(initial);
  return (
    <>
      <div className="tabs" role="tablist">
        {items.map((t, i) => <button key={i} className={i === on ? 'on' : ''} role="tab" aria-selected={i === on} onClick={() => { setOn(i); onChange && onChange(i); }}>{t[0]}</button>)}
      </div>
      {items.map((t, i) => <div key={i} hidden={i !== on}>{t[1]}</div>)}
    </>
  );
}

export function GasFrame({ code, name, children }) {
  return (
    <div className="gas-frame">
      <div className="gas-bar"><Icon name="lock" className="lock" /><span>Módulo {code} de Apps Script embebido en COI, {name}. Sesión única activa.</span></div>
      <div className="gas-body">{children}</div>
    </div>
  );
}

export function Avatar({ id, lg }) {
  const { AN } = useApp();
  const a = AN[id];
  return <span className={'avatar ' + (lg ? 'lg ' : '') + 'c' + (a ? a.color : 0)} title={a ? a.name : 'Gerencia'}>{a ? a.initials : 'G'}</span>;
}

export function Spark({ values, w = 120, h = 32, color = 'var(--green)' }) {
  if (!values || values.length < 2) return <span className="small muted">Sin datos</span>;
  const min = Math.min(...values), max = Math.max(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - min) / (max - min || 1)) * (h - 6)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <path className="ln-draw" pathLength="1" d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2.8" fill={color} />
    </svg>
  );
}

/** Gráfico de líneas. series = [{ data, color, area, dash }]. */
export function LineChart({ series, labels, w = 720, h = 220, min: minO, max: maxO, fmt: fmtO, label = 'Gráfico' }) {
  const W = w, H = h, pl = 52, pr = 16, pt = 14, pb = 26;
  const all = series.flatMap((s) => s.data);
  let min = minO !== undefined ? minO : Math.min(...all), max = maxO !== undefined ? maxO : Math.max(...all);
  if (max === min) max = min + 1;
  const x = (i) => pl + (i / (labels.length - 1)) * (W - pl - pr);
  const y = (v) => pt + (1 - (v - min) / (max - min)) * (H - pt - pb);
  const step = Math.ceil(labels.length / 8);
  const gid = 'lg' + useId().replace(/:/g, '');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label}>
      <defs>
        {series.map((s, si) => s.area && (
          <linearGradient key={si} id={gid + si} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={s.color} stopOpacity="0.28" />
            <stop offset="1" stopColor={s.color} stopOpacity="0" />
          </linearGradient>
        ))}
      </defs>
      {[0, 1, 2, 3, 4].map((k) => { const v = min + (k / 4) * (max - min); return (
        <g key={'g' + k}><line className="grid-l" x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} /><text x={pl - 8} y={y(v) + 4} textAnchor="end">{fmtO ? fmtO(v) : fmt(v)}</text></g>
      ); })}
      {labels.map((l, i) => { const last = i === labels.length - 1; return ((i % step === 0 && labels.length - 1 - i >= step / 2) || last) ? <text key={'l' + i} x={x(i)} y={H - 6} textAnchor="middle">{l}</text> : null; })}
      {series.map((s, si) => {
        const d = s.data.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
        return (
          <g key={'s' + si}>
            {s.area && <path className="area-in" d={`${d} L${x(s.data.length - 1)} ${y(min)} L${x(0)} ${y(min)}Z`} fill={`url(#${gid + si})`} />}
            <path className={s.dash ? undefined : 'ln-draw'} pathLength={s.dash ? undefined : 1} d={d} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dash ? '5 5' : undefined} />
          </g>
        );
      })}
    </svg>
  );
}

/** Barras horizontales. rows = [[etiqueta, valor, textoOpcional], ...]. */
export function HBars({ rows, color, min = 0 }) {
  const max = Math.max(...rows.map((r) => r[1]));
  return rows.map((r, i) => (
    <div className="hb" key={i}>
      <span className="small ellip">{r[0]}</span>
      <Bar v={(r[1] - min) / (max - min || 1) * 100} cls={color} />
      <span className="small num" style={{ textAlign: 'right' }}>{r[2] || fmt(r[1])}</span>
    </div>
  ));
}

export function DocRow({ title, sub, icon = 'file', right }) {
  return (
    <div className="doc">
      <span className="ico"><Icon name={icon} /></span>
      <div className="grow"><div className="strong">{title}</div><div className="small muted">{sub}</div></div>
      {right}
    </div>
  );
}

export function ListRow({ left, main, sub, right, go: to, client }) {
  const { go } = useApp();
  return (
    <div className={'list-row' + (to ? ' click' : '')} onClick={to ? () => go(to, { client }) : undefined}>
      {left}
      <div className="grow"><div className="strong ellip">{main}</div>{sub && <div className="small muted">{sub}</div>}</div>
      {right}
    </div>
  );
}

/** Campo etiquetado para formularios dentro de modales. */
export function Field({ label, children }) {
  return <label className="small strong" style={{ display: 'block' }}>{label}<div style={{ marginTop: 6 }}>{children}</div></label>;
}
export const fieldStyle = { height: 38, border: '1px solid var(--line)', borderRadius: 8, padding: '0 10px', width: '100%' };
export const areaStyle = { width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: 10 };

/** Estado de carga / error de datos del API dentro de una vista. */
export function Loading({ error }) {
  if (error) return <div className="card" style={{ padding: 24 }}><b>No se pudieron cargar los datos.</b><p className="muted small">{error.message}</p></div>;
  return (
    <div className="sk-wrap" aria-busy="true" aria-label="Cargando">
      <div className="sk sk-title" />
      <div className="grid g4">{[0, 1, 2, 3].map((i) => <div key={i} className="card sk-card"><div className="sk sk-line w40" /><div className="sk sk-num" /><div className="sk sk-line w70" /></div>)}</div>
      <div className="card sk-card mt"><div className="sk sk-line w30" />{[0, 1, 2, 3, 4].map((i) => <div key={i} className="sk sk-row" />)}</div>
    </div>
  );
}
