import { PageHead } from '../../components/ui.jsx';
import { V1Bar, V1Guard } from './V1Session.jsx';

// Granja de Usuarios (COI V1): en migración.
export default function Granja() {
  return (<><V1Bar /><V1Guard modulo="novedades"><PageHead title="Granja de Usuarios" sub="Módulo de COI V1 en migración." /></V1Guard></>);
}
