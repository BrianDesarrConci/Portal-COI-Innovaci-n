import { PageHead } from '../../components/ui.jsx';
import { V1Bar, V1Guard } from './V1Session.jsx';

// Inicio COI V1 (COI V1): en migración.
export default function Coiv1Inicio() {
  return (<><V1Bar /><V1Guard modulo="inicio"><PageHead title="Inicio COI V1" sub="Módulo de COI V1 en migración." /></V1Guard></>);
}
