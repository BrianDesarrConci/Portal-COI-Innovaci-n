import { useEffect, useRef, useState } from 'react';

const prefersReduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Símbolo de producto COI: anillos concéntricos con arcos verde y cian (motivo existente). */
export function CoiMark({ size = 40, className = '' }) {
  return (
    <svg className={'lx-mark ' + className} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="13.5" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="1.5" />
      <circle className="lx-mark-c" cx="24" cy="24" r="21" fill="none" stroke="#21BBEA" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="34 98" transform="rotate(-120 24 24)" />
      <circle className="lx-mark-g" cx="24" cy="24" r="13.5" fill="none" stroke="#048C38" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="22 63" transform="rotate(40 24 24)" />
      <circle cx="24" cy="24" r="4.2" fill="currentColor" />
    </svg>
  );
}

const fmt = (v, decimals) => v.toLocaleString('es-CO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** Cifra con conteo ascendente al cargar. El valor final se anuncia una sola vez a lectores de pantalla. */
function CountUp({ to, decimals = 0, suffix = '', delay = 0, duration = 1600 }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (prefersReduced()) { el.textContent = fmt(to, decimals) + suffix; return undefined; }
    let raf = 0; let t0 = 0;
    const tick = (now) => {
      if (!t0) t0 = now;
      const k = Math.min(1, Math.max(0, (now - t0 - delay) / duration));
      const e = 1 - (1 - k) ** 4;
      el.textContent = fmt(to * e, decimals) + suffix;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, decimals, suffix, delay, duration]);
  return <span ref={ref} aria-hidden="true">{fmt(0, decimals) + suffix}</span>;
}

const STATS = [
  { to: 16, label: 'clientes', sr: '16 clientes' },
  { to: 104, label: 'actividades', sr: '104 actividades' },
  { to: 99, decimals: 1, suffix: ' %', label: 'ANS cumplido', sr: '99,0 % de ANS cumplido', accent: true },
  { to: 11, label: 'procesos automatizados', sr: '11 procesos automatizados' },
];

export function Counters() {
  return (
    <dl className="lx-stats">
      {STATS.map((s, i) => (
        <div key={s.label} className={'lx-stat' + (s.accent ? ' accent' : '')}>
          <dt className="lx-stat-l">{s.label}</dt>
          <dd className="lx-stat-v num">
            <span className="lx-sr">{s.sr}</span>
            <CountUp to={s.to} decimals={s.decimals || 0} suffix={s.suffix || ''} delay={250 + i * 140} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

const NB = ' ';
const EVENTS = [
  { t: `11:00${NB}a.${NB}m.`, m: 'Soportes BBVA validados', k: 'g' },
  { t: `10:46${NB}a.${NB}m.`, m: 'Provisiones Fincomercio conciliadas', k: 'c' },
  { t: `10:32${NB}a.${NB}m.`, m: 'Reporte de ANS Davivienda enviado', k: 'g' },
  { t: `10:18${NB}a.${NB}m.`, m: 'Validación documental Protección completada', k: 'c' },
  { t: `9:55${NB}a.${NB}m.`, m: 'Alerta de efectivo Banco Agrario atendida', k: 'g' },
  { t: `6:00${NB}p.${NB}m.`, m: 'Cierre de la última oficina programado', k: 'c' },
];

/** Cinta de eventos operativos que rota. Decorativa para lectores de pantalla (no interrumpe). */
export function Ticker() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (prefersReduced()) return undefined;
    let id = 0;
    const run = () => { id = window.setInterval(() => setI((v) => (v + 1) % EVENTS.length), 3400); };
    const onVis = () => { window.clearInterval(id); if (!document.hidden) run(); };
    run();
    document.addEventListener('visibilitychange', onVis);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, []);
  const e = EVENTS[i];
  return (
    <div className="lx-ticker" aria-label="Actividad operativa reciente">
      <span className="lx-live"><span className="lx-live-dot" aria-hidden="true" />En vivo</span>
      <span className="lx-ticker-win">
        <span key={i} className="lx-ticker-item">
          <span className={'lx-tk-k ' + e.k} aria-hidden="true" />
          <time className="num">{e.t}</time>
          <span className="lx-tk-m">{e.m}</span>
        </span>
      </span>
    </div>
  );
}
