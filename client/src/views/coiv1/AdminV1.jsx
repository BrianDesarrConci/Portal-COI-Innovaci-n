// Administración (COI V1, secciones administracion / admin-usuarios / admin-permisos): usuarios,
// permisos por módulo y, en la demo, la bandeja de salida de correos y los archivos generados.
import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { fmt, norm } from '../../lib/format.js';
import { V1Bar, V1Guard, useV1 } from './V1Session.jsx';
import { V1Hero, Stat, Seg, Panel, Modal, F, PIcon, Pill, Avatar, toneOf, Empty, Skeleton, ErrorBox, gas, fmtBytes } from './portal/kit.jsx';

const ROLES = ['ADMIN', 'Lider', 'VISUALIZADOR', 'Usuario'];
const MOD_LABEL = { inicio: 'Inicio', novedades: 'Granja de Usuarios', experiencia: 'Experiencia de Cliente', centro: 'Centro de captura', arqueos: 'Control de Arqueos', brain: 'Brain RT', administracion: 'Administración' };
const MOD_ICON = { inicio: 'home', novedades: 'users', experiencia: 'message', centro: 'inbox', arqueos: 'wallet', brain: 'activity', administracion: 'shield' };
const si = (v) => String(v).trim().toUpperCase() === 'SI';

export default function AdminV1() {
  const { sesion, puede, tabla } = useV1();
  const habilitados = (tabla || []).slice(1).filter((r) => { const j = (tabla[0] || []).indexOf('administracion'); return j > 0 && si(r[j]); }).map((r) => r[0]);
  return (
    <>
      <V1Bar />
      <V1Guard modulo="administracion"><AdminModulo /></V1Guard>
      {sesion && !puede('administracion') && (
        <div className="card v1p-note-card mt">
          <Icon name="shield" />
          <div>
            <b>{habilitados.length ? 'Usuarios con Administración habilitada: ' + habilitados.join(', ') : 'En la hoja PERMISOS ningún usuario tiene «administracion» = SI'}</b>
            <p>{habilitados.length ? 'Elija uno de ellos en «Ver como» para administrar usuarios y permisos.' : 'Igual que en COI V1, el módulo queda oculto hasta que un administrador de la hoja PERMISOS marque la columna «administracion» en SI para su usuario.'}</p>
          </div>
        </div>
      )}
    </>
  );
}

function AdminModulo() {
  const { sesion, entrar } = useV1();
  const [tab, setTab] = useState('usuarios');
  const [usuarios, setUsuarios] = useState(null);
  const [tabla, setTabla] = useState(null);
  const [outbox, setOutbox] = useState(null);
  const [files, setFiles] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [u, t, o, f] = await Promise.all([
        gas('obtenerUsuarios'), gas('obtenerTablaPermisos'),
        fetch('/api/coiv1/outbox').then((r) => r.json()), fetch('/api/coiv1/files').then((r) => r.json())
      ]);
      setUsuarios(u); setTabla(t); setOutbox(o); setFiles(f);
    } catch (e) { setError(e); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const activos = usuarios ? usuarios.filter((u) => String(u[4]).toUpperCase() !== 'INACTIVO').length : 0;
  const admins = usuarios ? usuarios.filter((u) => String(u[2]).toUpperCase() === 'ADMIN').length : 0;

  return (
    <div className="v1p">
      <V1Hero eyebrow="COI V1 · Panel administrativo" icon="shield" title="Administración"
        sub="Administra usuarios, permisos por módulo y el registro de lo que el sistema envía y genera."
        right={<div className="v1p-hero-card"><span className="v1p-k"><Icon name="usercheck" />Sesión administradora</span><b>{sesion.nombre}</b><small>{sesion.rol}{sesion.correo ? ' · ' + String(sesion.correo).trim() : ''}</small></div>}>
        <div className="v1p-hero-tabs">
          <Seg size="lg" value={tab} onChange={setTab} items={[['usuarios', 'Usuarios', usuarios ? usuarios.length : undefined], ['permisos', 'Permisos'], ['outbox', 'Bandeja de salida', outbox ? outbox.length : undefined], ['files', 'Archivos generados', files ? files.length : undefined]]} />
        </div>
      </V1Hero>
      {error && <ErrorBox error={error} onRetry={cargar} />}
      <div className="v1p-stats four">
        <Stat label="Usuarios" value={usuarios ? usuarios.length : 0} loading={!usuarios} icon="users" sub="Hoja Usuarios" onClick={() => setTab('usuarios')} />
        <Stat label="Activos" value={activos} loading={!usuarios} icon="usercheck" color="#048C38" sub={usuarios ? fmt(usuarios.length - activos) + ' inactivos' : ''} />
        <Stat label="Administradores" value={admins} loading={!usuarios} icon="shield" color="#6C74A8" sub="Rol ADMIN" />
        <Stat label="Filas de permisos" value={tabla ? tabla.length - 1 : 0} loading={!tabla} icon="lock" color="#C99A00" sub={tabla ? (tabla[0].length - 1) + ' módulos' : ''} onClick={() => setTab('permisos')} />
      </div>
      <div className="mt">
        {tab === 'usuarios' && <Usuarios usuarios={usuarios} tabla={tabla} onChange={cargar} />}
        {tab === 'permisos' && <Permisos tabla={tabla} onSaved={async () => { await cargar(); await entrar(sesion.nombre); }} />}
        {tab === 'outbox' && <Outbox items={outbox} onReload={cargar} />}
        {tab === 'files' && <Archivos items={files} onReload={cargar} />}
      </div>
    </div>
  );
}

