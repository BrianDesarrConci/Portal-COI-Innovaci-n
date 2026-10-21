// Cliente 360 · Módulo especializado del cliente embebido en su espacio de trabajo.
// Si el módulo aún no se ha entregado, muestra su ficha «En construcción».
import Icon from '../../components/Icon.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { VISTAS_MODULOS } from '../../modulos/vistas.jsx';
import { EnConstruccion } from '../construccion/EnConstruccion.jsx';

export default function Modulo({ c }) {
  const { go } = useApp();
  const clave = c.modulo.view;
  const V = VISTAS_MODULOS[clave];
  return (
    <div className="c360-stack">
      <div className="c360-modbar">
        <span className="mi"><Icon name="layers" /></span>
        <div className="grow"><b>{c.modulo.nombre}</b><small>Módulo especializado de {c.nombre}{V ? ', integrado a su espacio de trabajo' : ' · en construcción'}</small></div>
        <button type="button" className="btn btn-o btn-sm" onClick={() => go(clave, { client: c.key })}><Icon name="eye" />Pantalla completa</button>
      </div>
      <div className="c360-embed">{V ? <V /> : <EnConstruccion clave={clave} />}</div>
    </div>
  );
}
