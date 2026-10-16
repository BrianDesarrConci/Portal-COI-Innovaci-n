// N0 Tablero gerencial: lectura de la operación por periodo con comparación frente al anterior.
import { useMemo, useState } from 'react';
import Icon from '../components/Icon.jsx';
import { Avatar, Bar, Card, Cell, GoLink, Loading, Spark, Table, Tag } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useModuleData } from '../hooks/useApi.js';
import { fmt, pct, hash, MONTHS, MSHORT } from '../lib/format.js';
import { PROC_VIEW } from '../lib/model.js';
import { MODULES } from '../lib/nav.js';
import { buildSeries, makeEvalFor, periodDef, PERIOD_OPTS, PERIOD_TYPES, inRange, agg, buckets, isoLocal } from './monitoreo/dashboard.js';
import { ComboChart, Delta, Donut, Gauge, Heatmap } from './monitoreo/charts.jsx';
import Pulse from './monitoreo/Pulse.jsx';
import CountUp from '../components/CountUp.jsx';

// Periodo elegido: se conserva al salir y volver al tablero, como en el demo.
const DASH = { type: 'mes', idx: 0 };
const AN_OFF = [0.006, -0.004, 0.003, 0.001, -0.006, -0.009];
const AN_OFF_B = [0.002, -0.001, 0.006, -0.003, -0.002, -0.012];
const PROC_COLORS = ['#242A54', '#048C38', '#21BBEA', '#6C74A8', '#00BD4E', '#7FD3F0', '#B9BEDA', '#3D8A44', '#1A8FB5', '#9AA0C8', '#5CC6A0'];

export default function Inicio() {
  const app = useApp();
  const { D, NOW, NOW_MIN } = app;
  const { data, error } = useModuleData('inicio');
  const [dash, setDash] = useState({ ...DASH });
  const setPeriod = (p) => { Object.assign(DASH, p); setDash({ ...DASH }); };
  const SERIES = useMemo(() => buildSeries(NOW), [NOW]);
  const evalFor = useMemo(() => makeEvalFor(D.clientExtra), [D]);
  if (!data) return <Loading error={error} />;
  return <Dashboard app={app} data={data} dash={dash} setPeriod={setPeriod} SERIES={SERIES} evalFor={evalFor} NOW={NOW} NOW_MIN={NOW_MIN} />;
}

