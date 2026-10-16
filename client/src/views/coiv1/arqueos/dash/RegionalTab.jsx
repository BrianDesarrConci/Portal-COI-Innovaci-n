// Pestaña Regional y zona (renderRegional / pintarRegional de V1): tabla resumen con
// mapa de calor (≥ 90 verde, ≥ 60 amarillo), barras apiladas de oficinas y cajeros ATM
// y matriz de cumplimiento por regional.
import { Fragment, useState } from 'react';
import Icon from '../../../../components/Icon.jsx';
import CountUp from '../../../../components/CountUp.jsx';
import { useMes, useRpc, mesNombre, n0, n2, heatNivel, C } from './lib.js';
import { Head, Tile, Panel, Estado, Heat, Empty } from './ui.jsx';
import { HBars, Legend, Ring } from './charts.jsx';

export function RegionalTab({ user }) {
  const { mes, meses, setMes } = useMes(user);
  const q = useRpc('obtenerResumenRegional', [user.idUsuario, user.rol, mes]);
  return (
    <div className="aqd">
      <Estado q={q} fn="obtenerResumenRegional">
        {(d) => <Regional d={d} mes={mes} meses={meses} setMes={setMes} reload={q.reload} />}
      </Estado>
    </div>
  );
}

const MATRIZ = [
  ['pctOficinas', '% Oficinas', (R) => R.oficinasConArqueo + '/' + R.oficinas, () => true],
  ['pctCheques', '% Cheques', (R) => R.chequesOK + '/' + R.chequesTotal, (R) => R.chequesTotal > 0],
  ['pctATM', '% ATM', (R) => R.atmConArqueo + '/' + R.atmTotal, (R) => R.atmTotal > 0],
  ['pctAlDia', '% Al día', (R) => R.alDia + '/' + R.oficinas, () => true],
  ['pctMeta', '% Meta', (R) => R.arqueosEjecutados + '/' + R.metaMinima, () => true]
];

