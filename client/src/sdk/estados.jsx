import Icon from '../components/Icon.jsx';
import { Loading } from '../components/ui.jsx';
import './sdk.css';

/**
 * Estados de pantalla comunes para los módulos.
 *   <Vacio titulo="Aún no hay registros" texto="Registre el primero con el botón Nuevo." />
 *   if (r.error) return <ErrorModulo error={r.error} reintentar={r.reload} />;
 *   if (!r.data) return <Cargando />;
 */
export function Vacio({ icono = 'inbox', titulo = 'Aún no hay información', texto, accion }) {
  return (
    <div className="coi-sdk-vacio" role="status">
      <span className="coi-sdk-vacio-ic"><Icon name={icono} /></span>
      <b>{titulo}</b>
      {texto && <p>{texto}</p>}
      {accion}
    </div>
  );
}

/** Error al cargar datos del módulo. Un 503 significa que la base MySQL del portal aún no está configurada. */
export function ErrorModulo({ error, reintentar }) {
  const sinBD = error && error.status === 503;
  return (
    <div className={'coi-sdk-error' + (sinBD ? ' info' : '')} role="alert">
      <span className="coi-sdk-vacio-ic"><Icon name={sinBD ? 'layers' : 'alert'} /></span>
      <div>
        <b>{sinBD ? 'Base de datos pendiente de configurar' : 'No se pudieron cargar los datos'}</b>
        <p>{sinBD ? 'El módulo está instalado, pero la base MySQL del portal todavía no está conectada. Los datos aparecerán aquí cuando Innovación la configure.' : (error && error.message) || 'Intente de nuevo en unos minutos.'}</p>
        {reintentar && !sinBD && <button type="button" className="btn btn-o" onClick={reintentar}>Reintentar</button>}
      </div>
    </div>
  );
}

/** Esqueleto de carga con la línea gráfica del portal. */
export const Cargando = () => <Loading />;
