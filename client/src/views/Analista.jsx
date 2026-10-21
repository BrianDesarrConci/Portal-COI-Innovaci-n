// Ficha de una analista: actividades a cargo y su avance (en cero hasta que exista la bitácora).
import { Card, Cell, GoLink, HBars, Kpis, PageHead, Spark, StatusBadge, Table, Tag } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt, pct } from '../lib/format.js';
import { MODULE_VIEW } from '../lib/model.js';
import Analistas from './Analistas.jsx';

export default function Analista({ sub: id }) {
  const { AN, STATS, procName, isAuto, todayState } = useApp();
  const a = AN[id]; if (!a) return <Analistas />;
  const s = STATS[id];
  const byProc = {}; s.list.forEach((x) => { byProc[x.p] = (byProc[x.p] || 0) + 1; });
  const procBars = Object.keys(byProc).sort((p, q) => byProc[q] - byProc[p]).map((k) => [procName(k), byProc[k]]);
  const rows = s.list.map((x) => ({
    key: x.n, go: MODULE_VIEW[x.m] || null, cells: [
      <span className="num muted">{x.n}</span>, <Cell main={x.d} sub={x.cl} />, <span className="small">{x.f}</span>, <span className="small">{procName(x.p)}</span>,
      isAuto(x) ? <Tag cls="b-info">Automatizada</Tag> : <Tag>Monitoreada</Tag>, <StatusBadge st={todayState[x.n]} />
    ]
  }));
  return (
    <>
      <PageHead title={a.name} sub={a.role + '. ' + a.focus + '.'}
        crumb={<><GoLink to="analistas">Analistas</GoLink> / {a.name}</>} />
      <Kpis items={[
        ['Avance del día', pct(s.comp, 0), s.done + ' de ' + s.due + ' cerradas con evidencia', 'shield'],
        ['Actividades a cargo', s.total, s.auto + ' automatizables', 'list'],
        ['Horas liberadas', fmt(s.freed, 1), 'por semana frente a la línea base', 'clock', 'h'],
        ['Cumplimiento a 20 días', pct(s.month, 1), <Spark values={s.series} w={110} h={22} />, 'activity']
      ]} />
      <div className="grid g-main mt">
        <Card title="Actividades del día" sub="Seleccione una actividad para abrir su módulo" flush>
          <Table headers={['N.º', 'Actividad', 'Frecuencia', 'Proceso', 'Modalidad', 'Hoy']} rows={rows} />
        </Card>
        <div>
          <Card title="Distribución por proceso"><HBars rows={procBars} color="cy" /></Card>
        </div>
      </div>
    </>
  );
}
