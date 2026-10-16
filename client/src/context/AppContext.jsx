import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildModel } from '../lib/model.js';
import { useOverlay } from '../components/Overlays.jsx';

const AppCtx = createContext(null);

/**
 * Estado global de la aplicación: modelo derivado del catálogo, navegación
 * interna y cliente en contexto (cuando se entra a un módulo desde un cliente).
 */
export function AppProvider({ catalog, children }) {
  const model = useMemo(() => buildModel(catalog), [catalog]);
  const navigate = useNavigate();
  const overlay = useOverlay();
  const [ctxClient, setCtxClient] = useState(null);

  /** Navega a una ruta interna como 'cliente/bbva' o 'traza/TRZ-0405'. */
  const go = useCallback((path, opts = {}) => {
    if (opts.client !== undefined) setCtxClient(opts.client);
    navigate('/' + (path || 'inicio'), { state: opts.keepScroll ? { keepScroll: true } : undefined });
  }, [navigate]);

  const { toast, modal, closeModal } = overlay;
  const value = useMemo(() => ({ ...model, model, go, ctxClient, setCtxClient, toast, modal, closeModal }), [model, go, ctxClient, toast, modal, closeModal]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

/** Acceso al modelo, navegación (`go`), avisos (`toast`) y modales (`modal`). */
export const useApp = () => useContext(AppCtx);