function Dashboard({ app, data, dash, setPeriod, SERIES, evalFor, NOW, NOW_MIN }) {
  const { D, acts, clients, STATS, isAuto, go, toast } = app;
  const P = periodDef(NOW, dash.type, dash.idx);
  const list = SERIES.filter((x) => inRange(x, P.s, P.e)), prevList = SERIES.filter((x) => inRange(x, P.ps, P.pe));
  const A = agg(list, evalFor), B = agg(prevList, evalFor);
  const bk = buckets(P, list, NOW_MIN, evalFor);
  const isDay = P.type === 'dia';
  const opts = Array.from({ length: PERIOD_OPTS[P.type] }, (_, i) => { const q = periodDef(NOW, P.type, i); return [i, q.label + (i === 0 && P.type !== 'dia' ? ', en curso' : i === 0 ? ', hoy' : '')]; });

  /* Analistas en el periodo */
  const anRows = D.analysts.map((a, i) => {
    const off = AN_OFF[i], offB = AN_OFF_B[i];
    const cA = Math.min(0.998, A.comp + off), cB = Math.min(0.998, B.comp + offB);
    const share = STATS[a.id].total / 104; const doneA = Math.round(A.done * share);
    const tr = bk.filter((b) => b.comp != null).map((b, j) => b.comp + off * 100 + Math.sin(j + i) * 0.4);
    return { a, cA, cB, doneA, hours: A.hours * share * (a.id === 'hernan' ? 0.4 : 1), tr };
  }).sort((p, q) => q.cA - p.cA);
  const anTable = (
    <Table headers={['Analista', 'Cumplimiento', 'Frente a ' + (isDay ? 'la semana anterior' : 'el anterior'), 'Cerradas', 'Horas liberadas', 'Tendencia']} align={['', '', '', 'r', 'r', '']}
      rows={anRows.map((r, i) => ({
        key: r.a.id, go: 'analista/' + r.a.id, cells: [
          <div className="who"><span className="rank">{i + 1}</span><Avatar id={r.a.id} /><div><Cell main={r.a.name} sub={r.a.id === 'hernan' ? 'Analista de datos' : 'Analista'} /></div></div>,
          <div className="cbar"><span className="num strong">{pct(r.cA * 100, 1)}</span><Bar v={r.cA * 100} cls={r.cA >= 0.95 ? '' : 'gd'} /></div>,
          <Delta a={r.cA * 100} b={r.cB * 100} unit=" pts" />,
          <span className="num">{fmt(r.doneA)}</span>,
          <span className="num">{fmt(r.hours, 0)} h</span>,
          r.tr.length > 1 ? <Spark values={r.tr} w={96} h={26} color={r.cA >= 0.95 ? '#048C38' : '#C99A00'} /> : <span className="muted small">Un día</span>
        ]
      }))} />
  );

  /* Clientes en el periodo */
  const evM = (k) => { const e = P.e; const idxM = (e.getFullYear() - 2026) * 12 + e.getMonth() - 4; const sc = D.clientExtra[k].score; return idxM >= 0 && idxM <= 5 ? sc[idxM] : Math.max(3.2, sc[0] - 0.05 * (0 - idxM)); };
  const clRows = Object.keys(clients).map((k) => {
    const off = (hash(k) % 100) / 100 * 0.04 - 0.02;
    const offB = ((hash(k + 'b') % 100) / 100) * 0.04 - 0.022; const ansA = Math.min(1, A.ans + off), ansB = Math.min(1, B.ans + offB);
    return { k, ansA, ansB, ev: evM(k) };
  }).sort((p, q) => q.ansA - p.ansA);
  const below = clRows.filter((c) => c.ansA < 0.95);
  const clTable = (
    <Table headers={['Cliente', 'ANS cumplido', 'Variación', 'Evaluación', 'Estado']} align={['', '', '', 'r', '']}
      rows={clRows.map((c) => ({
        key: c.k, go: 'cliente/' + c.k, cells: [
          <Cell main={clients[c.k].name} sub={'ANS ' + D.clientExtra[c.k].ans} />,
          <div className="cbar"><span className="num strong">{pct(c.ansA * 100, 1)}</span><Bar v={c.ansA * 100} cls={c.ansA >= 0.95 ? 'nv' : 'gd'} /></div>,
          <Delta a={c.ansA * 100} b={c.ansB * 100} unit=" pts" />,
          <><span className="num strong">{fmt(c.ev, 1)}</span><span className="muted small"> / 5</span></>,
          c.ansA >= 0.95 ? <Tag cls="b-ok">Cumple</Tag> : <Tag cls="b-warn">Por debajo</Tag>
        ]
      }))} />
  );

  /* Distribución por proceso */
  const procParts = D.processes.map((p, i) => [p.name, Math.round(A.done * (acts.filter((a) => a.p === p.id).length / 95) * (0.9 + (hash(p.id) % 20) / 100)), PROC_COLORS[i % PROC_COLORS.length], p.id]).sort((a, b) => b[1] - a[1]);

  /* Lectura automática */
  const dComp = (A.comp - B.comp) * 100;
  const reading = (isDay ? 'Hoy ' : (P.partial ? P.label + ' va ' : P.label + ' cerró ')) + 'con ' + pct(A.comp * 100, 1) + ' de las actividades cerradas con evidencia, ' + fmt(Math.abs(dComp), 1) + ' puntos ' + (dComp >= 0 ? 'por encima' : 'por debajo') + ' de ' + P.unitName + '. ' + (below.length ? below.length + (below.length === 1 ? ' cliente quedó' : ' clientes quedaron') + ' por debajo del 95 % de su ANS: ' + below.slice(0, 3).map((c) => clients[c.k].name).join(', ') + '.' : 'Todos los clientes cumplieron su ANS por encima del 95 %.') + ' El equipo liberó ' + fmt(A.hours, 0) + ' horas de trabajo manual.';

  /* Atención */
  const att = [];
  const last = anRows[anRows.length - 1];
  if (last.cA < 0.955) att.push(['warn', 'Cumplimiento de ' + last.a.name, pct(last.cA * 100, 1) + ' en el periodo, el más bajo del equipo', 'analista/' + last.a.id]);
  below.slice(0, 2).forEach((c) => att.push(['bad', clients[c.k].name + ' por debajo del ANS', pct(c.ansA * 100, 1) + ' frente a la meta de 95 %', 'cliente/' + c.k]));
  if (P.idx === 0) data.currentAttention.forEach((t) => att.push(t));
  if (!att.length) att.push(data.emptyAttention);
  const attList = (
    <div className="att-list">
      {att.slice(0, 5).map((t, i) => (
        <button key={i} className={'att ' + t[0]} onClick={() => go(t[3])}>
          <span className="att-ic"><Icon name={t[0] === 'ok' ? 'check' : t[0] === 'info' ? 'clock' : 'alert'} /></span>
          <span className="grow"><b>{t[1]}</b><small>{t[2]}</small></span>
          <Icon name="chevron" />
        </button>
      ))}
    </div>
  );

  /* Hitos y comités del periodo */
  const inP = (iso) => { const d = new Date(iso + 'T12:00:00'); return d >= P.s && d <= P.fullEnd; };
  const events = data.milestones.filter((m) => inP(m[0])).map((m) => [m[0], m[1], 'flag']);
  if (!isDay) {
    const mm = new Set(list.map((x) => x.d.getFullYear() + '-' + x.d.getMonth()));
    mm.forEach((k) => { const p = k.split('-').map(Number); events.push([isoLocal(new Date(p[0], p[1], data.committees.day)), 'Comités mensuales de ' + MONTHS[p[1]] + ': ' + data.committees.text, 'chart']); });
  }
  events.sort((a, b) => a[0] < b[0] ? -1 : 1);

  /* KPI con tendencia */
  const sparkOf = (f) => isDay ? [] : bk.filter((b) => b.comp != null).map(f);
  const autoN = acts.filter(isAuto).length;
  const kcard = (label, val, unit, dlt, sp, icon, color) => (
    <div className="card kx">
      <div className="kx-top"><span className="kx-ic" style={{ '--c': color }}><Icon name={icon} /></span><span className="kx-l">{label}</span></div>
      <div className="kx-v num"><CountUp value={val} />{unit && <small>{unit}</small>}</div>
      <div className="kx-b">{dlt}{sp.length > 1 && <Spark values={sp} w={92} h={26} color={color} />}</div>
    </div>
  );
  const heroStats = [['Actividades cerradas', fmt(A.done), 'de ' + fmt(A.prog) + ' programadas'], ['ANS cumplido', pct(A.ans * 100, 1), 'promedio ponderado de 16 clientes'], ['Evaluación de clientes', fmt(A.ev, 2), 'sobre 5, promedio del periodo'], ['Horas liberadas', fmt(A.hours, 0), 'trabajo manual evitado']];
  const attCard = <Card title="Lo que requiere atención">{attList}</Card>;

  return (
    <>
      <div className="dash-head">
        <div><h1 className="dash-title">Tablero gerencial</h1><p className="muted">Lectura de la operación de Apoyo al Negocio por periodo.</p></div>
        <div className="dash-ctrl">
          <div className="seg seg-lg">
            {PERIOD_TYPES.map((s) => <button key={s[0]} className={s[0] === P.type ? 'on' : ''} onClick={() => setPeriod({ type: s[0], idx: 0 })}>{s[1]}</button>)}
          </div>
          <select className="period-sel" aria-label="Periodo" value={P.idx} onChange={(e) => setPeriod({ idx: +e.target.value })}>
            {opts.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
          </select>
          <button className="btn btn-o" onClick={() => toast('Informe de ' + P.label + ' generado en PDF.')}><Icon name="download" />Informe del periodo</button>
          <button className="btn btn-board" onClick={() => go('junta')}><Icon name="sparkle" />Presentar al comité</button>
        </div>
      </div>

      <section className="hero">
        <div className="hero-g">
          <div className="gauge-box"><Gauge v={A.index} /><div className="gauge-c"><b className="num"><CountUp value={fmt(A.index, 1)} /></b><span>de 100</span></div></div>
          <div>
            <div className="hero-k">Índice de servicio</div>
            <div className="hero-p">{P.label}{P.partial ? ', en curso' : ''}</div>
            <div className="hero-d"><Delta a={A.index} b={B.index} unit=" pts" /> <span>frente a {P.unitName}</span></div>
          </div>
        </div>
        <div className="hero-stats">
          {heroStats.map((s) => <div key={s[0]} className="hs"><span>{s[0]}</span><b className="num"><CountUp value={s[1]} /></b><small>{s[2]}</small></div>)}
        </div>
        <p className="hero-read"><Icon name="sparkle" /><span>{reading}</span></p>
      </section>

      <div className="kx-row">
        {kcard('Cumplimiento con evidencia', pct(A.comp * 100, 1), '', <Delta a={A.comp * 100} b={B.comp * 100} unit=" pts" />, sparkOf((b) => b.comp), 'shield', '#048C38')}
        {kcard('ANS de clientes', pct(A.ans * 100, 1), '', <Delta a={A.ans * 100} b={B.ans * 100} unit=" pts" />, sparkOf((b) => b.ans || A.ans * 100), 'star', '#242A54')}
        {kcard('Casos atendidos', fmt(A.cases), '', <Delta a={A.cases / Math.max(1, A.days)} b={B.cases / Math.max(1, B.days)} unit=" al día" dec={1} />, sparkOf((b) => b.vol), 'inbox', '#21BBEA')}
        {kcard('Horas liberadas', fmt(A.hours, 0), 'h', <Delta a={A.hours / Math.max(1, A.days)} b={B.hours / Math.max(1, B.days)} unit=" h al día" dec={1} />, sparkOf((b) => b.hours || 0), 'clock', '#1A8FB5')}
        {kcard('Alertas gestionadas', fmt(A.alerts), '', <Delta a={A.alerts / Math.max(1, A.days)} b={B.alerts / Math.max(1, B.days)} unit=" al día" dec={1} invert />, sparkOf((b) => b.vol), 'bell', '#C99A00')}
        {kcard('Automatización', pct(autoN / 104 * 100, 0), '', <span className="delta flat">{autoN} de 104</span>, [], 'sparkle', '#6C74A8')}
      </div>

      {isDay && <div className="mt"><Pulse /></div>}

      <div className="grid g-main mt">
        <Card title={isDay ? 'Cierres por franja horaria' : 'Cumplimiento y volumen'}
          sub={isDay ? 'Actividades cerradas por hora y cumplimiento acumulado' : 'Barras: actividades cerradas por ' + ({ day: 'día', week: 'semana', month: 'mes' })[P.bucket] + '. Línea: cumplimiento con evidencia. Pase el cursor para ver el detalle.'}
          right={<div className="legend"><span><i style={{ background: '#C9CDE3' }} />Cerradas</span><span><i style={{ background: '#048C38' }} />Cumplimiento</span><span><i style={{ background: '#21BBEA' }} />Meta</span></div>}>
          <ComboChart id="main" data={bk} />
        </Card>
        <Card title="Distribución por proceso" sub="Actividades cerradas en el periodo">
          <div className="donut-box">
            <Donut parts={procParts.map((p) => [p[0], p[1], p[2]])} />
            <div className="dlg">
              {procParts.map((p) => (
                <button key={p[3]} className="lg-row" onClick={() => go(PROC_VIEW[p[3]])}><i style={{ background: p[2] }} /><span className="ellip">{p[0]}</span><b className="num">{fmt(p[1])}</b></button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {!isDay
        ? <div className="grid g-main mt"><Card title="Mapa de cumplimiento diario" sub="Cada cuadro es un día hábil del periodo"><Heatmap list={list} /></Card>{attCard}</div>
        : <div className="mt">{attCard}</div>}

      <div className="grid g2 mt">
        <Card title="Analistas" sub="Ordenadas por cumplimiento del periodo" flush right={<GoLink to="analistas" className="btn btn-g btn-sm">Fichas<Icon name="chevron" /></GoLink>}>{anTable}</Card>
        <Card title="Clientes" sub="ANS cumplido y evaluación del periodo" flush right={<GoLink to="clientes" className="btn btn-g btn-sm">Expedientes<Icon name="chevron" /></GoLink>}>
          <div style={{ maxHeight: 520, overflow: 'auto' }}>{clTable}</div>
        </Card>
      </div>

      <div className="grid g-main mt">
        <Card title="Hitos y comités del periodo">
          <div className="ev-list">
            {events.length ? events.slice(0, 7).map((e, i) => {
              const d = new Date(e[0] + 'T12:00:00'); const done = d <= NOW;
              return (
                <div key={i} className={'ev ' + (done ? 'done' : '')}>
                  <span className="ev-date"><b>{d.getDate()}</b>{MSHORT[d.getMonth()]}</span>
                  <span className="grow small">{e[1]}</span>
                  {done ? <Tag cls="b-ok">Cumplido</Tag> : <Tag cls="b-mute">Programado</Tag>}
                </div>
              );
            }) : <p className="small muted">Sin hitos ni comités en este periodo.</p>}
          </div>
        </Card>
        <Card title="Módulos de COI" sub="Acceso directo">
          <div className="mod-grid sm">
            {MODULES.filter((m) => m[0] !== 'inicio').map((m) => (
              <button key={m[0]} className="mod" onClick={() => go(m[0])}><Icon name={m[3]} /><span><b>{m[2]}</b><small>{m[1]}</small></span></button>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
