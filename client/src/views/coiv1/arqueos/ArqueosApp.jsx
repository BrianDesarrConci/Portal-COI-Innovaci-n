// Control de Arqueos (COI V1) dentro del portal: acceso embebido, navegación por rol,
// alertas persistentes de novedades y enrutamiento de pestañas. Portado de app.decodificado.js
// (validarEmbebido → iniciarApp → construirNav / irA / cargarPendientes).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../components/Icon.jsx';
import { useApp } from '../../../context/AppContext.jsx';
import { gas } from '../../../lib/gas.js';
import { useV1 } from '../V1Session.jsx';
import { AqCtx, AqModal, Spinner, ErrorBox, Chip, invalidarFront, mesLocal } from './shared.jsx';
import { ArqueoModal, NormalizarBody, PendientesBody } from './Gestion.jsx';
import Cargar from './Cargar.jsx';
import Historial, { HIST_STATE } from './Historial.jsx';
import Normalizaciones from './Normalizaciones.jsx';
import { DashboardTab, LideresTab, NovedadesTab, ClientesTab, RegionalTab, AnaliticaTab, TendenciasTab } from './dash/index.js';
import './arqueos.css';

/**
 * Estado que sobrevive al cambio de pestaña. El portal vuelve a montar la vista con cada ruta
 * (/arqueos/:sub), así que la sesión validada, los pendientes y la memoria de consultas viven aquí.
 */
const STORE = { key: '', user: null, pend: null, modalVisto: {}, tipologias: null };

const TABS = {
  Lider: [
    ['cargar', 'upload', 'Cargar Arqueo'], ['dashboard', 'chart', 'Mi Cumplimiento'], ['historial', 'list', 'Mis Arqueos'],
    ['clientes', 'building', 'Mis Oficinas'], ['novedades', 'alert', 'Faltantes / Sobrantes'], ['normalizaciones', 'flow', 'Mis Solicitudes']],
  Regional: [
    ['dashboard', 'chart', 'Dashboard Regional'], ['lideres', 'users', 'Cumplimiento por Líder'], ['clientes', 'building', 'Por Cliente / Oficina'],
    ['regional', 'pin', 'Regional y Zona'], ['analitica', 'activity', 'Analítica'], ['novedades', 'alert', 'Faltantes / Sobrantes'],
    ['tendencias', 'sparkle', 'Tendencias'], ['historial', 'layers', 'Matriz de Arqueos'], ['normalizaciones', 'filecheck', 'Aprobaciones']],
  Analista: [
    ['dashboard', 'chart', 'Dashboard Global'], ['lideres', 'users', 'Cumplimiento por Líder'], ['clientes', 'building', 'Por Cliente / Oficina'],
    ['regional', 'pin', 'Regional y Zona'], ['analitica', 'activity', 'Analítica'], ['novedades', 'alert', 'Faltantes / Sobrantes'],
    ['tendencias', 'sparkle', 'Tendencias'], ['historial', 'layers', 'Matriz de Arqueos'], ['normalizaciones', 'filecheck', 'Log Normalizaciones']]
};
const DASH = { dashboard: DashboardTab, lideres: LideresTab, novedades: NovedadesTab, clientes: ClientesTab, regional: RegionalTab, analitica: AnaliticaTab, tendencias: TendenciasTab };
const ROL_TXT = { Lider: 'Líder de excelencia', Regional: 'Regional', Analista: 'Analista' };

