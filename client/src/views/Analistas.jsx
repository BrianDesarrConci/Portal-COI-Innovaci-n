// Analistas: avance, cumplimiento y carga de cada integrante del equipo.
import { Avatar, PageHead, Spark } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt, pct } from '../lib/format.js';

export default function Analistas() {
  const { D, STATS, go } = useApp();
  return (
    <>
      <PageHead title="Analistas" sub="Actividades a cargo de cada integrante del equipo. El cumplimiento se calcula con la bitácora de actividades (en construcción). Seleccione una persona para ver su ficha." />
      <div className="grid g3">
        {D.analysts.map((a) => {
          const s = STATS[a.id];
          const open = () => go('analista/' + a.id);
          return (
            <div key={a.id} className="card an-card" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === 'Enter') open(); }}>
              <div className="an-top"><Avatar id={a.id} lg /><div className="grow"><h4>{a.name}</h4><div className="small muted">{a.focus}</div></div></div>
              <div className="an-stats">
                <div><b className="num">{s.total}</b><span>actividades</span></div>
                <div><b className="num">{pct(s.auto / s.total * 100, 0)}</b><span>automatizables</span></div>
                <div><b className="num">{fmt(s.freed, 1)} h</b><span>liberadas por semana</span></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div><div className="small muted">Cumplimiento a 20 días</div><div className="strong num">{pct(s.month, 1)}</div></div>
                <Spark values={s.series} w={130} h={34} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
