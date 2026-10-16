// Modo Comité: presentación ejecutiva a pantalla completa (fuera del Shell).
// Lienzo de diseño mínimo de 1280 x 800 escalado al tamaño de la pantalla.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { useApi, useModuleData } from '../hooks/useApi.js';
import { buildCommittee } from './junta/data.js';
import { SLIDES } from './junta/Slides.jsx';
import { Dots, reducedMotion } from './junta/parts.jsx';
import './junta/junta.css';

const AUTO_MS = 12000;
const IDLE_MS = 2800;
const BASE_W = 1280, BASE_H = 800, NARROW_W = 960;

function useStageSize() {
  const get = () => {
    const vw = window.innerWidth, vh = window.innerHeight;
    // En vertical (tableta) el lienzo es más angosto y las cuadrículas se apilan.
    const narrow = vw / vh < 1.1;
    const s = narrow ? vw / NARROW_W : Math.min(vw / BASE_W, vh / BASE_H);
    return { s, w: vw / s, h: vh / s, narrow };
  };
  const [size, setSize] = useState(get);
  useEffect(() => {
    const on = () => setSize(get());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return size;
}

const Svg = ({ d, children }) => <svg viewBox="0 0 24 24" aria-hidden="true">{d ? <path d={d} /> : children}</svg>;

export default function Junta() {
  const app = useApp();
  const { go } = app;
  const inicio = useModuleData('inicio');
  const traza = useApi('/api/traza');
  const C = useMemo(() => buildCommittee(app, inicio.data, traza.data), [app, inicio.data, traza.data]);

  const [idx, setIdx] = useState(0);
  const [prev, setPrev] = useState(null);
  const [dir, setDir] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [idle, setIdle] = useState(false);
  const [fs, setFs] = useState(false);
  const size = useStageSize();
  const n = SLIDES.length;
  const elapsed = useRef(0);
  const fillRef = useRef(null);
  const leaveT = useRef();
  const idleT = useRef();
  const rootRef = useRef(null);

  const idxRef = useRef(0);
  const goTo = useCallback((i) => {
    const cur = idxRef.current, nx = Math.max(0, Math.min(n - 1, i));
    if (nx === cur) return;
    idxRef.current = nx;
    elapsed.current = 0;
    setDir(nx > cur ? 1 : -1);
    setPrev(cur);
    setIdx(nx);
    clearTimeout(leaveT.current);
    leaveT.current = setTimeout(() => setPrev(null), reducedMotion() ? 0 : 750);
  }, [n]);
  const next = useCallback(() => goTo(idxRef.current + 1), [goTo]);
  const back = useCallback(() => goTo(idxRef.current - 1), [goTo]);

  const toggleFs = useCallback(() => {
    const el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }, []);
  const exit = useCallback(() => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); go('inicio'); }, [go]);

  /* Teclado. */
  useEffect(() => {
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key;
      if (k === 'ArrowRight' || k === 'PageDown' || k === ' ' || k === 'Spacebar') { e.preventDefault(); next(); }
      else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); back(); }
      else if (k === 'Home') { e.preventDefault(); goTo(0); }
      else if (k === 'End') { e.preventDefault(); goTo(n - 1); }
      else if (k === 'f' || k === 'F') { e.preventDefault(); toggleFs(); }
      else if (k === 'p' || k === 'P') { e.preventDefault(); setPlaying((p) => !p); }
      else if (k === 'Escape') { if (!document.fullscreenElement) exit(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back, goTo, toggleFs, exit, n]);

  /* Pantalla completa. */
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);

  /* Avance automático: el segmento activo de la barra se llena en 12 s. */
  useEffect(() => {
    const paint = () => { if (fillRef.current) fillRef.current.style.transform = 'scaleX(' + Math.min(1, elapsed.current / AUTO_MS) + ')'; };
    paint();
    if (!playing) return undefined;
    let last = performance.now(), raf;
    const tick = (t) => {
      elapsed.current += t - last; last = t; paint();
      if (elapsed.current >= AUTO_MS) {
        elapsed.current = 0;
        if (idx >= n - 1) { setPlaying(false); return; }
        goTo(idx + 1); return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, idx, n, goTo]);

  /* Controles que se ocultan tras unos segundos sin actividad. */
  useEffect(() => {
    const wake = () => { setIdle(false); clearTimeout(idleT.current); idleT.current = setTimeout(() => setIdle(true), IDLE_MS); };
    wake();
    const evs = ['mousemove', 'pointerdown', 'touchstart'];
    evs.forEach((e) => window.addEventListener(e, wake, { passive: true }));
    return () => { evs.forEach((e) => window.removeEventListener(e, wake)); clearTimeout(idleT.current); };
  }, []);

  /* Gesto de deslizar en tabletas. */
  useEffect(() => {
    let x0 = null, y0 = null;
    const st = (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; };
    const en = (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? next : back)();
      x0 = null;
    };
    window.addEventListener('touchstart', st, { passive: true });
    window.addEventListener('touchend', en, { passive: true });
    return () => { window.removeEventListener('touchstart', st); window.removeEventListener('touchend', en); };
  }, [next, back]);

  useEffect(() => () => clearTimeout(leaveT.current), []);
  useEffect(() => { const t = document.title; document.title = 'Modo Comité · COI'; return () => { document.title = t; }; }, []);

  const render = (i, cls) => {
    const [title, Comp] = SLIDES[i];
    return (
      <section key={i} className={'jt-slide ' + cls + (i === 0 ? ' is-cover' : '')} aria-hidden={cls !== 'is-in'} aria-roledescription="diapositiva" aria-label={(i + 1) + ' de ' + n + ': ' + title}>
        <Comp C={C} app={app} />
      </section>
    );
  };

  return (
    <div ref={rootRef} className={'jt-root' + (size.narrow ? ' is-narrow' : '') + (idle ? ' is-idle' : '') + (dir < 0 ? ' dir-back' : '')} role="region" aria-label="Modo Comité">
      <div className="jt-canvas" style={{ width: size.w, height: size.h, transform: 'scale(' + size.s + ')' }}>
        <div className="jt-bg"><Dots /><span className="jt-g1" /><span className="jt-g2" /></div>
        {idx !== 0 && idx !== n - 1 && (
          <div className="jt-top">
            <span className="jt-top-l"><b>COI</b>Informe al Comité de Accionistas · {C.period.label}</span>
            <span className="jt-top-r">Reval S.A.S. · Multipagas S.A.S.</span>
          </div>
        )}
        {prev !== null && render(prev, 'is-out')}
        {render(idx, 'is-in')}
      </div>

      <nav className="jt-prog" aria-label="Diapositivas">
        {SLIDES.map((s, i) => (
          <button key={i} className={i < idx ? 'past' : i === idx ? 'cur' : ''} onClick={() => goTo(i)} aria-label={'Ir a ' + s[0]} aria-current={i === idx ? 'step' : undefined}>
            <span className="jt-tip">{String(i + 1).padStart(2, '0')} · {s[0]}</span>
            <i ref={i === idx ? fillRef : undefined} className={i === idx ? 'fill' + (playing ? ' run' : '') : ''} />
          </button>
        ))}
      </nav>

      <div className="jt-ctrl" role="toolbar" aria-label="Controles de la presentación">
        <button onClick={exit} className="jt-btn txt" title="Salir (Esc)"><Svg d="M15 6 9 12l6 6" /><span>Salir</span></button>
        <span className="jt-ctrl-t">{SLIDES[idx][0]}</span>
        <div className="jt-ctrl-c">
          <button onClick={back} className="jt-btn" disabled={idx === 0} aria-label="Anterior"><Svg d="M15 6 9 12l6 6" /></button>
          <span className="jt-count num" aria-live="polite"><b>{String(idx + 1).padStart(2, '0')}</b> / {String(n).padStart(2, '0')}</span>
          <button onClick={next} className="jt-btn" disabled={idx === n - 1} aria-label="Siguiente"><Svg d="m9 6 6 6-6 6" /></button>
        </div>
        <button onClick={() => setPlaying((p) => !p)} className={'jt-btn' + (playing ? ' on' : '')} aria-label={playing ? 'Pausar avance automático' : 'Avance automático'} title={playing ? 'Pausar (P)' : 'Avance automático cada 12 s (P)'}>
          {playing ? <Svg><path d="M9 6v12M15 6v12" /></Svg> : <Svg><path d="M8 5.5v13l10.5-6.5z" /></Svg>}
        </button>
        <button onClick={toggleFs} className="jt-btn" aria-label={fs ? 'Salir de pantalla completa' : 'Pantalla completa'} title="Pantalla completa (F)">
          {fs ? <Svg d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <Svg d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
        </button>
      </div>
    </div>
  );
}