/* ---------------- Usuarios ---------------- */
function Usuarios({ usuarios, tabla, onChange }) {
  const [q, setQ] = useState('');
  const [rol, setRol] = useState('');
  const [modal, setModal] = useState(null);
  const modulosDe = useMemo(() => {
    const m = new Map();
    if (tabla) tabla.slice(1).forEach((r) => m.set(String(r[0]).trim().toUpperCase(), r.slice(1).filter(si).length));
    return m;
  }, [tabla]);
  const lista = useMemo(() => {
    const t = norm(q.trim());
    return (usuarios || []).filter((u) => (!rol || String(u[2]).toUpperCase() === rol.toUpperCase()) && (!t || [u[0], u[3], u[6], u[2]].some((x) => norm(x || '').includes(t))));
  }, [usuarios, q, rol]);
  const nMod = tabla ? tabla[0].length - 1 : 7;
  return (
    <Panel icon="users" title="Administración de Usuarios" sub="Usuarios registrados en COI V1. Las contraseñas nunca se muestran." flush
      right={<button type="button" className="btn btn-p" onClick={() => setModal({ modo: 'crear' })}><PIcon name="plus" />Nuevo usuario</button>}>
      <div className="v1p-toolbar v1p-pad-x">
        <div className="v1p-search grow"><Icon name="search" /><input className="inp" placeholder="Buscar usuario, nombre o correo..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="inp v1p-sel" aria-label="Rol" value={rol} onChange={(e) => setRol(e.target.value)}><option value="">Todos los roles</option>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
        <span className="v1p-counter"><b className="num">{fmt(lista.length)}</b> usuarios</span>
      </div>
      {!usuarios ? <div className="v1p-pad"><Skeleton rows={6} h={38} /></div> : !lista.length ? <Empty icon="search" title="Sin coincidencias" /> : (
        <div className="scroll-x">
          <table className="t v1p-table">
            <thead><tr><th>Usuario</th><th>Rol</th><th>Correo</th><th>Llave arqueos</th><th>Módulos</th><th>Estado</th><th className="r">Acciones</th></tr></thead>
            <tbody>
              {lista.map((u) => {
                const n = modulosDe.get(String(u[0]).trim().toUpperCase());
                return (
                  <tr key={u[0]}>
                    <td data-label="Usuario"><div className="v1p-who"><Avatar name={u[6] || u[0]} tone={toneOf(u[0])} size="sm" /><div><div className="cell-main">{u[0]}</div><div className="cell-sub">{u[6] || 'Sin nombre completo'}</div></div></div></td>
                    <td data-label="Rol"><span className={'v1p-role ' + String(u[2]).toLowerCase()}>{u[2] || '—'}</span></td>
                    <td data-label="Correo">{String(u[3] || '').trim() || <span className="muted small">Sin correo</span>}</td>
                    <td data-label="Llave arqueos">{u[5] ? <span className="chip">{u[5]}</span> : <span className="muted small">—</span>}</td>
                    <td data-label="Módulos">{n === undefined ? <span className="badge b-warn" title="El usuario no tiene fila en PERMISOS">Sin permisos</span> : <span className="v1p-mods"><span className="v1p-mods-bar"><i style={{ width: (n / nMod) * 100 + '%' }} /></span><small className="num">{n}/{nMod}</small></span>}</td>
                    <td data-label="Estado"><Pill v={u[4] || 'ACTIVO'} /></td>
                    <td data-label="Acciones" className="r"><button type="button" className="btn btn-o btn-sm" onClick={() => setModal({ modo: 'editar', usuario: u[0] })} title="Editar usuario"><Icon name="pen" />Editar</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {modal && <UsuarioModal {...modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); onChange(); }} />}
    </Panel>
  );
}

function UsuarioModal({ modo, usuario, onClose, onSaved }) {
  const { toast } = useApp();
  const crear = modo === 'crear';
  const [d, setD] = useState({ usuario: '', password: '', correo: '', rol: 'Lider', estado: 'ACTIVO' });
  const [cargando, setCargando] = useState(!crear);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState({});
  const [ver, setVer] = useState(false);
  useEffect(() => {
    if (crear) return;
    gas('obtenerUsuario', usuario).then((res) => {
      if (!res.success) { toast(res.msg); onClose(); return; }
      setD({ usuario: res.usuario, password: '', correo: String(res.correo || '').trim(), rol: res.rol || 'Lider', estado: res.estado || 'ACTIVO' });
      setCargando(false);
    }).catch((e) => { toast('❌ ' + e.message); onClose(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crear, usuario]);
  const set = (k) => (e) => setD((x) => ({ ...x, [k]: e.target.value }));
  async function guardar() {
    const e = {};
    if (!d.usuario.trim()) e.usuario = 'Obligatorio.';
    if (crear && !d.password.trim()) e.password = 'Obligatoria para un usuario nuevo.';
    if (!d.correo.trim()) e.correo = 'Obligatorio (como en V1).';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.correo.trim())) e.correo = 'Correo no válido.';
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const datos = { usuario: d.usuario.trim(), password: d.password.trim(), correo: d.correo.trim(), rol: d.rol, estado: d.estado };
      const res = await gas(crear ? 'crearUsuario' : 'actualizarUsuario', datos);
      if (res.success) { toast(crear ? 'Usuario creado correctamente.' : 'Usuario actualizado correctamente.'); onSaved(); }
      else toast('⚠️ ' + res.msg);
    } catch (x) { toast('❌ ' + x.message); } finally { setBusy(false); }
  }
  const roles = ROLES.includes(d.rol) ? ROLES : ROLES.concat(d.rol);
  return (
    <Modal title={crear ? 'Nuevo usuario' : 'Editar usuario'} icon={crear ? 'plus' : 'pen'} onClose={() => !busy && onClose()}
      foot={<><button type="button" className="btn btn-o" onClick={onClose} disabled={busy}>Cancelar</button><button type="button" className={'btn btn-p' + (busy ? ' loading' : '')} onClick={guardar} disabled={busy || cargando}><span className="spinner" /><Icon name="check" />Guardar</button></>}>
      {cargando ? <Skeleton rows={5} h={38} /> : (
        <div className="v1p-form">
          <F label="Usuario" req error={err.usuario} hint={crear ? 'Así inicia sesión. Se crea su fila en PERMISOS con todos los módulos en NO.' : 'El nombre de usuario no se puede cambiar.'}>
            <input className="inp" value={d.usuario} onChange={set('usuario')} disabled={!crear} autoComplete="off" />
          </F>
          <F label="Contraseña" req={crear} error={err.password} hint={crear ? null : 'Déjela en blanco para conservar la actual.'}>
            <div className="v1p-pass"><input className="inp" type={ver ? 'text' : 'password'} value={d.password} onChange={set('password')} autoComplete="new-password" placeholder={crear ? '' : '••••••••'} /><button type="button" className="btn btn-g btn-sm" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}><Icon name="eye" /></button></div>
          </F>
          <F label="Correo" req error={err.correo} wide><input className="inp" type="email" value={d.correo} onChange={set('correo')} placeholder="nombre@reval.com.co" /></F>
          <F label="Rol" req>
            <div className="v1p-roles">{roles.map((r) => <button key={r} type="button" className={'v1p-chip-t' + (d.rol === r ? ' on' : '')} onClick={() => setD((x) => ({ ...x, rol: r }))}>{r}</button>)}</div>
          </F>
          <F label="Estado" req>
            <div className="v1p-roles">{['ACTIVO', 'INACTIVO'].map((r) => <button key={r} type="button" className={'v1p-chip-t' + (d.estado === r ? ' on' : '')} onClick={() => setD((x) => ({ ...x, estado: r }))}>{r === 'ACTIVO' ? 'Activo' : 'Inactivo'}</button>)}</div>
          </F>
        </div>
      )}
    </Modal>
  );
}

/* ---------------- Permisos ---------------- */
function Permisos({ tabla, onSaved }) {
  const { toast } = useApp();
  const [m, setM] = useState(null);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (tabla) setM(tabla.map((r) => r.slice())); }, [tabla]);
  const dirty = useMemo(() => {
    if (!m || !tabla) return 0;
    let n = 0;
    for (let i = 1; i < m.length; i++) for (let j = 1; j < m[i].length; j++) if (si(m[i][j]) !== si(tabla[i][j])) n++;
    return n;
  }, [m, tabla]);
  if (!m) return <div className="card v1p-pad"><Skeleton rows={8} h={34} /></div>;
  const head = m[0];
  const t = norm(q.trim());
  const filas = m.map((r, i) => [r, i]).slice(1).filter(([r]) => !t || norm(r[0]).includes(t));
  const toggle = (i, j) => setM((x) => x.map((r, ri) => (ri === i ? r.map((c, cj) => (cj === j ? (si(c) ? 'NO' : 'SI') : c)) : r)));
  const col = (j, val) => setM((x) => x.map((r, ri) => (ri === 0 || (t && !norm(r[0]).includes(t)) ? r : r.map((c, cj) => (cj === j ? (val ? 'SI' : 'NO') : c)))));
  async function guardar() {
    // Igual que guardarPermisos() de js.html: se envía el estado de todas las casillas.
    const permisos = {};
    m.slice(1).forEach((r) => { permisos[r[0]] = {}; head.slice(1).forEach((mod, j) => { permisos[r[0]][mod] = si(r[j + 1]); }); });
    setBusy(true);
    try { await gas('guardarPermisos', permisos); toast('Permisos actualizados correctamente.'); await onSaved(); }
    catch (e) { toast('❌ ' + e.message); } finally { setBusy(false); }
  }
  return (
    <Panel icon="lock" title="Permisos por módulo" sub="Define los módulos disponibles para cada usuario (hoja PERMISOS)." flush
      right={<div className="v1p-perm-act">
        {dirty > 0 && <span className="badge b-warn">{dirty} {dirty === 1 ? 'cambio sin guardar' : 'cambios sin guardar'}</span>}
        {dirty > 0 && <button type="button" className="btn btn-g btn-sm" onClick={() => setM(tabla.map((r) => r.slice()))} disabled={busy}>Descartar</button>}
        <button type="button" className={'btn btn-p' + (busy ? ' loading' : '')} onClick={guardar} disabled={!dirty || busy}><span className="spinner" /><PIcon name="database" />Guardar cambios</button>
      </div>}>
      <div className="v1p-toolbar v1p-pad-x">
        <div className="v1p-search grow"><Icon name="search" /><input className="inp" placeholder="Filtrar usuarios..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <span className="v1p-counter"><b className="num">{filas.length}</b> usuarios</span>
      </div>
      <div className="scroll-x v1p-perm-wrap">
        <table className="v1p-perm">
          <thead>
            <tr>
              <th className="u">Usuario</th>
              {head.slice(1).map((mod, j) => {
                const on = filas.filter(([r]) => si(r[j + 1])).length;
                return (
                  <th key={mod}>
                    <span className="v1p-perm-h"><PIcon name={MOD_ICON[mod] || 'layers'} /><span>{MOD_LABEL[mod] || mod}</span><small className="num">{on}/{filas.length}</small></span>
                    <span className="v1p-perm-all"><button type="button" onClick={() => col(j + 1, true)} title={'Habilitar ' + mod + ' a los usuarios listados'}>Todos</button><button type="button" onClick={() => col(j + 1, false)} title={'Quitar ' + mod + ' a los usuarios listados'}>Ninguno</button></span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filas.map(([r, i]) => (
              <tr key={r[0]}>
                <th className="u"><span className="v1p-who"><Avatar name={r[0]} tone={toneOf(r[0])} size="sm" /><b>{r[0]}</b></span></th>
                {r.slice(1).map((c, j) => {
                  const changed = si(c) !== si(tabla[i][j + 1]);
                  return (
                    <td key={j} className={changed ? 'chg' : ''}>
                      <button type="button" role="switch" aria-checked={si(c)} aria-label={`${MOD_LABEL[head[j + 1]] || head[j + 1]} para ${r[0]}`} className={'v1p-switch' + (si(c) ? ' on' : '')} onClick={() => toggle(i, j + 1)}><i /></button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ---------------- Bandeja de salida (demo) ---------------- */
function Outbox({ items, onReload }) {
  const [sel, setSel] = useState(null);
  if (!items) return <div className="card v1p-pad"><Skeleton rows={5} h={40} /></div>;
  const cur = sel ? items.find((x) => x.id === sel) : items[0];
  return (
    <Panel icon="mail" title="Bandeja de salida" sub="Correos que genera el sistema. Mientras no se configure el envío, quedan aquí." flush
      right={<button type="button" className="btn btn-o btn-sm" onClick={onReload}><PIcon name="refresh" />Actualizar</button>}>
      {!items.length ? <Empty icon="mail" title="No hay correos en la bandeja">Los códigos OTP de Arqueos y las constancias de PQR aparecerán aquí.</Empty> : (
        <div className="v1p-mail">
          <ul className="v1p-mail-list">
            {items.map((x) => (
              <li key={x.id}><button type="button" className={cur && cur.id === x.id ? 'on' : ''} onClick={() => setSel(x.id)}>
                <span className="v1p-mail-ic"><Icon name="mail" /></span>
                <span className="grow"><b className="ellip">{x.subject}</b><small className="ellip">Para {x.to}</small></span>
                <small className="muted nowrap">{new Date(x.fecha).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small>
              </button></li>
            ))}
          </ul>
          {cur && (
            <div className="v1p-mail-view">
              <div className="v1p-mail-head"><b>{cur.subject}</b><small>De {cur.name || 'COI'} · Para {cur.to}{cur.cc ? ' · CC ' + cur.cc : ''}</small><small className="muted">{new Date(cur.fecha).toLocaleString('es-CO')}</small></div>
              {cur.htmlBody ? <iframe title="Vista del correo" sandbox="" srcDoc={cur.htmlBody} /> : <pre className="v1p-mail-txt">{cur.body}</pre>}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

/* ---------------- Archivos generados (demo) ---------------- */
function Archivos({ items, onReload }) {
  const [q, setQ] = useState('');
  if (!items) return <div className="card v1p-pad"><Skeleton rows={5} h={40} /></div>;
  const lista = items.slice().sort((a, b) => (a.created < b.created ? 1 : -1)).filter((f) => !q || norm(f.name + ' ' + f.folder).includes(norm(q)));
  const icon = (m) => (m === 'application/pdf' ? 'file' : /^image\//.test(m) ? 'eye' : m === 'text/html' ? 'printer' : 'file');
  return (
    <Panel icon="file" title="Archivos generados" sub="Equivalente a las carpetas de Drive de V1: constancias, soportes y documentos que crea el sistema." flush
      right={<button type="button" className="btn btn-o btn-sm" onClick={onReload}><PIcon name="refresh" />Actualizar</button>}>
      <div className="v1p-toolbar v1p-pad-x"><div className="v1p-search grow"><Icon name="search" /><input className="inp" placeholder="Buscar por nombre o carpeta..." value={q} onChange={(e) => setQ(e.target.value)} /></div><span className="v1p-counter"><b className="num">{lista.length}</b> archivos</span></div>
      {!lista.length ? <Empty icon="file" title="Aún no hay archivos">Al radicar una PQR o cerrar un arqueo, sus documentos aparecerán aquí.</Empty> : (
        <ul className="v1p-files">
          {lista.map((f) => (
            <li key={f.id}>
              <span className="v1p-file-ic"><PIcon name={icon(f.mimeType)} /></span>
              <span className="grow"><b className="ellip">{f.name}</b><small className="ellip"><PIcon name="layers" />{f.folder || 'Raíz'} · {fmtBytes(f.size)} · {new Date(f.created).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small></span>
              <a className="btn btn-o btn-sm" href={'/api/coiv1/files/' + f.id} target="_blank" rel="noopener noreferrer"><PIcon name="external" />Abrir</a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
