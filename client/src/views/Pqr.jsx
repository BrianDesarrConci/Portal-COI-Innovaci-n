// N3 PQR, reclamaciones y encuestas.
import { PageHead, Kpis, Card, Table, Cell, Tabs, Tag, Bar, Avatar, HBars } from '../components/ui.jsx';
import { ModalBtn } from '../components/Overlays.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt, pct } from '../lib/format.js';
import { ModuleData, ToastBtn, Small, Mt } from './operacion/common.jsx';

export default function Pqr() {
  return <ModuleData view="pqr">{(d) => <Body d={d} />}</ModuleData>;
}

function Body({ d }) {
  const { modal } = useApp();
  const PQR = d.pqr;

  const open = (x) => modal({
    title: x[0] + ', ' + x[1],
    body: <div className="timeline-v">
      <div className="it cur"><div className="strong">Radicada por código QR</div><div className="small muted">{x[2]}</div></div>
      <div className={'it ' + (x[4] ? 'cur' : '')}><div className="strong">Ampliación de información</div><div className="small muted">{x[4]} de 3 permitidas</div></div>
      <div className={'it ' + (/líder|video/.test(x[3]) ? 'cur' : '')}><div className="strong">Respuesta del líder</div><div className="small muted">Solicitada por el sistema</div></div>
      <div className="it"><div className="strong">Respuesta al cliente</div><div className="small muted">{x[5]} días hábiles restantes</div></div>
    </div>,
    foot: <>
      <ModalBtn className="btn btn-o" done="Caso escalado a Jurídica.">Escalar a Jurídica</ModalBtn>
      <ModalBtn done="Ampliación de información solicitada.">Pedir ampliación</ModalBtn>
    </>
  });

  const rows = PQR.map((x) => ({
    key: x[0], onClick: () => open(x),
    cells: [
      <span className="num strong">{x[0]}</span>,
      <Cell main={x[1]} sub={x[2]} />,
      <Small>{x[3]}</Small>,
      <span className="num">{x[4]} de 3</span>,
      <div style={{ width: 170 }}><Bar v={(15 - x[5]) / 15 * 100} cls={x[5] < 6 ? 'gd' : 'cy'} /><div className="small muted" style={{ marginTop: 4 }}>{x[5]} días hábiles restantes</div></div>,
      <Avatar id={x[6]} />
    ]
  }));

  return (
    <>
      <PageHead title="PQR, reclamaciones y encuestas" code="N3"
        sub="Radicación por código QR, ampliaciones controladas, respuesta del líder y escalamiento a Jurídica, con el reporte del día 1 generado automáticamente."
        right={<ToastBtn className="btn btn-o" msg="Reporte de PQR del mes generado." icon="download">Reporte del mes</ToastBtn>} />
      <Kpis items={[
        ['PQR abiertas', PQR.length, 'ninguna vencida', 'message'],
        ['Tiempo medio de respuesta', '4,1', 'días hábiles', 'clock', 'd'],
        ['Encuestas del mes', fmt(642), 'con líder y gerente regional asignados', 'list'],
        ['Satisfacción en encuestas', '91,4 %', <><span className="up">+2,1</span> frente al mes anterior</>, 'star']
      ]} />
      <Mt>
        <Tabs items={[
          ['PQR en gestión', <Card flush title="Casos en gestión" sub="Seleccione un caso para ver su trazabilidad">
            <Table headers={['Radicado', 'Asunto', 'Etapa', 'Ampliaciones', 'Plazo', 'Responsable']} rows={rows} />
          </Card>],
          ['Derechos de petición y tutelas', <Card flush title="Casos remitidos a Jurídica" sub="Plazo legal de 15 días hábiles para derechos de petición">
            <Table headers={['Radicado', 'Asunto', 'Días restantes', 'Estado']} rows={d.jur.map((j) => [
              <Cell main={j[0]} />, <Cell main={j[1]} sub={j[2]} />,
              <span className={'num ' + (j[3] < 5 ? 'down' : '')}>{j[3]} días</span>,
              <Tag cls="b-info">{j[4]}</Tag>
            ])} />
          </Card>],
          ['Encuestas', <div className="grid g2">
            <Card title="Satisfacción por regional" sub="Encuestas del mes, descargadas del aplicativo de Tecnología">
              <HBars rows={d.enc.map((e) => [e[0], e[1], pct(e[1], 1)])} color="nv" min={85} />
            </Card>
            <Card flush title="Calidad de los datos" sub="Antes de consolidar">
              <Table headers={['Control', 'Resultado']} rows={d.calidad.map((c) => [<Cell main={c[0]} />, <Tag cls={c[2]}>{c[1]}</Tag>])} />
            </Card>
          </div>]
        ]} />
      </Mt>
    </>
  );
}
