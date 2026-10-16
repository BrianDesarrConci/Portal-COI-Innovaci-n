import { PageHead } from '../../components/ui.jsx';
import { V1Bar, V1Guard } from './V1Session.jsx';

// Brain RT (COI V1): en migración.
export default function Brain() {
  return (<><V1Bar /><V1Guard modulo="brain"><PageHead title="Brain RT" sub="Módulo de COI V1 en migración." /></V1Guard></>);
}
