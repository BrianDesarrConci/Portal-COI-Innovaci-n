// G5 Banco Agrario.
import { PageHead, Kpis, Card, Table, Cell, Tabs, LineChart, GasFrame, Tag, Loading } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useModuleData } from '../hooks/useApi.js';
import { fmt, MONTHS } from '../lib/format.js';
import { N, Small } from './cifras/common.jsx';

export default function Agrario() {
  const { D, NOW, PREV_MONTH } = useApp();
  const { data: d, error } = useModuleData('agrario');
  if (!d) return <Loading error={error} />;
  const mes = MONTHS[NOW.getMonth()];
  return (
    <>
      <PageHead title="Banco Agrario" code="G5"
        sub="Punteo de tulas y precintos sobre el formulario existente, certificaciones mensuales, anexo de calificación con revisión previa de Recursos Físicos y pendientes de 2025." />
      <Kpis items={d.kpis} />
      <div className="mt">
        <GasFrame code="G5" name="Banco Agrario">
          <Tabs items={[
            ['Punteo de tulas', (
              <Card title="Punteo electrónico de la semana" sub="Operación, precinto y guía de la transportadora" flush>
                <Table headers={['Operación', 'Precinto', 'Guía', 'Estado']}
                  rows={d.punteo.map((x) => [
                    <N>{x[0]}</N>, <N>{x[1]}</N>, x[2] ? <N>{x[2]}</N> : <span className="muted">Sin guía</span>,
                    x[3] === 'ok' ? <Tag cls="b-ok">Conciliada</Tag> : <Tag cls="b-warn">Alerta de guía faltante</Tag>,
                  ])} />
              </Card>
            )],
            ['Certificaciones', (
              <Card title="Certificaciones mensuales" sub="Cargadas al Drive del banco" flush>
                <Table headers={['Certificación', 'Alcance', 'Avance']} rows={d.certificaciones.map((c) => [<Cell main={c[0]} />, <Small>{c[1]}</Small>, <N strong>{c[2]}</N>])} />
              </Card>
            )],
            ['Anexo de calificación', (
              <div className="grid g2">
                <Card title={'Anexo de calificación de ' + PREV_MONTH} sub="Actas y novedades revisadas con Recursos Físicos antes de enviarlo">
                  <div className="timeline-v">
                    <div className="it cur"><div className="strong">Actas y novedades consolidadas</div><div className="small muted">2 de {mes}</div></div>
                    <div className="it cur"><div className="strong">Revisión con Recursos Físicos</div><div className="small muted">3 de {mes}, sin descuentos previstos</div></div>
                    <div className="it cur"><div className="strong">Anexo enviado al banco</div><div className="small muted">3 de {mes}</div></div>
                  </div>
                </Card>
                <Card title="Calificación del banco" sub="Últimos seis meses">
                  <LineChart series={[{ data: D.clientExtra.agrario.score, color: '#048C38', area: true }]} labels={D.months} min={3} max={5} fmt={(v) => fmt(v, 1)} label="Calificación" h={200} w={480} />
                </Card>
              </div>
            )],
            ['Pendientes', (
              <Card title="Pendientes y solicitudes del banco" flush>
                <Table headers={['Tema', 'Cantidad', 'Estado']} align={['', 'r', '']} rows={d.pendientes.map((p) => [<Cell main={p[0]} />, <N>{p[1]}</N>, <Small>{p[2]}</Small>])} />
              </Card>
            )],
          ]} />
        </GasFrame>
      </div>
    </>
  );
}
