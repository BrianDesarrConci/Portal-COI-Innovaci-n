// Gráficos de los tableros de Arqueos, sin dependencias: anillo, avance acumulado,
// barras horizontales (simples, apiladas, agrupadas), dona y series mensuales.
// Todos llevan título accesible, leyenda cuando hay más de una serie y detalle al pasar el cursor.
import { useId, useLayoutEffect, useRef, useState } from 'react';

/** Ancho real del contenedor (para dibujar en píxeles y no deformar el texto). */
export function useWidth(def = 640) {
  const ref = useRef(null);
  const [w, setW] = useState(def);
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return undefined;
    const set = () => setW(Math.max(240, Math.round(el.getBoundingClientRect().width)));
    set();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(set); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** Pista flotante. rows = [[color|null, etiqueta, valor]]. */
function Tip({ at, title, rows, w }) {
  if (!at) return null;
  const left = Math.max(4, Math.min(at.x + 14, (w || 9999) - 214));
  return (
    <div className="aqd-tipbox" style={{ left, top: Math.max(0, at.y - 10) }} role="status">
      <b>{title}</b>
      {rows.map((r, i) => <span key={i}>{r[0] && <i style={{ background: r[0] }} />}<em>{r[1]}</em><strong>{r[2]}</strong></span>)}
    </div>
  );
}

export function Legend({ items }) {
  return (
    <div className="aqd-legend">
      {items.map((it) => <span key={it[0]}><i className={it[2] ? 'ln' + (it[2] === 'dash' ? ' dash' : '') : ''} style={{ background: it[2] ? undefined : it[1], borderColor: it[1] }} />{it[0]}</span>)}
    </div>
  );
}

/* ------------------------------------------------------------------
   Anillo de avance (ringSVG de V1)
   ------------------------------------------------------------------ */
export function Ring({ pct, color = '#048C38', size = 168, stroke = 13, track = 'rgba(255,255,255,.12)', children, label }) {
  const r = size / 2 - stroke / 2 - 2, c = 2 * Math.PI * r, h = size / 2;
  const f = Math.max(0, Math.min(100, pct || 0)) / 100;
  return (
    <div className="aqd-ring" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={h} cy={h} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle className="aqd-ring-arc" cx={h} cy={h} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          style={{ '--c': c.toFixed(1) }} strokeDasharray={`${(c * f).toFixed(1)} ${c.toFixed(1)}`} transform={`rotate(-90 ${h} ${h})`} />
      </svg>
      <div className="aqd-ring-c">{children}</div>
    </div>
  );
}

/** Escala con 4–6 marcas limpias (1, 2, 5 × 10^k). Devuelve { max, ticks }. */
export function escala(v, n = 4) {
  const raw = Math.max(v, 1) / n;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const m = raw / p;
  const step = (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
  const max = Math.ceil(Math.max(v, 1) / step) * step;
  const ticks = []; for (let t = 0; t <= max + step / 2; t += step) ticks.push(t);
  return { max, ticks };
}

/* ------------------------------------------------------------------
   Avance acumulado del mes contra la meta, con proyección.
   serie = [{ dia, valor, acumulado }] (obtenerDashboard.serie)
   ------------------------------------------------------------------ */
export function CumChart({ serie, meta, hasta, proyeccion, label = 'Avance acumulado del mes' }) {
  const [ref, W] = useWidth();
  const [hov, setHov] = useState(null);
  const H = 290, pl = 34, pr = 16, pt = 18, pb = 28;
  const n = serie.length || 1;
  const vis = hasta ? serie.filter((s) => s.dia <= hasta) : serie;
  const last = vis.length ? vis[vis.length - 1] : { dia: 0, acumulado: 0 };
  const { max: maxV, ticks } = escala(Math.max(meta * 1.08, last.acumulado, proyeccion || 0, ...serie.map((s) => s.valor)));
  const x = (d) => pl + ((d - 0.5) / n) * (W - pl - pr);
  const y = (v) => pt + (1 - v / maxV) * (H - pt - pb);
  const bw = Math.max(3, Math.min(14, (W - pl - pr) / n * 0.5));
  const line = vis.map((s, i) => (i ? 'L' : 'M') + x(s.dia).toFixed(1) + ' ' + y(s.acumulado).toFixed(1)).join(' ');
  const area = vis.length ? `${line} L${x(last.dia)} ${y(0)} L${x(vis[0].dia)} ${y(0)}Z` : '';
  const step = W < 520 ? 5 : 3;
  const gid = 'cum' + useId().replace(/:/g, '');
  const showProj = hasta && hasta < n && proyeccion !== undefined;
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left; let d = Math.round((px - pl) / ((W - pl - pr) / n) + 0.5);
    d = Math.max(1, Math.min(n, d));
    setHov({ d, x: x(d), y: e.clientY - r.top });
  };
  const hs = hov && serie[hov.d - 1];
  const futuro = hs && hasta && hs.dia > hasta;
  return (
    <div className="aqd-chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={label} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHov(null)}>
        <title>{label}</title>
        <defs><linearGradient id={gid} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#048C38" stopOpacity=".22" /><stop offset="1" stopColor="#048C38" stopOpacity="0" /></linearGradient></defs>
        {ticks.map((t) => <g key={t}><line className="aqd-grid" x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} /><text className="aqd-ax" x={pl - 8} y={y(t) + 4} textAnchor="end">{t}</text></g>)}
        {serie.map((s) => (
          <g key={s.dia}>
            {s.valor > 0 && (!hasta || s.dia <= hasta) && <rect className="aqd-colbar" x={x(s.dia) - bw / 2} y={y(s.valor)} width={bw} height={y(0) - y(s.valor)} rx="2" fill="#C9CDE3" />}
            {(s.dia === 1 || s.dia % step === 0) && <text className="aqd-ax" x={x(s.dia)} y={H - 8} textAnchor="middle">{s.dia}</text>}
          </g>
        ))}
        <line x1={pl} x2={W - pr} y1={y(meta)} y2={y(meta)} stroke="#242A54" strokeWidth="1.5" strokeDasharray="6 5" />
        <text className="aqd-ref" x={pl + 6} y={y(meta) - 7}>Meta {meta}</text>
        {hasta && hasta < n && <rect x={x(hasta) + bw} y={pt} width={Math.max(0, W - pr - x(hasta) - bw)} height={H - pt - pb} fill="#242A54" opacity=".025" />}
        {area && <path className="aqd-fade" d={area} fill={`url(#${gid})`} />}
        {line && <path className="aqd-draw" pathLength="1" d={line} fill="none" stroke="#048C38" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />}
        {showProj && <line x1={x(last.dia)} y1={y(last.acumulado)} x2={x(n)} y2={y(proyeccion)} stroke="#21BBEA" strokeWidth="2" strokeDasharray="4 5" strokeLinecap="round" />}
        {showProj && <circle cx={x(n)} cy={y(proyeccion)} r="4.5" fill="#21BBEA" stroke="#fff" strokeWidth="2" />}
        {vis.length > 0 && <circle cx={x(last.dia)} cy={y(last.acumulado)} r="5" fill="#048C38" stroke="#fff" strokeWidth="2" />}
        {vis.length > 0 && <text className="aqd-endl" x={x(last.dia) + (x(last.dia) > W - 90 ? -10 : 10)} y={y(last.acumulado) - 10} textAnchor={x(last.dia) > W - 90 ? 'end' : 'start'}>{last.acumulado}</text>}
        {hov && <line className="aqd-xh" x1={hov.x} x2={hov.x} y1={pt} y2={H - pb} />}
      </svg>
      <Tip at={hov} w={W} title={'Día ' + (hs ? hs.dia : '')} rows={hs ? (futuro
        ? [[null, 'Día aún no transcurrido', ''], ['#21BBEA', 'Proyección al cierre', proyeccion]]
        : [['#C9CDE3', 'Válidos del día', hs.valor], ['#048C38', 'Acumulado', hs.acumulado], [null, 'Faltan para meta', Math.max(meta - hs.acumulado, 0)]]) : []} />
    </div>
  );
}

