// Cliente 360 · Acuerdo y operación: ANS vigente, módulos de gestión y actividades del catálogo,
// más el ANS especializado por oficina que vive en los Sheets (hoja ANS Especializadas).
import { useMemo, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { Avatar, Cell, DocRow, LineChart, StatusBadge, Table, Tag } from '../../components/ui.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { useModuleData } from '../../hooks/useApi.js';
import { fmt, shortDate } from '../../lib/format.js';
import { MODULE_VIEW } from '../../lib/model.js';
import { useMonitoreoActions } from '../monitoreo/actions.jsx';
import { ClientModules } from '../monitoreo/clientModules.jsx';
import { Empty, Seg, Tile, titulo, usePaged } from './shared.jsx';

export const numCl = (s) => parseFloat(String(s).replace(',', '.'));

/** Datos del catálogo del tablero para un cliente (null si no está en el catálogo). */
export function useCatalogo(k) {
  const { D, clients } = useApp();
  return useMemo(() => {
    const x = D && D.clientExtra && D.clientExtra[k];
    if (!x || !clients[k]) return null;
    return { x, met: x.clauses.filter((cl) => numCl(cl[3]) >= numCl(cl[2])).length };
  }, [D, clients, k]);
}

export default function Acuerdo({ c, k, cat, ans }) {
  const [sec, setSec] = useState(cat ? 'modulos' : 'ans');
  const items = (cat ? [['modulos', 'Módulos de gestión'], ['expediente', 'Expediente y ANS'], ['actividades', 'Actividades']] : []).concat(ans.length ? [['ans', 'ANS por oficina · ' + fmt(ans.length)]] : []);
  return (
    <div className="c360-stack">
      {!cat && <div className="c360-banner"><Icon name="list" /><div><b>{c.nombre} aún no está en el catálogo de actividades y ANS del tablero.</b> Se muestran los datos de los Sheets; el acuerdo contractual se cargará al catalogarlo.</div></div>}
      {cat && <CatalogoKpis k={k} cat={cat} />}
      {items.length > 1 && <div className="c360-toolbar"><Seg label="Sección del acuerdo" value={sec} onChange={setSec} items={items} /></div>}
      {sec === 'modulos' && cat && <ModulosSec k={k} />}
      {sec === 'expediente' && cat && <Expediente k={k} cat={cat} />}
      {sec === 'actividades' && cat && <Actividades k={k} c={c} />}
      {sec === 'ans' && <AnsOficinas ans={ans} c={c} />}
      {!cat && !ans.length && <section className="card c360-card"><Empty icon="file" title="Sin acuerdo registrado">No hay ANS ni actividades catalogadas para {c.nombre}.</Empty></section>}
    </div>
  );
}

function CatalogoKpis({ k, cat }) {
  const { clientActs, firstName, PREV_MONTH } = useApp();
  const { x, met } = cat;
  const list = clientActs(k);
  return (
    <div className="c360-tiles">
      <Tile label="Evaluación vigente" value={fmt(x.score[5], 1)} unit="/ 5" icon="star" tone="gold" sub={'Emitida por el cliente en ' + PREV_MONTH} />
      <Tile label="Cláusulas del ANS cumplidas" value={met + ' de ' + x.clauses.length} icon="shield" tone="green" sub={'Versión ' + x.ans + ' vigente desde ' + shortDate(x.ansDate)} />
      <Tile label="Servicios en COI" value={fmt(list.length)} icon="list" tone="cyan" sub="Actividades con responsable y evidencia" />
      <Tile label="Analistas responsables" value={fmt(x.owners.length)} icon="users" sub={x.owners.map(firstName).join(', ')} />
    </div>
  );
}

function ModulosSec({ k }) {
  const { clientActs } = useApp();
  const list = clientActs(k);
  if (!list.length) return <section className="card c360-card"><Empty icon="layers" title="Sin actividades catalogadas" /></section>;
  return <ClientModules k={k} list={list} />;
}

function Expediente({ k, cat }) {
  const { D, clients, PREV_MONTH } = useApp();
  const act = useMonitoreoActions();
  const { data } = useModuleData('clientes');
  const c = clients[k], { x } = cat;
  const vmaj = parseInt(x.ans.slice(1), 10), vmin = parseInt(x.ans.split('.')[1], 10);
  const hist = [[x.ans, x.ansDate, 'Versión vigente', true]].concat((D.ansHistory.default || []).map((h, i) => {
    const d = new Date(x.ansDate + 'T12:00:00'); d.setMonth(d.getMonth() - (i + 1) * 5);
    const ver = i === 2 ? 'v1.0' : 'v' + (i === 0 && vmin > 0 ? vmaj + '.' + (vmin - 1) : Math.max(1, vmaj - i) + '.0');
    return [ver, d.toISOString().slice(0, 10), h[0], false];
  }));
  const clauses = x.clauses.map((cl) => [
    <Cell main={cl[0]} />, <span className="small">{cl[1]}</span>, <span className="num">{cl[2]}</span>, <span className="num strong">{cl[3]}</span>,
    numCl(cl[3]) >= numCl(cl[2]) ? <Tag cls="b-ok">Cumple</Tag> : <Tag cls="b-warn">Por debajo</Tag>
  ]);
  const openBtn = (onClick) => <button type="button" className="btn btn-g btn-sm" onClick={onClick}><Icon name="eye" />Abrir</button>;
  return (
    <>
      <div className="c360-grid-main">
        <section className="card c360-card">
          <header className="c360-ch"><div><h3>Checklist del acuerdo de nivel de servicio</h3><p>Medición del mes contra la versión {x.ans}</p></div></header>
          <div className="c360-cb flush"><Table headers={['Cláusula', 'Plazo', 'Meta', 'Resultado', 'Estado']} align={['', '', 'r', 'r', '']} rows={clauses} /></div>
        </section>
        <section className="card c360-card">
          <header className="c360-ch"><div><h3>Historial del ANS</h3><p>La versión vigente rige el checklist y la medición</p></div></header>
          <div className="c360-cb">
            <div className="timeline-v">
              {hist.map((h, i) => (
                <div key={i} className={'it ' + (h[3] ? 'cur' : '')}>
                  <div className="strong">{h[0]}{h[3] && <> <Tag cls="b-ok">Vigente</Tag></>}</div>
                  <div className="small muted">{shortDate(h[1])}. {h[2]}.</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <div className="c360-grid2">
        <section className="card c360-card">
          <header className="c360-ch"><div><h3>Evaluaciones del cliente</h3><p>Calificación mensual emitida por {c.name}</p></div></header>
          <div className="c360-cb"><LineChart series={[{ data: x.score, color: '#242A54', area: true }]} labels={D.months} min={3} max={5} fmt={(v) => fmt(v, 1)} label="Evaluaciones" h={210} w={560} /></div>
        </section>
        <section className="card c360-card">
          <header className="c360-ch"><div><h3>Documentos del expediente</h3><p>Última versión disponible</p></div></header>
          <div className="c360-cb" style={{ display: 'grid', gap: 10 }}>
            <DocRow title={'Acuerdo de nivel de servicio ' + x.ans} sub={'PDF firmado, ' + shortDate(x.ansDate)} icon="file" right={openBtn(() => act.ans(k))} />
            <DocRow title={'Evaluación del servicio de ' + PREV_MONTH} sub={'Formato del cliente, ' + fmt(x.score[5], 1) + ' / 5'} icon="star" right={openBtn(() => act.evaluacion(k))} />
            {data && <DocRow title="Acta del último comité" sub="Generada por COI" icon="chart" right={openBtn(() => act.acta(c.name, data.acta))} />}
          </div>
        </section>
      </div>
    </>
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
