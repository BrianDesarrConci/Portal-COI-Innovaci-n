// Mapa de puntos de Colombia (proyección equirectangular) para la Granja de Usuarios.
import { useMemo, useState } from 'react';
import { fmt } from '../../../lib/format.js';

const LON0 = -79.6, LON1 = -66.6, LAT0 = -4.4, LAT1 = 12.7;
const W = 360, H = Math.round(W * (LAT1 - LAT0) / (LON1 - LON0));
const inCol = (p) => p.lat != null && p.lon != null && p.lat > LAT0 && p.lat < LAT1 && p.lon > LON0 && p.lon < LON1;

/** Ventana visible: todo el país o, con `fit`, el recuadro de los puntos (mismo aspecto). */
function ventana(all, fit) {
  if (!fit || !all.length) return { x0: LON0, y1: LAT1, sx: (LON1 - LON0) / W, sy: (LAT1 - LAT0) / H };
  let a = Math.min(...all.map((p) => p.lon)), b = Math.max(...all.map((p) => p.lon));
  let c = Math.min(...all.map((p) => p.lat)), d = Math.max(...all.map((p) => p.lat));
  const span = Math.max((b - a) * 1.25, (d - c) * 1.25 * W / H, 0.12);
  const cx = (a + b) / 2, cy = (c + d) / 2;
  const sx = span / W;
  return { x0: cx - (W * sx) / 2, y1: cy + (H * sx) / 2, sx, sy: sx };
}

/**
 * points = [{ key, lat, lon, color, r, title, ring, dim }]
 * marks  = [{ key, lat, lon, label, kind: 'origin' | 'pick' }]  (se dibujan encima)
 */
export default function GeoMap({ points, marks = [], lines = [], legend, label = 'Mapa', onPick, height, fit }) {
  const [hover, setHover] = useState(null);
  const pts = useMemo(() => points.filter(inCol), [points]);
  const v = useMemo(() => ventana(pts.concat(marks.filter(inCol)), fit), [pts, marks, fit]);
  const px = (lon) => (lon - v.x0) / v.sx;
  const py = (lat) => (v.y1 - lat) / v.sy;
  const step = fit ? Math.max(0.05, Math.round(v.sx * W / 6 * 20) / 20) : 2;
  const grid = [];
  for (let lo = Math.ceil(v.x0 / step) * step, k = 0; lo < v.x0 + v.sx * W && k < 40; lo += step, k++) grid.push(<line key={'x' + k} x1={px(lo)} x2={px(lo)} y1={0} y2={H} />);
  for (let la = Math.floor(v.y1 / step) * step, k = 0; la > v.y1 - v.sy * H && k < 40; la -= step, k++) grid.push(<line key={'y' + k} x1={0} x2={W} y1={py(la)} y2={py(la)} />);
  const km = fit ? Math.max(1, Math.round(v.sx * W * 111)) : null;
  return (
    <div className="v1p-map" style={height ? { height } : undefined}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id="v1pGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#21BBEA" stopOpacity=".16" /><stop offset="1" stopColor="#21BBEA" stopOpacity="0" /></radialGradient>
        </defs>
        <g className="v1p-map-grid">{grid}</g>
        <g className="v1p-map-halo">{pts.map((p) => <circle key={'h' + p.key} cx={px(p.lon)} cy={py(p.lat)} r={(p.r || 3) * 3.2} fill="url(#v1pGlow)" />)}</g>
        {lines.map((l, i) => <line key={'l' + i} className="v1p-map-line" x1={px(l[0].lon)} y1={py(l[0].lat)} x2={px(l[1].lon)} y2={py(l[1].lat)} />)}
        <g>
          {pts.map((p) => (
            <circle key={p.key} cx={px(p.lon)} cy={py(p.lat)} r={p.r || 3} fill={p.color} opacity={p.dim ? 0.18 : 0.85}
              stroke={p.ring ? '#F6CF46' : '#fff'} strokeWidth={p.ring ? 1.6 : 0.6}
              className={onPick ? 'v1p-map-pt click' : 'v1p-map-pt'}
              onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)} onClick={onPick ? () => onPick(p) : undefined}>
              <title>{p.title}</title>
            </circle>
          ))}
        </g>
        {marks.map((m) => (
          <g key={m.key} className={'v1p-map-mark ' + (m.kind || 'pick')} transform={`translate(${px(m.lon)},${py(m.lat)})`}>
            <circle r={m.kind === 'origin' ? 9 : 6} className="pulse" />
            <circle r={m.kind === 'origin' ? 5.5 : 4} className="core" />
            {m.label && <text x="9" y="-8">{m.label}</text>}
          </g>
        ))}
      </svg>
      {hover && <div className="v1p-map-tip" style={{ left: (px(hover.lon) / W) * 100 + '%', top: (py(hover.lat) / H) * 100 + '%' }}>{hover.title}</div>}
      {km && <div className="v1p-map-scale">Vista de ~{fmt(km)} km</div>}
      {legend && <div className="v1p-map-legend">{legend.map((l) => <span key={l[0]}><i style={{ background: l[1] }} />{l[0]}{l[2] !== undefined && <b className="num">{fmt(l[2])}</b>}</span>)}</div>}
    </div>
  );
}
