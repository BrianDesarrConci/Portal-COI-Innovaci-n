// N6 Facturación y conciliación.
import { PageHead, Kpis, Card, Table, Cell, Tabs, LineChart, Avatar, Tag, Bar, Loading } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useModuleData } from '../hooks/useApi.js';
import { fmt, MONTHS } from '../lib/format.js';
import { N, Small, ToastBtn } from './cifras/common.jsx';

export default function Facturacion() {
  const { NOW } = useApp();
  const { data: d, error } = useModuleData('facturacion');
  if (!d) return <Loading error={error} />;

  const rows = d.facturacion.map((x) => [
    <Cell main={x[0]} sub={x[1]} />, <Avatar id={x[4]} />,
    <div style={{ width: 220 }}><Bar v={x[3] / x[2] * 100} cls={x[3] === x[2] ? '' : 'gd'} /><div className="small muted" style={{ marginTop: 4 }}>{x[3]} de {x[2]} novedades validadas</div></div>,
    x[3] === x[2] ? <Tag cls="b-ok">Lista para radicar</Tag> : <Tag cls="b-warn">Esperando líderes</Tag>,
  ]);
  const money = (v) => <N>$ {v}</N>;

  return (
    <>
      <PageHead title="Facturación y conciliación" sub="Novedades validadas por los líderes dentro de COI, cruces automáticos y control de descuentos por cliente." code="N6" />
      <Kpis items={d.kpis} />
      <div className="mt">
        <Tabs items={[
          ['Facturación del mes', (
            <Card title={'Facturación de ' + MONTHS[NOW.getMonth()]} sub="Avance de validación de novedades por cliente" flush>
              <Table headers={['Cliente', 'Responsable', 'Validación', 'Estado']} rows={rows} />
            </Card>
          )],
          ['Partidas de conciliación', (
            <Card title="Partidas con código" sub="Cada partida tiene responsable y trazabilidad, incluidas las abiertas desde 2022" flush>
              <Table headers={['Código', 'Cliente', 'Concepto', 'Valor', 'Estado']} align={['', '', '', 'r', '']}
                rows={d.partidas.map((p) => [<Cell main={p[0]} />, p[1], <Small>{p[2]}</Small>, money(p[3]), <Small>{p[4]}</Small>])} />
            </Card>
          )],
          ['Reembolsos Davivienda', (
            <Card title="Reembolsos" sub="Solicitud, envío a Eduardo y aprobación" flush>
              <Table headers={['Radicado', 'Oficina', 'Valor', 'Estado']} align={['', '', 'r', '']}
                rows={d.reembolsos.map((p) => [<Cell main={p[0]} />, p[1], money(p[2]), <Tag cls={p[3] === 'Aprobado' ? 'b-ok' : 'b-info'}>{p[3]}</Tag>])} />
            </Card>
          )],
          ['Cuentas de cobro y descuentos', (
            <div className="grid g2">
              <Card title="Cuentas de cobro por faltantes" sub="Fincomercio; seguimiento con Tesorería y Diferencias" flush>
                <Table headers={['Cuenta', 'Oficina', 'Valor', 'Estado']} align={['', '', 'r', '']}
                  rows={d.cuentasCobro.map((c) => [<Cell main={c[0]} />, c[1], money(c[2]), <Tag cls={c[3] === 'Descontado en nómina' ? 'b-ok' : 'b-info'}>{c[3]}</Tag>])} />
              </Card>
              <Card title="Descuentos vehiculares Davivienda" sub="Facturas generadas dentro del rango de tiempo del sistema" flush>
                <Table headers={['Radicado', 'Concepto', 'Estado']}
                  rows={d.descuentosVehiculares.map((c) => [<Cell main={c[0]} />, <Small>{c[1]}</Small>, <Tag cls={c[2] === 'Factura generada' ? 'b-ok' : 'b-warn'}>{c[2]}</Tag>])} />
              </Card>
            </div>
          )],
          ['Recaudo manual BBVA', (
            <Card title="Base de recaudo manual del mes" sub="Transacciones menores a 100.000 tipificadas automáticamente contra el directorio de códigos; se exporta en CSV" flush
              right={<ToastBtn msg="CSV de recaudo manual exportado." icon="download">Exportar CSV</ToastBtn>}>
              <Table headers={['Tipo', 'Transacciones', 'Tipificadas']} align={['', 'r', '']}
                rows={d.recaudoManual.map((r) => [<Cell main={r[0]} />, <N>{fmt(r[1])}</N>, r[1] === r[2] ? <Tag cls="b-ok">Completo</Tag> : <Tag cls="b-warn">{r[2]} de {r[1]}</Tag>])} />
            </Card>
          )],
          ['Descuentos por falta de personal', (
            <Card title="Histórico 2026 de descuentos" sub="Millones de pesos descontados por Banco de Bogotá y Fincomercio por falta de supernumerarios">
              <LineChart series={[{ data: d.descuentos.map((x) => x[1]), color: '#D6453D', area: true }]} labels={d.descuentos.map((x) => x[0])}
                min={0} max={3} fmt={(v) => fmt(v, 1) + ' M'} label="Descuentos 2026" h={220} />
            </Card>
          )],
        ]} />
      </div>
    </>
  );
}
