// N4 Alertas operativas.
import Icon from '../components/Icon.jsx';
import { PageHead, Kpis, Card, Table, Cell, Tabs, Tag, Bar, Avatar } from '../components/ui.jsx';
import { ModuleData, ToastBtn, Small, Mt } from './operacion/common.jsx';

const LEVEL = { bad: ['b-bad', 'Crítica'], warn: ['b-warn', 'Atención'], info: ['b-info', 'Informativa'], ok: ['b-ok', 'Cerrada'] };

export default function Alertas() {
  return <ModuleData view="alertas">{(d) => <Body d={d} />}</ModuleData>;
}

function Body({ d }) {
  const rows = d.al.map((a) => (
    <div className="list-row" key={a[1]}>
      <span className={'channel ' + (a[0] === 'bad' ? 'ch-aranda' : a[0] === 'ok' ? 'ch-wa' : 'ch-mail')}><Icon name={a[0] === 'ok' ? 'check' : a[0] === 'info' ? 'clock' : 'alert'} /></span>
      <div className="grow"><div className="strong">{a[1]}</div><div className="small muted">{a[2]}</div></div>
      <Avatar id={a[3]} />
      <Tag cls={LEVEL[a[0]][0]}>{LEVEL[a[0]][1]}</Tag>
      <span className="small muted" style={{ width: 100, textAlign: 'right' }}>{a[4]}</span>
    </div>
  ));

  return (
    <>
      <PageHead title="Alertas operativas" code="N4"
        sub="El sistema vigila excesos de efectivo, aperturas, programación de fines de semana, datáfonos y alarmas, y avisa a la persona responsable por correo y WhatsApp." />
      <Kpis items={[
        ['Alertas abiertas', 1, 'crítica, en gestión', 'bell'],
        ['Excesos de efectivo hoy', 2, 'ambos con transportadora solicitada', 'wallet'],
        ['Llegadas tarde hoy', 3, 'festivos excluidos del cálculo', 'clock'],
        ['Caídas de datáfono', 1, 'resuelta en 26 minutos', 'activity']
      ]} />
      <Mt>
        <Tabs items={[
          ['Alertas del día', <Card flush title="Alertas del día" right={<Tag cls="b-warn">1 abierta crítica</Tag>}>{rows}</Card>],
          ['Excesos de efectivo', <Card flush title="Saldo frente al cupo de póliza" sub="Porcentaje del cupo asegurado de cada oficina">
            <Table headers={['Oficina', 'Uso del cupo', '', 'Acción']} rows={d.exc.map((e) => [
              <Cell main={e[0]} />,
              <div style={{ width: 220 }}><Bar v={Math.min(100, e[1])} cls={e[1] > 100 ? 'gd' : 'nv'} /></div>,
              <span className={'num strong ' + (e[1] > 100 ? 'down' : '')}>{e[1]} %</span>,
              <Small>{e[2]}</Small>
            ])} />
          </Card>],
          ['Llegadas tarde', <Card flush title="Banco de Occidente, compromiso de apertura 7:30 a. m." sub="Fuente: transacción de apertura en PTR; los festivos no cuentan">
            <Table headers={['Oficina', 'Apertura', 'Minutos tarde', 'Justificación del líder']} rows={d.late.map((l) => [
              <Cell main={l[0]} />, <span className="num">{l[1]}</span>, <span className="num">{l[2]}</span>,
              l[3] === 'Pendiente' ? <Tag cls="b-warn">Pendiente</Tag> : <Small>{l[3]}</Small>
            ])} />
          </Card>],
          ['Fines de semana', <Card flush title="Programación de fines de semana BBVA" sub="Se notifica a Reval por correo y WhatsApp a las 5:30 p. m. del viernes"
            right={<ToastBtn className="btn btn-p btn-sm" msg="Programación de fines de semana enviada por correo y WhatsApp." icon="send">Enviar ahora</ToastBtn>}>
            <Table headers={['Día', 'Oficinas', 'Total']} rows={d.fds.map((f) => [<Cell main={f[0]} />, <Small>{f[1]}</Small>, <Tag cls="b-info">{f[2]}</Tag>])} />
          </Card>],
          ['Pruebas de alarma', <Card flush title="Pruebas de alarma de Fincomercio" sub="Tres oficinas monitoreadas por el cliente y nueve por Seguridad; consolidado mensual">
            <Table headers={['Oficina', 'Monitoreo', 'Prueba del mes']} rows={d.alarmas.map((x) => [
              <Cell main={x[0]} />, <Small>{x[1]}</Small>, x[2] ? <Tag cls="b-ok">Conforme</Tag> : <Tag cls="b-warn">Pendiente</Tag>
            ])} />
          </Card>]
        ]} />
      </Mt>
    </>
  );
}
