// Cliente 360: espacio de trabajo de un cliente con datos reales (Directorio Nacional, Granja de
// usuarios, Control de Arqueos) y su acuerdo y operación del catálogo, más su módulo especializado.
import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import CountUp from '../components/CountUp.jsx';
import { useApp } from '../context/AppContext.jsx';
import { CLIENTE } from '../lib/clientes.js';
import { fmt } from '../lib/format.js';
import Clientes from './Clientes.jsx';
import Acuerdo, { useCatalogo } from './cliente360/Acuerdo.jsx';
import ArqueosC from './cliente360/ArqueosC.jsx';
import Modulo from './cliente360/Modulo.jsx';
import Personal from './cliente360/Personal.jsx';
import Red from './cliente360/Red.jsx';
import Resumen from './cliente360/Resumen.jsx';
import { mesLargo, mono, Ring, Skel, useC360 } from './cliente360/shared.jsx';

const TAB_KEY = 'coi.c360.tab';

export default function Cliente({ sub: k }) {
  const c = CLIENTE[k];
  if (!c) return <Clientes />;
  return <Workspace key={k} c={c} />;
}

function Workspace({ c }) {
  const cat = useCatalogo(c.key);
  const { data: d, error, reload } = useC360('cliente360', c.real, c.key);
  const tabs = useMemo(() => {
    if (!d) return [];
    const t = [['resumen', 'Resumen', 'chart']];
    if (d.tieneRed) t.push(['red', 'Red de oficinas', 'building', d.oficinas.length], ['personal', 'Personal', 'users', d.personal.total], ['arqueos', 'Arqueos', 'filecheck', d.arqueos.pendientes.length || null]);
    else if (d.red && d.red.puntos) t.push(['red', 'Red de atención', 'store', d.red.puntos]);
    if (cat || d.ans.length) t.push(['acuerdo', 'Acuerdo y operación', 'shield']);
    if (c.modulo) t.push(['modulo', c.modulo.nombre, 'layers']);
    return t;
  }, [d, cat, c]);
  const [tab, setTabState] = useState(() => { try { const s = JSON.parse(sessionStorage.getItem(TAB_KEY) || '{}'); return s[c.key] || 'resumen'; } catch { return 'resumen'; } });
  const setTab = (t) => {
    setTabState(t);
    try { const s = JSON.parse(sessionStorage.getItem(TAB_KEY) || '{}'); s[c.key] = t; sessionStorage.setItem(TAB_KEY, JSON.stringify(s)); } catch { /* sin almacenamiento */ }
  };
  useEffect(() => { if (tabs.length && !tabs.some((t) => t[0] === tab)) setTabState('resumen'); }, [tabs, tab]);

  return (
    <div className="c360">
      <Hero c={c} d={d} cat={cat} onReload={reload} />
      {error ? (
        <div className="card c360-card c360-error"><Icon name="alert" /><div><b>No se pudieron cargar los datos reales del cliente.</b><p className="small muted">{error.message}</p></div><button type="button" className="btn btn-o btn-sm" onClick={reload}>Reintentar</button></div>
      ) : !d ? <Skel hero={false} /> : (
        <>
          <nav className="c360-tabs" role="tablist" aria-label={'Secciones de ' + c.nombre}>
            {tabs.map((t) => (
              <button key={t[0]} type="button" role="tab" aria-selected={tab === t[0]} className={tab === t[0] ? 'on' : ''} onClick={() => setTab(t[0])}>
                <Icon name={t[2]} /><span>{t[1]}</span>{t[3] ? <em className="num">{fmt(t[3])}</em> : null}
              </button>
            ))}
          </nav>
          <div className="c360-panel view-enter" key={tab} role="tabpanel">
            {tab === 'resumen' && <Resumen c={c} d={d} cat={cat} setTab={setTab} />}
            {tab === 'red' && <Red c={c} d={d} />}
            {tab === 'personal' && d.tieneRed && <Personal c={c} d={d} />}
            {tab === 'arqueos' && d.tieneRed && <ArqueosC c={c} d={d} />}
            {tab === 'acuerdo' && <Acuerdo c={c} k={c.key} cat={cat} ans={d.ans} />}
            {tab === 'modulo' && c.modulo && <Modulo c={c} />}
          </div>
          <p className="c360-src small muted"><Icon name="clock" />Datos reales de los Sheets (Directorio Nacional, Granja de usuarios, Control de Arqueos) consolidados a las {new Date(d.generado).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })} · mes en curso: {mesLargo(d.mes)}</p>
        </>
      )}
    </div>
  );
}

function Hero({ c, d, cat, onReload }) {
  const { go } = useApp();
  const k = d && d.kpis;
  const sub = !d ? 'Consolidando datos reales del cliente…'
    : k ? fmt(k.oficinas) + ' oficinas en ' + fmt(k.municipios) + ' municipios de ' + fmt(k.departamentos) + ' departamentos · ' + fmt(k.personas) + ' personas en la Granja'
      : d.red && d.red.puntos ? 'Sin oficinas dedicadas · ' + fmt(d.red.puntos) + ' puntos de la red habilitados en ' + fmt(d.red.departamentos) + ' departamentos'
        : 'Sin red de oficinas registrada en el Directorio Nacional';
  const figs = [];
  if (d && k) {
    figs.push(['Oficinas', fmt(k.oficinas)], ['Personas', fmt(k.personas)], ['Backups', fmt(k.backups)]);
  } else if (d && d.red && d.red.puntos) {
    figs.push(['Puntos habilitados', fmt(d.red.puntos)], ['Municipios', fmt(d.red.municipios)]);
  }
  if (cat) figs.push(['Servicios en COI', fmt(cat.lista.length)]);
  return (
    <section className="c360-hero">
      <div className="c360-hero-top">
        <button type="button" className="c360-crumb" onClick={() => go('clientes')}><Icon name="back" />Clientes</button>
        <span className="c360-crumb-sep">/</span><span className="c360-crumb-cur">{c.segmento}</span>
      </div>
      <div className="c360-hero-main">
        <span className="c360-mono lg" aria-hidden="true">{mono(c.nombre)}</span>
        <div className="c360-hero-t">
          <h1>{c.nombre}</h1>
          <p>{sub}</p>
          <div className="c360-hero-chips">
            <span className="c360-hchip">{c.segmento}</span>
            {c.real && <span className="c360-hchip">Directorio: {c.real}</span>}
            {c.modulo && <span className="c360-hchip cy"><Icon name="layers" />{c.modulo.nombre}</span>}
            <span className="c360-hchip live"><i />Datos reales</span>
          </div>
        </div>
        {k && k.pctMes !== null && d.arqueos.totalesMes.oficinas > 0 && (
          <div className="c360-hero-ring"><Ring v={k.pctMes} size={92} stroke={9} light /><small>Arqueos de {mesLargo(d.mes).split(' ')[0]}</small></div>
        )}
      </div>
      <div className="c360-hero-foot">
        <div className="c360-figs">
          {d ? figs.map((f) => <div key={f[0]}><b className="num"><CountUp value={f[1]} /></b><span>{f[0]}</span></div>) : [0, 1, 2].map((i) => <div key={i} className="sk-dark" />)}
        </div>
        <div className="c360-hero-act">
          <button type="button" className="btn c360-btn-light btn-ic" onClick={onReload} title="Actualizar datos" aria-label="Actualizar datos"><Icon name="activity" /></button>
        </div>
      </div>
    </section>
  );
}
