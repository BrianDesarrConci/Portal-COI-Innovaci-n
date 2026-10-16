// Piezas visuales del Modo Comité: contadores, delta, anillos y gráficos SVG animados.
import { useEffect, useRef, useState } from 'react';
import { fmt } from '../../lib/format.js';

export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Número que cuenta desde 0 hasta `to`. `format` recibe el valor intermedio. */
export function Count({ to, dec = 0, format, delay = 250, dur = 1500 }) {
  const f = format || ((v) => fmt(v, dec));
  const [v, setV] = useState(() => (reducedMotion() ? to : 0));
  const raf = useRef();
  useEffect(() => {
    if (reducedMotion()) { setV(to); return undefined; }
    let start = null; let t0;
    const step = (ts) => {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / dur);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    t0 = setTimeout(() => { raf.current = requestAnimationFrame(step); }, delay);
    return () => { clearTimeout(t0); cancelAnimationFrame(raf.current); };
  }, [to, delay, dur]);
  return <span className="num">{f(v)}</span>;
}

/** Variación frente al periodo anterior. */
export function Delta({ a, b, unit = ' pts', dec = 1, invert, label }) {
  const d = a - b; const flat = Math.abs(d) < Math.pow(10, -dec) / 2;
  const good = invert ? d < 0 : d > 0;
  const cls = flat ? 'is-flat' : good ? 'is-up' : 'is-down';
  return (
    <span className={'jt-delta ' + cls}>
      {!flat && <svg viewBox="0 0 10 10" aria-hidden="true"><path d={d > 0 ? 'M5 1.5 9 8H1z' : 'M5 8.5 1 2h8z'} /></svg>}
      <span className="num">{flat ? 'Sin variación' : (d > 0 ? '+' : '−') + fmt(Math.abs(d), dec) + unit}</span>
      {label && <em>{label}</em>}
    </span>
  );
}

/** Motivo de marca: anillos concéntricos con arcos verde y cian. */
export function Rings({ className = '', spin = true }) {
  return (
    <svg className={'jt-rings ' + className + (spin ? ' spin' : '')} viewBox="0 0 600 600" aria-hidden="true">
      {[290, 236, 182, 128, 74].map((r, i) => <circle key={r} className="rl" cx="300" cy="300" r={r} style={{ '--i': i }} />)}
      <circle className="arc-c" cx="300" cy="300" r="236" strokeDasharray="260 1223" />
      <circle className="arc-g" cx="300" cy="300" r="128" strokeDasharray="150 654" strokeDashoffset="-330" />
      <circle className="arc-c2" cx="300" cy="300" r="182" strokeDasharray="90 1054" strokeDashoffset="-600" />
      <circle className="node c" cx="503" cy="178" r="7" /><circle className="node g" cx="190" cy="408" r="6" /><circle className="node" cx="300" cy="64" r="4" />
    </svg>
  );
}

/** Retícula de puntos de fondo. */
export function Dots({ id = 'jt-dots' }) {
  return (
    <svg className="jt-dots" aria-hidden="true">
      <defs><pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" /></pattern></defs>
      <rect width="100%" height="100%" fill={'url(#' + id + ')'} />
    </svg>
  );
}

