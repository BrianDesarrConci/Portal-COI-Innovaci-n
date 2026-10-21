// Cliente 360 · Acuerdo y operación: módulos de gestión y actividades del catálogo que atienden al
// cliente, más el ANS especializado por oficina que vive en los Sheets (hoja ANS Especializadas).
// El ANS contractual y las evaluaciones del cliente se cargarán en su expediente (sin datos simulados).
import { useMemo, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { Avatar, Cell, StatusBadge, Table } from '../../components/ui.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { fmt } from '../../lib/format.js';
import { MODULE_VIEW } from '../../lib/model.js';
import { ClientModules } from '../monitoreo/clientModules.jsx';
import { Empty, Seg, Tile, titulo, usePaged } from './shared.jsx';

/** Actividades del catálogo que atienden al cliente (null si no tiene). */
export function useCatalogo(k) {
  const { clients, clientActs } = useApp();
  return useMemo(() => {
    if (!clients[k]) return null;
    const lista = clientActs(k);
    return lista.length ? { lista, responsables: [...new Set(lista.map((a) => a.a))] } : null;
  }, [clients, clientActs, k]);
}

export default function Acuerdo({ c, k, cat, ans }) {
  const [sec, setSec] = useState(cat ? 'modulos' : 'ans');
  const items = (cat ? [['modulos', 'Módulos de gestión'], ['actividades', 'Actividades']] : []).concat(ans.length ? [['ans', 'ANS por oficina · ' + fmt(ans.length)]] : []);
  return (
    <div className="c360-stack">
      {!cat && <div className="c360-banner"><Icon name="list" /><div><b>{c.nombre} aún no está en el catálogo de actividades del área.</b> Se muestran los datos de los Sheets.</div></div>}
      {cat && <CatalogoKpis cat={cat} />}
      {items.length > 1 && <div className="c360-toolbar"><Seg label="Sección del acuerdo" value={sec} onChange={setSec} items={items} /></div>}
      {sec === 'modulos' && cat && <ClientModules k={k} list={cat.lista} />}
      {sec === 'actividades' && cat && <Actividades k={k} c={c} />}
      {sec === 'ans' && <AnsOficinas ans={ans} c={c} />}
      {!cat && !ans.length && <section className="card c360-card"><Empty icon="file" title="Sin acuerdo registrado">No hay ANS ni actividades catalogadas para {c.nombre}.</Empty></section>}
    </div>
  );
}

function CatalogoKpis({ cat }) {
  const { firstName } = useApp();
  return (
    <div className="c360-tiles">
      <Tile label="Servicios en COI" value={fmt(cat.lista.length)} icon="list" tone="cyan" sub="Actividades del catálogo con responsable" />
      <Tile label="Analistas responsables" value={fmt(cat.responsables.length)} icon="users" sub={cat.responsables.map(firstName).join(', ')} />
      <Tile label="Acuerdo de nivel de servicio" value="Pendiente" icon="shield" tone="green" sub="Se cargará en el expediente del cliente" />
      <Tile label="Evaluación del cliente" value="Sin registro" icon="star" tone="gold" sub="Se registra cuando el cliente la emita" />
    </div>
  );
}

function Actividades({ k, c }) {
  const { clientActs, procName, todayState } = useApp();
  const list = clientActs(k);
  const rows = list.map((a) => ({ key: a.n, go: MODULE_VIEW[a.m] || null, cells: [<span className="num muted">{a.n}</span>, <Cell main={a.d} sub={a.f} />, <Avatar id={a.a} />, <span className="small">{procName(a.p)}</span>, <StatusBadge st={todayState[a.n]} />] }));
  return (
    <section className="card c360-card">
      <header className="c360-ch"><div><h3>Servicios y actividades</h3><p>Todo lo que Apoyo al Negocio hace para {c.nombre}; seleccione una fila para abrir su módulo</p></div></header>
      <div className="c360-cb flush"><Table headers={['N.º', 'Actividad', 'Responsable', 'Proceso', 'Hoy']} rows={rows} /></div>
    </section>
  );
}

function AnsOficinas({ ans, c }) {
  const [vis, more] = usePaged(ans, 25);
  const pol = ans.reduce((s, a) => s + a.politica, 0), an = ans.reduce((s, a) => s + a.ans, 0), arq = ans.reduce((s, a) => s + a.arqueo, 0);
  return (
    <section className="card c360-card">
      <header className="c360-ch"><div><h3>ANS especializado por oficina</h3><p>Hoja «ANS Especializadas» · {fmt(ans.length)} oficinas · {fmt(arq)} arqueos frente a {fmt(pol)} de política y {fmt(an)} de ANS</p></div></header>
      <div className="c360-cb flush">
        <Table headers={['Oficina', 'Zona', 'Arqueos', 'Política', 'ANS', '% política', '% ANS']} align={['', '', 'r', 'r', 'r', 'r', 'r']}
          rows={vis.map((a, i) => ({ key: a.oficina + i, cells: [
            <Cell main={titulo(a.oficina)} />, <span className="small">{titulo(a.zona)}</span>, <span className="num">{fmt(a.arqueo)}</span>,
            <span className="num">{fmt(a.politica)}</span>, <span className="num">{fmt(a.ans)}</span>,
            <span className={'num strong ' + (a.pctPolitica >= 100 ? 'up' : '')}>{fmt(a.pctPolitica)} %</span>,
            <span className={'num strong ' + (a.pctAns >= 100 ? 'up' : '')}>{fmt(a.pctAns)} %</span>
          ] }))} />
        {more}
      </div>
      <p className="c360-foot small muted">Fuente: libro COI V1. Los porcentajes los calcula la hoja; {c.nombre} se identifica por la columna CLIENTE.</p>
    </section>
  );
}
