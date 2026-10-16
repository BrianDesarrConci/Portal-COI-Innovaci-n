// N9 Transacciones en vivo. Serie simulada en el cliente que se actualiza cada 2,5 s.
import { useEffect, useReducer } from 'react';
import { PageHead, Card, LineChart, HBars, Loading } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useModuleData } from '../hooks/useApi.js';
import { fmt } from '../lib/format.js';
import { getPtr, tickPtr } from './cifras/ptrState.js';

export default function Ptr() {
  const { data, error } = useModuleData('ptr');
  if (!data) return <Loading error={error} />;
  return <Live cfg={data} />;
}

function Live({ cfg }) {
  const { daySeed, NOW_MIN } = useApp();
  const ptr = getPtr({ daySeed, NOW_MIN, negocios: cfg.negocios });
  const [, rerender] = useReducer((x) => x + 1, 0);
  useEffect(() => {
    const t = setInterval(() => { tickPtr(ptr); rerender(); }, cfg.intervalMs || 2500);
    return () => clearInterval(t);
  }, [ptr, cfg.intervalMs]);

  return (
    <>
      <PageHead title="Transacciones en vivo" sub="Lectura directa de la base MySQL de PTR, sin extracción manual. Las cifras se actualizan cada pocos segundos." code="N9"
        right={<span className="badge b-ok" style={{ height: 30 }}><span className="live-dot" />&nbsp;Conectado a PTR</span>} />
      <div className="grid g-main">
        <div className="card">
          <div className="card-h"><div><h3>Transacciones del día</h3><p>Todos los negocios, por franjas de 15 minutos</p></div></div>
          <div className="card-b">
            <div className="big-num">{fmt(ptr.total)}</div>
            <div className="small muted" style={{ marginBottom: 12 }}>transacciones desde las 8:00 a. m.</div>
            <LineChart series={[{ data: ptr.series, color: '#21BBEA', area: true }]} labels={ptr.labels} label="Transacciones por franja" h={230} />
          </div>
        </div>
        <div>
          <div className="card">
            <div className="card-h"><div><h3>Por negocio</h3><p>Acumulado del día</p></div></div>
            <div className="card-b"><HBars rows={Object.keys(ptr.neg).map((k) => [k, ptr.neg[k]])} color="nv" /></div>
          </div>
          <div className="mt">
            <Card title="Oficinas con más transacciones" sub="Hoy"><HBars rows={cfg.tops} color="cy" /></Card>
          </div>
        </div>
      </div>
    </>
  );
}
