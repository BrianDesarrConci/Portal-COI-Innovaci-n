// N8 Operación diaria de Fincomercio.
import { useEffect, useMemo, useState } from 'react';
import { PageHead, Kpis, Card, Table, Cell, Tabs, Tag, HBars, DocRow } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { rng } from '../lib/format.js';
import { ModuleData, ToastBtn, Small, Mt } from './operacion/common.jsx';

export default function Fincomercio() {
  return <ModuleData view="fincomercio">{(d) => <Body d={d} />}</ModuleData>;
}

/** Cuenta regresiva del ANS de 15 minutos de la anulación en curso (startFinTimer del demo). */
function AnuTimer({ start }) {
  const [left, setLeft] = useState(start);
  useEffect(() => {
    const t = setInterval(() => setLeft((l) => Math.max(0, l - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  return <div className="big-timer">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</div>;
}

function Body({ d }) {
  const { daySeed, NOW_MIN } = useApp();
  const after = NOW_MIN >= 18 * 60;
  const prov = useMemo(() => { const r = rng(daySeed ^ 501); return d.offices.map((o, i) => [o, 20 + ((i * 7) % 36) + Math.round(r() * 8)]); }, [d, daySeed]);

  return (
    <>
      <PageHead title="Operación diaria de Fincomercio" code="N8"
        sub="Provisiones, anulaciones, cierre de 12 oficinas, boletería e informe nocturno en un solo lugar. La ejecución en el aplicativo del cliente sigue por VPN." />
      <Kpis items={[
        ['Anulaciones de hoy', 6, 'todas dentro de 15 minutos', 'clock'],
        ['Provisiones', '11:12 a. m.', 'enviadas; límite 11:30 a. m.', 'wallet'],
        ['Declaraciones mayores a 5 M', 28, '25 validadas por el sistema', 'filecheck'],
        ['Informe nocturno', after ? 'Enviado' : '7:30 p. m.', after ? 'generado tras el cierre' : 'se genera al cierre de la última oficina', 'send']
      ]} />
      <Mt>
        <Tabs items={[
          ['Anulaciones', <div className="grid g-main">
            <Card title="Anulación en curso" sub="Plaza Central solicita anular la transacción 88412 por valor errado" right={<Tag cls="b-info">ANS de 15 minutos</Tag>}>
              <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
                <div><div className="small muted">Tiempo restante del ANS</div><AnuTimer start={d.anuSeconds} /></div>
                <div className="grow" style={{ minWidth: 240 }}>
                  <div className="timeline-v">
                    <div className="it cur"><div className="strong">Solicitud recibida por correo</div><div className="small muted">Detectada por el sistema y asignada a Maira</div></div>
                    <div className="it cur"><div className="strong">Anulación ejecutada por VPN</div><div className="small muted">Cambio a la agencia Plaza Central y cajero 07</div></div>
                    <div className="it"><div className="strong">Documento reemplazante</div><div className="small muted">Esperando al cajero; recordatorio automático en 5 minutos</div></div>
                  </div>
                </div>
              </div>
            </Card>
            <Card flush title="Anulaciones del día">
              <Table headers={['Transacción', 'Oficina', 'Tiempo']} rows={d.anul.map((a) => [<Cell main={a[0]} sub={a[2]} />, a[1], <Tag cls={a[4] ? 'b-ok' : 'b-info'}>{a[3]}</Tag>])} />
            </Card>
          </div>],
          ['Provisiones', <Card title="Provisiones del día" sub="Saldos de bóveda consultados, formulario de cajeros y cartas generadas; millones de pesos" right={<Tag cls="b-ok">Enviadas 11:12 a. m.</Tag>}>
            <HBars rows={prov.map((p) => [p[0], p[1], p[1] + ' M'])} color="cy" />
          </Card>],
          ['Cierre e informe nocturno', <Card title="Cierre de oficinas"
            sub={after ? 'Informe nocturno generado a partir de los tres archivos de cierre' : 'El informe nocturno se genera al recibir el cierre de la última oficina, 6:00 p. m.'}
            right={<ToastBtn msg="Vista previa del informe nocturno generada." icon="eye">Vista previa del informe</ToastBtn>}>
            <div className="office-grid">{d.offices.map((o) => <div key={o} className={'office ' + (after ? 'ok' : 'closed')}><b>{o}</b><span>{after ? 'Cierre recibido' : 'En operación'}</span></div>)}</div>
          </Card>],
          ['Biometría y retiros', <div className="grid g2">
            <Card title="Cruce de cierres contra biometría" sub="Reconocer y Olimpia; corte 11:00 a. m."><HBars rows={d.biometria} color="nv" /></Card>
            <Card flush title="Retiros sobre política" sub="4 millones nacional y 9 millones Bogotá">
              <Table headers={['Oficina', 'Política', 'Valor', 'Soportes']} align={['', '', 'r', '']} rows={d.retiros.map((x) => [
                <Cell main={x[0]} />, <Small>{x[1]}</Small>, <span className="num">$ {x[2]}</span>, <Tag cls={x[3] === 'Soporte completo' ? 'b-ok' : 'b-warn'}>{x[3]}</Tag>
              ])} />
            </Card>
          </div>],
          ['Boletería y agencias', <>
            <div className="grid g2">
              <Card flush title="Boletería de Finco Ticket" sub="Conteo diario cruzado con la validación biométrica del día siguiente">
                <Table headers={['Fecha', 'Boletas', 'Cruce biométrico']} align={['', 'r', '']} rows={d.boleteria.map((r) => [<Cell main={r[0]} />, <span className="num">{r[1]}</span>, <Tag cls={r[2] === 'Conforme' ? 'b-ok' : 'b-info'}>{r[2]}</Tag>])} />
              </Card>
              <Card flush title="Cambios de cajeros de agencia" sub="Reemplazos y traslados registrados en el aplicativo del banco">
                <Table headers={['Cajero', 'De', 'A', 'Motivo']} rows={d.cajeros.map((r) => [<Cell main={r[0]} />, r[1], r[2], <Small>{r[3]}</Small>])} />
              </Card>
            </div>
            <div className="grid g2 mt">
              <Card title="Planta activa semanal" sub="Reporte al cliente con novedades y solicitudes de usuarios">
                <DocRow title="Planta de la semana" sub="36 cajeros activos, 2 novedades, 1 usuario por crear" icon="usercheck" right={<Tag cls="b-ok">Enviada</Tag>} />
              </Card>
              <Card title="Efectivo deteriorado" sub="Recolección según cupo y póliza de cada oficina">
                <DocRow title="Recolección programada" sub="Oficinas Centro y Bosa, jueves" icon="wallet" right={<Tag cls="b-info">Programada</Tag>} />
              </Card>
            </div>
          </>],
          ['PNC', <Card flush title="Productos no conformes" sub="Descarga del aplicativo del cliente; los líderes responden en una semana">
            <Table headers={['Radicado', 'Oficina', 'Motivo', 'Plazo', 'Estado']} rows={d.pnc.map((p) => [
              <Cell main={p[0]} />, p[1], <Small>{p[2]}</Small>, <Small>{p[3]}</Small>, <Tag cls={p[4] === 'Cerrado' ? 'b-ok' : 'b-info'}>{p[4]}</Tag>
            ])} />
          </Card>]
        ]} />
      </Mt>
    </>
  );
}
