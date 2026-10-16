// G3 Usuarios, planta y directorios.
import { PageHead, Kpis, Card, Table, Cell, Tabs, HBars, DocRow, GasFrame, Tag, Loading } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useModuleData } from '../hooks/useApi.js';
import { N, Small, ToastBtn } from './cifras/common.jsx';

const NOV_CLS = { Retiro: 'b-warn', Ingreso: 'b-ok' };

export default function Usuarios() {
  const { PREV_MONTH } = useApp();
  const { data: d, error } = useModuleData('usuarios');
  if (!d) return <Loading error={error} />;
  return (
    <>
      <PageHead title="Usuarios, planta y directorios" code="G3"
        sub="Granja de usuarios de los lunes, planta de cajeros por cliente, creación de usuarios, informe de planta, parafiscales y directorios de la red." />
      <Kpis items={d.kpis} />
      <div className="mt">
        <GasFrame code="G3" name="usuarios y planta">
          <Tabs items={[
            ['Granja de usuarios', (
              <Card title="Granja de usuarios de esta semana" sub="Ingresos y retiros de la semana anterior; los líderes asignan backups" flush>
                <Table headers={['Funcionario', 'Novedad', 'Oficina', 'Backup', 'Notificado']}
                  rows={d.granja.map((x) => [
                    <Cell main={x[0]} />, <Tag cls={NOV_CLS[x[1]] || 'b-info'}>{x[1]}</Tag>, <Small>{x[2]}</Small>,
                    x[3] === 'Asignado' ? <Tag cls="b-ok">Asignado</Tag> : <Tag cls="b-warn">Pendiente</Tag>, <Small>{x[4]}</Small>,
                  ])} />
              </Card>
            )],
            ['Planta de cajeros', (
              <Card title="Planta de cajeros por cliente" sub="Usuarios por eliminar, mantener o ingresar" flush>
                <Table headers={['Cliente', 'Frecuencia', 'Mantener', 'Ingresar', 'Eliminar', '']} align={['', '', 'r', 'r', 'r', 'r']}
                  rows={d.planta.map((p) => [
                    <Cell main={p[0]} />, <Small>{p[1]}</Small>, <N>{p[2]}</N>, <N>{p[3]}</N>, <N>{p[4]}</N>,
                    <ToastBtn msg={'Planta de ' + p[0] + ' enviada.'} icon="send">Enviar</ToastBtn>,
                  ])} />
              </Card>
            )],
            ['Creación de usuarios', (
              <Card title="Usuarios en sistemas de clientes" sub="Responsable según cada cliente" flush>
                <Table headers={['Sistema', 'Responsable', 'Usuarios', 'Estado']} align={['', '', 'r', '']}
                  rows={d.creacion.map((c) => [<Cell main={c[0]} />, <Small>{c[1]}</Small>, <N>{c[2]}</N>, <Tag cls={c[3] === 'En gestión' ? 'b-info' : 'b-ok'}>{c[3]}</Tag>])} />
              </Card>
            )],
            ['Planta e ingresos', (
              <div className="grid g2">
                <Card title="Informe mensual de planta" sub="BBVA e Indega; notificación de cada ingreso"><HBars rows={d.informePlanta} color="nv" /></Card>
                <Card title="Parafiscales y formatos" sub="Mensual">
                  <DocRow title={'Formatos de parafiscales de ' + PREV_MONTH} sub="Generados y enviados" icon="file" right={<Tag cls="b-ok">Enviado</Tag>} />
                </Card>
              </div>
            )],
            ['Directorios', (
              <Card title="Directorios de la red transaccional" sub="Direcciones, oficinas y horarios; actualización mensual" flush>
                <Table headers={['Red', 'Última actualización', 'Estado']}
                  rows={d.directorios.map((x) => [<Cell main={x[0]} />, <N>{x[1]}</N>, <Tag cls="b-ok">Actualizado</Tag>])} />
              </Card>
            )],
          ]} />
        </GasFrame>
      </div>
    </>
  );
}
