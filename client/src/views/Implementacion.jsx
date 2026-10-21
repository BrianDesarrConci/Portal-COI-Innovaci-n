// Plan de implementación (V.implementacion del demo): hitos y avance comprometido por analista.
import { Avatar, Bar, Card, PageHead, Table } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt, shortDate } from '../lib/format.js';
import { HITOS } from '../lib/plan.js';

const MILESTONES = HITOS.map(([f, h, t]) => [h, shortDate(f), t]);
/* [analista, actividades, acumuladas al hito 2, hito 3, hito 4] */
const PLAN = [['monica', 6, 3, 4, 6], ['lina', 26, 7, 14, 25], ['jully', 13, 1, 13, 13], ['yesica', 24, 4, 14, 24], ['maira', 25, 2, 12, 25], ['hernan', 9, 2, 2, 2]];

export default function Implementacion() {
  const { AN } = useApp();
  const rows = PLAN.map((p) => ({
    key: p[0],
    cells: [
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar id={p[0]} /><span className="strong">{AN[p[0]] ? AN[p[0]].name : p[0]}</span></div>,
      <span className="num">{p[1]}</span>
    ].concat([p[2], p[3], p[4]].map((v, i) => (
      <div key={i} style={{ width: 170 }}><Bar v={v / p[1] * 100} /><div className="small muted num" style={{ marginTop: 4 }}>{v} ({fmt(v / p[1] * 100, 0)} %)</div></div>
    )))
  }));
  return (
    <>
      <PageHead title="Plan de implementación" sub="Así se llega a esta versión final: COI en dos semanas y procesos transversales hasta el 22 de enero de 2027." />
      <div className="card">
        <div className="card-b ms-grid">
          {MILESTONES.map((m, i) => (
            <div key={m[0]} style={{ borderTop: '4px solid ' + (i === 0 ? 'var(--cyan)' : 'var(--navy)'), paddingTop: 10 }}>
              <div className="strong" style={{ color: 'var(--navy)' }}>{m[0]}</div>
              <div className="small muted num">{m[1]}</div>
              <div className="small" style={{ marginTop: 6 }}>{m[2]}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt">
        <Card title="Avance comprometido por analista" sub="Actividades automatizadas acumuladas en cada hito" flush>
          <Table headers={['Analista', 'Actividades', 'Hito 2', 'Hito 3', 'Hito 4']} rows={rows} align={['', 'c', '', '', '']} />
        </Card>
      </div>
    </>
  );
}