export default function ArqueosApp({ sub }) {
  const { sesion } = useV1();
  const key = sesion ? sesion.nombre + '|' + (sesion.llave_arqueos || '') : '';
  const [estado, setEstado] = useState(() => (STORE.key === key && STORE.user ? { ok: true, user: STORE.user } : { cargando: true }));
  const [intento, setIntento] = useState(0);

  // validarEmbebido(usuario, llave) cada vez que cambia el usuario de la sesión V1.
  useEffect(() => {
    if (!sesion) return undefined;
    if (STORE.key === key && STORE.user) { setEstado({ ok: true, user: STORE.user }); return undefined; }
    if (!sesion.llave_arqueos) { setEstado({ sinLlave: true }); return undefined; }
    let vivo = true;
    setEstado({ cargando: true });
    gas('validarEmbebido', sesion.nombre, sesion.llave_arqueos)
      .then((res) => {
        if (!vivo) return;
        if (res && res.success) {
          invalidarFront();
          Object.assign(STORE, { key, user: res, pend: null, tipologias: STORE.tipologias });
          HIST_STATE.reset();
          setEstado({ ok: true, user: res });
        } else setEstado({ denegado: (res && res.message) || 'Acceso denegado. Llave de arqueo incorrecta.' });
      })
      .catch((e) => vivo && setEstado({ error: e }));
    return () => { vivo = false; };
  }, [key, intento]); // eslint-disable-line react-hooks/exhaustive-deps

  if (estado.cargando) return <div className="card aq-gate"><Spinner label="Validando llave de acceso desde COI V1…" /></div>;
  if (estado.error) return <ErrorBox error={estado.error} onRetry={() => setIntento((i) => i + 1)} />;
  if (estado.sinLlave || estado.denegado) return <SinAcceso motivo={estado.denegado} />;
  return <App key={key} user={estado.user} sub={sub} />;
}

/** Panel cuando el usuario de la sesión no tiene llave de arqueos o la validación falla. */
function SinAcceso({ motivo }) {
  const { sesion, usuarios, entrar } = useV1();
  const [cambiando, setCambiando] = useState('');
  const conLlave = (usuarios || []).filter((r) => String(r[5] || '').trim() && String(r[4]).toUpperCase() !== 'INACTIVO');
  const grupos = ['Analista', 'Regional', 'Lider'].map((rol) => [rol, conLlave.filter((r) => String(r[5]).trim().toLowerCase() === rol.toLowerCase())]).filter((g) => g[1].length);
  const otros = conLlave.filter((r) => !['analista', 'regional', 'lider'].includes(String(r[5]).trim().toLowerCase()));
  if (otros.length) grupos.push(['Otra llave', otros]);
  const ver = async (u) => { setCambiando(u); try { await entrar(u); } finally { setCambiando(''); } };
  return (
    <div className="aq-noacc view-enter">
      <div className="aq-noacc-hero">
        <span className="aq-noacc-ic"><Icon name="lock" /></span>
        <div>
          <p className="aq-eyebrow">Control de Arqueos · acceso embebido</p>
          <h2>{motivo ? 'No fue posible validar la llave de arqueos' : sesion.nombre + ' no tiene llave de arqueos'}</h2>
          <p>{motivo
            ? <>COI V1 respondió: <b>«{motivo}»</b>. El módulo se abre con el usuario y la llave registrados en la hoja <b>Usuarios</b> (columna <i>llave_arqueos</i>).</>
            : <>En COI V1 este módulo se abre solo para usuarios con <b>llave_arqueos</b> (Líder, Regional o Analista) en la hoja <b>Usuarios</b>. El rol de la llave define las pestañas y los datos visibles.</>}
          </p>
        </div>
      </div>
      <div className="card aq-noacc-list">
        <div className="card-h"><div><h3>Usuarios con acceso a Arqueos</h3><p>{conLlave.length} usuarios activos con llave. Elija uno para verlo como ese usuario.</p></div></div>
        <div className="card-b">
          {grupos.length ? grupos.map(([rol, filas]) => (
            <div key={rol} className="aq-noacc-g">
              <p className="aq-sec-lbl">{ROL_TXT[rol] || rol} · {filas.length}</p>
              <div className="aq-noacc-grid">
                {filas.map((r) => (
                  <button key={r[0]} className="aq-user" onClick={() => ver(r[0])} disabled={!!cambiando}>
                    <span className="aq-user-av">{String(r[6] || r[0]).split(/\s+/).slice(0, 2).map((x) => x[0]).join('')}</span>
                    <span className="aq-user-t"><b>{r[0]}</b><small>{r[6] || r[3] || 'Sin nombre en directorio'}</small></span>
                    <span className="aq-user-go">{cambiando === r[0] ? <span className="aq-spin sm" /> : <>Ver como<Icon name="chevron" /></>}</span>
                  </button>
                ))}
              </div>
            </div>
          )) : <p className="aq-dim">No hay usuarios con llave de arqueos en la hoja Usuarios.</p>}
        </div>
      </div>
    </div>
  );
}

