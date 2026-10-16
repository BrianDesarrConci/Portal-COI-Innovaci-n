// Inicio COI V1 (inicio.html reimaginado): bienvenida "Core Operativo Inteligente", contadores en
// vivo de los libros de V1, accesos según PERMISOS y el mapa de la migración COI V1 → COI.
import { useEffect, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import CountUp from '../../components/CountUp.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { fmt } from '../../lib/format.js';
import { V1Bar, V1Guard, useV1, V1_MODULOS } from './V1Session.jsx';
import { Panel, PIcon, gas, ErrorBox } from './portal/kit.jsx';

const ACCESOS = [
  ['novedades', 'granja', 'Granja de Usuarios', 'Gestión de bajas, reemplazos y coberturas.', 'users', '#21BBEA'],
  ['experiencia', 'experiencia', 'Experiencia de Cliente', 'Radicación de PQR con constancia y seguimiento.', 'headset', '#6C74A8', 'Completado'],
  ['centro', 'captura', 'Centro de captura', 'Gestión integral y automatización de los procesos del negocio.', 'inbox', '#048C38', 'Nuevo'],
  ['arqueos', 'arqueos', 'Control de Arqueos', 'Control y seguimiento de arqueos de caja.', 'wallet', '#C99A00'],
  ['brain', 'brain', 'Brain RT', 'Consulta transacciones en tiempo real desde Oracle.', 'brain', '#242A54'],
  ['administracion', 'adminv1', 'Administración', 'Usuarios, permisos y registro del sistema.', 'shield', '#1A8FB5']
];

// Secciones de COI V1 (index.html / slidebar.html) y su lugar en COI.
const MIGRACION = [
  ['login', 'Inicio de sesión', 'Sesión del portal + «Ver como» (usuario, rol, permisos)', null, 'Integrado'],
  ['header', 'Encabezado y saludo', 'Franja COI V1 en cada módulo', null, 'Integrado'],
  ['inicio', 'Inicio', 'Inicio COI V1 con contadores en vivo', 'coiv1', 'Migrado'],
  ['novedades', 'Granja de Usuarios', 'Granja de Usuarios: bajas, backups, historial y directorio', 'granja', 'Migrado'],
  ['reportes', 'Experiencia de Cliente', 'Radicación PQR con libro, constancia e historial', 'experiencia', 'Completado'],
  ['negocio', 'Centro de captura', 'Centro de captura (accesos)', 'captura', 'Migrado'],
  ['auditorias-fincomercio', 'Auditorías Fincomercio', 'Aplicación embebida en marco seguro', 'captura/fincomercio', 'Embebido'],
  ['control-apertura', 'Control de Apertura', 'Aplicación embebida en marco seguro', 'captura/apertura', 'Embebido'],
  ['Control-Arqueos', 'Control de Arqueos', 'Control de Arqueos en COI', 'arqueos', 'Migrado'],
  ['brain-rt', 'Brain RT', 'Centro de acceso a Oracle Analytics (sin contraseñas)', 'brain', 'Migrado'],
  ['administracion', 'Panel administrativo', 'Administración: usuarios, permisos, correos y archivos', 'adminv1', 'Migrado'],
  ['admin-usuarios', 'Usuarios', 'Administración › Usuarios', 'adminv1', 'Migrado'],
  ['admin-permisos', 'Permisos', 'Administración › Permisos', 'adminv1', 'Migrado']
];
const EST = { Migrado: 'b-ok', Completado: 'b-info', Embebido: 'b-mute', Integrado: 'b-warn' };

function saludo() { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; }

export default function Coiv1Inicio() {
  return (<><V1Bar /><V1Guard modulo="inicio"><InicioV1 /></V1Guard></>);
}

function InicioV1() {
  const { sesion, puede, meta } = useV1();
  const { go } = useApp();
  const [r, setR] = useState(null);
  const [err, setErr] = useState(null);
  const cargar = () => { setErr(null); gas('resumenInicioV1').then(setR).catch(setErr); };
  useEffect(cargar, []);
  const habilitados = V1_MODULOS.filter((m) => puede(m)).length;
  const extraido = meta && meta.extraido ? new Date(meta.extraido) : null;
  const vivo = meta && meta.driver === 'sheets';
  const nombre = String(sesion.nombre || '');

  const cifras = [
    ['Novedades pendientes', r && r.novedades.pendientes, 'Bajas sin backup', 'alert', '#FFB3AE', 'granja'],
    ['Novedades resueltas', r && r.novedades.resueltas, r ? fmt(r.novedades.cubiertas) + ' coberturas activas' : '', 'check', '#7FE0A6', 'granja'],
    ['Personas en la granja', r && r.granja.personas, r ? fmt(r.granja.oficinas) + ' oficinas' : '', 'users', '#7FD3F0', 'granja'],
    ['Backups disponibles', r && r.granja.backupsDisponibles, 'BACKUP SI/NO = SI', 'usercheck', '#F6CF46', 'granja'],
    ['Arqueos registrados', r && r.arqueos.registrados, 'Hoja Arqueos', 'wallet', '#C9CDE3', 'arqueos'],
    ['Módulos habilitados', habilitados, 'de ' + V1_MODULOS.length + ' para ' + nombre, 'grid', '#DCE0F4', null]
  ];

  return (
    <div className="v1p">
      <section className="v1p-welcome">
        <svg className="v1p-welcome-net" viewBox="0 0 400 260" aria-hidden="true">
          {[[60, 60], [180, 30], [300, 80], [120, 160], [250, 190], [360, 200], [40, 220]].map((p, i, a) => a.slice(i + 1).filter((_, k) => (i + k) % 2 === 0).map((q, k) => <line key={i + '-' + k} x1={p[0]} y1={p[1]} x2={q[0]} y2={q[1]} />))}
          {[[60, 60], [180, 30], [300, 80], [120, 160], [250, 190], [360, 200], [40, 220]].map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={i % 3 === 0 ? 5 : 3.5} />)}
        </svg>
        <div className="v1p-welcome-main">
          <div className="v1p-eyebrow">{saludo()}, {nombre} · {sesion.rol}</div>
          <h1 className="v1p-coi">C<i>·</i>O<i>·</i>I</h1>
          <div className="v1p-coi-sub">Core Operativo Inteligente</div>
          <p className="v1p-coi-tag">Conectamos personas, procesos y decisiones estratégicas en tiempo real</p>
          <div className="v1p-welcome-cta">
            {puede('novedades') && <button type="button" className="btn btn-lg v1p-btn-gold" onClick={() => go('granja')}><Icon name="users" />Ir a la Granja de Usuarios</button>}
            <span className="v1p-hero-chips"><span><span className={'v1p-live' + (vivo ? '' : ' snap')} />{vivo ? 'Google Sheets en vivo' : 'Copia de Sheets'}</span>{extraido && <span>Extraída {extraido.toLocaleString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}</span>
          </div>
        </div>
        <div className="v1p-welcome-stats">
          {cifras.map((c) => {
            const B = c[5] ? 'button' : 'div';
            return (
              <B key={c[0]} type={c[5] ? 'button' : undefined} className={'v1p-ws' + (c[5] ? ' click' : '')} style={{ '--c': c[4] }} onClick={c[5] ? () => go(c[5]) : undefined}>
                <span className="v1p-ws-l"><PIcon name={c[3]} />{c[0]}</span>
                <b className="num">{c[1] === null || c[1] === undefined ? <span className="v1p-sk dark" style={{ width: 54, height: 24 }} /> : <CountUp value={fmt(c[1])} />}</b>
                <small>{c[2]}</small>
              </B>
            );
          })}
        </div>
      </section>
      {err && <div className="mt"><ErrorBox error={err} onRetry={cargar} /></div>}

      <div className="v1p-sec-h mt"><h2>Accesos rápidos</h2><p>Los módulos sin permiso en la hoja PERMISOS aparecen bloqueados para {nombre}.</p></div>
      <div className="v1p-access">
        {ACCESOS.map(([mod, ruta, titulo, desc, icon, color, badge]) => {
          const ok = puede(mod);
          return (
            <button key={mod} type="button" className={'card v1p-acc' + (ok ? '' : ' off')} style={{ '--c': color }} onClick={() => ok && go(ruta)} disabled={!ok} aria-disabled={!ok}>
              <span className="v1p-app-ic"><PIcon name={icon} /></span>
              <span className="v1p-acc-b">
                <b>{titulo}{badge && ok && <span className={'v1p-acc-badge ' + (badge === 'Nuevo' ? 'gold' : '')}>{badge}</span>}</b>
                <small>{desc}</small>
              </span>
              {ok ? <span className="v1p-acc-go"><Icon name="chevron" /></span> : <span className="v1p-acc-lock"><Icon name="lock" />Sin permiso</span>}
            </button>
          );
        })}
      </div>

      <div className="v1p-two mt v1p-two-wide">
        <Panel icon="swap" title="Migración COI V1 → COI" sub="Cada sección de la aplicación de Apps Script y su nuevo lugar en el portal." flush>
          <div className="scroll-x">
            <table className="t v1p-table v1p-mig">
              <thead><tr><th>Sección V1</th><th>Nuevo hogar en COI</th><th>Estado</th></tr></thead>
              <tbody>
                {MIGRACION.map(([id, v1, nuevo, ruta, est]) => (
                  <tr key={id} className={ruta ? 'click' : ''} onClick={ruta ? () => go(ruta) : undefined}>
                    <td data-label="Sección V1"><div className="cell-main">{v1}</div><div className="cell-sub"><code>#{id}</code></div></td>
                    <td data-label="Nuevo hogar"><div className="cell-main">{nuevo}</div>{ruta && <div className="cell-sub"><code>/{ruta}</code></div>}</td>
                    <td data-label="Estado"><span className={'badge ' + EST[est]}>{est}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="v1p-stack">
          <Panel icon="database" title="Origen de los datos">
            <dl className="v1p-dl">
              <dt>Conexión</dt><dd><span className={'v1p-live' + (vivo ? '' : ' snap')} />{vivo ? 'Google Sheets en vivo (cuenta de servicio)' : 'Copia de los Sheets de V1 (snapshot)'}</dd>
              <dt>Extracción</dt><dd>{extraido ? extraido.toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' }) : '—'}</dd>
              <dt>Libros</dt><dd>{meta && meta.libros ? Object.keys(meta.libros).map((b) => <span key={b} className="chip">{b} · {Object.keys(meta.libros[b]).length} hojas</span>) : '—'}</dd>
              <dt>Funciones</dt><dd>{meta && meta.funciones ? fmt(meta.funciones.length) + ' funciones de Apps Script portadas' : '—'}</dd>
              <dt>PQR</dt><dd>{r ? fmt(r.pqr.radicadas) + ' radicadas en el libro PQR' : '—'}</dd>
              <dt>Usuarios</dt><dd>{r ? fmt(r.usuarios.activos) + ' activos de ' + fmt(r.usuarios.total) : '—'}</dd>
            </dl>
          </Panel>
          <Panel icon="bell" title="Últimas actualizaciones" className="mt">
            <ul className="v1p-news">
              <li><b>Experiencia de Cliente completada</b><span>El formulario PQR de V1 ya radica, guarda constancia y muestra historial.</span></li>
              <li><b>Granja de Usuarios con mapa</b><span>Directorio georreferenciado y asignación de backups con puntaje visible.</span></li>
              <li><b>Cierre automático al abrir</b><span>Las coberturas vencidas se cierran como SISTEMA AUTOMÁTICO.</span></li>
              <li><b>Brain RT sin contraseñas</b><span>Las credenciales de Oracle se solicitan por TRAZA.</span></li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
