// Expediente de un cliente: módulos de gestión, ANS vigente con su historial y actividades.
import Icon from '../components/Icon.jsx';
import { Avatar, Card, Cell, DocRow, GoLink, Kpis, LineChart, Loading, PageHead, StatusBadge, Table, Tabs, Tag } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useModuleData } from '../hooks/useApi.js';
import { fmt, shortDate } from '../lib/format.js';
import { MODULE_VIEW } from '../lib/model.js';
import Clientes from './Clientes.jsx';
import { useMonitoreoActions } from './monitoreo/actions.jsx';
import { ClientModules } from './monitoreo/clientModules.jsx';

const num = (s) => parseFloat(s.replace(',', '.'));

export default function Cliente({ sub: k }) {
  const { D, clients, clientActs, procName, todayState, firstName, PREV_MONTH } = useApp();
  const act = useMonitoreoActions();
  const { data, error } = useModuleData('clientes');
  const c = clients[k], x = D.clientExtra[k]; if (!c) return <Clientes />;
  if (!data) return <Loading error={error} />;
  const list = clientActs(k);
  const met = x.clauses.filter((cl) => num(cl[3]) >= num(cl[2])).length;
  const vmaj = parseInt(x.ans.slice(1), 10), vmin = parseInt(x.ans.split('.')[1], 10);
  const hist = [[x.ans, x.ansDate, 'Versión vigente', true]].concat(D.ansHistory.default.map((h, i) => {
    const d = new Date(x.ansDate + 'T12:00:00'); d.setMonth(d.getMonth() - (i + 1) * 5);
    const ver = i === 2 ? 'v1.0' : 'v' + (i === 0 && vmin > 0 ? vmaj + '.' + (vmin - 1) : Math.max(1, vmaj - i) + '.0');
    return [ver, d.toISOString().slice(0, 10), h[0], false];
  }));
  const clauses = x.clauses.map((cl) => [
    <Cell main={cl[0]} />, <span className="small">{cl[1]}</span>, <span className="num">{cl[2]}</span>, <span className="num strong">{cl[3]}</span>,
    num(cl[3]) >= num(cl[2]) ? <Tag cls="b-ok">Cumple</Tag> : <Tag cls="b-warn">Por debajo</Tag>
  ]);
  const svc = list.map((a) => ({ key: a.n, go: MODULE_VIEW[a.m] || null, cells: [<span className="num muted">{a.n}</span>, <Cell main={a.d} />, <Avatar id={a.a} />, <span className="small">{procName(a.p)}</span>, <StatusBadge st={todayState[a.n]} />] }));
  const openBtn = (onClick) => <button className="btn btn-g btn-sm" onClick={onClick}><Icon name="eye" />Abrir</button>;

  const expediente = (
    <>
      <div className="grid g-main mt">
        <Card title="Checklist del acuerdo de nivel de servicio" sub={'Medición del mes contra la versión ' + x.ans} flush>
          <Table headers={['Cláusula', 'Plazo', 'Meta', 'Resultado', 'Estado']} align={['', '', 'r', 'r', '']} rows={clauses} />
        </Card>
        <Card title="Historial del ANS" sub="La versión vigente rige el checklist y la medición">
          <div className="timeline-v">
            {hist.map((h, i) => (
              <div key={i} className={'it ' + (h[3] ? 'cur' : '')}>
                <div className="strong">{h[0]}{h[3] && <> <Tag cls="b-ok">Vigente</Tag></>}</div>
                <div className="small muted">{shortDate(h[1])}. {h[2]}.</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="grid g2 mt">
        <Card title="Evaluaciones del cliente" sub={'Calificación mensual emitida por ' + c.name}>
          <LineChart series={[{ data: x.score, color: '#242A54', area: true }]} labels={D.months} min={3} max={5} fmt={(v) => fmt(v, 1)} label="Evaluaciones" h={210} w={560} />
        </Card>
        <Card title="Documentos del expediente" sub="Última versión disponible">
          <div style={{ display: 'grid', gap: 10 }}>
            <DocRow title={'Acuerdo de nivel de servicio ' + x.ans} sub={'PDF firmado, ' + shortDate(x.ansDate)} icon="file" right={openBtn(() => act.ans(k))} />
            <DocRow title={'Evaluación del servicio de ' + PREV_MONTH} sub={'Formato del cliente, ' + fmt(x.score[5], 1) + ' / 5'} icon="star" right={openBtn(() => act.evaluacion(k))} />
            <DocRow title="Acta del último comité" sub="Generada por COI" icon="chart" right={openBtn(() => act.acta(c.name, data.acta))} />
          </div>
        </Card>
      </div>
    </>
  );

  return (
    <>
      <PageHead title={c.name} sub={c.desc + (x.offices ? '. ' + x.offices + ' oficinas en operación' : '') + '.'}
        right={<>
          <button className="btn btn-o" onClick={() => act.ans(k)}><Icon name="file" />Ver ANS vigente</button>
          <button className="btn btn-p" onClick={() => act.evaluacion(k)}><Icon name="upload" />Registrar evaluación</button>
        </>}
        crumb={<><GoLink to="clientes">Clientes</GoLink> / {c.name}</>} />
      <Kpis items={[
        ['Evaluación vigente', fmt(x.score[5], 1), 'emitida por el cliente en ' + PREV_MONTH, 'star', '/ 5'],
        ['Cláusulas del ANS cumplidas', met + ' de ' + x.clauses.length, 'versión ' + x.ans + ' vigente desde ' + shortDate(x.ansDate), 'shield'],
        ['Servicios en COI', list.length, 'actividades con responsable y evidencia', 'list'],
        ['Analistas responsables', x.owners.length, x.owners.map(firstName).join(', '), 'users']
      ]} />
      <div className="mt">
        <Tabs items={[
          ['Módulos de gestión', <ClientModules k={k} list={list} />],
          ['Expediente y ANS', expediente],
          ['Todas las actividades', (
            <Card title="Servicios y actividades" sub={'Todo lo que Apoyo al Negocio hace para ' + c.name + '; seleccione una fila para abrir su módulo'} flush>
              <Table headers={['N.º', 'Actividad', 'Responsable', 'Proceso', 'Hoy']} rows={svc} />
            </Card>
          )]
        ]} />
      </div>
    </>
  );
}
