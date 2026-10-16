// TRAZA: gestión de solicitudes de los aplicativos del área (V.traza y V.trazaDetalle del demo).
// Lee y escribe en /api/traza; la pestaña activa y los filtros se conservan entre navegaciones.
import { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Loading, PageHead } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useApi } from '../hooks/useApi.js';
import { TZF, hydrate } from './traza/shared.jsx';
import { Capacidad, Etapas, Informe, Tablero } from './traza/Panels.jsx';
import Solicitudes from './traza/Solicitudes.jsx';
import Radicar from './traza/Radicar.jsx';
import Detalle from './traza/Detalle.jsx';

const SUB = [['tablero', 'Tablero'], ['solicitudes', 'Solicitudes'], ['etapas', 'Flujo por etapas'], ['capacidad', 'Capacidad'], ['informe', 'Informe de gestión'], ['radicar', 'Radicar solicitud']];

export default function Traza({ sub }) {
  const all = useApi('/api/traza');
  if (sub) return <Detalle key={sub} id={sub} onChanged={all.reload} />;
  return <TrazaHome all={all} />;
}

function TrazaHome({ all }) {
  const { go } = useApp();
  const [view, setViewS] = useState(TZF.view);
  const setView = (v) => { TZF.view = v; setViewS(v); };
  const TZ = useMemo(() => (all.data || []).map(hydrate), [all.data]);

  let body;
  if (!all.data) body = <Loading error={all.error} />;
  else if (view === 'tablero') body = <Tablero TZ={TZ} />;
  else if (view === 'solicitudes') body = <Solicitudes TZ={TZ} />;
  else if (view === 'etapas') body = <Etapas TZ={TZ} />;
  else if (view === 'capacidad') body = <Capacidad TZ={TZ} />;
  else if (view === 'informe') body = <Informe TZ={TZ} />;
  else body = <Radicar TZ={TZ} onCancel={() => setView('solicitudes')} onCreated={(t) => { TZF.view = 'solicitudes'; all.reload(); go('traza/' + t.id); }} />;

  return (
    <>
      <PageHead title="TRAZA" sub="Gestión de solicitudes de los aplicativos del área: radicación, priorización, ejecución, horas invertidas y trazabilidad hasta el cierre."
        right={<button className="btn btn-p" onClick={() => setView('radicar')}><Icon name="upload" />Radicar solicitud</button>} />
      <div className="subnav">
        {SUB.map((s) => (
          <button key={s[0]} className={view === s[0] ? 'on' : ''} onClick={() => setView(s[0])}>
            {s[1]}{s[0] === 'solicitudes' && <> <span className="cm-count">{TZ.length}</span></>}
          </button>
        ))}
      </div>
      {body}
    </>
  );
}
