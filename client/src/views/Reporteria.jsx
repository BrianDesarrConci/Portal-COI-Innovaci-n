// N5 Reportería y comités.
import Icon from '../components/Icon.jsx';
import { PageHead, Kpis, Card, Table, Cell, Tabs, LineChart, DocRow, Avatar, Tag, Loading } from '../components/ui.jsx';
import { useModuleData } from '../hooks/useApi.js';
import { fmt } from '../lib/format.js';
import { N, useActa } from './cifras/common.jsx';

const ESTADO_CLS = { Listo: 'b-ok', Programado: 'b-mute' };

export default function Reporteria() {
  const { data, error } = useModuleData('reporteria');
  if (!data) return <Loading error={error} />;
  return <Body d={data} />;
}

function Body({ d }) {
  const acta = useActa(d.acta);
  const rows = d.comites.map((c) => [
    <Cell main={c[0]} sub={c[1]} />, <N>{c[2]}</N>, <Avatar id={c[4]} />, <Tag cls={ESTADO_CLS[c[3]] || 'b-info'}>{c[3]}</Tag>,
    <button type="button" className="btn btn-o btn-sm" onClick={() => acta(c[0])}><Icon name="file" />Generar acta</button>,
  ]);
  const au = d.auditorias;
  const aud = au.oficinas.map((o, i) => [
    <Cell main={o} />, <N>{au.primerDia + i} {au.mes}</N>,
    i < au.auditadas ? <Tag cls="b-ok">Checklist completo</Tag> : <Tag cls="b-mute">Programada</Tag>,
    i < au.auditadas ? <span className="small">Soportes en Drive</span> : '',
  ]);
  return (
    <>
      <PageHead title="Reportería y comités" sub="Cifras, indicadores y actas de comité generados desde los datos de COI, sin armar presentaciones a mano." code="N5" />
      <Kpis items={d.kpis} />
      <div className="mt">
        <Tabs items={[
          ['Comités', (
            <div className="grid g-main">
              <Card title="Comités del mes" sub="Material listo antes de la fecha de cada cliente" flush>
                <Table headers={['Cliente', 'Fecha', 'Responsable', 'Estado', '']} rows={rows} align={['', '', '', '', 'r']} />
              </Card>
              <Card title="Recaudo BBVA" sub="Millones de pesos por mes">
                <LineChart series={[{ data: d.recaudo.data, color: '#242A54', area: true }]} labels={d.recaudo.months} fmt={(v) => fmt(v / 1000, 0) + ' mil'} label="Recaudo BBVA" h={230} w={520} />
              </Card>
            </div>
          )],
          ['Informes recurrentes', (
            <Card title="Informes recurrentes" sub="Se generan solos y quedan en la bitácora">
              <div className="docs-grid">{d.recurrentes.map((r, i) => <DocRow key={i} title={r[0]} sub={r[1]} icon="chart" right={<Avatar id={r[2]} />} />)}</div>
            </Card>
          )],
          ['Auditorías Fincomercio', (
            <Card title="Auditorías mensuales obligatorias" sub="Cronograma, lista de chequeo y soportes; videos solicitados por el cliente" flush>
              <Table headers={['Oficina', 'Fecha', 'Estado', 'Soportes']} rows={aud} />
            </Card>
          )],
        ]} />
      </div>
    </>
  );
}