/* ------------------------------------------------------------------
   Barras horizontales (HTML): simples, apiladas o con referencia.
   rows = [{ key, label, sub, segs: [{ v, color, name }], end, tip: [[color, etiqueta, valor]] }]
   ------------------------------------------------------------------ */
export function HBars({ rows, max, refV, refLabel, label, labelW = 168, onRow, unit = '' }) {
  const wrap = useRef(null);
  const [hov, setHov] = useState(null);
  const mx = max || Math.max(1, ...rows.map((r) => r.segs.reduce((a, s) => a + (s.v || 0), 0)), refV || 0);
  const move = (e, r) => { const b = wrap.current.getBoundingClientRect(); setHov({ r, at: { x: e.clientX - b.left, y: e.clientY - b.top + 16 } }); };
  return (
    <div className={'aqd-hb' + (refV ? ' has-ref' : '')} ref={wrap} role="img" aria-label={label} style={{ '--lw': labelW + 'px' }} onPointerLeave={() => setHov(null)}>
      {refV ? <div className="aqd-hb-refgrid" aria-hidden="true"><span /><span className="aqd-hb-reft"><em style={{ left: Math.min(100, refV / mx * 100) + '%' }}><b>{refLabel}</b></em></span><span /></div> : null}
      {rows.map((r) => {
        const tot = r.segs.reduce((a, s) => a + (s.v || 0), 0);
        return (
          <div key={r.key} className={'aqd-hb-row' + (onRow ? ' click' : '') + (hov && hov.r.key === r.key ? ' on' : '')}
            onPointerMove={(e) => move(e, r)} onPointerDown={(e) => move(e, r)} onClick={onRow ? () => onRow(r) : undefined}>
            <span className="aqd-hb-l" title={r.label}><span className="ellip">{r.label}</span>{r.sub && <small>{r.sub}</small>}</span>
            <span className="aqd-hb-t">
              {r.segs.map((s, i) => s.v > 0 && <i key={i} style={{ width: (s.v / mx * 100) + '%', background: s.color }} />)}
              {tot === 0 && <i className="zero" />}
            </span>
            <span className="aqd-hb-v num">{r.end !== undefined ? r.end : tot + unit}</span>
          </div>
        );
      })}
      {hov && <Tip at={hov.at} w={wrap.current ? wrap.current.clientWidth : 600} title={hov.r.label} rows={hov.r.tip || hov.r.segs.map((s) => [s.color, s.name, s.v + unit])} />}
    </div>
  );
}

