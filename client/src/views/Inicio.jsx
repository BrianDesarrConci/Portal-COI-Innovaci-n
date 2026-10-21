// N0 Tablero gerencial: operación real de la red (libros de COI V1) y avance del portal.
// Los indicadores de cumplimiento se calculan con la bitácora de actividades; mientras no exista
// registro quedan en cero (no se simulan).
import Icon from '../components/Icon.jsx';
import CountUp from '../components/CountUp.jsx';
import { Card, Tag } from '../components/ui.jsx';
import { useApp } from '../context/AppContext.jsx';
import { fmt, longDate, MSHORT } from '../lib/format.js';
import { ESTADO, NAV } from '../lib/nav.js';
import { HITOS } from '../lib/plan.js';
import LiveOps from './hub/LiveOps.jsx';

const ESTADOS = [['activo', 'En funcionamiento', 'b-ok'], ['desarrollo', 'En desarrollo', 'b-info'], ['construccion', 'En construcción', 'b-warn']];

export default function Inicio() {
  const { D, acts, clients, NOW, isAuto, go } = useApp();
  const opciones = NAV.flatMap((g) => g[1].map((it) => ({ clave: it[0], nombre: it[1], icono: it[2], grupo: g[0], estado: ESTADO[it[0]] })));
  const cuenta = (e) => opciones.filter((o) => o.estado === e).length;
  const avance = opciones.length ? (cuenta('activo') / opciones.length) * 100 : 0;
  const hoy = [NOW.getFullYear(), String(NOW.getMonth() + 1).padStart(2, '0'), String(NOW.getDate()).padStart(2, '0')].join('-');

  const kpi = (label, val, sub, icon, color) => (
    <div className="card kx">
      <div className="kx-top"><span className="kx-ic" style={{ '--c': color }}><Icon name={icon} /></span><span className="kx-l">{label}</span></div>
      <div className="kx-v num"><CountUp value={val} /></div>
      <div className="kx-b"><span className="small muted">{sub}</span></div>
    </div>
  );

  return (
    <>
      <div className="dash-head">
        <div><h1 className="dash-title">Tablero gerencial</h1><p className="muted">Operación real de la red y avance de COI · {longDate(NOW)}</p></div>
      </div>

      <LiveOps />

      <div className="hub-divider"><span>Cumplimiento de actividades</span><small>Se calcula con la bitácora de actividades del área (en construcción) · sin registros todavía</small></div>
      <div className="kx-row">
        {kpi('Cerradas con evidencia', '0', 'de ' + fmt(acts.length) + ' actividades del catálogo', 'shield', '#048C38')}
        {kpi('ANS de clientes', '0 %', fmt(Object.keys(clients).length) + ' clientes con ANS', 'star', '#242A54')}
        {kpi('Casos atendidos', '0', 'Novedades, PQR y requerimientos', 'inbox', '#21BBEA')}
        {kpi('Alertas gestionadas', '0', 'Alertas operativas', 'bell', '#C99A00')}
        {kpi('Horas liberadas', '0', 'Trabajo manual evitado', 'clock', '#1A8FB5')}
        {kpi('Automatizables', fmt(acts.filter(isAuto).length), 'de ' + fmt(acts.length) + ' actividades', 'sparkle', '#6C74A8')}
      </div>

      <div className="grid g-main mt">
        <Card title="Avance de COI" sub={'Opciones del portal por estado · ' + fmt(avance, 0) + ' % en funcionamiento'}>
          <div className="ini-avance">
            <div className="ini-barra" role="img" aria-label={ESTADOS.map(([e, l]) => l + ': ' + cuenta(e)).join(', ')}>
              {ESTADOS.map(([e]) => cuenta(e) ? <i key={e} className={'ini-' + e} style={{ flexGrow: cuenta(e) }} /> : null)}
            </div>
            <div className="ini-leyenda">
              {ESTADOS.map(([e, l]) => <span key={e}><i className={'ini-' + e} />{l}<b className="num">{cuenta(e)}</b></span>)}
            </div>
          </div>
          <div className="ini-mods">
            {opciones.filter((o) => o.clave !== 'inicio').map((o) => (
              <button key={o.clave} type="button" className={'ini-mod ' + o.estado} onClick={() => go(o.clave)} title={o.grupo}>
                <Icon name={o.icono} /><span className="ellip">{o.nombre}</span>
                <Tag cls={ESTADOS.find((x) => x[0] === o.estado)[2]}>{ESTADOS.find((x) => x[0] === o.estado)[1]}</Tag>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Hitos del plan" sub="Compromisos de la implementación">
          <div className="ev-list">
            {HITOS.map(([f, h, t]) => {
              const d = new Date(f + 'T12:00:00'); const hecho = f < hoy;
              return (
                <div key={f} className={'ev ' + (hecho ? 'done' : '')}>
                  <span className="ev-date"><b>{d.getDate()}</b>{MSHORT[d.getMonth()]}</span>
                  <span className="grow small"><b>{h}.</b> {t}</span>
                  {f === hoy ? <Tag cls="b-info">Hoy</Tag> : hecho ? <Tag cls="b-ok">Cumplido</Tag> : <Tag cls="b-mute">Programado</Tag>}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mt">
        <Card title="Área de Apoyo al Negocio" sub="Catálogo vigente de actividades">
          <div className="ini-cat">
            {[['Clientes con ANS', Object.keys(clients).length, 'clientes'], ['Actividades', acts.length, 'catalogo'], ['Analistas', D.analysts.length, 'analistas'], ['Procesos transversales', D.processes.length, 'procesos']].map(([l, n, to]) => (
              <button key={l} type="button" onClick={() => go(to)}><b className="num"><CountUp value={fmt(n)} /></b><span>{l}</span></button>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
