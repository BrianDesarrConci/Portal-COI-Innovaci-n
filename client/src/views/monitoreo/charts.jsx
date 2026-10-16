// Gráficos del tablero gerencial: variación, indicador circular, dona,
// combinado barras y línea (con detalle al pasar el cursor) y mapa de calor.
import { useRef, useState } from 'react';
import { fmt, pct, MSHORT } from '../../lib/format.js';

/** Variación entre dos valores. `invert` = bajar es bueno. */
export function Delta({ a, b, unit = '', dec, invert }) {
  const d = a - b; const flat = Math.abs(d) < 0.05; const good = invert ? d <= 0 : d >= 0;
  const s = (flat ? '' : d >= 0 ? '+' : '−') + fmt(flat ? 0 : Math.abs(d), dec === undefined ? 1 : dec) + unit;
  return <span className={'delta ' + (flat ? 'flat' : good ? 'pos' : 'neg')}>{s}</span>;
}

export function Gauge({ v, size = 168 }) {
  const r = size / 2 - 12, c = 2 * Math.PI * r, frac = Math.max(0, Math.min(1, (v - 80) / 20)), h = size / 2;
  return (
    <svg className="gauge" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={h} cy={h} r={r} stroke="rgba(255,255,255,.12)" strokeWidth="12" fill="none" />
      <circle className="gauge-arc" cx={h} cy={h} r={r} stroke="#21BBEA" strokeWidth="12" fill="none" strokeLinecap="round"
        strokeDasharray={(c * frac).toFixed(1) + ' ' + c.toFixed(1)} transform={`rotate(-90 ${h} ${h})`} />
    </svg>
  );
}

/** Dona. parts = [[etiqueta, valor, color], ...]. */
export function Donut({ parts, size = 180 }) {
  const r = size / 2 - 16, c = 2 * Math.PI * r, tot = parts.reduce((a, p) => a + p[1], 0), h = size / 2;
  let off = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribución por proceso">
      {parts.map((p, i) => {
        const len = p[1] / tot * c; const o = off; off += len;
        return (
          <circle key={i} cx={h} cy={h} r={r} fill="none" stroke={p[2]} strokeWidth="22"
            strokeDasharray={Math.max(0, len - 2).toFixed(1) + ' ' + c.toFixed(1)} strokeDashoffset={(-o).toFixed(1)} transform={`rotate(-90 ${h} ${h})`}>
            <title>{p[0] + ': ' + fmt(p[1])}</title>
          </circle>
        );
      })}
      <text x="50%" y="47%" textAnchor="middle" className="donut-n">{fmt(tot)}</text>
      <text x="50%" y="60%" textAnchor="middle" className="donut-l">actividades</text>
    </svg>
  );
}

/** Barras de volumen con línea de cumplimiento y meta del 95 %. data = [{ label, vol, comp, ans, future }]. */
export function ComboChart({ id, data }) {
  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);
  const W = 860, H = 280, pl = 46, pr = 46, pt = 18, pb = 30, n = data.length;
  const bw = Math.max(4, Math.min(34, (W - pl - pr) / n * 0.56));
  const x = (i) => pl + (n === 1 ? (W - pl - pr) / 2 : (i + 0.5) * (W - pl - pr) / n);
  const vmax = Math.max(...data.map((d) => d.vol), 1) * 1.15;
  const cs = data.filter((d) => d.comp != null).map((d) => d.comp);
  const cmin = Math.min(88, Math.floor(Math.min(...cs, 95) - 1)), cmax = 100;
  const yv = (v) => pt + (1 - v / vmax) * (H - pt - pb), yc = (v) => pt + (1 - (v - cmin) / (cmax - cmin)) * (H - pt - pb);
  const step = Math.ceil(n / 12);
  const pts = data.map((d, i) => d.comp == null ? null : [x(i), yc(d.comp)]).filter(Boolean);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const gid = 'g-' + id;

  const onMove = (e) => {
    const svg = svgRef.current; if (!svg || !n) return;
    const r = svg.getBoundingClientRect(); const vx = (e.clientX - r.left) / r.width * W;
    let i = Math.round((vx - pl) / ((W - pl - pr) / n) - 0.5); i = Math.max(0, Math.min(n - 1, i));
    const px = x(i); const left = px / W * r.width;
    setHover({ i, px, left: Math.min(Math.max(0, r.width - 190), Math.max(0, left + 14)) });
  };
  const d = hover && data[hover.i];

  return (
    <div className="chart-wrap">
      <svg ref={svgRef} className="chart combo" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Cumplimiento y volumen del periodo"
        onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#048C38" stopOpacity=".22" /><stop offset="1" stopColor="#048C38" stopOpacity="0" /></linearGradient>
        </defs>
        {[0, 1, 2, 3, 4].map((k) => {
          const cv = cmin + (k / 4) * (cmax - cmin); const yy = yc(cv);
          return (
            <g key={'k' + k}>
              <line className="grid-l" x1={pl} x2={W - pr} y1={yy} y2={yy} />
              <text x={W - pr + 8} y={yy + 4}>{fmt(cv, 0) + ' %'}</text>
              <text x={pl - 8} y={yy + 4} textAnchor="end">{fmt(vmax * k / 4 / (vmax > 2000 ? 1000 : 1), 0) + (vmax > 2000 ? ' mil' : '')}</text>
            </g>
          );
        })}
        {data.map((b, i) => (
          <g key={'b' + i}>
            <rect className={'cb' + (b.future ? ' fut' : '')} x={x(i) - bw / 2} y={yv(b.vol)} width={bw} height={Math.max(0, H - pb - yv(b.vol))} rx={Math.min(5, bw / 3)} />
            {(i % step === 0 || i === n - 1) && <text x={x(i)} y={H - 9} textAnchor="middle">{b.label}</text>}
          </g>
        ))}
        <line x1={pl} x2={W - pr} y1={yc(95)} y2={yc(95)} stroke="#21BBEA" strokeWidth="1.5" strokeDasharray="5 5" />
        <text x={pl + 6} y={yc(95) - 6} className="meta-l">Meta 95 %</text>
        {pts.length > 1 && (
          <>
            <path d={`${line} L${pts[pts.length - 1][0]} ${H - pb} L${pts[0][0]} ${H - pb}Z`} fill={`url(#${gid})`} />
            <path d={line} fill="none" stroke="#048C38" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
            {pts.length <= 31 && pts.map((p, i) => <circle key={'p' + i} cx={p[0]} cy={p[1]} r="3.2" fill="#fff" stroke="#048C38" strokeWidth="2" />)}
          </>
        )}
        <line className="xh" x1={hover ? hover.px : 0} x2={hover ? hover.px : 0} y1={pt} y2={H - pb} style={hover ? undefined : { display: 'none' }} />
      </svg>
      <div className="tip" style={d ? { display: 'block', left: hover.left } : undefined}>
        {d && (
          <>
            <b>{d.label}</b>
            <span>Actividades cerradas <i>{fmt(d.vol)}</i></span>
            {d.comp != null ? <span>Cumplimiento <i>{pct(d.comp, 1)}</i></span> : <span>Franja aún no transcurrida</span>}
            {d.ans ? <span>ANS cumplido <i>{pct(d.ans, 1)}</i></span> : null}
          </>
        )}
      </div>
    </div>
  );
}

