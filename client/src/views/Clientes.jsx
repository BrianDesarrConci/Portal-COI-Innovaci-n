// Todos los clientes: portafolio de los 19 clientes del portal con cifras reales (Directorio Nacional,
// Granja de usuarios y Control de Arqueos), agrupado por segmento. Cada tarjeta abre su Cliente 360.
import { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import CountUp from '../components/CountUp.jsx';
import { Spark } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { CLIENTES, SEGMENTOS } from '../lib/clientes.js';
import { fmt } from '../lib/format.js';
import Mapa from './cliente360/Mapa.jsx';
import { Barras, buscar, Empty, mesLargo, mono, Ring, Search, Seg, Skel, useC360 } from './cliente360/shared.jsx';

const SEG_COLOR = { Bancos: '#242A54', 'Fondos de pensiones': '#21BBEA', 'Cooperativas y financieras': '#048C38', 'Sector público': '#F6CF46', 'Red propia': '#8B91BC' };
const ORDEN = [['oficinas', 'Más oficinas'], ['personas', 'Más personas'], ['pct', 'Mejor cumplimiento'], ['pend', 'Más pendientes'], ['alertas', 'Más alertas'], ['nombre', 'Nombre']];

function filas(res, D) {
  const porReal = {}; (res.clientes || []).forEach((r) => { porReal[r.cliente] = r; });
  return CLIENTES.map((c) => {
    const r = c.real ? porReal[c.real] || null : null;
    const red = res.red ? res.red[c.key] : null;
    const x = D && D.clientExtra ? D.clientExtra[c.key] : null;
    const alertas = r ? r.novedadesAbiertas + r.faltantesMes + r.oficinasSinPersonal : 0;
    return { c, r, red, x, oficinas: r ? r.oficinas : 0, puntos: red ? red.puntos : 0, personas: r ? r.personas : 0, pct: r && r.oficinas ? r.pctMes : null, pend: r ? r.pendientesMes : 0, alertas };
  });
}

const ordenar = (rows, by) => rows.slice().sort((a, b) => {
  if (by === 'nombre') return a.c.nombre.localeCompare(b.c.nombre, 'es');
  const va = a[by] === null ? -1 : a[by], vb = b[by] === null ? -1 : b[by];
  return vb - va || b.puntos - a.puntos || a.c.nombre.localeCompare(b.c.nombre, 'es');
});

export default function Clientes() {
  const { D, go } = useApp();
  const { data: res, error, reload } = useC360('resumenClientes');
  const [q, setQ] = useState('');
  const [seg, setSeg] = useState('Todos');
  const [by, setBy] = useState('oficinas');
  const [modo, setModo] = useState(() => { try { return localStorage.getItem('coi.c360.vista') || 'tarjetas'; } catch { return 'tarjetas'; } });
  const cambiarModo = (m) => { setModo(m); try { localStorage.setItem('coi.c360.vista', m); } catch { /* sin almacenamiento */ } };

  const rows = useMemo(() => (res ? filas(res, D) : []), [res, D]);
  const vis = useMemo(() => ordenar(rows.filter((x) => (seg === 'Todos' || x.c.segmento === seg) && buscar(q, x.c.nombre, x.c.real, x.c.segmento)), by), [rows, seg, q, by]);
  const tot = useMemo(() => {
    const conRed = rows.filter((x) => x.r && x.r.oficinas);
    const of = conRed.reduce((s, x) => s + x.r.oficinas, 0), cu = conRed.reduce((s, x) => s + x.r.cumplenMes, 0);
    return { clientes: rows.length, conRed: conRed.length, oficinas: of, personas: rows.reduce((s, x) => s + x.personas, 0), pct: of ? Math.round((cu / of) * 100) : null,
      pend: rows.reduce((s, x) => s + x.pend, 0), nov: rows.reduce((s, x) => s + (x.r ? x.r.novedadesAbiertas : 0), 0), modulos: CLIENTES.filter((c) => c.modulo).length };
  }, [rows]);
  const open = (k) => go('cliente/' + k);

  return (
    <div className="c360">
      <section className="c360-port-head">
        <div>
          <span className="c360-kicker">Gerencia de Gestión del Negocio · Portafolio</span>
          <h1>Clientes</h1>
          <p>Cada cliente con su espacio Cliente 360: red de oficinas, personal, arqueos, acuerdo de servicio y módulo especializado, con datos reales de los Sheets.</p>
        </div>
        {res && <button type="button" className="btn btn-o btn-sm" onClick={reload}><Icon name="activity" />Actualizar</button>}
      </section>

      {error ? <div className="card c360-card c360-error"><Icon name="alert" /><div><b>No se pudo cargar el portafolio.</b><p className="small muted">{error.message}</p></div><button type="button" className="btn btn-o btn-sm" onClick={reload}>Reintentar</button></div>
        : !res ? <Skel hero={false} /> : (
          <>
            <div className="c360-strip">
              <div><span>Clientes</span><b className="num"><CountUp value={fmt(tot.clientes)} /></b><small>{tot.conRed} con red dedicada · {tot.modulos} con módulo</small></div>
              <div><span>Oficinas dedicadas</span><b className="num"><CountUp value={fmt(tot.oficinas)} /></b><small>Directorio Nacional</small></div>
              <div><span>Personas</span><b className="num"><CountUp value={fmt(tot.personas)} /></b><small>Granja de usuarios</small></div>
              <div><span>Arqueos de {mesLargo(res.mes).split(' ')[0]}</span><b className="num"><CountUp value={tot.pct === null ? '—' : fmt(tot.pct) + ' %'} /></b><small>{fmt(tot.pend)} oficinas pendientes</small></div>
              <div><span>Novedades abiertas</span><b className="num"><CountUp value={fmt(tot.nov)} /></b><small>Bajas de personal</small></div>
            </div>

            <div className="c360-toolbar c360-port-tools">
              <div className="c360-dims" role="group" aria-label="Segmento">
                {['Todos'].concat(SEGMENTOS).map((s) => {
                  const n = s === 'Todos' ? rows.length : rows.filter((x) => x.c.segmento === s).length;
                  return <button type="button" key={s} className={'c360-pill' + (seg === s ? ' on' : '')} onClick={() => setSeg(s)}>{s}<em>{n}</em></button>;
                })}
              </div>
              <div className="c360-tools">
                <Search value={q} onChange={setQ} placeholder="Buscar cliente…" />
                <label className="c360-select"><Icon name="flow" /><span className="vh">Ordenar</span>
                  <select value={by} onChange={(e) => setBy(e.target.value)} aria-label="Ordenar por">{ORDEN.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select></label>
                <Seg label="Vista" value={modo} onChange={cambiarModo} items={[['tarjetas', 'Tarjetas'], ['tabla', 'Tabla']]} />
              </div>
            </div>

            {!vis.length ? <section className="card c360-card"><Empty icon="search" title="Sin clientes que coincidan">Cambie la búsqueda o el segmento.</Empty></section>
              : modo === 'tabla' ? <TablaClientes rows={vis} open={open} by={by} setBy={setBy} />
                : SEGMENTOS.filter((s) => vis.some((x) => x.c.segmento === s)).map((s) => (
                  <section key={s} className="c360-group">
                    <h2><i style={{ background: SEG_COLOR[s] }} />{s}<span>{vis.filter((x) => x.c.segmento === s).length}</span></h2>
                    <div className="c360-cards">{vis.filter((x) => x.c.segmento === s).map((x) => <Tarjeta key={x.c.key} x={x} open={open} />)}</div>
                  </section>
                ))}

            <div className="c360-grid-main c360-nation">
              <section className="card c360-card">
                <header className="c360-ch"><div><h3>Presencia nacional</h3><p>{fmt(res.puntos.length)} oficinas de clientes con coordenadas en el Directorio</p></div></header>
                <div className="c360-cb">
                  <Mapa oficinas={res.puntos.map((p) => ({ ...p, municipio: p.cliente }))} fit={false} r={2.6} label="Oficinas de los clientes en Colombia"
                    colorDe={(p) => SEG_COLOR[(CLIENTES.find((c) => c.real === p.cliente) || {}).segmento] || '#242A54'}
                    leyenda={SEGMENTOS.filter((s) => s !== 'Fondos de pensiones').map((s) => [s, SEG_COLOR[s], res.puntos.filter((p) => (CLIENTES.find((c) => c.real === p.cliente) || {}).segmento === s).length])} />
                </div>
              </section>
              <section className="card c360-card">
                <header className="c360-ch"><div><h3>Oficinas por departamento</h3><p>Toda la red del Directorio Nacional</p></div></header>
                <div className="c360-cb"><Barras rows={res.departamentos} max={12} total={res.departamentos.reduce((s, d) => s + d.n, 0)} /></div>
              </section>
            </div>
          </>
        )}
    </div>
  );
}

function Tarjeta({ x, open }) {
  const { c, r, red } = x;
  const serie = r ? r.serie.filter((s) => s.conDatos).map((s) => s.pct || 0) : [];
  const chips = [];
  if (r && r.pendientesMes) chips.push(['warn', fmt(r.pendientesMes) + ' sin arqueo']);
  if (r && r.faltantesMes) chips.push(['bad', fmt(r.faltantesMes) + ' faltantes']);
  if (r && r.novedadesAbiertas) chips.push(['warn', fmt(r.novedadesAbiertas) + ' novedades']);
  if (r && r.oficinasSinPersonal) chips.push(['mute', fmt(r.oficinasSinPersonal) + ' sin personal']);
  if (r && r.oficinas && !chips.length) chips.push(['ok', 'Al día']);
  return (
    <button type="button" className="card c360-cl" onClick={() => open(c.key)} aria-label={'Abrir Cliente 360 de ' + c.nombre}>
      <div className="c360-cl-h">
        <span className="c360-mono" style={{ background: SEG_COLOR[c.segmento] }}>{mono(c.nombre)}</span>
        <div className="grow"><h4 className="ellip">{c.nombre}</h4><small className="ellip">{c.real ? 'Directorio: ' + c.real : 'Sin red dedicada'}</small></div>
        {c.modulo && <span className="c360-modtag" title={c.modulo.nombre}><Icon name="layers" />Módulo</span>}
      </div>
      {r && r.oficinas ? (
        <div className="c360-cl-m">
          <div><b className="num">{fmt(r.oficinas)}</b><span>Oficinas</span></div>
          <div><b className="num">{fmt(r.personas)}</b><span>Personas</span></div>
          <Ring v={r.pctMes} size={52} stroke={5} />
        </div>
      ) : (
        <div className="c360-cl-m alt">
          <div><b className="num">{fmt(x.puntos)}</b><span>Puntos habilitados</span></div>
          <div><b className="num">{fmt(red ? red.departamentos : 0)}</b><span>Departamentos</span></div>
        </div>
      )}
      <div className="c360-cl-trend">
        {serie.length > 1 ? <><Spark values={serie} w={120} h={26} color="#048C38" /><small>Cumplimiento de arqueos</small></>
          : r && r.oficinas ? <small>Arqueos: {fmt(r.arqueosMes)} en el mes</small> : <small>Atención en la red propia Reval · Multipagas</small>}
      </div>
      <div className="c360-cl-f">
        <span className="c360-tags">{chips.slice(0, 3).map((ch) => <span key={ch[1]} className={'badge b-' + ch[0]}>{ch[1]}</span>)}</span>
        {x.x ? <span className="c360-ans"><Icon name="star" />{fmt(x.x.score[5], 1)} · ANS {x.x.ans}</span> : <span className="c360-ans muted">Sin catálogo</span>}
      </div>
    </button>
  );
}

function TablaClientes({ rows, open, by, setBy }) {
  const th = (k, label, cls = '') => <th className={cls}><button type="button" className={'c360-th' + (by === k ? ' on' : '')} onClick={() => setBy(k)}>{label}{by === k && <Icon name="chevron" />}</button></th>;
  return (
    <section className="card c360-card">
      <div className="c360-cb flush scroll-x">
        <table className="t c360-ptable">
          <thead><tr>{th('nombre', 'Cliente')}<th>Segmento</th>{th('oficinas', 'Oficinas', 'r')}<th className="r">Puntos habilitados</th>{th('personas', 'Personas', 'r')}{th('pct', 'Arqueos del mes', 'r')}{th('pend', 'Pendientes', 'r')}{th('alertas', 'Alertas', 'r')}<th>ANS</th></tr></thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.c.key} className="click" onClick={() => open(x.c.key)}>
                <td data-label="Cliente"><div className="c360-tcl"><span className="c360-mono sm" style={{ background: SEG_COLOR[x.c.segmento] }}>{mono(x.c.nombre)}</span><div><div className="cell-main">{x.c.nombre}</div><div className="cell-sub">{x.c.modulo ? x.c.modulo.nombre : x.c.real || 'Sin red dedicada'}</div></div></div></td>
                <td data-label="Segmento"><span className="small">{x.c.segmento}</span></td>
                <td data-label="Oficinas" className="r num">{x.oficinas ? fmt(x.oficinas) : '—'}</td>
                <td data-label="Puntos habilitados" className="r num">{x.puntos ? fmt(x.puntos) : '—'}</td>
                <td data-label="Personas" className="r num">{x.personas ? fmt(x.personas) : '—'}</td>
                <td data-label="Arqueos del mes" className="r">{x.pct === null ? <span className="muted">—</span> : <span className="c360-pctcell"><span className="c360-mini"><i style={{ width: x.pct + '%' }} className={'t-' + (x.pct >= 90 ? 'ok' : x.pct >= 60 ? 'info' : 'warn')} /></span><b className="num">{fmt(x.pct)} %</b></span>}</td>
                <td data-label="Pendientes" className="r num">{x.r ? fmt(x.pend) : '—'}</td>
                <td data-label="Alertas" className="r">{x.alertas ? <span className="badge b-warn">{fmt(x.alertas)}</span> : x.r ? <span className="badge b-ok">0</span> : <span className="muted">—</span>}</td>
                <td data-label="ANS"><span className="small">{x.x ? x.x.ans + ' · ' + fmt(x.x.score[5], 1) : 'Sin catálogo'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
