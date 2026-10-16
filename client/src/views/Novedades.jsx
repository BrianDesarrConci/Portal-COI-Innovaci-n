// N2 Novedades y requerimientos.
import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import { PageHead, Kpis, Card, Table, Cell, Tabs, Tag, Avatar, HBars, Field, areaStyle } from '../components/ui.jsx';
import { ModalBtn } from '../components/Overlays.jsx';
import { useApp } from '../context/AppContext.jsx';
import { leftTime } from '../lib/format.js';
import { ModuleData, ToastBtn, Small, Mt, CH } from './operacion/common.jsx';

const prioCls = (p) => p === 'Alta' ? 'b-bad' : p === 'Media' ? 'b-warn' : 'b-mute';
const caseId = (i) => 'NOV-' + (2610 + i * 7);

export default function Novedades() {
  return <ModuleData view="novedades">{(d) => <Body d={d} />}</ModuleData>;
}

function Body({ d }) {
  const { AN, toast, modal } = useApp();
  const [confirmed, setConfirmed] = useState({});
  const NOV = d.nov;

  const caso = (i) => {
    const it = NOV[i]; const c = CH[it[0]];
    modal({
      title: 'Caso ' + caseId(i),
      body: <>
        <div className="grid g2" style={{ marginBottom: 16 }}>
          <div><Cell main={it[2]} sub={it[1]} /></div>
          <div style={{ textAlign: 'right' }}><Tag cls={it[5] === 'Alta' ? 'b-bad' : 'b-warn'}>{it[5]}</Tag> <span className="countdown">{leftTime(it[4])}</span></div>
        </div>
        <div className="timeline-v">
          <div className="it cur"><div className="strong">Recibido por {c[2].toLowerCase()}</div><div className="small muted">Clasificado por el sistema y asignado a {AN[it[3]].name}</div></div>
          <div className="it cur"><div className="strong">Confirmación automática al cliente</div><div className="small muted">Con número de caso y plazo del ANS</div></div>
          <div className="it"><div className="strong">Gestión de la analista</div><div className="small muted">Pendiente</div></div>
        </div>
        <Field label="Respuesta al cliente"><textarea rows={3} style={areaStyle} defaultValue="Buen día. Su solicitud está en gestión; le confirmaremos el cierre por este medio." /></Field>
      </>,
      foot: <>
        <ModalBtn className="btn btn-o">Cerrar</ModalBtn>
        <ModalBtn done="Respuesta enviada y caso actualizado.">Enviar respuesta</ModalBtn>
      </>
    });
  };
  const reconfirmar = (i) => { setConfirmed((c) => ({ ...c, [i]: true })); toast('Reconfirmación enviada por WhatsApp al mensajero.'); };

  const sorted = NOV.map((it, i) => it.concat([i])).sort((p, q) => p[4] - q[4]);
  const rows = sorted.map((it) => {
    const c = CH[it[0]];
    return {
      key: it[6], onClick: () => caso(it[6]),
      cells: [
        <span className={'channel ' + c[1]} title={c[2]}><Icon name={c[0]} /></span>,
        <Cell main={it[2]} sub={it[1] + ', ' + c[2].toLowerCase() + ', caso ' + caseId(it[6])} />,
        <Avatar id={it[3]} />,
        <Tag cls={prioCls(it[5])}>{it[5]}</Tag>,
        <><span className={'countdown ' + (it[4] < 60 ? 'down' : '')}>{leftTime(it[4])}</span><div className="cell-sub">para vencer ANS</div></>,
        <button className="btn btn-o btn-sm">Atender</button>
      ]
    };
  });
  const byCh = { wa: 0, mail: 0, form: 0, aranda: 0 }; NOV.forEach((n) => byCh[n[0]]++);

  return (
    <>
      <PageHead title="Novedades y requerimientos" code="N2"
        sub="Un solo canal con los bancos: correo, WhatsApp, Aranda y formularios llegan aquí con responsable y acuerdo de servicio." />
      <Kpis items={[
        ['Casos abiertos', NOV.length, '5 de prioridad alta', 'inbox'],
        ['Cerrados hoy', 37, 'tiempo medio 2,4 h', 'check'],
        ['Dentro del ANS', '98,6 %', 'últimos 30 días', 'shield'],
        ['Canales unificados', 4, 'correo, WhatsApp, Aranda y formularios', 'layers']
      ]} />
      <Mt>
        <Tabs items={[
          ['Bandeja única', <div className="grid g-main">
            <Card flush title="Casos abiertos" sub="Ordenados por tiempo restante del acuerdo de servicio; seleccione uno para ver su historial">
              <Table headers={['Canal', 'Caso', 'Responsable', 'Prioridad', 'Tiempo', '']} rows={rows} align={['', '', '', '', 'r', 'r']} />
            </Card>
            <Card title="Entrada por canal" sub="Casos abiertos">
              <HBars rows={[['WhatsApp', byCh.wa], ['Correo', byCh.mail], ['Formularios', byCh.form], ['Aranda', byCh.aranda]]} color="cy" />
            </Card>
          </div>],
          ['Reunión semanal BBVA', <Card flush title="Reunión de seguimiento con Edwin, martes 10:00 a. m." sub="Agenda y compromisos generados desde las novedades de la semana"
            right={<ToastBtn msg="Agenda del martes enviada a BBVA." icon="send">Enviar agenda</ToastBtn>}>
            <Table headers={['Tema', 'Detalle', 'Estado']} rows={d.reunion.map((x) => [<Cell main={x[0]} />, <Small>{x[1]}</Small>, <Tag cls={x[2]}>{x[3]}</Tag>])} />
          </Card>],
          ['Cheques en canje Fincomercio', <Card flush title="Reconfirmación de recolección de cheques en canje" sub="Seis oficinas de Bogotá; aviso por WhatsApp al mensajero del cliente">
            <Table headers={['Oficina', 'Hora programada', 'Reconfirmación']} rows={d.canje.map((x, i) => [
              <Cell main={x[0]} />,
              <span className="num">{x[1]}</span>,
              x[2] || confirmed[i] ? <Tag cls="b-ok">Confirmada</Tag> : <button className="btn btn-o btn-sm" onClick={() => reconfirmar(i)}><Icon name="chat" />Reconfirmar</button>
            ])} />
          </Card>]
        ]} />
      </Mt>
    </>
  );
}
