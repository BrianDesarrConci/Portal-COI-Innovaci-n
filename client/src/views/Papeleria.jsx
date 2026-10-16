// G2 Papelería e insumos.
import { PageHead, Kpis, Card, Table, Cell, Tabs, HBars, GasFrame, Tag, Loading } from '../components/ui.jsx';
import { useModuleData } from '../hooks/useApi.js';
import { N, Small, ToastBtn } from './cifras/common.jsx';

export default function Papeleria() {
  const { data: d, error } = useModuleData('papeleria');
  if (!d) return <Loading error={error} />;
  return (
    <>
      <PageHead title="Papelería e insumos" code="G2"
        sub="Solicitudes de las oficinas, pedido mensual consolidado de la primera semana y cálculo bimensual de papelería bancaria del Banco Agrario." />
      <Kpis items={d.kpis} />
      <div className="mt">
        <GasFrame code="G2" name="papelería">
          <Tabs items={[
            ['Solicitudes', (
              <Card title="Solicitudes recientes" flush right={<ToastBtn msg="Formulario de solicitud enviado a las oficinas." icon="form">Formulario para oficinas</ToastBtn>}>
                <Table headers={['Oficina', 'Elementos', 'Estado']}
                  rows={d.solicitudes.map((s) => [<Cell main={s[0]} />, <Small>{s[1]}</Small>, <Tag cls={s[2] === 'Aprobada' ? 'b-ok' : 'b-info'}>{s[2]}</Tag>])} />
              </Card>
            )],
            ['Pedido mensual', (
              <Card title="Pedido consolidado de noviembre" sub="Unidades" right={<ToastBtn className="btn btn-p btn-sm" msg="Pedido de papelería enviado a Compras." icon="send">Enviar a Compras</ToastBtn>}>
                <HBars rows={d.pedido} color="nv" />
              </Card>
            )],
            ['Banco Agrario bimensual', (
              <Card title="Cálculo de papelería bancaria" sub="Banco Agrario, cada dos meses" flush>
                <Table headers={['Concepto', 'Valor']} align={['', 'r']} rows={d.agrario.map((a) => [<Cell main={a[0]} />, <N strong>{a[1]}</N>])} />
              </Card>
            )],
          ]} />
        </GasFrame>
      </div>
    </>
  );
}