/** Barras agrupadas horizontales (varias series por categoría, misma unidad). */
export function GroupBars({ labels, series, colors, max, unit = '', label, fmtV = (v) => v }) {
  const wrap = useRef(null);
  const [hov, setHov] = useState(null);
  const mx = max || Math.max(1, ...series.flatMap((s) => s.data));
  const move = (e, i) => { const b = wrap.current.getBoundingClientRect(); setHov({ i, at: { x: e.clientX - b.left, y: e.clientY - b.top + 16 } }); };
  return (
    <div className="aqd-gb" ref={wrap} role="img" aria-label={label} onPointerLeave={() => setHov(null)}>
      {labels.map((l, i) => (
        <div key={l} className={'aqd-gb-row' + (hov && hov.i === i ? ' on' : '')} onPointerMove={(e) => move(e, i)} onPointerDown={(e) => move(e, i)}>
          <span className="aqd-gb-l ellip" title={l}>{l}</span>
          <span className="aqd-gb-bars">
            {series.map((s, si) => (
              <span key={si} className="aqd-gb-b">
                <i style={{ width: Math.max(0, s.data[i] / mx * 100) + '%', background: colors[si] }} />
                <em className="num">{fmtV(s.data[i])}{unit}</em>
              </span>
            ))}
          </span>
        </div>
      ))}
      {hov && <Tip at={hov.at} w={wrap.current ? wrap.current.clientWidth : 600} title={labels[hov.i]} rows={series.map((s, si) => [colors[si], s.name, fmtV(s.data[hov.i]) + unit])} />}
    </div>
  );
}

