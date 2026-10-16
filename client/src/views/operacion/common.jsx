// Ayudantes compartidos por las vistas del grupo Operación (N1, N2, N3, N4, N7, N8).
import Icon from '../../components/Icon.jsx';
import { Loading } from '../../components/ui.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { useModuleData } from '../../hooks/useApi.js';

/** Canales de entrada de novedades: [icono, clase, nombre]. */
export const CH = { wa: ['chat', 'ch-wa', 'WhatsApp'], mail: ['mail', 'ch-mail', 'Correo'], form: ['form', 'ch-form', 'Formulario'], aranda: ['ticket', 'ch-aranda', 'Aranda'] };

/** Carga los datos del módulo y entrega el cuerpo de la vista cuando están listos. */
export function ModuleData({ view, children }) {
  const { data, error } = useModuleData(view);
  if (!data) return <Loading error={error} />;
  return children(data);
}

/** Botón que solo muestra un aviso (equivale a data-act="toast"). */
export function ToastBtn({ msg, icon, className = 'btn btn-o btn-sm', children }) {
  const { toast } = useApp();
  return <button type="button" className={className} onClick={() => toast(msg)}>{icon && <Icon name={icon} />}{children}</button>;
}

export const Small = ({ children }) => <span className="small">{children}</span>;
export const Mt = ({ children }) => <div className="mt">{children}</div>;
