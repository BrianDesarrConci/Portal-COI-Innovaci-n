import { PageHead } from '../../components/ui.jsx';
import { V1Bar, V1Guard } from './V1Session.jsx';

// Administración (COI V1): en migración.
export default function AdminV1() {
  return (<><V1Bar /><V1Guard modulo="administracion"><PageHead title="Administración" sub="Módulo de COI V1 en migración." /></V1Guard></>);
}