function Regional({ d, mes, meses, setMes, reload }) {
  const T = d.total || {};
  // En pantallas angostas las zonas inician contraídas (la tabla pasa a tarjetas).
  const [cerradas, setCerradas] = useState(() => new Set(typeof window !== 'undefined' && window.innerWidth < 760 ? (d.regionales || []).map((R) => R.regional) : []));
  const toggle = (r) => setCerradas((s) => { const n = new Set(s); if (n.has(r)) n.delete(r); else n.add(r); return n; });
  const regs = d.regionales || [];
  const zonasDe = (r) => d.zonas.filter((z) => z.regional === r);
  const peor = regs.slice().sort((a, b) => a.pctOficinas - b.pctOficinas)[0];
  const mejor = regs.slice().sort((a, b) => b.pctOficinas - a.pctOficinas)[0];

  const fila = (g, cls, label, extra) => (
    <tr className={cls} key={label}>
      <td data-label="Regional / zona" className="aqd-rz">{label}</td>
      <td data-label="Oficinas" className="c"><div className="aqd-cell2 c"><b className="num">{g.oficinas}</b><small>{g.propias} propias</small></div></td>
      <td data-label="Arqueos ejecutados" className="c"><div className="aqd-cell2 c"><b className="num">{g.arqueosEjecutados}</b><small>{g.arqueosPropias} en propias · {g.numLideres} líder(es)</small></div></td>
      <td data-label={'% meta (' + d.meta + '/líder)'} className="c"><div className="aqd-cell2 c"><Heat p={g.pctMeta} /><small>meta {g.metaMinima}</small></div></td>
      <td data-label="Ofi. pendientes" className={'c num strong ' + (g.oficinasPendientes ? 'aqd-neg' : 'aqd-pos')}>{g.oficinasPendientes}</td>
      <td data-label="Prom. visitas" className="c num">{n2(g.promedioVisitas)}</td>
      <td data-label="% Oficinas" className="c"><Heat p={g.pctOficinas} /></td>
      <td data-label="% Cheques" className="c">{g.chequesTotal ? <Heat p={g.pctCheques} /> : <Heat p={null} />}</td>
      <td data-label="% ATM" className="c">{g.atmTotal ? <Heat p={g.pctATM} /> : <Heat p={null} />}</td>
      <td data-label="% Al día" className="c"><Heat p={g.pctAlDia} /></td>
      {extra}
    </tr>
  );

  return (
    <>
      <Head title={'Resumen por regional y zona · ' + mesNombre(d.mes)}
        sub={<>Arqueos parciales ejecutados a la fecha (mínimo <b>{d.meta} por líder</b> al mes), oficinas propias, pendientes, promedio de visitas y red de cajeros ATM.</>}
        mes={mes} meses={meses} setMes={setMes} />

      <section className="aqd-hero">
        <div className="aqd-hero-main">
          <Ring pct={T.pctMeta || 0} color={(T.pctMeta || 0) >= 100 ? '#3FD07A' : C.cyan} size={168} label={`${T.pctMeta || 0}% de la meta mínima`}>
            <b className="num"><CountUp value={(T.pctMeta || 0) + '%'} /></b><span>de la meta</span>
          </Ring>
          <div className="aqd-hero-id">
            <span className="aqd-hero-k">Total red · {regs.length} regionales · {d.zonas.length} zonas</span>
            <div className="aqd-hero-big num"><CountUp value={n0(T.arqueosEjecutados)} /><small> / {n0(T.metaMinima)}</small></div>
            <p className="aqd-hero-sub">arqueos ejecutados frente a la meta mínima ({T.numLideres || 0} líderes × {d.meta})</p>
            {mejor && peor && mejor !== peor && (
              <p className="aqd-hero-msg">Mayor cobertura de oficinas: <b>{mejor.regional}</b> ({mejor.pctOficinas}%). Mayor rezago: <b>{peor.regional}</b> ({peor.pctOficinas}%, {peor.oficinasPendientes} oficinas pendientes).</p>
            )}
          </div>
        </div>
        <div className="aqd-hero-stats">
          <div className="aqd-hs"><span>Oficinas con arqueo</span><b className="num"><CountUp value={(T.pctOficinas || 0) + '%'} /></b><small>{n0(T.oficinasConArqueo)}/{n0(T.oficinas)} · {n0(T.oficinasPendientes)} pendientes</small></div>
          <div className="aqd-hs"><span>Cajeros ATM con arqueo</span><b className="num"><CountUp value={(T.pctATM || 0) + '%'} /></b><small>{n0(T.atmConArqueo)}/{n0(T.atmTotal)} · {n0(T.atmSinArqueo)} sin arqueo</small></div>
          <div className="aqd-hs"><span>Oficinas al día</span><b className="num"><CountUp value={(T.pctAlDia || 0) + '%'} /></b><small>completas y sin extemporáneos</small></div>
          <div className="aqd-hs"><span>Promedio de visitas</span><b className="num"><CountUp value={String(T.promedioVisitas || 0).replace('.', ',')} /></b><small>por oficina en el mes</small></div>
        </div>
      </section>

      <div className="aqd-grid4">
        <Tile label="Arqueos ejecutados" value={n0(T.arqueosEjecutados)} sub={'Meta mínima ' + n0(T.metaMinima) + ' (' + (T.pctMeta || 0) + '%)'} icon="check" tone="green" />
        <Tile label="Oficinas con arqueo" value={n0(T.oficinasConArqueo) + '/' + n0(T.oficinas)} sub={n0(T.oficinasPendientes) + ' pendientes · ' + (T.pctOficinas || 0) + '%'} icon="building" tone="navy" />
        <Tile label="Promedio de visitas" value={String(T.promedioVisitas || 0).replace('.', ',')} sub="por oficina en el mes" icon="pin" tone="cyan" />
        <Tile label="ATM con arqueo" value={n0(T.atmConArqueo) + '/' + n0(T.atmTotal)} sub={n0(T.atmSinArqueo) + ' sin arqueo · ' + (T.pctATM || 0) + '%'} icon="wallet" tone="cyan" />
      </div>

      {!regs.length ? <Panel><Empty icon="pin" title="Sin oficinas visibles para el resumen regional" /></Panel> : (
        <>
          <Panel title="Matriz de cumplimiento por regional" icon="layers" sub="Cada celda: porcentaje y avance (hecho / total). Verde ≥ 90 %, amarillo ≥ 60 %, rojo por debajo."
            right={<div className="aqd-heat-lg"><span className="aqd-heat aqd-ok">≥ 90%</span><span className="aqd-heat aqd-warn">60–89%</span><span className="aqd-heat aqd-bad">&lt; 60%</span></div>}>
            <div className="aqd-matrix" role="table" aria-label="Matriz de cumplimiento por regional" style={{ '--cols': MATRIZ.length }}>
              <div className="aqd-mx-h" role="row"><span role="columnheader">Regional</span>{MATRIZ.map((m) => <span key={m[0]} role="columnheader">{m[1]}</span>)}</div>
              {regs.concat([{ ...T, regional: 'TOTAL RED', _total: true }]).map((R) => (
                <div key={R.regional} className={'aqd-mx-r' + (R._total ? ' tot' : '')} role="row">
                  <span role="rowheader" className="aqd-mx-n"><b>{R.regional}</b><small>{R._total ? d.zonas.length : R.zonas} zonas · {n0(R.oficinas)} oficinas</small></span>
                  {MATRIZ.map((m) => m[3](R)
                    ? <span key={m[0]} role="cell" className={'aqd-mx-c aqd-' + heatNivel(R[m[0]])} title={`${R.regional} · ${m[1]}: ${R[m[0]]}% (${m[2](R)})`}><b className="num">{R[m[0]]}%</b><small className="num">{m[2](R)}</small></span>
                    : <span key={m[0]} role="cell" className="aqd-mx-c aqd-na"><b>—</b><small>no aplica</small></span>)}
                </div>
              ))}
            </div>
          </Panel>

          <div className="aqd-grid2">
            <Panel title="Arqueos parciales por regional" icon="building" sub="Oficinas con arqueo frente a pendientes a la fecha"
              right={<Legend items={[['Con arqueo', C.green], ['Pendientes', '#C9CDE3']]} />}>
              <HBars label="Oficinas con arqueo y pendientes por regional" labelW={150}
                rows={regs.map((R) => ({ key: R.regional, label: R.regional, sub: R.pctOficinas + '% cubierto',
                  segs: [{ v: R.oficinasConArqueo, color: C.green, name: 'Con arqueo' }, { v: R.oficinasPendientes, color: '#C9CDE3', name: 'Pendientes' }],
                  end: n0(R.oficinas) }))} />
            </Panel>
            <Panel title="Red de cajeros ATM por regional" icon="wallet" sub="Cajeros con arqueo (cuenta 1 vez al mes) frente a sin arqueo"
              right={<Legend items={[['Con arqueo', C.cyan], ['Sin arqueo', '#C9CDE3']]} />}>
              {T.atmTotal ? (
                <HBars label="Cajeros ATM con y sin arqueo por regional" labelW={150}
                  rows={regs.filter((R) => R.atmTotal).map((R) => ({ key: R.regional, label: R.regional, sub: R.pctATM + '% con arqueo',
                    segs: [{ v: R.atmConArqueo, color: C.cyan, name: 'Con arqueo' }, { v: R.atmSinArqueo, color: '#C9CDE3', name: 'Sin arqueo' }],
                    end: n0(R.atmTotal) }))} />
              ) : <Empty icon="building" title="Sin cajeros parametrizados" />}
            </Panel>
          </div>

          <Panel title="Tabla resumen por regional y zona · oficinas" icon="list" flush sub="Pulse una regional para mostrar u ocultar sus zonas. La fila de la regional muestra su consolidado.">
            <div className="aqd-tbl-wrap">
              <table className="t aqd-tbl aqd-rtbl">
                <thead>
                  <tr>
                    <th>Regional / zona</th><th className="c">Oficinas</th><th className="c">Arqueos ejecutados</th>
                    <th className="c">% meta ({d.meta}/líder)</th><th className="c">Ofi. pendientes</th><th className="c">Prom. visitas</th>
                    <th className="c">% Oficinas</th><th className="c">% Cheques</th><th className="c">% ATM</th><th className="c">% Al día</th>
                  </tr>
                </thead>
                <tbody>
                  {regs.map((R) => {
                    const open = !cerradas.has(R.regional);
                    return (
                      <Fragment key={R.regional}>
                        {fila(R, 'aqd-rgrp' + (open ? ' open' : ''),
                          <button type="button" className="aqd-rg-btn" aria-expanded={open} onClick={() => toggle(R.regional)}>
                            <Icon name="chevron" /><b>{R.regional}</b><small>{R.zonas} zonas</small>
                          </button>)}
                        {open && zonasDe(R.regional).map((z) => fila(z, 'aqd-rzona', <span className="aqd-zn">{z.zona}</span>))}
                      </Fragment>
                    );
                  })}
                  {fila(T, 'aqd-rtot', <b>TOTAL RED</b>)}
                </tbody>
              </table>
            </div>
            <div className="aqd-more">
              <button type="button" className="btn btn-g btn-sm" onClick={() => setCerradas(new Set())}>Expandir todas</button>
              <button type="button" className="btn btn-g btn-sm" onClick={() => setCerradas(new Set(regs.map((R) => R.regional)))}>Contraer todas</button>
            </div>
          </Panel>

          <Panel title="Detalle de cajeros ATM por zona" icon="wallet" flush>
            <div className="aqd-tbl-wrap">
              <table className="t aqd-tbl compact">
                <thead><tr><th>Regional</th><th>Zona</th><th className="c">Cajeros</th><th className="c">Con arqueo</th><th className="c">Sin arqueo</th><th className="c">% ATM</th></tr></thead>
                <tbody>
                  {d.zonas.filter((g) => g.atmTotal).length ? d.zonas.filter((g) => g.atmTotal).map((g) => (
                    <tr key={g.regional + g.zona}><td data-label="Regional">{g.regional}</td><td data-label="Zona">{g.zona}</td><td data-label="Cajeros" className="c num">{g.atmTotal}</td><td data-label="Con arqueo" className="c num">{g.atmConArqueo}</td><td data-label="Sin arqueo" className={'c num ' + (g.atmSinArqueo ? 'aqd-neg strong' : '')}>{g.atmSinArqueo}</td><td data-label="% ATM" className="c"><Heat p={g.pctATM} /></td></tr>
                  )) : <tr><td colSpan="6" className="aqd-tbl-empty" data-label="">Sin cajeros parametrizados.</td></tr>}
                  <tr className="aqd-rtot"><td data-label="" colSpan="2"><b>TOTAL</b></td><td data-label="Cajeros" className="c num">{n0(T.atmTotal)}</td><td data-label="Con arqueo" className="c num">{n0(T.atmConArqueo)}</td><td data-label="Sin arqueo" className="c num">{n0(T.atmSinArqueo)}</td><td data-label="% ATM" className="c">{T.atmTotal ? <Heat p={T.pctATM} /> : <Heat p={null} />}</td></tr>
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </>
  );
}
