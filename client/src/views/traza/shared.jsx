// Constantes y piezas comunes de TRAZA (portadas de TZ_*, tzAvatar, tzStepper y tzTable del demo).
import Icon from '../../components/Icon.jsx';
import { Table, Cell, Tag } from '../../components/ui.jsx';
import { dshort, fmt } from '../../lib/format.js';

export const TZ_STATES = ['Recibida', 'En análisis', 'En desarrollo', 'En pruebas', 'En espera', 'Cerrada', 'Rechazada'];
export const TZ_FLOW = ['Recibida', 'En análisis', 'En desarrollo', 'En pruebas', 'Cerrada'];
export const TZ_STATE_CLS = { 'Recibida': 'b-mute', 'En análisis': 'b-info', 'En desarrollo': 'b-info', 'En pruebas': 'b-warn', 'En espera': 'b-mute', 'Cerrada': 'b-ok', 'Rechazada': 'b-bad' };
export const TZ_PRIO_CLS = { 'Crítica': 'b-bad', 'Alta': 'b-warn', 'Media': 'b-info', 'Baja': 'b-mute' };
export const TZ_OWNERS = { brian: { name: 'Brian Tautiva', role: 'Desarrollo y arquitectura', initials: 'BT', color: 2 }, hernan: { name: 'Hernán Dimate', role: 'Analítica transaccional', initials: 'HD', color: 5 } };
export const TZ_APPS = ['COI', 'Analítica transaccional', 'CreSER', 'Gestión de la Demanda', 'Gobierno de Datos', 'Gestión CORE', 'SMART30', 'LexCore', 'MultiLAB'];
export const TZ_TYPES = ['Mejora', 'Cambio', 'Reajuste', 'Corrección de falla', 'Nuevo desarrollo'];

/**
 * Estado de la vista que sobrevive a la navegación (como TZF en el demo): pestaña y filtros.
 * Otras vistas pueden abrir el formulario con `TZF.view = 'radicar'; go('traza')`.
 */
export const TZF = { view: 'tablero', estado: '', app: '', owner: '', q: '' };

export const tzOpen = (t) => t.state !== 'Cerrada' && t.state !== 'Rechazada';
/** Convierte las fechas ISO del API en Date. */
export const hydrate = (t) => ({ ...t, created: new Date(t.created), target: new Date(t.target) });

export function TzAvatar({ owner }) {
  const o = TZ_OWNERS[owner] || { name: owner, initials: '?', color: 0 };
  return <span className={'avatar c' + o.color} title={o.name}>{o.initials}</span>;
}
export const StateTag = ({ state }) => <Tag cls={TZ_STATE_CLS[state]}>{state}</Tag>;
export const PrioTag = ({ prio }) => <Tag cls={TZ_PRIO_CLS[prio]}>{prio}</Tag>;

export function Stepper({ t }) {
  if (t.state === 'Rechazada') {
    return (
      <div className="stepper">
        <div className="st done"><i><Icon name="check" /></i><span>Recibida</span></div>
        <div className="st bad"><i><Icon name="x" /></i><span>Rechazada</span></div>
      </div>
    );
  }
  const cur = t.state === 'En espera' ? 2 : TZ_FLOW.indexOf(t.state);
  const closed = t.state === 'Cerrada';
  return (
    <div className="stepper">
      {TZ_FLOW.map((s, i) => {
        const done = i < cur || closed;
        return (
          <div key={s} className={'st ' + (done ? 'done' : i === cur ? 'cur' : '')}>
            <i>{done ? <Icon name="check" /> : i + 1}</i>
            <span>{s}{i === cur && t.state === 'En espera' ? ', en espera' : ''}</span>
          </div>
        );
      })}
    </div>
  );
}

export function TzTable({ list, now }) {
  return (
    <Table
      headers={['Radicado', 'Solicitud', 'Aplicativo', 'Tipo', 'Prioridad', 'Responsable', 'Estado', 'Fecha objetivo', 'Horas']}
      align={['', '', '', '', '', 'c', '', '', 'r']}
      rows={list.map((t) => ({
        key: t.id,
        go: 'traza/' + t.id,
        cells: [
          <span className="num strong">{t.id}</span>,
          <Cell main={t.title} sub={t.req + ', ' + t.area} />,
          <span className="small">{t.app}</span>,
          <span className="small">{t.type}</span>,
          <PrioTag prio={t.prio} />,
          <TzAvatar owner={t.owner} />,
          <StateTag state={t.state} />,
          <span className={'small nowrap ' + (tzOpen(t) && t.target < now ? 'down' : '')}>{dshort(t.target)}</span>,
          <span className="num small nowrap">{fmt(t.inv, 1)} de {fmt(t.est, 0)}</span>
        ]
      }))}
    />
  );
}
