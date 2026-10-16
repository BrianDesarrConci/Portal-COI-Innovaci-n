// Pestaña Faltantes y sobrantes del mes (renderNovedades de V1).
// Las acciones de gestión (solicitar explicación, gestionar, explicar, detalle) abren los modales
// del módulo operativo (useAq().abrir). Fuera de ese contexto se emite el evento cancelable
// `coi:arqueos:gestion` y, si nadie lo atiende, se muestra una ficha de solo lectura.
import { useMemo, useState } from 'react';
import Icon from '../../../../components/Icon.jsx';
import CountUp from '../../../../components/CountUp.jsx';
import { useOverlay } from '../../../../components/Overlays.jsx';
import { useAq } from '../shared.jsx';
import { useMes, useRpc, mesNombre, n0, cop, copSigno, copCorto, sinTildes, FMT, DIFE, C } from './lib.js';
import { Head, Tile, Panel, Estado, SortTable, Pills, Search, Chip, Empty } from './ui.jsx';
import { Donut, HBars, Legend } from './charts.jsx';

/** dd/MM/yyyy o yyyy-MM-dd → número ordenable. */
export const fechaNum = (f) => {
  const s = String(f || '');
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return +(m[1] + m[2] + m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return +(m[3] + m[2].padStart(2, '0') + m[1].padStart(2, '0'));
  return 0;
};

/** Estado de gestión de la diferencia, igual a la columna "Gestión de la diferencia" de V1. */
function gestion(nv) {
  if (nv.estadoDiferencia && nv.estadoDiferencia !== DIFE.PENDIENTE) {
    const ok = nv.estadoDiferencia === DIFE.RECUPERADO || nv.estadoDiferencia === DIFE.CRUZADO;
    return { k: ok ? 'cerrada' : 'perdida', tone: ok ? 'ok' : 'warn', txt: nv.estadoDiferencia };
  }
  return nv.explicacionSolicitada ? { k: 'pendiente', tone: 'bad', txt: 'Explicación pendiente', icon: 'bell' } : { k: 'sin', tone: 'mute', txt: 'Sin solicitar' };
}

const montoTxt = (nv) => (nv.novedad === 'FALTANTE' ? '−' : '+') + (nv.formato === FMT.CHEQUES ? n0(Math.abs(nv.diferencia)) + ' tít.' : cop(nv.diferencia));

export function NovedadesTab({ user }) {
  const { mes, meses, setMes } = useMes(user);
  const q = useRpc('obtenerDashboard', [user.idUsuario, user.rol, mes]);
  return (
    <div className="aqd">
      <Estado q={q} fn="obtenerDashboard">
        {(d) => <Novedades d={d} user={user} mes={mes} meses={meses} setMes={setMes} reload={q.reload} />}
      </Estado>
    </div>
  );
}

function Novedades({ d, user, mes, meses, setMes, reload }) {
  const { modal } = useOverlay() || {};
  const g = d.global, esSuper = user.rol !== 'Lider';
  const [filtro, setFiltro] = useState('todas');
  const [busca, setBusca] = useState('');
  const nov = d.novedades || [];

  const lista = useMemo(() => {
    let l = nov;
    if (filtro === 'FALTANTE' || filtro === 'SOBRANTE') l = l.filter((x) => x.novedad === filtro);
    else if (filtro !== 'todas') l = l.filter((x) => gestion(x).k === filtro);
    if (busca) { const b = sinTildes(busca); l = l.filter((x) => sinTildes(x.oficina + ' ' + x.lider + ' ' + (x.elemento || '')).includes(b)); }
    return l;
  }, [nov, filtro, busca]);

  // Concentración por oficina (monto), a partir del mismo detalle.
  const porOfi = useMemo(() => {
    const m = {};
    nov.forEach((x) => {
      if (x.formato === FMT.CHEQUES) return;
      const o = m[x.oficina] || (m[x.oficina] = { oficina: x.oficina, f: 0, s: 0, nf: 0, ns: 0 });
      if (x.novedad === 'FALTANTE') { o.f += Math.abs(x.diferencia); o.nf++; } else { o.s += Math.abs(x.diferencia); o.ns++; }
    });
    return Object.values(m).sort((a, b) => (b.f + b.s) - (a.f + a.s)).slice(0, 8);
  }, [nov]);
  const ges = ['cerrada', 'perdida', 'pendiente', 'sin'].map((k) => nov.filter((x) => gestion(x).k === k).length);

  // Mismos modales de V1 (abrirGestion / abrirRespuesta / abrirDetalle) del módulo operativo.
  const aq = useAq();
  const accion = (nv, tipo) => {
    const destino = { gestionar: 'gestion', responder: 'respuesta', detalle: 'detalle' }[tipo];
    if (aq && aq.abrir) { aq.abrir(destino, nv.id); return; }
    const ev = new CustomEvent('coi:arqueos:gestion', { detail: { id: nv.id, accion: tipo, novedad: nv }, cancelable: true });
    const atendido = !window.dispatchEvent(ev);
    if (!atendido && modal) modal({ title: 'Novedad ' + nv.id, body: <FichaNovedad nv={nv} esSuper={esSuper} /> });
  };

  const cols = [
    { k: 'fecha', h: 'Fecha', sort: (x) => fechaNum(x.fecha), render: (x) => <span className="num nowrap">{x.fecha}</span> },
    { k: 'oficina', h: esSuper ? 'Oficina / líder' : 'Oficina', render: (x) => <div className="aqd-cell2 aqd-w-of"><b className="aqd-nav">{x.oficina}</b>{esSuper && <small>{x.lider}</small>}</div> },
    { k: 'formato', h: 'Formato / elemento', render: (x) => <div className="aqd-cell2"><code>{x.formato || '—'}</code><small>{x.elemento || '—'}</small></div> },
    { k: 'novedad', h: 'Novedad', render: (x) => x.novedad === 'FALTANTE' ? <Chip tone="bad" icon="alert">Faltante</Chip> : <Chip tone="warn" icon="wallet">Sobrante</Chip> },
    { k: 'diferencia', h: 'Diferencia', align: 'r', sort: (x) => Math.abs(x.diferencia), render: (x) => <b className={'num ' + (x.novedad === 'FALTANTE' ? 'aqd-neg' : 'aqd-gold')}>{montoTxt(x)}</b> },
    { k: 'gestion', h: 'Gestión de la diferencia', sort: (x) => gestion(x).k, render: (x) => { const s = gestion(x); return <div className="aqd-chips"><Chip tone={s.tone} icon={s.icon}>{s.txt}</Chip>{x.tipologia && <Chip tone="info">{x.tipologia}</Chip>}</div>; } },
    { k: 'url', h: 'Soporte', sort: false, render: (x) => x.url && x.url !== 'Arqueo Digital' ? <a className="aqd-link" href={x.url} target="_blank" rel="noreferrer"><Icon name="file" />PDF</a> : <span className="muted">—</span> },
    { k: 'acc', h: '', sort: false, render: (x) => {
      if (esSuper) return <button type="button" className="aqd-act" title={x.explicacionSolicitada ? 'Gestionar la novedad' : 'Solicitar explicación al líder'} onClick={() => accion(x, 'gestionar')}><Icon name="chat" />{x.explicacionSolicitada ? 'Gestionar' : 'Solicitar'}</button>;
      if (x.explicacionSolicitada && (!x.estadoDiferencia || x.estadoDiferencia === DIFE.PENDIENTE)) return <button type="button" className="aqd-act bad" onClick={() => accion(x, 'responder')}><Icon name="send" />Explicar</button>;
      return <button type="button" className="aqd-act ghost" onClick={() => accion(x, 'detalle')}><Icon name="eye" />Detalle</button>;
    } }
  ].filter(Boolean);

  return (
    <>
      <Head title={'Faltantes y sobrantes · ' + mesNombre(d.mes)}
        sub="Control riguroso de las diferencias operativas identificadas en los arqueos del mes."
        mes={mes} meses={meses} setMes={setMes} />

      <section className="aqd-hero aqd-hero-slim">
        <div className="aqd-hero-trio">
          <div><span>Impacto neto del mes</span><b className={'num ' + (g.montoNeto < 0 ? 'neg' : 'pos')}><CountUp value={copSigno(g.montoNeto)} /></b><small>sobrantes − faltantes</small></div>
          <div className="aqd-balance" aria-label="Balance de faltantes y sobrantes">
            <div className="aqd-bal-row"><span>Faltantes</span><span className="aqd-bal-t"><i className="f" style={{ width: (Math.max(g.montoFaltante, g.montoSobrante) ? g.montoFaltante / Math.max(g.montoFaltante, g.montoSobrante) * 100 : 0) + '%' }} /></span><b className="num">{copCorto(g.montoFaltante)}</b></div>
            <div className="aqd-bal-row"><span>Sobrantes</span><span className="aqd-bal-t"><i className="s" style={{ width: (Math.max(g.montoFaltante, g.montoSobrante) ? g.montoSobrante / Math.max(g.montoFaltante, g.montoSobrante) * 100 : 0) + '%' }} /></span><b className="num">{copCorto(g.montoSobrante)}</b></div>
          </div>
        </div>
      </section>

      <div className="aqd-grid4">
        <Tile label="Casos de faltante" value={n0(g.faltantes)} sub={cop(g.montoFaltante)} icon="alert" tone="red" />
        <Tile label="Casos de sobrante" value={n0(g.sobrantes)} sub={cop(g.montoSobrante)} icon="wallet" tone="gold" />
        <Tile label="Total novedades" value={n0(g.faltantes + g.sobrantes)} sub="Este mes" icon="flag" tone="navy" />
        <Tile label="Explicación pendiente" value={n0(ges[2])} sub={ges[3] + ' sin solicitar'} icon="bell" tone={ges[2] ? 'red' : 'green'} />
      </div>

      {nov.length > 0 && (
        <div className="aqd-grid-main">
          <Panel title="Oficinas con mayor diferencia" icon="building" sub="Monto acumulado del mes (efectivo y ATM), ocho oficinas principales"
            right={<Legend items={[['Faltante', C.red], ['Sobrante', C.gold]]} />}>
            <HBars label="Oficinas con mayor diferencia" labelW={190}
              rows={porOfi.map((o) => ({
                key: o.oficina, label: o.oficina, sub: (o.nf ? o.nf + ' falt.' : '') + (o.nf && o.ns ? ' · ' : '') + (o.ns ? o.ns + ' sobr.' : ''),
                segs: [{ v: o.f, color: C.red, name: 'Faltante' }, { v: o.s, color: C.gold, name: 'Sobrante' }],
                end: copCorto(o.f + o.s),
                tip: [[C.red, 'Faltante (' + o.nf + ')', cop(o.f)], [C.gold, 'Sobrante (' + o.ns + ')', cop(o.s)]]
              }))} />
          </Panel>
          <Panel title="Gestión de las diferencias" icon="check" sub="Estado de la explicación y recuperación">
            <Donut label="Gestión de las diferencias" centerLabel="novedades"
              parts={[
                { label: 'Recuperado / compensado', value: ges[0], color: C.green },
                { label: 'No recuperado / no compensado', value: ges[1], color: C.goldInk },
                { label: 'Explicación pendiente', value: ges[2], color: C.red },
                { label: 'Sin solicitar', value: ges[3], color: C.mute }
              ]} />
          </Panel>
        </div>
      )}

      <Panel title="Detalle de diferencias" icon="list" sub="De mayor a menor diferencia. Ordene por cualquier columna." flush
        right={<Search value={busca} onChange={setBusca} placeholder="Buscar oficina o líder" />}>
        <div className="aqd-filterbar">
          <Pills label="Filtrar novedades" value={filtro} onChange={setFiltro} items={[
            ['todas', 'Todas', nov.length], ['FALTANTE', 'Faltantes', g.faltantes], ['SOBRANTE', 'Sobrantes', g.sobrantes],
            ['pendiente', 'Explicación pendiente', ges[2]], ['sin', 'Sin solicitar', ges[3]], ['cerrada', 'Recuperadas', ges[0]]
          ]} />
        </div>
        {nov.length
          ? <SortTable rows={lista} cols={cols} rowKey={(x) => x.id} limit={60} empty="Ninguna novedad coincide con el filtro." />
          : <Empty icon="check" title="Sin faltantes ni sobrantes este mes">Todos los arqueos del mes cuadraron contra el sistema.</Empty>}
      </Panel>
    </>
  );
}

function FichaNovedad({ nv, esSuper }) {
  const s = gestion(nv);
  const filas = [['Fecha', nv.fecha], ['Oficina', nv.oficina], esSuper && ['Líder', nv.lider], ['Formato', nv.formato || '—'], ['Elemento', nv.elemento || '—'],
    ['Novedad', nv.novedad], ['Diferencia', montoTxt(nv)], ['Gestión', s.txt], nv.tipologia && ['Tipología', nv.tipologia], nv.estadoRevision && ['Revisión', nv.estadoRevision]].filter(Boolean);
  return (
    <div className="aqd-ficha">
      <dl>{filas.map((f) => <div key={f[0]}><dt>{f[0]}</dt><dd>{f[1]}</dd></div>)}</dl>
      {nv.url && nv.url !== 'Arqueo Digital' && <a className="btn btn-o btn-sm" href={nv.url} target="_blank" rel="noreferrer"><Icon name="file" />Abrir soporte PDF</a>}
      <p className="small muted">La gestión de la novedad se realiza en la pestaña {esSuper ? 'Matriz de arqueos' : 'Mis arqueos'}.</p>
    </div>
  );
}