/* ------------------------------------------------------------------
   Dona con leyenda interactiva. parts = [{ label, value, color }]
   ------------------------------------------------------------------ */
export function Donut({ parts, size = 196, center, centerLabel, label, fmtV = (v) => v.toLocaleString('es-CO'), legendExtra }) {
  const [hov, setHov] = useState(null);
  const tot = parts.reduce((a, p) => a + (p.value || 0), 0);
  const sw = 26, r = size / 2 - sw / 2 - 2, c = 2 * Math.PI * r, h = size / 2;
  let off = 0;
  const pctOf = (v) => (tot ? Math.round(v / tot * 100) : 0);
  const hp = hov !== null ? parts[hov] : null;
  return (
    <div className="aqd-donut">
      <div className="aqd-donut-g" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label + ': ' + parts.map((p) => p.label + ' ' + fmtV(p.value)).join(', ')}>
          <circle cx={h} cy={h} r={r} fill="none" stroke="#EEF0F6" strokeWidth={sw} />
          {tot > 0 && parts.map((p, i) => {
            const len = p.value / tot * c; const o = off; off += len;
            if (!p.value) return null;
            return (
              <circle key={i} className="aqd-donut-s" cx={h} cy={h} r={r} fill="none" stroke={p.color} strokeWidth={hov === i ? sw + 6 : sw}
                strokeDasharray={`${Math.max(0, len - (parts.filter((q) => q.value).length > 1 ? 2 : 0)).toFixed(2)} ${c.toFixed(2)}`} strokeDashoffset={(-o).toFixed(2)}
                transform={`rotate(-90 ${h} ${h})`} opacity={hov !== null && hov !== i ? 0.35 : 1}
                onPointerEnter={() => setHov(i)} onPointerLeave={() => setHov(null)}>
                <title>{p.label + ': ' + fmtV(p.value) + ' (' + pctOf(p.value) + '%)'}</title>
              </circle>
            );
          })}
        </svg>
        <div className="aqd-donut-c">
          {hp ? <><b className="num">{pctOf(hp.value)}%</b><span>{hp.label}</span></> : <><b className="num">{center !== undefined ? center : fmtV(tot)}</b><span>{centerLabel}</span></>}
        </div>
      </div>
      <div className="aqd-donut-lg">
        {parts.map((p, i) => (
          <button type="button" key={p.label} className={hov === i ? 'on' : ''} onPointerEnter={() => setHov(i)} onPointerLeave={() => setHov(null)} onFocus={() => setHov(i)} onBlur={() => setHov(null)}>
            <i style={{ background: p.color }} /><span className="ellip">{p.label}</span><b className="num">{fmtV(p.value)}</b><small className="num">{pctOf(p.value)}%</small>
          </button>
        ))}
        {legendExtra}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Series mensuales (12 meses): líneas o columnas agrupadas.
   series = [{ name, color, data: [12 números] }]; corte = índice del último mes con datos.
   ------------------------------------------------------------------ */
export function MonthChart({ labels, series, type = 'line', corte = 11, fmtAxis = (v) => v, fmtV = (v) => v, label, onPick, picked }) {
  const [ref, W] = useWidth();
  const [hov, setHov] = useState(null);
  const H = 250, pl = type === 'bar' ? 64 : 36, pr = 12, pt = 16, pb = 28, n = labels.length;
  const { max: maxV, ticks } = escala(Math.max(1, ...series.flatMap((s) => s.data.slice(0, corte + 1))));
  const slot = (W - pl - pr) / n;
  const x = (i) => pl + (i + 0.5) * slot;
  const y = (v) => pt + (1 - v / maxV) * (H - pt - pb);
  const gid = 'mc' + useId().replace(/:/g, '');
  const bw = Math.max(3, Math.min(16, slot * 0.7 / series.length - 2));
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left - pl) / slot)));
    setHov({ i, x: x(i), y: e.clientY - r.top });
  };
  return (
    <div className="aqd-chart" ref={ref}>
      <svg width={W} height={H} role="img" aria-label={label} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHov(null)}
        onClick={onPick && hov ? () => onPick(hov.i) : undefined} style={onPick ? { cursor: 'pointer' } : undefined}>
        <title>{label}</title>
        <defs>{series.map((s, si) => <linearGradient key={si} id={gid + si} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity=".16" /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient>)}</defs>
        {ticks.map((t, k) => <g key={k}><line className="aqd-grid" x1={pl} x2={W - pr} y1={y(t)} y2={y(t)} /><text className="aqd-ax" x={pl - 8} y={y(t) + 4} textAnchor="end">{fmtAxis(t)}</text></g>)}
        {corte < n - 1 && <g><rect x={pl + (corte + 1) * slot} y={pt} width={(n - corte - 1) * slot} height={H - pt - pb} fill="#242A54" opacity=".03" /><text className="aqd-ax" x={pl + (corte + 1) * slot + 6} y={pt + 12}>Sin datos aún</text></g>}
        {picked !== undefined && picked !== null && <rect x={pl + picked * slot} y={pt} width={slot} height={H - pt - pb} fill="#21BBEA" opacity=".08" rx="6" />}
        {labels.map((l, i) => (slot >= 30 || i % 2 === 0 || picked === i) && <text key={l} className={'aqd-ax' + (picked === i ? ' on' : '')} x={x(i)} y={H - 8} textAnchor="middle">{l}</text>)}
        {type === 'bar' && series.map((s, si) => s.data.map((v, i) => i <= corte && v > 0 && (
          <rect key={si + '-' + i} className="aqd-colbar" x={x(i) - (series.length * (bw + 2)) / 2 + si * (bw + 2)} y={y(v)} width={bw} height={y(0) - y(v)} rx="3" fill={s.color} />
        )))}
        {type === 'line' && series.map((s, si) => {
          const pts = s.data.slice(0, corte + 1).map((v, i) => [x(i), y(v)]);
          const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
          return (
            <g key={si}>
              {pts.length > 1 && <path className="aqd-fade" d={`${d} L${pts[pts.length - 1][0]} ${y(0)} L${pts[0][0]} ${y(0)}Z`} fill={`url(#${gid + si})`} />}
              <path className="aqd-draw" pathLength="1" d={d} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={hov && hov.i === i ? 5 : 3.5} fill={s.color} stroke="#fff" strokeWidth="2" />)}
            </g>
          );
        })}
        {hov && <line className="aqd-xh" x1={hov.x} x2={hov.x} y1={pt} y2={H - pb} />}
      </svg>
      <Tip at={hov} w={W} title={hov ? labels[hov.i] : ''} rows={hov ? (hov.i > corte ? [[null, 'Mes sin datos', '']] : series.map((s) => [s.color, s.name, fmtV(s.data[hov.i])])) : []} />
    </div>
  );
}

/** Pequeño anillo para tarjetas (sin texto central propio). */
export function MiniRing({ pct, color, size = 46 }) {
  return <Ring pct={pct} color={color} size={size} stroke={6} track="#EEF0F6" label={pct + '%'} />;
}

/** Segmentos proporcionales en una sola barra (distribución por estado). */
export function StackStrip({ parts, label }) {
  const tot = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div className="aqd-strip" role="img" aria-label={label + ': ' + parts.map((p) => p.label + ' ' + p.value).join(', ')}>
      {parts.map((p) => p.value > 0 && <i key={p.label} style={{ flexGrow: p.value / tot, background: p.color }} title={p.label + ': ' + p.value} />)}
    </div>
  );
}
