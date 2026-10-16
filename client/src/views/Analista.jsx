// Ficha de una analista: su día, actividades a cargo y tiempo liberado.
import Icon from '../components/Icon.jsx';
import { Card, Cell, GoLink, HBars, Kpis, PageHead, Spark, StatusBadge, Table, Tag } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt, pct } from '../lib/format.js';
import { MODULE_VIEW } from '../lib/model.js';
import Analistas from './Analistas.jsx';
import { useMonitoreoActions } from './monitoreo/actions.jsx';

export default function Analista({ sub: id }) {
  const { AN, STATS, procName, isAuto, todayState } = useApp();
  const act = useMonitoreoActions();
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
  const daily = Math.max(1.2, a.baseHours - s.freed / 5);
  return (
    <>
      <PageHead title={a.name} sub={a.role + '. ' + a.focus + '.'}
        right={<button className="btn btn-o" onClick={() => act.mensaje(id)}><Icon name="mail" />Enviar mensaje</button>}
        crumb={<><GoLink to="analistas">Analistas</GoLink> / {a.name}</>} />
      <Kpis items={[
        ['Avance del día', pct(s.comp, 0), s.done + ' de ' + s.due + ' cerradas con evidencia', 'shield'],
        ['Actividades a cargo', s.total, s.auto + ' automatizadas', 'list'],
        ['Horas liberadas', fmt(s.freed, 1), 'por semana frente a la línea base', 'clock', 'h'],
        ['Cumplimiento a 20 días', pct(s.month, 1), <Spark values={s.series} w={110} h={22} />, 'activity']
      ]} />
      <div className="grid g-main mt">
        <Card title="Actividades del día" sub="Seleccione una actividad para abrir su módulo" flush>
          <Table headers={['N.º', 'Actividad', 'Frecuencia', 'Proceso', 'Modalidad', 'Hoy']} rows={rows} />
        </Card>
        <div>
          <Card title="Distribución por proceso"><HBars rows={procBars} color="cy" /></Card>
          <div className="mt">
            <Card title="Tiempo diario en tareas repetitivas"><HBars rows={[['Línea base', a.baseHours, fmt(a.baseHours, 1) + ' h'], ['Con COI', daily, fmt(daily, 1) + ' h']]} color="nv" /></Card>
          </div>
        </div>
      </div>
    </>
  );
}
