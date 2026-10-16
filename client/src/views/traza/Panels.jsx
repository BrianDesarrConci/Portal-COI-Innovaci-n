// Pestañas de lectura de TRAZA: tablero, flujo por etapas, capacidad e informe de gestión.
import Icon from '../../components/Icon.jsx';
import { Card, Cell, Table, LineChart, HBars, Bar } from '../../components/ui.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { DAYS, MONTHS, dshort, fmt, pct } from '../../lib/format.js';
import { TZ_OWNERS, TZ_PRIO_CLS, TZ_STATES, PrioTag, StateTag, TzAvatar, tzOpen } from './shared.jsx';

export function Tablero({ TZ }) {
  const { NOW, go } = useApp();
  const open = TZ.filter(tzOpen), closedM = TZ.filter((t) => t.state === 'Cerrada');
  const crit = open.filter((t) => t.prio === 'Crítica').length, overdue = open.filter((t) => t.target < NOW).length;
  const hours = TZ.reduce((s, t) => s + t.inv, 0);
  const weeks = ['sem 37', 'sem 38', 'sem 39', 'sem 40', 'sem 41', 'sem 42'];
  const byState = TZ_STATES.map((s) => [s, TZ.filter((t) => t.state === s).length]).filter((x) => x[1]);
  const byApp = {}; TZ.forEach((t) => { byApp[t.app] = (byApp[t.app] || 0) + 1; });
  const ranking = open.slice().sort((a, b) => b.score - a.score).slice(0, 6);
  const kx = [['Abiertas', open.length, 'flow', '#242A54'], ['Prioridad crítica', crit, 'alert', '#D6453D'], ['Fecha objetivo vencida', overdue, 'clock', '#C99A00'], ['Cerradas en el mes', closedM.length, 'check', '#048C38'], ['Horas invertidas', fmt(hours, 1), 'clock', '#1A8FB5'], ['Ciclo promedio', '6,2 d', 'activity', '#6C74A8']];
  return (
    <>
      <div className="kx-row" style={{ marginTop: 0 }}>
        {kx.map((k) => (
          <div className="card kx" key={k[0]}>
            <div className="kx-top"><span className="kx-ic" style={{ '--c': k[3] }}><Icon name={k[2]} /></span><span className="kx-l">{k[0]}</span></div>
            <div className="kx-v num">{k[1]}</div>
          </div>
        ))}
      </div>
      <div className="grid g-main mt">
        <Card title="Recibidas y cerradas por semana" sub="Últimas seis semanas">
          <LineChart series={[{ data: [4, 6, 3, 5, 7, 5], color: '#242A54' }, { data: [3, 5, 5, 4, 6, 4], color: '#048C38', area: true }]} labels={weeks} min={0} max={8} label="Recibidas y cerradas" h={230} />
          <div className="legend"><span><i style={{ background: '#242A54' }} />Recibidas</span><span><i style={{ background: '#048C38' }} />Cerradas</span></div>
        </Card>
        <Card title="Prioridad por criticidad" sub="Puntaje de 0 a 100 calculado con impacto, urgencia y usuarios afectados">
          {ranking.map((t) => (
            <button key={t.id} className="rk-row" onClick={() => go('traza/' + t.id)}>
              <span className={'rk-score ' + (t.score >= 85 ? 'bad' : t.score >= 70 ? 'warn' : '')}>{t.score}</span>
              <span className="grow"><b>{t.title}</b><small>{t.id}, {t.app}</small></span>
              <StateTag state={t.state} />
            </button>
          ))}
        </Card>
      </div>
      <div className="grid g2 mt">
        <Card title="Solicitudes por estado"><HBars rows={byState} color="nv" /></Card>
        <Card title="Solicitudes por aplicativo"><HBars rows={Object.keys(byApp).map((k) => [k, byApp[k]]).sort((a, b) => b[1] - a[1])} color="cy" /></Card>
      </div>
    </>
  );
}

