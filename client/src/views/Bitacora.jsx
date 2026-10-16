// Bitácora: registro de cada actividad ejecutada hoy, con su responsable y evidencia.
import Icon from '../components/Icon.jsx';
import { Avatar, Card, Cell, PageHead, Table, Tag } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { rng, hhmm } from '../lib/format.js';
import { MODULE_VIEW } from '../lib/model.js';

export default function Bitacora() {
  const { acts, todayState, daySeed, NOW_MIN, procName, isAuto, toast } = useApp();
  const ev = []; const r = rng(daySeed ^ 4242);
  acts.filter((a) => todayState[a.n] === 'done' && a.p !== 'M').slice(0, 40).forEach((a) => { ev.push({ t: 8 * 60 + Math.floor(r() * Math.max(30, NOW_MIN - 8 * 60)), a }); });
  ev.sort((x, y) => y.t - x.t);
  const rows = ev.slice(0, 24).map((e) => ({
    key: e.a.n, go: MODULE_VIEW[e.a.m] || null, cells: [
      <span className="num small">{hhmm(e.t)}</span>, <Cell main={e.a.d} sub={procName(e.a.p)} />, <Avatar id={e.a.a} />,
      isAuto(e.a) ? <Tag cls="b-info">Sistema</Tag> : <Tag>Manual</Tag>, <Tag cls="b-ok">Evidencia adjunta</Tag>
    ]
  }));
  return (
    <>
      <PageHead title="Bitácora" sub="Registro de cada actividad ejecutada, con su responsable y evidencia. Es la fuente de todos los indicadores de COI."
        right={<button className="btn btn-o" onClick={() => toast('Bitácora exportada.')}><Icon name="download" />Exportar</button>} />
      <Card title="Registro de hoy" sub="Seleccione una fila para abrir su módulo" flush>
        <Table headers={['Hora', 'Actividad', 'Responsable', 'Origen', 'Evidencia']} rows={rows} />
      </Card>
    </>
  );
}