function Reloj() {
  const [d, setD] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setD(new Date()), 30000); return () => clearInterval(t); }, []);
  return <span className="aq-clock"><Icon name="clock" />{d.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' })} · {d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</span>;
}

function App({ user, sub }) {
  const { go } = useApp();
  const tabs = TABS[user.rol] || TABS.Analista;
  const def = user.rol === 'Lider' ? 'cargar' : 'dashboard';
  const tab = tabs.some((t) => t[0] === sub) ? sub : def;
  const [pend, setPend] = useState(STORE.pend);
  const [tipologias, setTipologias] = useState(STORE.tipologias);
  const [modal, setModal] = useState(null);
  const [version, setVersion] = useState(0);
  const navRef = useRef(null);

  const irA = useCallback((t, opts = {}) => {
    if (opts.filtro) HIST_STATE.filtroSig = opts.filtro;
    if (t === tab) setVersion((v) => v + 1); else go('arqueos/' + t);
  }, [go, tab]);
  const cerrarModal = useCallback(() => setModal(null), []);
  const abrirModal = useCallback((m) => setModal(m), []);
  const abrir = useCallback((tipo, id) => {
    const cfg = {
      detalle: { title: 'Detalle del arqueo', icon: 'eye', sub: id },
      gestion: { title: 'Gestionar arqueo', icon: 'filecheck', sub: id },
      respuesta: { title: 'Responder novedad', icon: 'send', tone: 'bad', sub: id + ' · la alerta se cerrará cuando respondas y el analista confirme el OK' },
      normalizar: { title: 'Solicitar normalización', icon: 'flow', sub: 'Arqueo ' + id + ' · Tu Regional revisará la solicitud.' },
      pendientes: { title: 'Novedades pendientes', icon: 'bell', tone: 'bad' }
    }[tipo];
    const body = tipo === 'pendientes' ? <PendientesBody /> : tipo === 'normalizar' ? <NormalizarBody idArqueo={id} /> : <ArqueoModal tipo={tipo} id={id} />;
    setModal({ ...cfg, wide: tipo !== 'normalizar', body, k: tipo + id + Date.now() });
  }, []);

  // obtenerPendientes al iniciar y cada 5 minutos (alerta persistente).
  const cargarPendientes = useCallback(async (mostrarModal) => {
    try {
      const p = await gas('obtenerPendientes', user.idUsuario, user.rol);
      const P = p && p.success ? p : { total: 0, items: [], pendientesLider: 0, pendientesAnalista: 0 };
      STORE.pend = P; setPend(P);
      if (mostrarModal && user.rol === 'Lider' && P.pendientesLider > 0 && !STORE.modalVisto[STORE.key]) {
        STORE.modalVisto[STORE.key] = true;
        abrir('pendientes');
      }
    } catch { /* sin alertas si el servicio no responde */ }
  }, [user, abrir]);
  useEffect(() => {
    cargarPendientes(true);
    const t = setInterval(() => cargarPendientes(false), 300000);
    if (!STORE.tipologias) gas('getTipologias').then((t2) => { STORE.tipologias = t2 || []; setTipologias(STORE.tipologias); }).catch(() => {});
    return () => clearInterval(t);
  }, [cargarPendientes]);

  /** Después de cualquier escritura: memoria limpia, pendientes al día y vista recargada. */
  const despuesDeEscribir = useCallback((destino) => {
    invalidarFront(); cargarPendientes(false);
    if (destino) irA(destino); else setVersion((v) => v + 1);
  }, [cargarPendientes, irA]);

  useEffect(() => {
    const b = navRef.current && navRef.current.querySelector('.on');
    if (b && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [tab]);

  const ctx = useMemo(() => ({ user, pend, tipologias, abrir, abrirModal, cerrarModal, irA, despuesDeEscribir, version, mesHoy: mesLocal() }),
    [user, pend, tipologias, abrir, abrirModal, cerrarModal, irA, despuesDeEscribir, version]);

  const P = pend || { total: 0 };
  const Dash = DASH[tab];
  return (
    <AqCtx.Provider value={ctx}>
      <div className="aq">
        <header className="aq-head">
          <div className="aq-head-l">
            <span className="aq-mark" aria-hidden="true"><Icon name="wallet" /></span>
            <div>
              <p className="aq-eyebrow">COI V1 · Reval / Multipagas</p>
              <h1>Control de Arqueos</h1>
              <p className="aq-head-sub"><b>{user.nombre}</b><Chip tone="navy">{ROL_TXT[user.rol] || user.rol}</Chip><span className="aq-hide-sm">{user.idUsuario}</span></p>
            </div>
          </div>
          <div className="aq-head-r">
            <Reloj />
            <button className="btn btn-o btn-sm" onClick={() => { invalidarFront(); setVersion((v) => v + 1); cargarPendientes(false); }} title="Volver a consultar los datos"><Icon name="activity" />Actualizar</button>
          </div>
        </header>

        <nav className="aq-nav" ref={navRef} aria-label="Secciones de Control de Arqueos">
          {tabs.map(([id, ic, txt]) => (
            <button key={id} className={id === tab ? 'on' : ''} aria-current={id === tab ? 'page' : undefined} onClick={() => irA(id)}>
              <Icon name={ic} />{txt}{id === 'historial' && P.total > 0 && <span className="aq-nav-badge" aria-label={P.total + ' pendientes'}>{P.total}</span>}
            </button>
          ))}
        </nav>

        <AlertaPendientes P={P} user={user} abrir={abrir} irA={irA} />

        <main className="aq-body view-enter" key={tab + '|' + version}>
          {tab === 'cargar' && <Cargar />}
          {tab === 'historial' && <Historial />}
          {tab === 'normalizaciones' && <Normalizaciones />}
          {Dash && <Dash user={user} />}
        </main>
      </div>
      {modal && (
        <AqModal key={modal.k} title={modal.title} icon={modal.icon} tone={modal.tone} sub={modal.sub} wide={modal.wide} onClose={cerrarModal}>
          {modal.body}
        </AqModal>
      )}
    </AqCtx.Provider>
  );
}

/** Banda persistente de novedades (pintarAlertaPendientes). */
function AlertaPendientes({ P, user, abrir, irA }) {
  if (!P || !P.total) return null;
  if (user.rol === 'Lider') {
    if (!P.pendientesLider) return null;
    const items = (P.items || []).filter((i) => i.quien === 'LIDER');
    return (
      <div className="aq-alert hot" role="alert">
        <div className="aq-alert-n"><span>{P.pendientesLider}</span></div>
        <div className="aq-alert-t">
          <b><Icon name="bell" />Tienes {P.pendientesLider} novedad(es) de arqueo pendiente(s) por responder</b>
          <p>{items.slice(0, 3).map((i) => i.oficina + ' · ' + i.fechaReal + ' (' + (i.tipos || []).map((t) => (t === 'SOPORTE' ? 'corregir soporte' : 'explicar diferencia')).join(' + ') + ')').join(' · ')}{items.length > 3 ? ' · …' : ''}</p>
          <small>Esta alerta permanecerá activa hasta que respondas todas las novedades.</small>
        </div>
        <button className="btn aq-alert-btn" onClick={() => abrir('pendientes')}>Responder ahora</button>
      </div>
    );
  }
  return (
    <div className="aq-alert" role="status">
      <div className="aq-alert-n"><span>{P.total}</span></div>
      <div className="aq-alert-t">
        <b><Icon name="filecheck" />{P.pendientesAnalista} respuesta(s) de líderes pendientes de confirmar OK · {P.pendientesLider} novedad(es) esperando respuesta del líder</b>
        <small>Los líderes reciben alerta persistente en pantalla y correo diario hasta responder.</small>
      </div>
      <div className="aq-alert-acts">
        <button className="btn btn-o btn-sm aq-alert-ghost" onClick={() => abrir('pendientes')}>Ver lista</button>
        <button className="btn aq-alert-btn" onClick={() => irA('historial', { filtro: 'pend' })}>Ver en la matriz</button>
      </div>
    </div>
  );
}
