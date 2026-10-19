// Cliente 360 · Módulo especializado del cliente embebido en su espacio de trabajo.
import Icon from '../../components/Icon.jsx';
import { useApp } from '../../context/AppContext.jsx';
import Agrario from '../Agrario.jsx';
import Cheques from '../Cheques.jsx';
import Fincomercio from '../Fincomercio.jsx';

const VISTAS = { agrario: Agrario, cheques: Cheques, fincomercio: Fincomercio };

export default function Modulo({ c }) {
  const { go } = useApp();
  const V = VISTAS[c.modulo.view];
  if (!V) return null;
  return (
    <div className="c360-stack">
      <div className="c360-modbar">
        <span className="mi"><Icon name="layers" /></span>
        <div className="grow"><b>{c.modulo.nombre}</b><small>Módulo especializado de {c.nombre}, integrado a su espacio de trabajo</small></div>
        <button type="button" className="btn btn-o btn-sm" onClick={() => go(c.modulo.view, { client: c.key })}><Icon name="eye" />Pantalla completa</button>
      </div>
      <div className="c360-embed"><V /></div>
    </div>
  );
}
