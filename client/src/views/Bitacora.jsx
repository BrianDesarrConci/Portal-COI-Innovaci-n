// Bitácora: registro de cada actividad ejecutada, con su responsable y evidencia.
// Es la fuente de los indicadores de cumplimiento; se alimenta cuando los módulos entren en operación.
import Icon from '../components/Icon.jsx';
import { Card, Kpis, PageHead } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { longDate } from '../lib/format.js';

export default function Bitacora() {
  const { acts, NOW } = useApp();
  return (
    <>
      <PageHead title="Bitácora" sub="Registro de cada actividad ejecutada, con su responsable y evidencia. Es la fuente de todos los indicadores de COI." />
      <Kpis items={[
        ['Registros de hoy', 0, longDate(NOW), 'clock'],
        ['Con evidencia', 0, 'Soportes adjuntos', 'filecheck'],
        ['Actividades del catálogo', acts.length, 'Que registrarán su ejecución aquí', 'list'],
        ['Pendientes de registro', 0, 'Según la frecuencia de cada actividad', 'bell'],
      ]} />
      <div className="mt">
        <Card title="Registro de hoy">
          <div className="ntf-empty lg"><Icon name="clock" /><b>Sin registros</b><small>Cada módulo anotará aquí las actividades que ejecute, con su responsable y evidencia.</small></div>
        </Card>
      </div>
    </>
  );
}
