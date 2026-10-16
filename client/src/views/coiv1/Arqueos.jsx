import { PageHead } from '../../components/ui.jsx';
import { V1Bar, V1Guard } from './V1Session.jsx';

// Control de Arqueos (COI V1): en migración.
export default function Arqueos() {
  return (<><V1Bar /><V1Guard modulo="arqueos"><PageHead title="Control de Arqueos" sub="Módulo de COI V1 en migración." /></V1Guard></>);
}
