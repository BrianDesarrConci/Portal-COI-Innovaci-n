import { PageHead } from '../../components/ui.jsx';
import { V1Bar, V1Guard } from './V1Session.jsx';

// Experiencia de Cliente (COI V1): en migración.
export default function Experiencia() {
  return (<><V1Bar /><V1Guard modulo="experiencia"><PageHead title="Experiencia de Cliente" sub="Módulo de COI V1 en migración." /></V1Guard></>);
}
