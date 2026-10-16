// Piezas compartidas de los tableros de Arqueos: encabezado con mes, chips de
// semáforo, KPI, panel del Asesor COI, estados vacíos / carga y tabla ordenable.
import { useMemo, useState } from 'react';
import Icon from '../../../../components/Icon.jsx';
import CountUp from '../../../../components/CountUp.jsx';
import { heatNivel, mesNombre, SEM, sinTildes } from './lib.js';
import './dash.css';

/** Encabezado de pestaña: título, subtítulo, selector de mes y actualizar. */
export function Head({ title, sub, mes, meses, setMes, onReload, extra, kicker }) {
  return (
    <div className="aqd-head">
      <div className="aqd-head-t">
        {kicker && <span className="aqd-kicker">{kicker}</span>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      <div className="aqd-head-c">
        {extra}
        {setMes && (
          <label className="aqd-sel">
            <Icon name="clock" />
            <span className="aqd-vh">Mes</span>
            <select value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mes del tablero">
              {meses.map((m) => <option key={m} value={m}>{mesNombre(m)}</option>)}
            </select>
          </label>
        )}
        {onReload && <button type="button" className="aqd-icbtn" onClick={onReload} title="Actualizar datos" aria-label="Actualizar datos"><Icon name="activity" /></button>}
      </div>
    </div>
  );
}

/** Chip del semáforo con el texto de estado de V1 (META CUMPLIDA, EN RUTA, …). */
export function Sem({ s, children, lg }) {
  const k = (SEM[s] || SEM.rojo).cls;
  const ic = k === 'ok' ? 'check' : k === 'warn' ? 'alert' : 'x';
  return <span className={'aqd-sem aqd-' + k + (lg ? ' lg' : '')}><Icon name={ic} />{children}</span>;
}

/** Chip de estado genérico. tone = ok | warn | bad | info | mute | navy. */
export const Chip = ({ tone = 'mute', icon, children, title }) => (
  <span className={'aqd-chip aqd-' + tone} title={title}>{icon && <Icon name={icon} />}{children}</span>
);

/** Celda de calor con los umbrales de V1 (≥ 90 / ≥ 60). */
export const Heat = ({ p }) => (p === null || p === undefined)
  ? <span className="aqd-heat aqd-na">—</span>
  : <span className={'aqd-heat aqd-' + heatNivel(p)}>{p}%</span>;

/** Tarjeta KPI con conteo animado. tone pinta el acento (no el número). */
export function Tile({ label, value, sub, icon, tone = 'navy', foot }) {
  return (
    <div className={'aqd-tile aqd-t-' + tone}>
      <div className="aqd-tile-l"><span className="aqd-tile-ic"><Icon name={icon} /></span>{label}</div>
      <div className="aqd-tile-v num"><CountUp value={value} /></div>
      {sub && <div className="aqd-tile-s">{sub}</div>}
      {foot}
    </div>
  );
}

export function Panel({ title, sub, right, children, className = '', icon, flush }) {
  return (
    <section className={'aqd-panel ' + className}>
      {(title || right) && (
        <header className="aqd-panel-h">
          <div>{title && <h3>{icon && <Icon name={icon} />}{title}</h3>}{sub && <p>{sub}</p>}</div>
          {right && <div className="aqd-panel-r">{right}</div>}
        </header>
      )}
      <div className={'aqd-panel-b' + (flush ? ' flush' : '')}>{children}</div>
    </section>
  );
}

export function Empty({ icon = 'check', title, children }) {
  return (
    <div className="aqd-empty">
      <span className="aqd-empty-ic"><Icon name={icon} /></span>
      <b>{title}</b>
      {children && <p>{children}</p>}
    </div>
  );
}

/** Esqueleto de carga con la silueta del tablero (héroe, KPI y dos paneles). */
export function Skeleton({ hero = true }) {
  return (
    <div className="aqd-sk" aria-busy="true" aria-label="Cargando tablero">
      <div className="aqd-skb" style={{ height: 34, width: 'min(380px, 80%)' }} />
      {hero && <div className="aqd-skb aqd-sk-hero" />}
      <div className="aqd-grid4">{[0, 1, 2, 3].map((i) => <div key={i} className="aqd-skb" style={{ height: 104 }} />)}</div>
      <div className="aqd-grid-main"><div className="aqd-skb" style={{ height: 300 }} /><div className="aqd-skb" style={{ height: 300 }} /></div>
    </div>
  );
}

/** Error o función aún no disponible en el servidor. */
export function Falla({ error, noDisponible, onRetry, fn }) {
  if (noDisponible) {
    return (
      <div className="aqd-pend">
        <span className="aqd-empty-ic"><Icon name="clock" /></span>
        <div>
          <b>Este tablero se está conectando con el servidor</b>
          <p>La función <code>{fn}</code> de Control de Arqueos todavía no está publicada en el API de COI V1. El tablero se mostrará en cuanto esté disponible.</p>
          {onRetry && <button type="button" className="btn btn-o btn-sm" onClick={onRetry}>Reintentar</button>}
        </div>
      </div>
    );
  }
  return (
    <div className="aqd-pend aqd-pend-bad" role="alert">
      <span className="aqd-empty-ic"><Icon name="alert" /></span>
      <div>
        <b>No fue posible calcular el tablero</b>
        <p>{error ? error.message || String(error) : 'Error desconocido.'}</p>
        {onRetry && <button type="button" className="btn btn-o btn-sm" onClick={onRetry}>Reintentar</button>}
      </div>
    </div>
  );
}

/** Envoltura estándar de carga / error. */
export function Estado({ q, fn, children }) {
  if (q.loading && !q.data) return <Skeleton />;
  if (q.error) return <Falla error={q.error} noDisponible={q.noDisponible} onRetry={q.reload} fn={fn} />;
  if (!q.data) return <Skeleton />;
  return children(q.data);
}

/* ------------------------------------------------------------------
   Asesor COI: recomendaciones calculadas en el cliente (igual que V1).
   ------------------------------------------------------------------ */
const SEV_IC = { rojo: 'alert', amarillo: 'clock', verde: 'check', info: 'sparkle' };
export function Asesor({ consejos }) {
  if (!consejos || !consejos.length) return null;
  return (
    <section className="aqd-asesor" aria-label="Asesor COI">
      <header>
        <span className="aqd-asesor-ic"><Icon name="sparkle" /></span>
        <div><h3>Asesor COI</h3><p>Recomendaciones basadas en las métricas del mes</p></div>
      </header>
      <div className="aqd-asesor-g">
        {consejos.map((c, i) => (
          <article key={i} className={'aqd-tip aqd-tip-' + c.sev}>
            <span className="aqd-tip-ic"><Icon name={c.ic || SEV_IC[c.sev] || 'sparkle'} /></span>
            <div><b>{c.titulo}</b><p>{c.texto}</p></div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------
   Tabla ordenable. cols = [{ k, h, align, sort: fn(row)→valor, render: fn(row), w }]
   ------------------------------------------------------------------ */
export function SortTable({ cols, rows, rowKey, initial, foot, empty = 'Sin datos.', limit, onRow, compact, caption }) {
  const [sort, setSort] = useState(initial || null);
  const [lim, setLim] = useState(limit || 0);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const c = cols.find((x) => x.k === sort.k);
    if (!c) return rows;
    const get = c.sort || ((r) => r[c.k]);
    const out = rows.slice().sort((a, b) => {
      const va = get(a), vb = get(b);
      if (typeof va === 'number' && typeof vb === 'number') return va - vb;
      return sinTildes(va).localeCompare(sinTildes(vb), 'es', { numeric: true });
    });
    return sort.dir === 'desc' ? out.reverse() : out;
  }, [rows, sort, cols]);
  const shown = lim ? sorted.slice(0, lim) : sorted;
  const toggle = (c) => {
    if (c.sort === false) return;
    setSort((s) => (s && s.k === c.k ? { k: c.k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { k: c.k, dir: c.align === 'r' || c.align === 'c' ? 'desc' : 'asc' }));
  };
  return (
    <div className="aqd-tbl-wrap">
      <table className={'t aqd-tbl' + (compact ? ' compact' : '')}>
        {caption && <caption className="aqd-vh">{caption}</caption>}
        <thead>
          <tr>
            {cols.map((c) => {
              const on = sort && sort.k === c.k;
              const can = c.sort !== false;
              return (
                <th key={c.k} className={(c.align || '') + (can ? ' srt' : '')} style={c.w ? { width: c.w } : undefined}
                  aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {can ? <button type="button" onClick={() => toggle(c)}>{c.h}<span className={'aqd-srt' + (on ? ' on ' + sort.dir : '')} aria-hidden="true" /></button> : c.h}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {shown.length ? shown.map((r, i) => (
            <tr key={rowKey ? rowKey(r, i) : i} className={onRow ? 'click' : undefined} onClick={onRow ? () => onRow(r) : undefined}>
              {cols.map((c) => <td key={c.k} className={c.align || ''} data-label={typeof c.h === 'string' ? c.h : ''}>{c.render ? c.render(r, i) : r[c.k]}</td>)}
            </tr>
          )) : <tr><td colSpan={cols.length} className="aqd-tbl-empty" data-label="">{empty}</td></tr>}
          {foot}
        </tbody>
      </table>
      {lim > 0 && sorted.length > lim && (
        <div className="aqd-more">
          <span>Mostrando {shown.length} de {sorted.length}</span>
          <button type="button" className="btn btn-o btn-sm" onClick={() => setLim(lim + (limit || 50))}>Ver {Math.min(limit || 50, sorted.length - lim)} más</button>
          <button type="button" className="btn btn-g btn-sm" onClick={() => setLim(0)}>Ver todas</button>
        </div>
      )}
    </div>
  );
}

/** Filtros tipo píldora con contador. items = [[id, etiqueta, n]] */
export function Pills({ items, value, onChange, label = 'Filtro' }) {
  return (
    <div className="aqd-pills" role="group" aria-label={label}>
      {items.map(([id, txt, n]) => (
        <button key={id} type="button" className={value === id ? 'on' : ''} aria-pressed={value === id} onClick={() => onChange(id)}>
          {txt}{n !== undefined && <b>{n}</b>}
        </button>
      ))}
    </div>
  );
}

/** Barra de progreso fina con color de estado. */
export const Meter = ({ v, tone = 'ok', label }) => (
  <span className="aqd-meter" role="img" aria-label={label || Math.round(v) + '%'}>
    <span className={'aqd-meter-f aqd-' + tone} style={{ width: Math.max(0, Math.min(100, v)) + '%' }} />
  </span>
);

export function Search({ value, onChange, placeholder = 'Buscar…' }) {
  return (
    <label className="aqd-search">
      <Icon name="search" />
      <input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </label>
  );
}
