import { PageHead } from '../../components/ui.jsx';
import { V1Bar, V1Guard } from './V1Session.jsx';

// Centro de captura (COI V1): en migración.
export default function Captura() {
  return (<><V1Bar /><V1Guard modulo="centro"><PageHead title="Centro de captura" sub="Módulo de COI V1 en migración." /></V1Guard></>);
}
