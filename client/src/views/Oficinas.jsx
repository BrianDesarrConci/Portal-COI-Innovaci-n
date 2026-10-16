// N7 Torre de control de oficinas.
import { useMemo } from 'react';
import { PageHead, Kpis, Card, Table, Cell, Tabs, Tag, Bar } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { rng } from '../lib/format.js';
import { ModuleData, Small, Mt } from './operacion/common.jsx';

const LBL = { ok: 'Abierta a tiempo', late: 'Apertura tardía justificada', closed: 'Cerrada por novedad', bad: 'Sin apertura registrada' };
const prioCls = (p) => p.indexOf('Alta') === 0 ? 'b-bad' : p === 'Media' ? 'b-warn' : 'b-mute';

export default function Oficinas() {
  return <ModuleData view="oficinas">{(d) => <Body d={d} />}</ModuleData>;
}

function Body({ d }) {
  const { daySeed } = useApp();
  const list = useMemo(() => {
    const r = rng(daySeed ^ 909); const out = [];
    d.groups.forEach((g) => { for (let i = 1; i <= g[1]; i++) { const x = r(); out.push({ c: g[0], n: g[0] + ' ' + String(i).padStart(2, '0'), st: x < 0.86 ? 'ok' : x < 0.95 ? 'late' : x < 0.98 ? 'closed' : 'bad' }); } });
    return out;
  }, [d, daySeed]);
  const counts = { ok: 0, late: 0, closed: 0, bad: 0 }; list.forEach((o) => counts[o.st]++);
  const { ptr } = d;

  return (
    <>
      <PageHead title="Torre de control de oficinas" code="N7"
        sub="Aperturas, cierres, disponibilidad, actas y adecuaciones, cruzadas con el Directorio Nacional como única fuente de oficinas." />
      <Kpis items={[
        ['Abiertas a tiempo', counts.ok, 'de ' + list.length + ' oficinas monitoreadas', 'check'],
        ['Aperturas tardías', counts.late, 'con justificación del líder', 'clock'],
        ['Cerradas por novedad', counts.closed + counts.bad, 'registradas en la bitácora', 'pin'],
        ['Adecuaciones abiertas', d.adec.length, 'priorizadas por impacto en salud', 'building']
      ]} />
      <Mt>
        <Tabs items={[
          ['Apertura de hoy', <Card title="Estado de apertura de hoy" sub="Fuente: transacción de apertura en PTR y reporte de los líderes"
            right={<div className="legend"><span><i style={{ background: 'var(--green)' }} />A tiempo</span><span><i style={{ background: 'var(--gold)' }} />Tardía</span><span><i style={{ background: 'var(--line-strong)' }} />Cerrada</span><span><i style={{ background: 'var(--red)' }} />Sin apertura</span></div>}>
            <div className="office-grid">{list.map((o) => <div key={o.n} className={'office ' + o.st}><b>{o.n}</b><span>{LBL[o.st]}</span></div>)}</div>
          </Card>],
          ['Adecuaciones locativas', <Card flush title="Adecuaciones y arreglos locativos" sub="Banco Popular; prioridad según impacto en la salud de los funcionarios">
            <Table headers={['Oficina', 'Necesidad', 'Prioridad', 'Antigüedad', 'Estado']} rows={d.adec.map((a) => [
              <Cell main={a[0]} />, <Small>{a[1]}</Small>, <Tag cls={prioCls(a[2])}>{a[2]}</Tag>, <Small>{a[3]}</Small>, <Small>{a[4]}</Small>
            ])} />
          </Card>],
          ['Actas', <Card flush title="Actas de recepción y cierre" sub="Inventario, entrega y destrucciones">
            <Table headers={['Tipo', 'Oficina', 'Contenido', 'Fecha']} rows={d.actas.map((a) => [<Cell main={a[0]} />, a[1], <Small>{a[2]}</Small>, <span className="num">{a[3]}</span>])} />
          </Card>],
          ['Disponibilidad', <Card flush title="Disponibilidad de oficinas" sub="Reemplaza el archivo de Drive de disponibilidad">
            <Table headers={['Oficina', 'Estado']} rows={d.disp.map((x) => [<Cell main={x[0]} />, <Tag cls={x[2]}>{x[1]}</Tag>])} />
          </Card>],
          ['Despliegue de PTR Banco de Bogotá', <div className="grid g2">
            <Card title={'Instalación de PTR en ' + ptr.total + ' oficinas'} sub="Los equipos del banco operan con Outlook y exigen cuentas propias">
              <div className="big-num">{ptr.installed} de {ptr.total}</div>
              <div className="small muted" style={{ margin: '6px 0 12px' }}>oficinas con PTR instalado y probado</div>
              <Bar v={ptr.installed / ptr.total * 100} />
            </Card>
            <Card flush title="Bloqueos abiertos">
              <Table headers={['Motivo', 'Oficinas']} rows={ptr.blocks.map((b) => [<Cell main={b[0]} />, <span className="num">{b[1]}</span>])} align={['', 'r']} />
            </Card>
          </div>]
        ]} />
      </Mt>
    </>
  );
}
