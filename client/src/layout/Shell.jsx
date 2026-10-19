import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { PageHead } from '../components/ui.jsx';
import BrandMarks from './BrandMarks.jsx';
import { useApp } from '../context/AppContext.jsx';
import { MODULES, NAV, VIEW_LABEL, VIEW_HOME, NOTIFS } from '../lib/nav.js';
import { CLIENTES, CLIENTE, SEGMENTOS, clientePorModulo } from '../lib/clientes.js';
import { hhmm, longDate, norm } from '../lib/format.js';
import { useApi } from '../hooks/useApi.js';
import VIEWS from '../views/index.js';
import ClientCtxBar from '../views/ClientCtxBar.jsx';

/** Marco de la aplicación: menú lateral, barra superior y vista activa. */
export default function Shell({ user, onLogout }) {
  const { view = 'inicio', sub } = useParams();
  const location = useLocation();
  const { go, AN, clients, ctxClient, setCtxClient } = useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [userToggled, setUserToggled] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [dd, setDd] = useState(null);
  const contentRef = useRef(null);

  const View = VIEWS[view] || VIEWS.inicio;
  const home = VIEW_HOME[view];
  const navKey = home && !home.startsWith('cliente/') ? home : (VIEWS[view] ? view : 'inicio');
  // Cliente activo en el menú: /cliente/:k o el módulo especializado de un cliente (p. ej. /fincomercio).
  const activeClient = view === 'cliente' ? sub : (clientePorModulo(view) && !NAV.some((g) => g[1].some((it) => it[0] === view)) ? clientePorModulo(view).key : null);

  // Cambio de vista: limpia el cliente en contexto fuera de los módulos, cierra menús y anima la entrada.
  useLayoutEffect(() => {
    const isModule = MODULES.some((m) => m[0] === view) && view !== 'inicio';
    if (!isModule && !(view === 'analista' && ctxClient)) setCtxClient(null);
    setDd(null); setDrawer(false);
    const keep = location.state && location.state.keepScroll;
    if (!keep) {
      const c = contentRef.current;
      if (c) { c.classList.remove('view-enter'); void c.offsetWidth; c.classList.add('view-enter'); }
      window.scrollTo(0, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, sub]);

  useEffect(() => {
    const auto = () => {
      const w = window.innerWidth;
      if (w > 900 && w <= 1180) setCollapsed(true);
      else if (w > 1180 && !userToggled) setCollapsed(false);
      if (w > 900) setDrawer(false);
    };
    auto(); window.addEventListener('resize', auto);
    return () => window.removeEventListener('resize', auto);
  }, [userToggled]);

  useEffect(() => { document.body.classList.toggle('no-scroll', drawer); }, [drawer]);
  useEffect(() => {
    const close = (e) => { if (!e.target.closest('.dd')) setDd(null); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const toggleMenu = () => {
    if (window.innerWidth <= 900) { setDrawer((d) => !d); return; }
    setUserToggled(true); setCollapsed((c) => !c);
  };

  const lbl = VIEW_LABEL[view] || (view === 'analista' ? ['Personas', 'Equipo de analistas'] : view === 'cliente' ? ['Clientes', 'Todos los clientes'] : ['Inicio', 'Tablero gerencial']);
  let extra = '';
  if (view === 'analista' && AN[sub]) extra = AN[sub].name;
  if (view === 'cliente') extra = (CLIENTE[sub] && CLIENTE[sub].nombre) || (clients[sub] && clients[sub].name) || '';
  if (view === 'traza' && sub) extra = sub;

  return (
    <div className={'app' + (collapsed ? ' collapsed' : '')}>
      <aside className={'side' + (drawer ? ' open' : '')} aria-label="Menú principal">
        <div className="side-head">
          <BrandMarks size="sm" />
          <div className="mono" aria-hidden="true">C<i /></div>
        </div>
        <SideNav active={activeClient ? null : navKey} activeClient={activeClient} />
        <div className="side-foot">
          <svg className="sf-rings" viewBox="0 0 200 200" aria-hidden="true"><circle cx="160" cy="160" r="120" /><circle cx="160" cy="160" r="88" /><circle cx="160" cy="160" r="56" /></svg>
          <div className="sf-user"><span className="avatar">{user.initials}</span><div className="sf-txt"><b>{user.name}</b><small>{user.role}</small></div></div>
          <div className="sf-meta"><span className="dot-ok" /><span className="sf-txt">Sincronizado hace 1 min, versión 1.0</span></div>
        </div>
      </aside>
      <div className="main">
        <header className="top">
          <button className="icon-btn" aria-label="Abrir o contraer el menú" title={collapsed ? 'Expandir menú' : 'Contraer menú'} onClick={toggleMenu}><Icon name="sidebar" /></button>
          <span className="top-brand">COI</span>
          <div className="crumbs">
            <span>{lbl[0]}</span><Icon name="chevron" />
            {extra ? <><span>{lbl[1]}</span><Icon name="chevron" /><b>{extra}</b></> : <b>{lbl[1]}</b>}
          </div>
          <Search />
          <div className="top-right">
            <Clock />
            <div className="dd">
              <button className="icon-btn" aria-label="Notificaciones" onClick={() => setDd(dd === 'notif' ? null : 'notif')}><Icon name="bell" /><span className="pip">{NOTIFS.length}</span></button>
              <div className={'dd-menu' + (dd === 'notif' ? ' open' : '')}><Notifs /></div>
            </div>
            <div className="dd">
              <button className="user-btn" aria-label="Menú de usuario" onClick={() => setDd(dd === 'user' ? null : 'user')}>
                <span className="avatar">{user.initials}</span><span className="ub-txt"><b>{user.name}</b><small>{user.role}</small></span><Icon name="down" />
              </button>
              <div className={'dd-menu right' + (dd === 'user' ? ' open' : '')}>
                <div className="ddu-head"><span className="avatar lg">{user.initials}</span><div><b>{user.name}</b><small>{user.email}</small><small>{user.role}</small></div></div>
                <label className="ddu-row"><span>Ver COI como</span>
                  <select className="viewas" aria-label="Ver como" value={view === 'analista' && AN[sub] ? sub : ''} onChange={(e) => go(e.target.value ? 'analista/' + e.target.value : 'inicio')}>
                    <option value="">Gerencia</option>
                    {Object.values(AN).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
                <button className="ddu-item" onClick={() => go('junta')}><Icon name="sparkle" />Modo Comité (presentación)</button>
                <button className="ddu-item" onClick={() => go('implementacion')}><Icon name="flag" />Plan de implementación</button>
                <button className="ddu-item" onClick={() => go('traza')}><Icon name="message" />Soporte y solicitudes</button>
                <button className="ddu-item danger" onClick={onLogout}><Icon name="logout" />Cerrar sesión</button>
              </div>
            </div>
          </div>
        </header>
        <main className="content" ref={contentRef}>
          <ClientCtxBar view={view} />
          <ViewBoundary key={view + '/' + (sub || '')}>
            <View sub={sub} />
          </ViewBoundary>
        </main>
      </div>
      <div className={'scrim' + (drawer ? ' show' : '')} onClick={() => setDrawer(false)} />
    </div>
  );
}

function SideNav({ active, activeClient }) {
  const { go } = useApp();
  const [closed, setClosed] = useState({});
  const [showClients, setShowClients] = useState(true);
  const [q, setQ] = useState('');
  const list = q.trim() ? CLIENTES.filter((c) => norm(c.nombre).includes(norm(q.trim()))) : CLIENTES;
  return (
    <nav className="nav" aria-label="Secciones">
      {NAV.map((g, gi) => {
        const isClients = g[2] === 'clientes';
        const hasActive = g[1].some((it) => it[0] === active) || (isClients && !!activeClient);
        const isClosed = closed[gi] && !hasActive;
        return (
          <div key={g[0]} className={'nav-group' + (isClosed ? ' closed' : '')}>
            <button type="button" className="nav-gh" aria-expanded={!isClosed} onClick={() => setClosed((c) => ({ ...c, [gi]: !c[gi] }))}><span>{g[0]}</span><Icon name="chevron" className="chev" /></button>
            <div className="nav-items">
              {g[1].map((it) => (
                <button key={it[0]} type="button" className={'nav-item ' + (active === it[0] ? 'on' : '')} title={it[1]} onClick={() => go(it[0], { client: null })}>
                  <Icon name={it[2]} /><span className="ni-l">{it[1]}</span>
                  {typeof it[3] === 'number' ? <span className="count">{it[3]}</span> : it[3] ? <span className="tag">{it[3]}</span> : null}
                  {isClients && <span className="tag">{CLIENTES.length}</span>}
                </button>
              ))}
              {isClients && (
                <div className={'nav-clients' + (showClients || activeClient ? ' open' : '')}>
                  <button type="button" className="nav-sub-toggle" onClick={() => setShowClients((v) => !v)} aria-expanded={showClients || !!activeClient}>
                    <Icon name="chevron" className="chev" /><span>Espacios por cliente</span>
                  </button>
                  <div className="nav-client-list">
                    <label className="nav-client-q"><Icon name="search" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filtrar clientes" aria-label="Filtrar clientes" /></label>
                    {SEGMENTOS.map((seg) => {
                      const items = list.filter((c) => c.segmento === seg);
                      if (!items.length) return null;
                      return (
                        <div key={seg} className="nav-seg">
                          <div className="nav-seg-h">{seg}</div>
                          {items.map((c) => (
                            <button key={c.key} type="button" className={'nav-client' + (activeClient === c.key ? ' on' : '')} onClick={() => go('cliente/' + c.key, { client: null })} title={c.nombre}>
                              <span className="nav-client-dot" /><span className="ni-l">{c.nombre}</span>{c.modulo && <span className="nav-client-mod" title={c.modulo.nombre}>+</span>}
                            </button>
                          ))}
                        </div>
                      );
                    })}
                    {!list.length && <div className="nav-seg-h">Sin coincidencias</div>}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function Search() {
  const { go, D, clients } = useApp();
  const traza = useApi('/api/traza');
  const { pathname } = useLocation();
  const { reload } = traza;
  // Recarga los radicados al navegar, para encontrar también los recién creados.
  useEffect(() => { reload(); }, [pathname, reload]);
  const [q, setQ] = useState('');
  const [show, setShow] = useState(false);
  const inp = useRef(null);
  const idx = useMemo(() => D.analysts.map((a) => ['analista/' + a.id, a.name, 'Analista'])
    .concat(CLIENTES.map((c) => ['cliente/' + c.key, c.nombre, 'Cliente · ' + c.segmento]))
    .concat(MODULES.map((m) => [m[0], m[2], 'Módulo ' + m[1]]))
    .concat([['catalogo', 'Catálogo de actividades', 'Las 104 actividades']])
    .concat((traza.data || []).map((t) => ['traza/' + t.id, t.id + ', ' + t.title, 'TRAZA'])), [D, clients, traza.data]);
  const res = q.trim() ? idx.filter((r) => norm(r[1]).includes(norm(q.trim()))).slice(0, 8) : [];
  const pick = (to) => { setQ(''); setShow(false); go(to, { client: null }); };

  useEffect(() => {
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inp.current && inp.current.focus(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="search">
      <Icon name="search" />
      <input ref={inp} type="search" placeholder="Buscar cliente, analista, módulo o radicado" autoComplete="off" aria-label="Buscar"
        value={q} onChange={(e) => { setQ(e.target.value); setShow(!!e.target.value.trim()); }}
        onBlur={() => setTimeout(() => setShow(false), 200)}
        onKeyDown={(e) => { if (e.key === 'Enter' && res[0]) pick(res[0][0]); }} />
      <kbd>Ctrl K</kbd>
      <div className={'results' + (show ? ' show' : '')}>
        {res.length ? res.map((r) => <button key={r[0]} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r[0])}>{r[1]}<span>{r[2]}</span></button>)
          : <div className="empty">Sin resultados para esa búsqueda</div>}
      </div>
    </div>
  );
}

function Notifs() {
  const { go, toast } = useApp();
  return (
    <>
      <div className="dd-h"><b>Notificaciones</b><button className="linkbtn" onClick={() => toast('Notificaciones marcadas como leídas.')}>Marcar como leídas</button></div>
      {NOTIFS.map((n) => (
        <button key={n[1]} className="ntf" onClick={() => go(n[3], { client: null })}>
          <span className={'att-ic ' + n[0]}><Icon name={n[0] === 'ok' ? 'check' : n[0] === 'info' ? 'clock' : 'alert'} /></span>
          <span className="grow"><b>{n[1]}</b><small>{n[2]}</small></span>
        </button>
      ))}
      <button className="dd-f" onClick={() => go('bitacora')}>Ver toda la actividad</button>
    </>
  );
}

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  return <div className="clock"><b>{hhmm(now.getHours() * 60 + now.getMinutes())}</b>{longDate(now)}</div>;
}

/** Si una vista falla, muestra el error sin tumbar el resto del portal. */
class ViewBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { console.error(err); }
  render() {
    if (this.state.err) return <PageHead title="No se pudo abrir esta vista" sub={'Detalle técnico: ' + this.state.err.message} />;
    return this.props.children;
  }
}
