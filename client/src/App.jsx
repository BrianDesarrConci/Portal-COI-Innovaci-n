import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ModalHost, OverlayProvider } from './components/Overlays.jsx';
import { AppProvider } from './context/AppContext.jsx';
import { useApi } from './hooks/useApi.js';
import Login from './layout/Login.jsx';
import Shell from './layout/Shell.jsx';
import Junta from './views/Junta.jsx';
import { V1SessionProvider } from './views/coiv1/V1Session.jsx';
import './views/coiv1/v1.css';

// Usuario de la demo. En producción llega del inicio de sesión corporativo.
const USER = { name: 'Nubia Parrado', initials: 'NP', email: 'nubia.parrado@reval.com.co', role: 'Directora' };
const SESSION_KEY = 'coi.session';

export default function App() {
  const [logged, setLogged] = useState(() => { try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; } });
  const catalog = useApi('/api/catalog');
  const setSession = (v) => { setLogged(v); try { v ? sessionStorage.setItem(SESSION_KEY, '1') : sessionStorage.removeItem(SESSION_KEY); } catch { /* sin almacenamiento */ } };

  return (
    <OverlayProvider>
      {!logged ? <Login user={USER} onEnter={() => setSession(true)} />
        : catalog.error ? <Fatal msg={catalog.error.message} />
        : !catalog.data ? <div className="content"><span className="muted">Cargando COI…</span></div>
        : (
          <AppProvider catalog={catalog.data}>
            <V1SessionProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/inicio" replace />} />
              <Route path="/junta" element={<Junta />} />
              <Route path="/:view" element={<Shell user={USER} onLogout={() => setSession(false)} />} />
              <Route path="/:view/:sub" element={<Shell user={USER} onLogout={() => setSession(false)} />} />
            </Routes>
            <ModalHost />
            </V1SessionProvider>
          </AppProvider>
        )}
    </OverlayProvider>
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