export function Etapas({ TZ }) {
  const { NOW, go } = useApp();
  const cols = ['Recibida', 'En análisis', 'En desarrollo', 'En pruebas', 'En espera', 'Cerrada'];
  return (
    <div className="kanban k6">
      {cols.map((c) => {
        const items = TZ.filter((t) => t.state === c);
        return (
          <div className="kcol" key={c}>
            <h5><span>{c}</span><span className="cm-count">{items.length}</span></h5>
            {items.map((t) => (
              <button key={t.id} className="kcard" onClick={() => go('traza/' + t.id)}>
                <div className="kc-top"><span className="cell-sub num">{t.id}</span><PrioTag prio={t.prio} /></div>
                <div className="strong">{t.title}</div>
                <div className="cell-sub">{t.app}</div>
                <div className="kc-foot">
                  <TzAvatar owner={t.owner} />
                  <span className="small muted num">{fmt(t.inv, 1)} de {fmt(t.est, 0)} h</span>
                  <span className={'small ' + (tzOpen(t) && t.target < NOW ? 'down' : 'muted')}>{dshort(t.target)}</span>
                </div>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function Capacidad({ TZ }) {
  const { NOW, go } = useApp();
  const cap = Object.keys(TZ_OWNERS).map((o) => {
    const mine = TZ.filter((t) => t.owner === o && tzOpen(t));
    return [o, mine.length, mine.reduce((s, t) => s + Math.max(0, t.est - t.inv), 0)];
  });
  const days = Array.from({ length: 10 }, (_, i) => { const d = new Date(NOW); d.setDate(d.getDate() + i); return d; }).filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
  return (
    <>
      <div className="grid g2">
        {cap.map(([o, n, pend]) => {
          const week = o === 'brian' ? 30 : 16;
          const occ = Math.min(100, pend / (week * 2) * 100);
          return (
            <Card key={o} title={TZ_OWNERS[o].name} sub={TZ_OWNERS[o].role} right={<TzAvatar owner={o} />}>
              <dl className="cm-stats flat">
                <div><dt>Solicitudes abiertas</dt><dd className="num">{n}</dd></div>
                <div><dt>Horas pendientes</dt><dd className="num">{fmt(pend, 1)}</dd></div>
                <div><dt>Disponibles por semana</dt><dd className="num">{week}</dd></div>
              </dl>
              <div className="small muted" style={{ margin: '14px 0 6px' }}>Ocupación de las próximas dos semanas</div>
              <Bar v={occ} cls={pend > week * 2 ? 'gd' : 'cy'} />
              <div className="small muted" style={{ marginTop: 6 }}>{pct(occ, 0)} de la capacidad comprometida</div>
            </Card>
          );
        })}
      </div>
      <div className="mt">
        <Card title="Calendario de fechas objetivo" sub="Próximos diez días hábiles">
          <div className="cal-row">
            {days.map((d) => {
              const due = TZ.filter((t) => tzOpen(t) && t.target.toDateString() === d.toDateString());
              return (
                <div key={d.toDateString()} className={'cal-day' + (d.toDateString() === NOW.toDateString() ? ' today' : '')}>
                  <div className="cal-d"><b>{d.getDate()}</b>{DAYS[d.getDay()].slice(0, 3)}</div>
                  {due.length ? due.map((t) => (
                    <button key={t.id} className={'cal-ev ' + (TZ_PRIO_CLS[t.prio] || '')} onClick={() => go('traza/' + t.id)}>{t.id}<span>{t.title}</span></button>
                  )) : <span className="small muted">Sin vencimientos</span>}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}

export function Informe({ TZ }) {
  const { NOW, toast } = useApp();
  const apps = {};
  TZ.forEach((t) => { const a = apps[t.app] = apps[t.app] || [0, 0, 0]; a[0]++; if (t.state === 'Cerrada') a[1]++; a[2] += t.inv; });
  const hours = TZ.reduce((s, t) => s + t.inv, 0);
  return (
    <div className="card">
      <div className="card-h">
        <div><h3>Informe de gestión de {MONTHS[NOW.getMonth()]}</h3><p>Base para la revisión semanal con la Gerencia</p></div>
        <button className="btn btn-o btn-sm" onClick={() => toast('Informe de gestión de TRAZA descargado en PDF.')}><Icon name="download" />Descargar PDF</button>
      </div>
      <dl className="cm-stats">
        <div><dt>Recibidas</dt><dd className="num">{TZ.length}</dd></div>
        <div><dt>Cerradas</dt><dd className="num">{TZ.filter((t) => t.state === 'Cerrada').length}</dd></div>
        <div><dt>Rechazadas</dt><dd className="num">{TZ.filter((t) => t.state === 'Rechazada').length}</dd></div>
        <div><dt>Horas invertidas</dt><dd className="num">{fmt(hours, 1)}</dd></div>
        <div><dt>Cumplimiento de fecha objetivo</dt><dd className="num">94 %</dd></div>
      </dl>
      <div className="scroll-x">
        <Table
          headers={['Aplicativo', 'Recibidas', 'Cerradas', 'Horas invertidas']}
          align={['', 'r', 'r', 'r']}
          rows={Object.keys(apps).sort((a, b) => apps[b][2] - apps[a][2]).map((k) => ({ key: k, cells: [<Cell main={k} />, <span className="num">{apps[k][0]}</span>, <span className="num">{apps[k][1]}</span>, <span className="num">{fmt(apps[k][2], 1)} h</span>] }))}
        />
      </div>
    </div>
  );
}
