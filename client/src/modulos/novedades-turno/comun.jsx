import { Tag } from '@coi/sdk';

export const ETQ = {
  turno: { manana: 'Mañana', tarde: 'Tarde', noche: 'Noche' },
  categoria: { operativa: 'Operativa', efectivo: 'Efectivo', seguridad: 'Seguridad', tecnologia: 'Tecnología', personal: 'Personal' },
  prioridad: { alta: ['Alta', 'b-bad'], media: ['Media', 'b-warn'], baja: ['Baja', 'b-mute'] },
  estado: { abierta: ['Abierta', 'b-warn'], en_gestion: ['En gestión', 'b-info'], cerrada: ['Cerrada', 'b-ok'] },
};

export const Estado = ({ v }) => <Tag cls={ETQ.estado[v][1]}>{ETQ.estado[v][0]}</Tag>;
export const Prioridad = ({ v }) => <Tag cls={ETQ.prioridad[v][1]}>{ETQ.prioridad[v][0]}</Tag>;

/** "hace 25 min", "hace 3 h" o la fecha. */
export function hace(iso) {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return 'Ahora';
  if (min < 60) return `Hace ${min} min`;
  if (min < 24 * 60) return `Hace ${Math.round(min / 60)} h`;
  return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}
export const fechaHora = (iso) => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
