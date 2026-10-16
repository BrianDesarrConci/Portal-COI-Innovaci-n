// Procesos transversales: las 104 actividades del área agrupadas por proceso.
import { Avatar, Card, Cell, Kpis, Loading, PageHead, Table, Tag } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useModuleData } from '../hooks/useApi.js';
import { PROC_VIEW } from '../lib/model.js';

const Owners = ({ ids }) => ids.map((x) => <span key={x} style={{ marginRight: -6, display: 'inline-block' }}><Avatar id={x} /></span>);

export default function Procesos() {
  const { D, acts, clients, PR } = useApp();
  const { data, error } = useModuleData('procesos');
  if (!data) return <Loading error={error} />;
  const people = (list) => Array.from(new Set(list.map((a) => a.a)));
  const clientsOf = (list) => Array.from(new Set(list.reduce((s, a) => s.concat(a.c), [])));
  const rows = D.processes.map((p) => {
    const list = acts.filter((a) => a.p === p.id);
    const cls = clientsOf(list);
    return {
      key: p.id, go: PROC_VIEW[p.id], cells: [
        <Cell main={p.name} sub={p.summary} />, <Owners ids={people(list)} />,
        <span className="small">{cls.length ? cls.map((c) => clients[c].name).slice(0, 4).join(', ') + (cls.length > 4 ? ' y ' + (cls.length - 4) + ' más' : '') : 'Interno'}</span>,
        <span className="num">{list.length}</span>, <span className="small">{p.module.split(' ').join(', ')}</span>,
        p.id === data.alertProcess ? <Tag cls="b-warn">Alerta abierta</Tag> : <Tag cls="b-ok">En operación</Tag>
      ]
    };
  });
  const extra = data.extra.map((e) => {
    const list = acts.filter((x) => x.p === e[0]);
    const cls = clientsOf(list);
    return {
      key: e[0], go: e[3], cells: [
        <Cell main={e[1]} sub={e[2]} />, <Owners ids={people(list)} />,
        <span className="small">{cls.length ? cls.map((c) => clients[c].name).join(', ') : 'Interno'}</span>,
        <span className="num">{list.length}</span>, <span className="small">{e[4]}</span>, <Tag cls={e[6]}>{e[5]}</Tag>
      ]
    };
  });
  const nAuto = acts.filter((x) => PR[x.p]).length;
  const total = { key: 'total', cells: [<span className="strong">Total</span>, '', <span className="small muted">{nAuto} en los once procesos y {104 - nAuto} monitoreadas</span>, <span className="num strong">{acts.length}</span>, '', ''] };
  return (
    <>
      <PageHead title="Procesos transversales" sub={'Las 104 actividades del área: ' + nAuto + ' operan en los once procesos transversales y ' + (104 - nAuto) + ' se monitorean desde el tablero sin automatizar. Seleccione una fila para abrir su módulo.'} />
      <Kpis items={[
        ['Actividades del área', acts.length, 'el catálogo completo', 'list'],
        ['En procesos transversales', nAuto, 'automatizadas en once procesos', 'sparkle'],
        ['Monitoreadas', 104 - nAuto, '7 de analítica y 2 del tablero gerencial', 'eye'],
        ['Procesos en operación', 11, '1 con alerta abierta', 'layers']
      ]} />
      <div className="mt">
        <Card title="Procesos y actividades" flush>
          <Table headers={['Proceso', 'Analistas', 'Clientes', 'Actividades', 'Módulos', 'Estado']} align={['', '', '', 'c', '', '']} rows={rows.concat(extra).concat([total])} />
        </Card>
      </div>
    </>
  );
}
