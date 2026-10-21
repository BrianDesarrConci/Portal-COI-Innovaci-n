// N3 PQR y experiencia: hub único de PQR. Pestañas en la URL (/pqr/radicacion, /pqr/seguimiento):
//  · Radicación y libro de PQR → formulario real de COI V1 (Experiencia de Cliente, libro PQR en Sheets).
//  · Seguimiento, reclamaciones y encuestas → en construcción (lo entrega un analista del equipo).
import { useEffect, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt } from '../lib/format.js';
import { gas } from '../lib/gas.js';
import Experiencia from './coiv1/Experiencia.jsx';
import { SourceBadge, useMeta } from './hub/LiveOps.jsx';
import './hub/hub.css';

const TABS = [
  ['radicacion', 'Radicación y libro de PQR', 'form', 'Real'],
  ['seguimiento', 'Seguimiento, reclamaciones y encuestas', 'flow', 'Obra']
];
// Cifras del libro PQR: se conservan entre pestañas (cada pestaña es una ruta).
const STATS = { v: null };

function usePqrStats() {
  const [st, setSt] = useState(STATS.v);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let vivo = true;
    gas('obtenerHistorialPQR', '', 'ADMIN').then((h) => {
      const lista = Array.isArray(h) ? h : [];
      const hace30 = Date.now() - 30 * 86400000;
      const v = {
        total: lista.length,
        mes: lista.filter((r) => Date.parse(r.fechaRadicacionISO) >= hace30).length,
        qr: lista.filter((r) => r.tipificacion === 'Queja' || r.tipificacion === 'Reclamo').length
      };
      STATS.v = v; if (vivo) setSt(v);
    }).catch((e) => vivo && setErr(e));
    return () => { vivo = false; };
  }, []);
  return [st, err];
}

export default function Pqr({ sub }) {
  const { go } = useApp();
  const meta = useMeta();
  const [st, err] = usePqrStats();
  const tab = TABS.some((t) => t[0] === sub) ? sub : 'radicacion';
  const k = (label, v, small) => (
    <div className="hub-pqr-k"><span>{label}</span>{v == null ? (err ? <b>—</b> : <i className="hub-sk" />) : <b className="num">{fmt(v)}</b>}{small && <small>{small}</small>}</div>
  );
  return (
    <div className="hub-pqr">
      <section className="hub-pqr-head">
        <div>
          <div className="hub-pqr-eyebrow">Operación · N3</div>
          <h1>PQR y experiencia</h1>
          <p>Un solo lugar para radicar peticiones, quejas y reclamos con constancia, consultar el libro PQR y hacer seguimiento a reclamaciones, casos jurídicos y encuestas de satisfacción.</p>
          <SourceBadge meta={meta} compact />
        </div>
        <div className="hub-pqr-kpis" aria-label="Cifras del libro PQR">
          {k('Radicadas', st && st.total)}
          {k('Últimos 30 días', st && st.mes)}
          {k('Quejas y reclamos', st && st.qr)}
        </div>
        <div className="hub-pqr-meta">
          <div className="hub-tabs" role="tablist" aria-label="Secciones de PQR">
            {TABS.map(([id, label, icon, tag]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={'hub-tab' + (tab === id ? ' on' : '')}
                onClick={() => tab !== id && go('pqr/' + id, { keepScroll: true })}>
                <Icon name={icon} />{label}<small className={tag === 'Real' ? 'real' : 'demo'}>{tag === 'Real' ? 'Datos reales' : 'En construcción'}</small>
              </button>
            ))}
          </div>
        </div>
      </section>
      <div className="hub-pqr-body" role="tabpanel">
        {tab === 'radicacion'
          ? <div className="hub-embed"><Experiencia /></div>
          : <Seguimiento />}
      </div>
    </div>
  );
}

function Seguimiento() {
  return (
    <section className="card">
      <div className="ntf-empty">
        <Icon name="flow" />
        <b>Seguimiento, reclamaciones y encuestas · en construcción</b>
        <small>Ampliaciones controladas, respuesta del líder, escalamiento a Jurídica y encuestas de satisfacción. Lo desarrolla un analista del equipo; mientras tanto, la radicación y el libro PQR funcionan con datos reales.</small>
      </div>
    </section>
  );
}
