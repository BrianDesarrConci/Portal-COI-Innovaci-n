// Centro de captura (COI V1, sección "negocio"): acceso a Auditorías Fincomercio y Control de
// Apertura, que son otras aplicaciones de Apps Script embebidas por iframe (centrodecaptura.html).
import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { V1Bar, V1Guard } from './V1Session.jsx';
import { V1Hero, PIcon } from './portal/kit.jsx';

const APPS = {
  fincomercio: {
    v1: 'auditorias-fincomercio', title: 'Auditorías Fincomercio', short: 'Fincomercio', icon: 'clipboard', color: '#21BBEA',
    desc: 'Plataforma de auditorías Fincomercio: registro y seguimiento de las visitas de auditoría a los puntos del cliente.',
    url: 'https://script.google.com/macros/s/AKfycbyJbcEqPE6YDsZ-lNjRHuHzg0oAs6x0Z3lyeClEJZ9GtaU3QTdC6srRsrM18GJZzXfVGg/exec',
    feats: ['Formularios de auditoría por punto', 'Hallazgos y evidencias', 'Consolidado para el cliente']
  },
  apertura: {
    v1: 'control-apertura', title: 'Control de Apertura', short: 'Control de Apertura', icon: 'rocket', color: '#6C74A8',
    desc: 'Plataforma de Control de Apertura: verificación diaria de la apertura de oficinas y su reporte.',
    url: 'https://script.google.com/macros/s/AKfycbyi-eDnjoVT2IBqM9_9JJFHYiq1J3qwWv_1XC_stc6JWkWYgqIKW5DlQ700joLmiPz8/exec',
    feats: ['Registro de apertura por oficina', 'Novedades de apertura', 'Seguimiento en tiempo real']
  }
};

export default function Captura({ sub }) {
  return (<><V1Bar /><V1Guard modulo="centro">{APPS[sub] ? <Embebida id={sub} app={APPS[sub]} /> : <Hub />}</V1Guard></>);
}

function Hub() {
  const { go } = useApp();
  return (
    <div className="v1p">
      <V1Hero eyebrow="COI V1 · Negocios" icon="inbox" title="Centro de captura" tone="green"
        sub="Gestión integral y automatización de los procesos del negocio. Cada aplicación corre en Apps Script y se abre dentro de COI con su sesión corporativa de Google." />
      <div className="v1p-apps mt">
        {Object.entries(APPS).map(([k, a]) => (
          <button key={k} type="button" className="card v1p-app" style={{ '--c': a.color }} onClick={() => go('captura/' + k)}>
            <span className="v1p-app-ic"><PIcon name={a.icon} /></span>
            <span className="v1p-app-tag">Apps Script · embebido</span>
            <h3>{a.title}</h3>
            <p>{a.desc}</p>
            <ul>{a.feats.map((f) => <li key={f}><Icon name="check" />{f}</li>)}</ul>
            <span className="v1p-app-go">Abrir aplicación<Icon name="chevron" /></span>
          </button>
        ))}
        <div className="card v1p-app soon">
          <span className="v1p-app-ic"><PIcon name="plus" /></span>
          <span className="v1p-app-tag">Próximamente</span>
          <h3>Nuevas capturas</h3>
          <p>Los próximos formularios del negocio se publicarán aquí con el mismo acceso único.</p>
        </div>
      </div>
      <div className="card v1p-note-card mt">
        <Icon name="lock" />
        <div><b>Requiere sesión corporativa de Google</b><p>Las aplicaciones se sirven desde script.google.com. Si el navegador no tiene una sesión activa de la cuenta corporativa (@reval.com.co o @multival.com.co), Google pedirá iniciarla o bloqueará el marco; en ese caso use «Abrir en pestaña nueva».</p></div>
      </div>
    </div>
  );
}

function Embebida({ id, app }) {
  const { go } = useApp();
  const [estado, setEstado] = useState('cargando');
  const [n, setN] = useState(0);
  const timer = useRef(null);
  useEffect(() => {
    setEstado('cargando');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setEstado((s) => (s === 'cargando' ? 'lento' : s)), 9000);
    return () => clearTimeout(timer.current);
  }, [n, id]);
  return (
    <div className="v1p">
      <div className="v1p-crumb">
        <button type="button" className="btn btn-g btn-sm" onClick={() => go('captura')}><Icon name="back" />Centro de captura</button>
        <span>/</span><b>{app.title}</b>
      </div>
      <section className="card v1p-frame">
        <header className="v1p-frame-h" style={{ '--c': app.color }}>
          <span className="v1p-app-ic sm"><PIcon name={app.icon} /></span>
          <div className="grow">
            <h3>{app.title}</h3>
            <small><Icon name="lock" />script.google.com · sección «{app.v1}» de COI V1</small>
          </div>
          <span className={'v1p-frame-st ' + estado}>{estado === 'listo' ? 'Marco cargado' : estado === 'lento' ? 'Sin respuesta' : 'Cargando…'}</span>
          <button type="button" className="btn btn-o btn-sm" onClick={() => setN((x) => x + 1)} title="Recargar"><PIcon name="refresh" /><span className="v1p-hide-sm">Recargar</span></button>
          <a className="btn btn-p btn-sm" href={app.url} target="_blank" rel="noopener noreferrer"><PIcon name="external" /><span className="v1p-hide-sm">Abrir en pestaña nueva</span></a>
        </header>
        <div className="v1p-frame-hint"><Icon name="alert" /><span>¿El marco aparece vacío o pide iniciar sesión? Google exige la sesión corporativa en este navegador: use «Abrir en pestaña nueva», inicie sesión y pulse «Recargar».</span></div>
        <div className="v1p-frame-b">
          {estado !== 'listo' && (
            <div className={'v1p-frame-load' + (estado === 'lento' ? ' slow' : '')}>
              {estado === 'lento' ? (
                <>
                  <span className="v1p-frame-load-ic"><Icon name="lock" /></span>
                  <b>La aplicación no respondió dentro de COI</b>
                  <p>Requiere una sesión corporativa de Google activa en este navegador. Ábrala en una pestaña nueva para iniciar sesión y vuelva a cargar.</p>
                  <div className="v1p-ok-act"><a className="btn btn-p" href={app.url} target="_blank" rel="noopener noreferrer"><PIcon name="external" />Abrir en pestaña nueva</a><button type="button" className="btn btn-o" onClick={() => setN((x) => x + 1)}><PIcon name="refresh" />Reintentar</button></div>
                </>
              ) : (
                <><span className="v1p-spin lg" /><b>Conectando con {app.short}…</b><p>Se usa su sesión corporativa de Google.</p></>
              )}
            </div>
          )}
          <iframe key={n} title={app.title} src={app.url} onLoad={() => setEstado('listo')} allow="clipboard-write" referrerPolicy="no-referrer-when-downgrade" />
        </div>
      </section>
    </div>
  );
}
