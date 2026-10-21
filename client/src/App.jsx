import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ModalHost, OverlayProvider } from './components/Overlays.jsx';
import { AppProvider } from './context/AppContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { useApi } from './hooks/useApi.js';
import { api } from './lib/api.js';
import Login from './layout/Login.jsx';
import Shell from './layout/Shell.jsx';
import Junta from './views/Junta.jsx';
import { V1SessionProvider } from './views/coiv1/V1Session.jsx';
import './views/coiv1/v1.css';
import './layout/login/login.css';

/**
 * Arranque: lee la configuración de ingreso y la sesión del servidor (/api/auth).
 * Sin sesión muestra el ingreso; con sesión, el portal. Un 401 del API devuelve al ingreso.
 */
export default function App() {
  const [auth, setAuth] = useState({ cargando: true, config: null, usuario: null, error: null });

  useEffect(() => {
    let vivo = true;
    Promise.all([api.get('/api/auth/config'), api.get('/api/auth/me').catch((e) => (e.status === 401 ? null : Promise.reject(e)))])
      .then(([config, me]) => vivo && setAuth({ cargando: false, config, usuario: me ? me.usuario : null, error: null }))
      .catch((error) => vivo && setAuth({ cargando: false, config: null, usuario: null, error }));
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    const vencida = () => setAuth((a) => (a.usuario ? { ...a, usuario: null } : a));
    window.addEventListener('coi:sesion-vencida', vencida);
    return () => window.removeEventListener('coi:sesion-vencida', vencida);
  }, []);

  const entrar = useCallback((usuario) => setAuth((a) => ({ ...a, usuario })), []);
  const salir = useCallback(async () => {
    try { await api.post('/api/auth/logout', {}); } catch { /* la cookie vence sola */ }
    setAuth((a) => ({ ...a, usuario: null }));
  }, []);
  const ctx = useMemo(() => ({ usuario: auth.usuario, config: auth.config, salir }), [auth.usuario, auth.config, salir]);

  return (
    <OverlayProvider>
      {auth.cargando ? <div className="lx-boot" aria-label="Cargando COI"><span className="lx-spin" /></div>
        : auth.error ? <Fatal msg={auth.error.message} />
        : !auth.usuario ? <Login config={auth.config} onEnter={entrar} />
        : <AuthProvider value={ctx}><Portal usuario={auth.usuario} onLogout={salir} /></AuthProvider>}
    </OverlayProvider>
  );
}

function Portal({ usuario, onLogout }) {
  const catalog = useApi('/api/catalog');
  // Forma que usan el menú y la barra superior.
  const user = useMemo(() => ({
    name: usuario.nombre, initials: usuario.iniciales || usuario.nombre.slice(0, 2).toUpperCase(),
    email: usuario.correo, role: usuario.cargo || (usuario.roles || [])[0] || 'Usuario'
  }), [usuario]);

  if (catalog.error) return <Fatal msg={catalog.error.message} />;
  if (!catalog.data) return <div className="content"><span className="muted">Cargando COI…</span></div>;
  return (
    <AppProvider catalog={catalog.data}>
      <V1SessionProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/inicio" replace />} />
          <Route path="/junta" element={<Junta />} />
          <Route path="/:view" element={<Shell user={user} onLogout={onLogout} />} />
          <Route path="/:view/:sub" element={<Shell user={user} onLogout={onLogout} />} />
        </Routes>
        <ModalHost />
      </V1SessionProvider>
    </AppProvider>
  );
}

function Fatal({ msg }) {
  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: 40, color: '#242A54' }}>
      <h2>No se pudo conectar con el API de COI</h2>
      <p>Verifique que el servidor Node.js esté en ejecución (npm run dev). Detalle: {msg}</p>
    </div>
  );
}
