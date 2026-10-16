// Clientes: expediente de cada cliente con su evaluación y ANS vigente.
import { PageHead, Spark } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt, shortDate } from '../lib/format.js';
import { clientMono } from './monitoreo/clientModules.jsx';

export default function Clientes() {
  const { D, clients, clientActs, go } = useApp();
  return (
    <>
      <PageHead title="Clientes" sub="Expediente de cada cliente: servicios, acuerdo de nivel de servicio vigente con su historial y evaluaciones emitidas." />
      <div className="grid g4">
        {Object.keys(clients).map((k) => {
          const c = clients[k], x = D.clientExtra[k], n = clientActs(k).length, delta = x.score[5] - x.score[4];
          const open = () => go('cliente/' + k);
          return (
            <div key={k} className="card cl-card" tabIndex={0} onClick={open} onKeyDown={(e) => { if (e.key === 'Enter') open(); }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span className="cl-mono">{clientMono(c.name)}</span>
                <div className="grow"><h4 className="ellip">{c.name}</h4><div className="small muted ellip">{c.desc}</div></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div className="small muted">Evaluación del cliente</div>
                  <div><span className="score num">{fmt(x.score[5], 1)}</span><span className="small muted"> / 5 </span><span className={'small ' + (delta >= 0 ? 'up' : 'down')}>{(delta >= 0 ? '+' : '') + fmt(delta, 1)}</span></div>
                </div>
                <Spark values={x.score} w={90} h={28} color="#242A54" />
              </div>
              <div className="small muted">ANS vigente {x.ans}, {shortDate(x.ansDate)}. {n} actividades{x.offices ? ', ' + x.offices + ' oficinas' : ''}.</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
