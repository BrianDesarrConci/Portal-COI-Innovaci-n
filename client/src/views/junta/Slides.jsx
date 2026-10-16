// Diapositivas del Modo Comité. Cada una recibe `C` (cifras de buildCommittee) y `app`.
import BrandMarks from '../../layout/BrandMarks.jsx';
import { fmt, pct, MONTHS, MSHORT } from '../../lib/format.js';
import { Count, Delta, Gauge, MiniRing, Rings, TrendChart } from './parts.jsx';
import { TARGET } from './data.js';
import { isoLocal } from '../monitoreo/dashboard.js';

const WORDS = ['Ningún', 'Un', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez', 'Once', 'Doce', 'Trece', 'Catorce', 'Quince', 'Dieciséis', 'Diecisiete', 'Dieciocho'];
const word = (n) => WORDS[n] || String(n);

const rv = (d) => ({ '--d': d });
const dLong = (iso) => { const d = new Date(iso + 'T12:00:00'); return d.getDate() + ' de ' + MONTHS[d.getMonth()] + ' de ' + d.getFullYear(); };

/** Marco común: encabezado con número, título y subtítulo. */
function Frame({ n, kicker, title, sub, children, cls = '' }) {
  return (
    <div className={'jt-frame ' + cls}>
      <header className="jt-head">
        <div className="jt-kick rv" style={rv(0)}><span className="num">{String(n).padStart(2, '0')}</span>{kicker}</div>
        <h2 className="rv" style={rv(1)}>{title}</h2>
        {sub && <p className="jt-sub rv" style={rv(2)}>{sub}</p>}
      </header>
      <div className="jt-body">{children}</div>
    </div>
  );
}

/* 1. Portada */
export function Portada({ C, app }) {
  const { NOW, D } = app;
  return (
    <div className="jt-cover">
      <Rings className="jt-cover-rings" />
      <div className="jt-cover-top rv" style={rv(0)}><BrandMarks size="lg" /><span className="jt-tagline">Gerencia de Gestión del Negocio</span></div>
      <div className="jt-cover-mid">
        <div className="jt-lock rv" style={rv(1)}><span className="jt-lock-n">COI</span><span className="jt-lock-t">Gestión y Monitoreo<br />de Apoyo al Negocio</span></div>
        <h1 className="rv" style={rv(2)}>Informe al Comité<br />de Accionistas</h1>
        <p className="jt-cover-period rv" style={rv(3)}>
          <b>{C.period.label}</b><span>{C.period.partial ? 'Corte al ' + NOW.getDate() + ' de ' + MONTHS[NOW.getMonth()] : 'Cierre del mes'}</span>
        </p>
      </div>
      <div className="jt-cover-facts">
        {[[Object.keys(app.clients).length, 'clientes con acuerdo de servicio'], [C.totalActs, 'actividades monitoreadas'], [D.processes.length, 'procesos transversales'], [D.analysts.length, 'personas en el equipo']].map((f, i) => (
          <div key={f[1]} className="rv" style={rv(4 + i * 0.6)}><b><Count to={f[0]} delay={500 + i * 120} /></b><span>{f[1]}</span></div>
        ))}
      </div>
      <div className="jt-cover-foot rv" style={rv(6)}>Reval S.A.S. · Multipagas S.A.S. · Documento de uso interno para el Comité de Accionistas</div>
    </div>
  );
}

/* 2. Índice de servicio */
export function Indice({ C }) {
  const { A, B, period } = C;
  const kpis = [
    ['Cumplimiento con evidencia', <Count to={A.comp * 100} format={(v) => pct(v, 1)} />, 'actividades cerradas con soporte', <Delta a={A.comp * 100} b={B.comp * 100} />],
    ['ANS cumplido', <Count to={A.ans * 100} format={(v) => pct(v, 1)} />, 'promedio ponderado de 16 clientes', <Delta a={A.ans * 100} b={B.ans * 100} />],
    ['Evaluación de clientes', <><Count to={A.ev} dec={2} /><small> / 5</small></>, 'promedio del mes', <Delta a={A.ev} b={B.ev} dec={2} unit="" />],
    ['Horas liberadas', <><Count to={A.hours} /><small> h</small></>, 'trabajo manual evitado en el mes', <Delta a={A.hours / Math.max(1, A.days)} b={B.hours / Math.max(1, B.days)} unit=" h al día" />]
  ];
  return (
    <Frame n={2} kicker="Índice de servicio" title="La operación sostiene un servicio de alto nivel" sub={'Lectura de ' + period.text + (period.partial ? ', en curso,' : '') + ' frente al mismo tramo de ' + period.prevName + '.'}>
      <div className="jt-idx">
        <div className="jt-idx-g rv" style={rv(2)}>
          <Gauge v={A.index} />
          <div className="jt-idx-c">
            <span className="l">Índice de servicio</span>
            <b><Count to={A.index} dec={1} dur={1800} /></b>
            <span className="s">de 100</span>
            <Delta a={A.index} b={B.index} label={'frente a ' + period.prevName} />
          </div>
        </div>
        <div className="jt-kpis">
          {kpis.map((k, i) => (
            <div key={k[0]} className="jt-kpi rv" style={rv(3 + i * 0.7)}>
              <span className="l">{k[0]}</span>
              <b>{k[1]}</b>
              <span className="s">{k[2]}</span>
              {k[3]}
            </div>
          ))}
          <p className="jt-note rv" style={rv(6)}>
            <i /><span>El índice combina cumplimiento con evidencia (50 %), ANS de clientes (30 %) y evaluación de clientes (20 %). En el mes se cerraron <b className="num">{fmt(A.done)}</b> de <b className="num">{fmt(A.prog)}</b> actividades programadas.</span>
          </p>
        </div>
      </div>
    </Frame>
  );
}

/* 3. Cumplimiento en el tiempo */
export function Tendencia({ C }) {
  const m = C.monthly, first = m[0], last = m[m.length - 1];
  const over = m.filter((x) => x.comp >= TARGET).length;
  const firstOver = m.find((x) => x.comp >= TARGET);
  return (
    <Frame n={3} kicker="Cumplimiento en el tiempo" title={last.comp > first.comp ? 'Doce meses de mejora sostenida' : 'Doce meses de operación'} sub="Actividades cerradas con evidencia sobre las programadas, por mes. La línea cian muestra el ANS cumplido de los clientes.">
      <div className="jt-trend-w">
        <div className="jt-chart rv" style={rv(2)}>
          <div className="jt-legend"><span><i className="g" />Cumplimiento con evidencia</span><span><i className="c" />ANS cumplido</span><span><i className="y" />Meta</span></div>
          <TrendChart data={m} target={TARGET} />
        </div>
        <aside className="jt-side">
          <div className="jt-stat rv" style={rv(3)}>
            <span className="l">Avance en doce meses</span>
            <b><Count to={last.comp - first.comp} dec={1} format={(v) => '+' + fmt(v, 1)} /><small> pts</small></b>
            <span className="s">de {pct(first.comp, 1)} en {first.full.toLowerCase()} a {pct(last.comp, 1)} en {last.full.toLowerCase()}</span>
          </div>
          <div className="jt-stat rv" style={rv(3.7)}>
            <span className="l">Meses sobre la meta</span>
            <b><Count to={over} /><small> de {m.length}</small></b>
            <span className="s">{firstOver ? 'por encima de ' + TARGET + ' % desde ' + firstOver.full.toLowerCase() : 'meta de ' + TARGET + ' %'}</span>
          </div>
          <div className="jt-stat rv" style={rv(4.4)}>
            <span className="l">Acumulado {C.period.year}</span>
            <b><Count to={C.ytd.comp * 100} format={(v) => pct(v, 1)} /></b>
            <span className="s"><span className="num">{fmt(C.ytd.done)}</span> actividades cerradas en el año</span>
          </div>
        </aside>
      </div>
    </Frame>
  );
}

/* 4. Clientes y ANS */
export function Clientes({ C }) {
  const rows = C.clientRows, half = Math.ceil(rows.length / 2);
  const { A, B, maxGain, belowAns } = C;
  const col = (list, off) => (
    <ol className="jt-cl" start={off + 1}>
      {list.map((c, i) => {
        const rank = off + i + 1, top = rank <= 3, low = c.ans < TARGET;
        return (
          <li key={c.k} className={'rv' + (top ? ' is-top' : '') + (low ? ' is-low' : '')} style={rv(2.5 + (off + i) * 0.22)}>
            <span className="cl-rk num">{rank}</span>
            <span className="cl-nm"><b>{c.name}</b><small>ANS {c.ansV}</small></span>
            <span className="cl-bar"><i style={{ '--w': ((c.ev - 3) / 2 * 100).toFixed(1) + '%' }} /></span>
            <span className="cl-ev num">{fmt(c.ev, 1)}</span>
            <span className={'cl-an num' + (low ? ' warn' : '')}>{pct(c.ans, 1)}</span>
          </li>
        );
      })}
    </ol>
  );
  return (
    <Frame n={4} kicker="Clientes y acuerdos de servicio" title={rows.every((c) => c.ev >= c.evFirst) ? 'Los ' + rows.length + ' clientes mejoran su evaluación' : 'Evaluación de los ' + rows.length + ' clientes'} sub={'Evaluación del cliente en ' + C.period.month + ' (escala de 1 a 5) y ANS cumplido en el mes. Ordenados por evaluación.'}>
      <div className="jt-clients">
        <aside className="jt-side">
          <div className="jt-stat big rv" style={rv(2)}>
            <span className="l">Evaluación promedio</span>
            <b><Count to={A.ev} dec={2} /><small> / 5</small></b>
            <Delta a={A.ev} b={B.ev} dec={2} unit="" label={'frente a ' + C.period.prevName} />
          </div>
          <div className="jt-stat rv" style={rv(2.7)}>
            <span className="l">Mayor avance en el semestre</span>
            <b className="t">{maxGain.name}</b>
            <span className="s">de <span className="num">{fmt(maxGain.evFirst, 1)}</span> en mayo a <span className="num">{fmt(maxGain.ev, 1)}</span> en {C.period.month}</span>
          </div>
          <div className={'jt-stat rv' + (belowAns.length ? ' alert' : ' ok')} style={rv(3.4)}>
            <span className="l">ANS por debajo de {TARGET} %</span>
            <b><Count to={belowAns.length} /><small> {belowAns.length === 1 ? 'cliente' : 'clientes'}</small></b>
            <span className="s">{belowAns.length ? belowAns.map((c) => c.name).join(', ') + '. En seguimiento con el líder de cuenta.' : 'Todos los clientes cumplen su acuerdo.'}</span>
          </div>
        </aside>
        <div className="jt-cl-wrap">
          <div className="jt-cl-h rv" style={rv(2)}><span /><span>Cliente</span><span>Evaluación</span><span /><span>ANS</span></div>
          <div className="jt-cl-h rv second" style={rv(2)}><span /><span>Cliente</span><span>Evaluación</span><span /><span>ANS</span></div>
          {col(rows.slice(0, half), 0)}
          {col(rows.slice(half), half)}
        </div>
      </div>
    </Frame>
  );
}

/* 5. Eficiencia y automatización */
const SEG_COLORS = ['#048C38', '#21BBEA', '#A9B0D6', '#37A866', '#6FD0F0', '#7C84B8', '#0E7A3A', '#1A9CC6', '#C9CDE6', '#5BBF85', '#4F578D'];
export function Eficiencia({ C }) {
  const { A, ytd, autoN, totalActs, procs } = C;
  const tot = procs.reduce((s, p) => s + p.n, 0);
  const size = 440, h = size / 2, r = 170, c = 2 * Math.PI * r, gap = 6;
  let acc = 0;
  const sorted = [...procs].sort((a, b) => b.n - a.n);
  return (
    <Frame n={5} kicker="Eficiencia y automatización" title="Más tiempo del equipo para el cliente" sub="Horas de trabajo manual que el portal y sus automatizaciones dejan de exigir, y actividades cubiertas por los 11 procesos transversales.">
      <div className="jt-eff">
        <aside className="jt-side">
          <div className="jt-stat big rv" style={rv(2)}>
            <span className="l">Horas liberadas en {C.period.month}</span>
            <b><Count to={A.hours} /><small> h</small></b>
            <span className="s">equivalen a <span className="num">{fmt(A.hours / 8, 0)}</span> jornadas de ocho horas</span>
          </div>
          <div className="jt-stat rv" style={rv(2.7)}>
            <span className="l">Acumulado {C.period.year}</span>
            <b><Count to={ytd.hours} /><small> h</small></b>
            <span className="s"><span className="num">{fmt(ytd.hours / 8, 0)}</span> jornadas devueltas a la operación</span>
          </div>
          <div className="jt-stat ring rv" style={rv(3.4)}>
            <MiniRing v={autoN / totalActs * 100} size={104} stroke={10} />
            <div><span className="l">Actividades automatizadas</span><b><Count to={autoN / totalActs * 100} format={(v) => pct(v, 0)} /></b><span className="s"><span className="num">{autoN}</span> de <span className="num">{totalActs}</span> dentro de un proceso</span></div>
          </div>
        </aside>
        <div className="jt-hub rv" style={rv(2.5)}>
          <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
            <circle className="hb-r" cx={h} cy={h} r={r + 34} /><circle className="hb-r" cx={h} cy={h} r={r - 40} /><circle className="hb-r" cx={h} cy={h} r={r - 84} />
            {sorted.map((p, i) => {
              const len = (p.n / tot) * c - gap; const off = acc; acc += (p.n / tot) * c;
              return <circle key={p.id} className="hb-s" cx={h} cy={h} r={r} stroke={SEG_COLORS[i % SEG_COLORS.length]} strokeDasharray={`${Math.max(1, len)} ${c}`} strokeDashoffset={-off} transform={`rotate(-90 ${h} ${h})`} style={{ '--i': i }} />;
            })}
          </svg>
          <div className="hb-c"><b><Count to={procs.length} /></b><span>procesos transversales</span><small><span className="num">{tot}</span> actividades</small></div>
        </div>
        <ul className="jt-procs">
          {sorted.map((p, i) => (
            <li key={p.id} className="rv" style={rv(3 + i * 0.25)}>
              <i style={{ background: SEG_COLORS[i % SEG_COLORS.length] }} />
              <span className="nm">{p.name}</span>
              <span className="n num">{p.n}</span>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  );
}

/* 6. Equipo */
export function Equipo({ C }) {
  const maxLoad = Math.max(...C.team.map((t) => t.total));
  const avg = C.team.reduce((s, t) => s + t.comp, 0) / C.team.length;
  return (
    <Frame n={6} kicker="Equipo" title={word(C.team.length) + ' personas, ' + pct(avg, 1) + ' de cumplimiento promedio'} sub={'Cumplimiento con evidencia de ' + C.period.text + ', actividades a cargo y horas liberadas por persona.'}>
      <div className="jt-team">
        {C.team.map((t, i) => (
          <div key={t.id} className={'jt-mate rv' + (t.comp < 95 ? ' is-low' : '')} style={rv(2 + i * 0.5)}>
            <div className="mt-top">
              <span className={'av av' + (t.color % 3)}>{t.initials}</span>
              <div className="mt-who"><b>{t.name}</b><small>{t.role === 'Analista de datos' ? 'Analista de datos' : 'Analista'} · {t.focus}</small></div>
            </div>
            <div className="mt-mid">
              <div className="mt-ring"><MiniRing v={t.comp} min={85} max={100} size={112} stroke={10} cls={t.comp < 95 ? 'is-low' : ''} /><span className="num"><Count to={t.comp} format={(v) => fmt(v, 1)} delay={400 + i * 100} /><small>%</small></span></div>
              <div className="mt-facts">
                <div><span>Actividades a cargo</span><b className="num">{t.total}</b><em className="load"><i style={{ '--w': (t.total / maxLoad * 100).toFixed(0) + '%' }} /></em></div>
                <div><span>Cerradas en el mes</span><b className="num">{fmt(t.done)}</b></div>
                <div><span>Horas liberadas</span><b className="num">{fmt(t.hours, 0)} h</b></div>
              </div>
            </div>
            <Delta a={t.comp} b={t.compPrev} label={'frente a ' + C.period.prevName} />
          </div>
        ))}
      </div>
    </Frame>
  );
}

/* 7. Hoja de ruta */
export function Ruta({ C, app }) {
  const ms = C.milestones, P = C.portfolio;
  const todayISO = isoLocal(app.NOW);
  const all = [...ms.map((m) => m.date), ...C.committees.map((m) => m.date), todayISO].sort();
  const s0 = new Date(all[0] + 'T12:00:00'); s0.setDate(1);
  const e0 = new Date(all[all.length - 1] + 'T12:00:00'); e0.setMonth(e0.getMonth() + 1, 0);
  const pos = (iso) => ((new Date(iso + 'T12:00:00') - s0) / (e0 - s0)) * 100;
  const monthTicks = []; for (let d = new Date(s0); d <= e0; d.setMonth(d.getMonth() + 1)) monthTicks.push(new Date(d));
  const comm = C.committees.filter((c) => !c.done).slice(0, 3);
  const stColor = { 'Recibida': '#A9B0D6', 'En análisis': '#6FD0F0', 'En desarrollo': '#21BBEA', 'En pruebas': '#1A9CC6', 'En espera': '#F6CF46', 'Cerrada': '#048C38', 'Rechazada': '#4F578D' };
  return (
    <Frame n={7} kicker="Hoja de ruta" title={ms.length ? word(ms.filter((m) => !m.done).length) + ' hitos hasta la entrega formal' : 'Hoja de ruta'} sub="Plan de puesta en producción de COI, comités mensuales con clientes y portafolio de solicitudes gestionadas en TRAZA.">
      <div className="jt-road">
        {!ms.length ? <p className="jt-empty">Cargando hitos…</p> : (
          <div className="jt-tl">
            <div className="tl-cards">
              {ms.map((m, i) => (
                <div key={m.date} className={'tl-card rv' + (m.done ? ' done' : '')} style={rv(2 + i * 0.5)}>
                  <span className="tl-d num">{dLong(m.date)}</span>
                  <b>{m.text.split(':')[0]}</b>
                  <small>{m.text.split(':').slice(1).join(':').trim()}</small>
                </div>
              ))}
            </div>
            <div className="tl-axis rv" style={rv(2)}>
              <svg className="tl-links" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true">
                {ms.map((m, i) => <path key={m.date} d={`M${(i + 0.5) * (100 / ms.length)} 0 C ${(i + 0.5) * (100 / ms.length)} 30, ${pos(m.date)} 30, ${pos(m.date)} 60`} vectorEffect="non-scaling-stroke" style={{ '--dl': (0.9 + i * 0.12) + 's' }} />)}
              </svg>
              <div className="tl-line"><i className="past" style={{ width: pos(todayISO) + '%' }} /></div>
              {monthTicks.map((d) => <span key={d.getTime()} className="tl-m" style={{ left: pos(isoLocal(d)) + '%' }}>{MSHORT[d.getMonth()]} {String(d.getFullYear()).slice(2)}</span>)}
              {ms.map((m) => <span key={m.date} className={'tl-dot' + (m.done ? ' done' : '')} style={{ left: pos(m.date) + '%' }} />)}
              {C.committees.map((m) => <span key={m.date} className={'tl-cm' + (m.done ? ' done' : '')} style={{ left: pos(m.date) + '%' }} title={m.text} />)}
              <span className="tl-today" style={{ left: pos(todayISO) + '%' }}><em>Hoy</em></span>
            </div>
            <div className="tl-legend rv" style={rv(4)}>
              <span><i className="dot" />Hito del plan</span><span><i className="cm" />Comité mensual con clientes</span>
              {comm[0] && <span className="next">Próximo comité: <b>{dLong(comm[0].date)}</b>, {comm[0].text.split(': ')[1]}</span>}
            </div>
          </div>
        )}
        <div className="jt-traza rv" style={rv(5)}>
          <div className="tz-h"><b>Portafolio TRAZA</b><span>Solicitudes de mejora y desarrollo de los aplicativos del área</span></div>
          {!P ? <p className="jt-empty">Cargando portafolio…</p> : (
            <div className="tz-g">
              <div className="tz-k">
                {[['Solicitudes', P.total], ['Abiertas', P.open], ['Cerradas', P.closed], ['Horas invertidas', Math.round(P.hours)]].map((k, i) => (
                  <div key={k[0]}><b><Count to={k[1]} delay={700 + i * 100} /></b><span>{k[0]}</span></div>
                ))}
              </div>
              <div className="tz-bar">
                <div className="tz-stack">
                  {P.states.filter((s) => P.by[s]).map((s, i) => <i key={s} style={{ flex: P.by[s], background: stColor[s], '--i': i }} title={s + ': ' + P.by[s]} />)}
                </div>
                <div className="tz-lg">
                  {P.states.filter((s) => P.by[s]).map((s) => <span key={s}><i style={{ background: stColor[s] }} />{s}<b className="num">{P.by[s]}</b></span>)}
                </div>
                <p className="tz-note"><b className="num">{P.critical}</b> abiertas con prioridad alta o crítica{P.overdue ? <>; <b className="num">{P.overdue}</b> con fecha objetivo vencida</> : ''}.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Frame>
  );
}

/* 8. Cierre */
export function Cierre({ C }) {
  const { A, B, period, belowAns, milestones, committees, portfolio } = C;
  const next = milestones.find((m) => !m.done);
  const nextCom = committees.find((m) => !m.done);
  const msgs = [
    ['Servicio', fmt(A.index, 1), 'de 100 en el índice de servicio de ' + period.month + ', ' + (A.index >= B.index ? 'por encima' : 'por debajo') + ' de ' + period.prevName + '.'],
    ['Clientes', fmt(A.ev, 2), 'sobre 5 en la evaluación de los 16 clientes, con ANS cumplido de ' + pct(A.ans * 100, 1) + '.'],
    ['Eficiencia', fmt(C.ytd.hours, 0) + ' h', 'liberadas en ' + period.year + ' y ' + pct(C.autoN / C.totalActs * 100, 0) + ' de las actividades dentro de un proceso automatizado.']
  ];
  const steps = [];
  if (next) steps.push([dLong(next.date), next.text]);
  if (nextCom) steps.push([dLong(nextCom.date), nextCom.text]);
  if (belowAns.length) steps.push(['Seguimiento', 'Plan de acción con ' + belowAns.map((c) => c.name).join(', ') + ' para recuperar el ' + TARGET + ' % del ANS.']);
  const fin = milestones[milestones.length - 1];
  if (fin && fin !== next) steps.push([dLong(fin.date), fin.text]);
  if (portfolio) steps.push(['TRAZA', portfolio.open + ' solicitudes abiertas, ' + portfolio.critical + ' de prioridad alta o crítica en ejecución.']);
  return (
    <div className="jt-end">
      <Rings className="jt-end-rings" />
      <div className="jt-end-top rv" style={rv(0)}><span className="jt-kick"><span className="num">08</span>Cierre</span><BrandMarks size="sm" /></div>
      <h2 className="rv" style={rv(1)}>Mensajes para el comité</h2>
      <div className="jt-msgs">
        {msgs.map((m, i) => (
          <div key={m[0]} className="jt-msg rv" style={rv(2 + i * 0.6)}>
            <span className="l">{m[0]}</span><b className="num">{m[1]}</b><p>{m[2]}</p>
          </div>
        ))}
      </div>
      <div className="jt-steps rv" style={rv(4)}>
        <span className="l">Próximos pasos</span>
        <ol>{steps.map((s, i) => <li key={i} className="rv" style={rv(4.5 + i * 0.4)}><em>{s[0]}</em><span>{s[1]}</span></li>)}</ol>
      </div>
      <div className="jt-end-foot rv" style={rv(6)}>COI · Gestión y Monitoreo de Apoyo al Negocio · Reval S.A.S. · Multipagas S.A.S.</div>
    </div>
  );
}

export const SLIDES = [
  ['Portada', Portada], ['Índice de servicio', Indice], ['Cumplimiento en el tiempo', Tendencia], ['Clientes y ANS', Clientes],
  ['Eficiencia y automatización', Eficiencia], ['Equipo', Equipo], ['Hoja de ruta', Ruta], ['Cierre', Cierre]
];
