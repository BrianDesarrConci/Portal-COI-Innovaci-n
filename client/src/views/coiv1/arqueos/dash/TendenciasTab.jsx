// Pestaña Tendencias (renderTendencias / pintarTendencias / pintarHistograma de V1):
// evolución anual de faltantes y sobrantes e índice de incidencia por oficina.
import { useMemo, useState } from 'react';
import CountUp from '../../../../components/CountUp.jsx';
import { useRpc, n0, cop, copSigno, copCorto, MES_CORTO, MESES, C } from './lib.js';
import { Head, Tile, Panel, Estado, SortTable, Meter, Empty } from './ui.jsx';
import { HBars, Legend, MonthChart } from './charts.jsx';

export function TendenciasTab({ user }) {
  const [anio, setAnio] = useState(null);
  const q = useRpc('obtenerTendencias', [user.idUsuario, user.rol, anio]);
  return (
    <div className="aqd">
      <Estado q={q} fn="obtenerTendencias">
        {(d) => <Tendencias d={d} setAnio={setAnio} reload={q.reload} />}
      </Estado>
    </div>
  );
}

const nivelIndice = (i) => (i >= 30 ? 'bad' : i >= 15 ? 'warn' : 'ok');

function Tendencias({ d, setAnio, reload }) {
  const [mesSel, setMesSel] = useState('TODOS');
  const M = d.meses || [];
  const totF = M.reduce((s, m) => s + m.faltCasos, 0), totS = M.reduce((s, m) => s + m.sobCasos, 0);
  const totFM = M.reduce((s, m) => s + m.faltMonto, 0), totSM = M.reduce((s, m) => s + m.sobMonto, 0);
  const totArq = M.reduce((s, m) => s + (m.total || 0), 0), totVal = M.reduce((s, m) => s + (m.validos || 0), 0);
  const hoy = new Date();
  const corte = String(hoy.getFullYear()) === String(d.anio) ? hoy.getMonth() : String(d.anio) > String(hoy.getFullYear()) ? -1 : 11;
  const picoIdx = M.reduce((b, m, i) => (m.faltCasos + m.sobCasos > (M[b] ? M[b].faltCasos + M[b].sobCasos : -1) ? i : b), 0);
  const tasa = totArq ? Math.round((totF + totS) / totArq * 1000) / 10 : 0;

  // Histograma (pintarHistograma): top 15 por casos del año o del mes elegido.
  const hist = useMemo(() => {
    let datos;
    if (mesSel === 'TODOS') datos = d.oficinas.map((o) => ({ oficina: o.oficina, casos: o.casos }));
    else { const idx = parseInt(mesSel, 10); datos = d.oficinas.map((o) => ({ oficina: o.oficina, casos: o.porMes[idx] })).filter((x) => x.casos > 0).sort((a, b) => b.casos - a.casos); }
    return datos.slice(0, 15);
  }, [d.oficinas, mesSel]);
  const histCol = (i) => (i < 3 ? C.red : i < 7 ? '#E0B520' : C.navy);
  const pick = (i) => setMesSel((v) => (v === String(i) ? 'TODOS' : String(i)));

  const yearSel = (
    <label className="aqd-sel">
      <span className="aqd-vh">Año</span>
      <select value={d.anio} onChange={(e) => setAnio(e.target.value)} aria-label="Año">{d.anios.map((a) => <option key={a} value={a}>{a}</option>)}</select>
    </label>
  );
  const mesSelect = (
    <label className="aqd-sel">
      <span className="aqd-vh">Mes del histograma</span>
      <select value={mesSel} onChange={(e) => setMesSel(e.target.value)} aria-label="Mes del histograma">
        <option value="TODOS">Todo el año</option>
        {MES_CORTO.map((nm, i) => <option key={nm} value={String(i)}>{nm} {d.anio}</option>)}
      </select>
    </label>
  );

  return (
    <>
      <Head title={'Tendencias de diferencias operativas · ' + d.anio}
        sub="Evolución anual de faltantes y sobrantes e índice de incidencia por oficina."
        extra={<>{yearSel}{mesSelect}</>} />

      <section className="aqd-hero aqd-hero-slim">
        <div className="aqd-hero-quad">
          <div><span>Impacto neto anual</span><b className={'num ' + (totSM - totFM < 0 ? 'neg' : 'pos')}><CountUp value={copSigno(totSM - totFM)} /></b><small>sobrantes − faltantes</small></div>
          <div><span>Arqueos del año</span><b className="num"><CountUp value={n0(totArq)} /></b><small>{n0(totVal)} válidos</small></div>
          <div><span>Tasa de novedad</span><b className="num"><CountUp value={String(tasa).replace('.', ',') + ' %'} /></b><small>casos con diferencia por cada 100 arqueos</small></div>
          <div><span>Mes con más casos</span><b>{(totF + totS) ? MESES[picoIdx] : '—'}</b><small>{(totF + totS) ? (M[picoIdx].faltCasos + M[picoIdx].sobCasos) + ' casos' : 'sin diferencias en el año'}</small></div>
        </div>
      </section>

      <div className="aqd-grid4">
        <Tile label={'Faltantes ' + d.anio} value={n0(totF)} sub={cop(totFM)} icon="alert" tone="red" />
        <Tile label={'Sobrantes ' + d.anio} value={n0(totS)} sub={cop(totSM)} icon="wallet" tone="gold" />
        <Tile label="Oficinas con novedades" value={n0(d.oficinas.length)} sub="Al menos 1 diferencia" icon="building" tone="navy" />
        <Tile label="Impacto neto anual" value={copSigno(totSM - totFM)} sub="Sobrantes − faltantes" icon="chart" tone={totSM - totFM < 0 ? 'red' : 'green'} />
      </div>

      <div className="aqd-grid2">
        <Panel title="Casos por mes" icon="chart" sub="Faltantes frente a sobrantes. Pulse un mes para filtrar el histograma."
          right={<Legend items={[['Faltantes', C.red, 'line'], ['Sobrantes', C.goldInk, 'line']]} />}>
          <MonthChart label={'Casos por mes ' + d.anio} labels={MES_CORTO} corte={corte} onPick={pick} picked={mesSel === 'TODOS' ? null : +mesSel}
            series={[{ name: 'Faltantes', color: C.red, data: M.map((m) => m.faltCasos) }, { name: 'Sobrantes', color: C.goldInk, data: M.map((m) => m.sobCasos) }]}
            fmtAxis={(v) => n0(v)} fmtV={(v) => n0(v) + ' casos'} />
        </Panel>
        <Panel title="Monto por mes" icon="wallet" sub="Valor de las diferencias en pesos"
          right={<Legend items={[['Monto faltante', C.red], ['Monto sobrante', C.gold]]} />}>
          <MonthChart type="bar" label={'Monto por mes ' + d.anio} labels={MES_CORTO} corte={corte} onPick={pick} picked={mesSel === 'TODOS' ? null : +mesSel}
            series={[{ name: 'Monto faltante', color: C.red, data: M.map((m) => m.faltMonto) }, { name: 'Monto sobrante', color: C.gold, data: M.map((m) => m.sobMonto) }]}
            fmtAxis={(v) => copCorto(v)} fmtV={(v) => cop(v)} />
        </Panel>
      </div>

      <Panel title="Histograma: oficinas con mayor índice de diferencias" icon="flag"
        sub={'Casos de faltante/sobrante por oficina · ' + (mesSel === 'TODOS' ? 'Todo el año ' + d.anio : MESES[+mesSel] + ' ' + d.anio) + '. Las 3 primeras en rojo y las 4 siguientes en amarillo.'}
        right={mesSel !== 'TODOS' && <button type="button" className="btn btn-g btn-sm" onClick={() => setMesSel('TODOS')}>Ver todo el año</button>}>
        {hist.length
          ? <HBars label="Oficinas con más casos de diferencia" labelW={220} rows={hist.map((x, i) => ({ key: x.oficina, label: (i + 1) + '. ' + x.oficina, segs: [{ v: x.casos, color: histCol(i), name: 'Casos con diferencia' }] }))} />
          : <Empty icon="check" title="Sin diferencias en el periodo" />}
      </Panel>

      <Panel title={'Ranking de oficinas por incidencia (' + d.anio + ')'} icon="list" flush sub="Índice de incidencia = casos con diferencia ÷ arqueos realizados en la oficina.">
        {d.oficinas.length ? (
          <SortTable rows={d.oficinas.map((o, i) => ({ ...o, rank: i + 1 }))} rowKey={(o) => o.oficina} limit={30}
            cols={[
              { k: 'rank', h: '#', align: 'c', render: (o) => <span className="aqd-rank">{o.rank}</span> },
              { k: 'oficina', h: 'Oficina', render: (o) => <b className="aqd-nav">{o.oficina}</b> },
              { k: 'casos', h: 'Casos', align: 'r', render: (o) => <b className="num">{o.casos}</b> },
              { k: 'faltCasos', h: 'Faltantes', align: 'r', render: (o) => <span className={'num ' + (o.faltCasos ? 'aqd-neg' : 'muted')}>{o.faltCasos}</span> },
              { k: 'sobCasos', h: 'Sobrantes', align: 'r', render: (o) => <span className={'num ' + (o.sobCasos ? 'aqd-gold' : 'muted')}>{o.sobCasos}</span> },
              { k: 'faltMonto', h: 'Monto falt.', align: 'r', render: (o) => <span className={'num ' + (o.faltMonto ? 'aqd-neg' : 'muted')}>{cop(o.faltMonto)}</span> },
              { k: 'sobMonto', h: 'Monto sobr.', align: 'r', render: (o) => <span className={'num ' + (o.sobMonto ? 'aqd-gold' : 'muted')}>{cop(o.sobMonto)}</span> },
              { k: 'indice', h: 'Índice incidencia', render: (o) => <div className="aqd-adv"><Meter v={o.indice} tone={nivelIndice(o.indice)} /><span className="num">{o.indice}%</span></div> }
            ]} />
        ) : <Empty icon="check" title="Sin diferencias operativas en el año" />}
      </Panel>
    </>
  );
}
