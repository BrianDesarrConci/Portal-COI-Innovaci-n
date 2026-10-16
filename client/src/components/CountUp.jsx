import { useEffect, useRef, useState } from 'react';

const reduce = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Anima la parte numérica de un valor ya formateado en es-CO ("1.262", "98,6 %", "$ 4.210").
 * Conserva prefijo, sufijo y número de decimales. Si no hay número, lo muestra tal cual.
 */
export default function CountUp({ value, duration = 900 }) {
  const isText = typeof value === 'string' || typeof value === 'number';
  const text = String(value ?? '');
  const m = isText && text.match(/^(\D*?)(-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?)(.*)$/s);
  const target = m ? parseFloat(m[2].replace(/\./g, '').replace(',', '.')) : null;
  const decimals = m && m[2].includes(',') ? m[2].split(',')[1].length : 0;
  const [shown, setShown] = useState(() => (target === null || reduce() ? target : 0));
  const prev = useRef(0);

  useEffect(() => {
    if (target === null || reduce()) { setShown(target); return undefined; }
    const from = prev.current; const start = performance.now(); let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(from + (target - from) * e);
      if (p < 1) raf = requestAnimationFrame(tick); else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  if (!isText) return value;
  if (target === null) return text;
  const n = Number(shown).toLocaleString('es-CO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return <>{m[1]}{n}{m[3]}</>;
}
