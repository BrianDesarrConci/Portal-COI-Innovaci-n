import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';

const OverlayCtx = createContext(null);

/** Proveedor de avisos (toast) y ventanas modales. */
export function OverlayProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [modal, setModal] = useState(null);
  const seq = useRef(0);

  const toast = useCallback((msg) => {
    const id = ++seq.current;
    setToasts((t) => t.concat({ id, msg }));
    setTimeout(() => setToasts((t) => t.map((x) => x.id === id ? { ...x, fading: true } : x)), 3200);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  const openModal = useCallback((m) => setModal(m), []);
  const closeModal = useCallback((doneMsg) => { setModal(null); if (doneMsg) toast(doneMsg); }, [toast]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setModal(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <OverlayCtx.Provider value={{ toast, modal: openModal, closeModal }}>
      {children}
      {modal && <Modal {...modal} onClose={closeModal} />}
      <div className="toast-wrap" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast" style={t.fading ? { transition: 'opacity .3s', opacity: 0 } : undefined}>
            <Icon name="check" /><span>{t.msg}</span>
          </div>
        ))}
      </div>
    </OverlayCtx.Provider>
  );
}

function Modal({ title, body, foot, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => { closeRef.current && closeRef.current.focus(); }, []);
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="modal-h">
          <h3>{title}</h3>
          <button ref={closeRef} className="btn btn-g btn-sm" onClick={() => onClose()}><Icon name="x" />Cerrar</button>
        </div>
        <div className="modal-b">{body}</div>
        {foot && <div className="modal-f">{foot}</div>}
      </div>
    </div>
  );
}

export const useOverlay = () => useContext(OverlayCtx);

/** Botón de pie de modal: cierra la ventana y, si trae `done`, muestra ese aviso. */
export function ModalBtn({ done, className = 'btn btn-p', onClick, children }) {
  const { closeModal } = useOverlay();
  return <button className={className} onClick={() => { if (onClick) onClick(); closeModal(done); }}>{children}</button>;
}
