// Módulos de gestión por cliente: panel lateral de módulos y detalle de actividades
// (clientModules / clientModulePanel del demo) y utilidades del cliente en contexto.
import { useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { Avatar, Cell, GoLink, StatusBadge, Table } from '../../components/ui.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { rng, hash, hhmm, MONTHS } from '../../lib/format.js';
import { MODULES } from '../../lib/nav.js';
import { useMonitoreoActions } from './actions.jsx';

/** Textos con que cada cliente aparece en los módulos (para resaltar sus registros). */
export const CLIENT_ALIAS = { bbva: ['BBVA'], colfondos: ['Colfondos'], proteccion: ['Protección'], porvenir: ['Porvenir'], bancolombia: ['Bancolombia', 'Indega'], agrario: ['Agrario'], popular: ['Popular'], snr: ['SNR'], bogota: ['Bogotá'], occidente: ['Occidente'], davivienda: ['Davivienda'], fincomercio: ['Fincomercio', 'Finco'], citibank: ['Citibank'], cajasocial: ['Caja Social'], coopcentral: ['Coopcentral'], union: ['Banco Unión'] };

/** Monograma del cliente: dos letras sin el prefijo "Banco (de)". */
export const clientMono = (name) => name.replace(/^Banco (de )?/, '').slice(0, 2).toUpperCase();

/** [vista, código, nombre, icono] del módulo que atiende una actividad. */
export const modInfo = (code) => { if (code === 'Se mantiene') return ['analista/hernan', 'Monitoreo', 'Tableros de analítica', 'activity']; const m = MODULES.find((x) => x[1] === code); return m || ['inicio', code, code, 'layers']; };

const nextCut = (f, NOW) => { const m = f.match(/antes de [^,;]+/i); if (m) return 'Hoy, ' + m[0]; if (/Diaria/.test(f)) return 'Hoy'; if (/lunes/i.test(f)) return 'Lunes'; if (/martes/i.test(f)) return 'Martes'; if (/viernes/i.test(f)) return 'Viernes'; if (/Semanal/.test(f)) return 'Esta semana'; if (/Quincenal/.test(f)) return 'Próxima quincena'; if (/Bimensual/.test(f)) return 'Próximo bimestre'; if (/Semestral/.test(f)) return 'Fin del semestre'; if (/Mensual|1\.ª semana|día 1/i.test(f)) return 'Día 5 de ' + MONTHS[(NOW.getMonth() + 1) % 12]; if (/Anual/.test(f)) return 'Temporada'; return 'Según solicitud'; };

function LastEv({ n }) {
  const { todayState, daySeed, NOW_MIN } = useApp();
  if (todayState[n] !== 'done') return <span className="muted">Sin evidencia hoy</span>;
  const r = rng(hash('ev' + n) ^ daySeed)();
  return <>{'Hoy, ' + hhmm(8 * 60 + Math.floor(r * Math.max(30, NOW_MIN - 8 * 60)))}</>;
}

export function clientModGroups(list) {
  const groups = {}; list.forEach((x) => { (groups[x.m] = groups[x.m] || []).push(x); });
  return Object.keys(groups).sort((p, q) => groups[q].length - groups[p].length).map((code) => ({ code, items: groups[code] }));
}

function ClientModulePanel({ k, code }) {
  const { AN, clients, clientActs, todayState, NOW } = useApp();
  const act = useMonitoreoActions();
  const groups = clientModGroups(clientActs(k));
  const g = groups.find((x) => x.code === code) || groups[0];
  const mi = modInfo(g.code), items = g.items;
  const done = items.filter((x) => todayState[x.n] === 'done').length, risk = items.filter((x) => todayState[x.n] === 'risk').length;
  const owners = Array.from(new Set(items.map((x) => x.a)));
  const rows = items.map((x) => ({
    key: x.n, cells: [
      <span className="num muted">{x.n}</span>,
      <div className="cm-act"><Cell main={x.d} sub={x.f} /></div>,
      <div className="who"><Avatar id={x.a} /><span className="small nowrap">{AN[x.a] ? AN[x.a].name.split(' ')[0] : 'Gerencia'}</span></div>,
      <span className="small">{nextCut(x.f, NOW)}</span>,
      <span className="small nowrap"><LastEv n={x.n} /></span>,
      <StatusBadge st={todayState[x.n]} />,
      <button className="btn btn-o btn-sm btn-ic" title="Registrar evidencia" aria-label="Registrar evidencia" onClick={() => act.evidencia(x.n)}><Icon name="upload" /></button>
    ]
  }));
  return (
    <>
      <div className="cm-head">
        <div className="cm-title">
          <span className="kx-ic"><Icon name={mi[3]} /></span>
          <div><h3>{mi[2]}</h3><p>{g.code === 'Se mantiene' ? 'Se monitorea en COI sin automatizar' : 'Módulo ' + g.code + ' para ' + clients[k].name}</p></div>
        </div>
        <div className="cm-actions">
          <button className="btn btn-o btn-sm" onClick={() => act.ans(k)}><Icon name="file" />ANS vigente</button>
          <GoLink to={mi[0]} client={k} className="btn btn-p btn-sm">Abrir módulo completo<Icon name="chevron" /></GoLink>
        </div>
      </div>
      <dl className="cm-stats">
        <div><dt>Actividades</dt><dd className="num">{items.length}</dd></div>
        <div><dt>Cerradas hoy</dt><dd className="num">{done}</dd></div>
        <div><dt>En curso o programadas</dt><dd className="num">{items.length - done - risk}</dd></div>
        <div><dt>En riesgo</dt><dd className={'num' + (risk ? ' down' : '')}>{risk}</dd></div>
        <div><dt>Responsables</dt><dd>{owners.map((o) => <Avatar key={o} id={o} />)}</dd></div>
      </dl>
      <div className="scroll-x">
        <Table headers={['N.º', 'Actividad', 'Responsable', 'Próximo corte', 'Última evidencia', 'Estado', 'Evidencia']} align={['', '', '', '', '', '', 'c']} rows={rows} />
      </div>
    </>
  );
}

/** Tarjeta con la lista de módulos que atienden al cliente y el panel del módulo elegido. */
export function ClientModules({ k, list }) {
  const { clients, todayState } = useApp();
  const groups = clientModGroups(list);
  const [sel, setSel] = useState({ code: groups[0].code, n: 0 });
  return (
    <div className="card cm-layout">
      <nav className="cm-nav" aria-label="Módulos del cliente">
        <div className="cm-nav-h">Módulos que atienden a {clients[k].name}</div>
        {groups.map((g) => {
          const mi = modInfo(g.code); const pend = g.items.filter((x) => todayState[x.n] !== 'done').length; const risk = g.items.some((x) => todayState[x.n] === 'risk');
          return (
            <button key={g.code} className={'cm-item' + (g.code === sel.code ? ' on' : '')} onClick={() => setSel((s) => ({ code: g.code, n: s.n + 1 }))}>
              <Icon name={mi[3]} />
              <span className="grow"><b>{mi[2]}</b><small>{g.code === 'Se mantiene' ? 'Monitoreo' : 'Módulo ' + g.code}</small></span>
              <span className={'cm-count' + (risk ? ' warn' : pend ? ' info' : '')}>{g.items.length}</span>
            </button>
          );
        })}
      </nav>
      <section key={sel.n} className={'cm-panel' + (sel.n ? ' view-enter' : '')} id="cm-panel">
        <ClientModulePanel k={k} code={sel.code} />
      </section>
    </div>
  );
}
