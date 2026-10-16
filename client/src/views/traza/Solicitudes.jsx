// Pestaña "Solicitudes": filtros por estado, aplicativo, responsable y búsqueda, resueltos en el API.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { TZF, TZ_STATES, TzTable, hydrate } from './shared.jsx';

export default function Solicitudes({ TZ }) {
  const { NOW } = useApp();
  const [f, setF] = useState({ estado: TZF.estado, app: TZF.app, owner: TZF.owner, q: TZF.q });
  const [q, setQ] = useState(TZF.q);
  const timer = useRef(null);
  const set = (k, v) => { TZF[k] = v; setF((x) => ({ ...x, [k]: v })); };
  useEffect(() => () => clearTimeout(timer.current), []);
  const onQ = (v) => { setQ(v); clearTimeout(timer.current); timer.current = setTimeout(() => set('q', v), 250); };

  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const res = useApi('/api/traza' + (qs ? '?' + qs : ''));
  const list = useMemo(() => (res.data || []).map(hydrate), [res.data]);
  const apps = useMemo(() => Array.from(new Set(TZ.map((t) => t.app))).sort(), [TZ]);

  const sel = (key, opts, label) => (
    <select className="period-sel" aria-label={label} value={f[key]} onChange={(e) => set(key, e.target.value)}>
      {opts.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
    </select>
  );

  return (
    <div className="card">
      <div className="card-h">
        <div className="cat-filters">
          {sel('estado', [['', 'Todos los estados'], ['abiertas', 'Solo abiertas']].concat(TZ_STATES.map((s) => [s, s])), 'Estado')}
          {sel('app', [['', 'Todos los aplicativos']].concat(apps.map((a) => [a, a])), 'Aplicativo')}
          {sel('owner', [['', 'Todos los responsables'], ['brian', 'Brian Tautiva'], ['hernan', 'Hernán Dimate']], 'Responsable')}
          <input className="cat-q" type="search" placeholder="Buscar por radicado, título o solicitante" value={q} onChange={(e) => onQ(e.target.value)} />
        </div>
        <span className="small muted">{res.error ? res.error.message : res.data ? list.length + ' solicitudes' : 'Cargando…'}</span>
      </div>
      <div className="card-b flush scroll-x">
        {list.length ? <TzTable list={list} now={NOW} />
          : res.data ? <p className="small muted" style={{ padding: 20 }}>Ninguna solicitud cumple los filtros. Quite alguno para ver más resultados.</p> : null}
      </div>
    </div>
  );
}