/** Indicador de 270 grados. Escala de `min` a `max`, como el tablero (80 a 100). */
export function Gauge({ v, min = 80, max = 100, size = 420 }) {
  const h = size / 2, r = h - 30, c = 2 * Math.PI * r, arc = c * 0.75;
  const frac = Math.max(0, Math.min(1, (v - min) / (max - min)));
  const ticks = [];
  for (let i = 0; i <= 20; i++) {
    const ang = (135 + i * 13.5) * Math.PI / 180, major = i % 5 === 0;
    const r1 = r + 20, r2 = r + (major ? 30 : 25);
    ticks.push(<line key={i} className={major ? 'mj' : ''} x1={h + r1 * Math.cos(ang)} y1={h + r1 * Math.sin(ang)} x2={h + r2 * Math.cos(ang)} y2={h + r2 * Math.sin(ang)} />);
  }
  const lab = (val, i) => { const ang = (135 + i * 67.5) * Math.PI / 180; const rr = r - 34; return <text key={val} x={h + rr * Math.cos(ang)} y={h + rr * Math.sin(ang) + 5} textAnchor="middle">{val}</text>; };
  const endAng = (135 + frac * 270) * Math.PI / 180;
  return (
    <svg className="jt-gauge" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <defs>
        <linearGradient id="jt-gg" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#048C38" /><stop offset="1" stopColor="#21BBEA" /></linearGradient>
      </defs>
      <g className="tk">{ticks}</g>
      <circle className="track" cx={h} cy={h} r={r} strokeDasharray={`${arc} ${c}`} transform={`rotate(135 ${h} ${h})`} />
      <circle className="fill" cx={h} cy={h} r={r} stroke="url(#jt-gg)" style={{ '--len': arc * frac, '--c': c }} transform={`rotate(135 ${h} ${h})`} />
      <circle className="knob" cx={h + r * Math.cos(endAng)} cy={h + r * Math.sin(endAng)} r="11" />
      <g className="lb">{[min, min + (max - min) / 4, min + (max - min) / 2, min + 3 * (max - min) / 4, max].map((val, i) => lab(val, i))}</g>
    </svg>
  );
}

/** Anillo pequeño de avance (0 a 100). */
export function MiniRing({ v, min = 0, max = 100, size = 96, stroke = 8, cls = '' }) {
  const h = size / 2, r = h - stroke, c = 2 * Math.PI * r, frac = Math.max(0, Math.min(1, (v - min) / (max - min)));
  return (
    <svg className={'jt-mring ' + cls} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle className="t" cx={h} cy={h} r={r} strokeWidth={stroke} />
      <circle className="f" cx={h} cy={h} r={r} strokeWidth={stroke} style={{ '--len': c * frac, '--c': c }} transform={`rotate(-90 ${h} ${h})`} />
    </svg>
  );
}

/** Gráfico de líneas del cumplimiento mensual con área, línea de ANS y meta. */
export function TrendChart({ data, target, lo = 86, hi = 100 }) {
  const W = 1100, H = 420, pl = 56, pr = 56, pt = 28, pb = 52;
  const x = (i) => pl + (i * (W - pl - pr)) / (data.length - 1);
  const y = (v) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const line = (k) => data.map((d, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(d[k]).toFixed(1)).join(' ');
  const area = line('comp') + ` L${x(data.length - 1)} ${H - pb} L${x(0)} ${H - pb} Z`;
  const grid = []; for (let v = lo; v <= hi; v += 2) grid.push(v);
  const last = data[data.length - 1];
  return (
    <svg className="jt-trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Cumplimiento mensual">
      <defs>
        <linearGradient id="jt-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#048C38" stopOpacity=".42" /><stop offset="1" stopColor="#048C38" stopOpacity="0" /></linearGradient>
      </defs>
      {grid.map((v) => <g key={v} className="gr"><line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} /><text x={pl - 14} y={y(v) + 5} textAnchor="end">{v}</text></g>)}
      <path className="area" d={area} fill="url(#jt-area)" />
      <line className="target" x1={pl} x2={W - pr} y1={y(target)} y2={y(target)} pathLength="1" />
      <text className="target-l" x={pl + 10} y={y(target) - 10}>Meta {target} %</text>
      <path className="ln ans jt-draw" d={line('ans')} pathLength="1" style={{ '--dl': '0.5s' }} />
      <path className="ln comp jt-draw" d={line('comp')} pathLength="1" style={{ '--dl': '0.2s' }} />
      {data.map((d, i) => (
        <g key={i} className="pt" style={{ '--i': i }}>
          <circle className={'dot' + (d.partial ? ' partial' : '')} cx={x(i)} cy={y(d.comp)} r={i === data.length - 1 ? 8 : 5} />
          <text className="xl" x={x(i)} y={H - pb + 30} textAnchor="middle">{d.label}{i === 0 || d.label === 'ene' ? ' ' + String(d.year).slice(2) : ''}</text>
        </g>
      ))}
      <g className="callout" transform={`translate(${x(data.length - 1)} ${y(last.comp) + 22})`}>
        <rect x="-44" y="0" width="88" height="34" rx="9" />
        <text y="23" textAnchor="middle">{fmt(last.comp, 1)} %</text>
      </g>
    </svg>
  );
}
