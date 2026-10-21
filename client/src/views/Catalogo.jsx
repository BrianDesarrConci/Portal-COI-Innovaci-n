// Catálogo de actividades: las 104 actividades con responsable, frecuencia y módulo en COI.
import { useState } from 'react';
import { Avatar, Cell, Kpis, PageHead, StatusBadge, Table, Tag } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { norm } from '../lib/format.js';
import { MODULE_VIEW } from '../lib/model.js';
import { MODULES } from '../lib/nav.js';

// Filtros del catálogo: se conservan al salir y volver, como en el demo.
const CAT = { who: '', q: '' };
const modLabel = (m) => { const x = MODULES.find((k) => k[1] === m); return x ? x[2] + ' (' + m + ')' : m === 'Se mantiene' ? 'Tablero actual, monitoreado' : m; };

export default function Catalogo() {
  const { D, acts, AN, procName, isAuto, todayState } = useApp();
  const [f, setF] = useState({ ...CAT });
  const upd = (p) => { Object.assign(CAT, p); setF({ ...CAT }); };
  const list = acts.filter((a) => (!f.who || a.a === f.who) && (!f.q || norm(a.d + ' ' + a.cl + ' ' + procName(a.p)).indexOf(norm(f.q)) >= 0));
  const people = [['', 'Todo el equipo']].concat(D.analysts.map((a) => [a.id, a.name])).concat([['gerencia', 'Gerencia']]);
  const rows = list.map((a) => ({
    key: a.n, go: MODULE_VIEW[a.m] || (a.a !== 'gerencia' ? 'analista/' + a.a : null), cells: [
      <span className="num muted">{a.n}</span>, <Cell main={a.d} sub={a.cl} />, <Avatar id={AN[a.a] ? a.a : 'gerencia'} />,
      <span className="small">{a.f}</span>, <span className="small">{modLabel(a.m)}</span>,
      isAuto(a) ? <Tag cls="b-info">Automatizada</Tag> : <Tag>Monitoreada</Tag>, <StatusBadge st={todayState[a.n]} />
    ]
  }));
  const auto = acts.filter(isAuto).length;
  return (
    <>
      <PageHead title="Catálogo de actividades" sub="Las actividades levantadas con cada integrante del equipo, con su módulo en COI. Seleccione una fila para abrir el módulo." />
      <Kpis items={[
        ['Actividades del catálogo', acts.length, 'con responsable y frecuencia', 'list'],
        ['Automatizables', auto, 'en los módulos de COI', 'sparkle'],
        ['Monitoreadas sin automatizar', acts.length - auto, 'tableros de analítica que se mantienen y base de indicadores', 'eye'],
        ['Integrantes', D.analysts.length, 'del equipo de Apoyo al Negocio', 'users']
      ]} />
      <div className="card mt">
        <div className="card-h">
          <div className="cat-filters">
            <select className="period-sel" aria-label="Responsable" value={f.who} onChange={(e) => upd({ who: e.target.value })}>
              {people.map((p) => <option key={p[0]} value={p[0]}>{p[1]}</option>)}
            </select>
            <input className="cat-q" type="search" placeholder="Filtrar por actividad, cliente o proceso" value={f.q} onChange={(e) => upd({ q: e.target.value })} />
          </div>
          <span className="small muted">{list.length} actividades</span>
        </div>
        <div className="card-b flush scroll-x">
          <Table headers={['N.º', 'Actividad', 'Responsable', 'Frecuencia', 'Módulo en COI', 'Modalidad', 'Hoy']} rows={rows} />
        </div>
      </div>
    </>
  );
}
