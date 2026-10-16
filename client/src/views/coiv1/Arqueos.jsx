import { V1Bar, V1Guard, useV1 } from './V1Session.jsx';
import ArqueosApp from './arqueos/ArqueosApp.jsx';

// Control de Arqueos (COI V1): acceso embebido con la llave de arqueos del usuario de la sesión.
// Como en V1, se entra por el menú de COI (PERMISOS) o por el ingreso propio del aplicativo de
// Arqueos, que solo exige la llave (validarLogin/validarEmbebido).
// `sub` es la pestaña activa (/arqueos/cargar, /arqueos/historial, …).
export default function Arqueos({ sub }) {
  const { sesion } = useV1() || {};
  return (<><V1Bar /><V1Guard modulo="arqueos" permitir={!!(sesion && sesion.llave_arqueos)}><ArqueosApp sub={sub} /></V1Guard></>);
}