const HmLegend = () => (
  <div className="hm-leg"><span>Menos de 92,5 %</span>{[0, 1, 2, 3, 4, 5].map((l) => <i key={l} className={'hm l' + l} />)}<span>98,5 % o más</span></div>
);

/** Mapa de cumplimiento diario: calendario hasta 6 semanas, columnas por semana si es más largo. */
export function Heatmap({ list }) {
  if (!list.length) return null;
  const first = new Date(list[0].d); first.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const weeks = Math.ceil(((list[list.length - 1].d - first) / 864e5 + 1) / 7);
  const by = {}; list.forEach((x) => { by[x.key] = x; });
  const lv = (c) => c >= 0.985 ? 5 : c >= 0.97 ? 4 : c >= 0.955 ? 3 : c >= 0.94 ? 2 : c >= 0.925 ? 1 : 0;
  const sz = weeks <= 6 ? 40 : weeks <= 10 ? 30 : weeks <= 16 ? 24 : 18; const showN = sz >= 30;
  const dayAt = (w, dd) => { const day = new Date(first); day.setDate(first.getDate() + w * 7 + dd); return day; };
  const title = (day, x) => day.getDate() + ' ' + MSHORT[day.getMonth()] + ': ' + pct(x.done / x.prog * 100, 1);

  if (weeks <= 6) {
    const cells = [];
    for (let w = 0; w < weeks; w++) for (let dd = 0; dd < 6; dd++) {
      const day = dayAt(w, dd); const x = by[day.toISOString().slice(0, 10)];
      cells.push(x
        ? <i key={w + '-' + dd} className={'hm l' + lv(x.done / x.prog)} title={title(day, x)}><b>{day.getDate()}</b><small>{fmt(x.done / x.prog * 100, 1)}</small></i>
        : <i key={w + '-' + dd} className="hm off" />);
    }
    return (
      <>
        <div className="cal">{['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((d) => <span key={d} className="cal-h">{d}</span>)}{cells}</div>
        <HmLegend />
      </>
    );
  }
  const cols = [];
  for (let w = 0; w < weeks; w++) {
    const cells = [];
    for (let dd = 0; dd < 6; dd++) {
      const day = dayAt(w, dd); const x = by[day.toISOString().slice(0, 10)];
      cells.push(x ? <i key={dd} className={'hm l' + lv(x.done / x.prog)} title={title(day, x)}>{showN ? day.getDate() : ''}</i> : <i key={dd} className="hm off" />);
    }
    cols.push(<div key={w} className="hm-col">{cells}</div>);
  }
  return (
    <>
      <div className="hm-wrap" style={{ '--hm': sz + 'px' }}>
        <div className="hm-days"><span>Lun</span><span /><span>Mié</span><span /><span>Vie</span><span /></div>
        <div className="hm-grid">{cols}</div>
      </div>
      <HmLegend />
    </>
  );
}
