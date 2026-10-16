// Barra de cliente en contexto (se muestra al entrar a un módulo desde la ficha de un cliente)
// y resaltado de los registros de ese cliente dentro de la vista (highlightClient del demo).
import { useEffect, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useApp } from '../context/AppContext.jsx';
import { MODULES } from '../lib/nav.js';
import { CLIENT_ALIAS, clientMono } from './monitoreo/clientModules.jsx';

const HL_SEL = 'tbody tr, .list-row, .doc, .kcard, .office, .att';

export default function ClientCtxBar({ view }) {
  const { acts, clients, ctxClient: k, setCtxClient, go } = useApp();
  const barRef = useRef(null);
  const [count, setCount] = useState(0);
  const active = !!(k && clients[k]);

  useEffect(() => {
    if (!active) return undefined;
    const content = barRef.current && barRef.current.closest('.content');
    if (!content) return undefined;
    const keys = (CLIENT_ALIAS[k] || [clients[k].name]).map((s) => s.toLowerCase());
    const match = (el) => { const t = el.textContent.toLowerCase(); return keys.some((s) => t.indexOf(s) >= 0); };
    let tabDone = false;
    const apply = () => {
      // Abre la primera pestaña que mencione al cliente (una sola vez por vista).
      if (!tabDone) {
        const tb = Array.from(content.querySelectorAll('.tabs button')).find(match);
        if (tb) { tabDone = true; if (!tb.classList.contains('on')) tb.click(); }
      }
      let n = 0;
      content.querySelectorAll(HL_SEL).forEach((el) => { if (barRef.current && barRef.current.contains(el)) return; if (match(el)) { el.classList.add('hl'); n++; } });
      setCount(n);
    };
    apply();
    // Las vistas pueden pintar sus datos después (carga del API, pestañas): se vuelve a resaltar.
    let raf = 0;
    const obs = new MutationObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(apply); });
    obs.observe(content, { childList: true, subtree: true });
    return () => { obs.disconnect(); cancelAnimationFrame(raf); content.querySelectorAll('.hl').forEach((el) => el.classList.remove('hl')); };
  }, [active, k, view, clients]);

  if (!active) return null;
  const code = (MODULES.find((m) => m[0] === view) || [])[1];
  const items = acts.filter((x) => x.c.indexOf(k) >= 0 && (x.m === code || (view === 'analista' && x.m === 'Se mantiene')));
  return (
    <div className="ctx-bar" ref={barRef}>
      <span className="cl-mono">{clientMono(clients[k].name)}</span>
      <div className="grow">
        <div className="strong">Gestionando a {clients[k].name}</div>
        <div className="small muted">{items.length ? items.length + (items.length === 1 ? ' actividad' : ' actividades') + ' de este cliente en el módulo: ' + items.map((x) => x.d.split(':')[0].split(';')[0]).join('; ') : 'Información del cliente resaltada en el módulo'}</div>
      </div>
      <span className="small muted" id="ctx-count">{count ? count + ' registros resaltados' : ''}</span>
      <button className="btn btn-o btn-sm" onClick={() => go('cliente/' + k)}><Icon name="back" />Volver al expediente</button>
      <button className="btn btn-g btn-sm" aria-label="Quitar filtro de cliente" onClick={() => setCtxClient(null)}><Icon name="x" /></button>
    </div>
  );
}
