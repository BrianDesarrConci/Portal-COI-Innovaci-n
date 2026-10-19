import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { gas } from '../../lib/gas.js';
import Icon from '../../components/Icon.jsx';

/**
 * Sesión de COI V1 dentro del portal. En V1 la sesión sale de validarCredenciales (usuario,
 * rol, llave_arqueos y permisos por módulo de la hoja PERMISOS). En la demo se elige el usuario
 * con iniciarSesionDemo, porque la copia de los Sheets no incluye contraseñas.
 */
const Ctx = createContext(null);
const KEY = 'coi.v1.usuario';
export const V1_MODULOS = ['inicio', 'novedades', 'experiencia', 'centro', 'arqueos', 'brain', 'administracion'];

export function V1SessionProvider({ children }) {
  const [usuarios, setUsuarios] = useState([]);
  const [tabla, setTabla] = useState([]);
  const [sesion, setSesion] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);

  const entrar = useCallback(async (usuario) => {
    const r = await gas('iniciarSesionDemo', usuario);
    if (!r.success) throw new Error(r.msg);
    setSesion(r);
    try { sessionStorage.setItem(KEY, usuario); } catch { /* sin almacenamiento */ }
    return r;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [u, t, m] = await Promise.all([gas('obtenerUsuarios'), gas('obtenerTablaPermisos'), fetch('/api/coiv1/meta').then((x) => x.json())]);
        setUsuarios(u); setTabla(t); setMeta(m);
        let pref = null; try { pref = sessionStorage.getItem(KEY); } catch { /* */ }
        // Por defecto (demo): quien tenga llave de Arqueos «Analista» (ve toda la red); si no, el
        // usuario ACTIVO con más módulos habilitados en PERMISOS.
        const score = (name) => {
          const u0 = u.find((r) => r[0] === name);
          const row = t.find((r) => r[0] === name);
          return (u0 && String(u0[5]).trim().toUpperCase() === 'ANALISTA' ? 100 : 0) + (row ? row.slice(1).filter((x) => String(x).toUpperCase() === 'SI').length : 0);
        };
        const activos = u.filter((r) => String(r[4]).toUpperCase() !== 'INACTIVO');
        const def = (pref && activos.find((r) => r[0] === pref)) || activos.slice().sort((a, b) => score(b[0]) - score(a[0]))[0];
        if (def) await entrar(def[0]);
      } catch (e) { setError(e); }
    })();
  }, [entrar]);

  /**
   * ¿Puede ver el módulo? Regla de aplicarPermisos() en js.html de V1: los usuarios que no son
   * ADMIN ven todo; a los ADMIN solo se les ocultan los módulos en NO de la hoja PERMISOS.
   */
  const puede = useCallback((modulo) => {
    if (!sesion) return false;
    if (String(sesion.rol || '').toUpperCase().trim() !== 'ADMIN') return true;
    const p = sesion.permisos || {};
    return !(modulo in p) || !!p[modulo];
  }, [sesion]);
  const value = useMemo(() => ({ usuarios, tabla, sesion, meta, error, entrar, puede }), [usuarios, tabla, sesion, meta, error, entrar, puede]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useV1 = () => useContext(Ctx);

/** Franja superior de los módulos V1: usuario de la sesión, selector de demostración y origen de datos. */
export function V1Bar() {
  const { usuarios, sesion, meta, entrar } = useV1();
  if (!sesion) return null;
  const fecha = meta && meta.extraido ? new Date(meta.extraido).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
  return (
    <div className="v1-bar">
      <span className="v1-bar-tag" title="Módulo migrado de COI V1 con datos de Google Sheets"><Icon name="layers" />Datos reales</span>
      <span className="v1-bar-user"><b>{sesion.nombre}</b> · {sesion.rol}{sesion.llave_arqueos ? ' · Arqueos: ' + sesion.llave_arqueos : ''}</span>
      <label className="v1-bar-sel">
        <span>Ver como</span>
        <select value={sesion.nombre} onChange={(e) => entrar(e.target.value)}>
          {usuarios.filter((r) => String(r[4]).toUpperCase() !== 'INACTIVO').map((r) => <option key={r[0]} value={r[0]}>{r[0]} · {r[2]}</option>)}
        </select>
      </label>
      <span className="v1-bar-src" title="Origen de los datos">
        <span className={'v1-dot ' + (meta && meta.driver === 'sheets' ? 'live' : '')} />
        {meta && meta.driver === 'sheets' ? 'Google Sheets en vivo' : 'Copia de Sheets · ' + fecha}
      </span>
    </div>
  );
}

/** Bloquea el contenido si el usuario no tiene el módulo habilitado en PERMISOS (como showSection de V1). */
export function V1Guard({ modulo, children, permitir = false }) {
  const { sesion, puede, error } = useV1();
  if (error) return <div className="card" style={{ padding: 24 }}><b>No se pudo iniciar COI V1.</b><p className="muted small">{error.message}</p></div>;
  if (!sesion) return <div className="card" style={{ padding: 24 }}><span className="muted">Abriendo sesión de COI V1…</span></div>;
  // `permitir`: entrada alternativa propia del aplicativo (p. ej. Arqueos con su llave).
  if (!puede(modulo) && !permitir) {
    return (
      <div className="card v1-locked">
        <Icon name="lock" />
        <div><b>Módulo no habilitado para {sesion.nombre}</b><p className="muted small">El usuario es ADMIN y en la hoja PERMISOS el módulo «{modulo}» está en NO (regla de COI V1). Cambie de usuario con «Ver como» o habilítelo en Administración.</p></div>
      </div>
    );
  }
  return children;
}
