// Paso 2 · Bajas pendientes de cobertura (cargarNovedadesPendientes de js.html).
import { useMemo } from 'react';
import { Panel, Empty, PIcon, Avatar, toneOf } from '../kit.jsx';
import { parseFecha, fechaCorta } from '../granjaLogic.js';

export default function Pendientes({ items, activo, onGestionar, esAdmin }) {
  // Registros repetidos (mismo funcionario, fecha y motivo): en V1 un doble clic publica dos alertas.
  const dup = useMemo(() => {
    const m = new Map();
    items.forEach((n) => { const k = [n.cajero, n.fechaInicio, n.descripcion].join('|'); m.set(k, (m.get(k) || 0) + 1); });
    return (n) => m.get([n.cajero, n.fechaInicio, n.descripcion].join('|')) > 1;
  }, [items]);
  return (
    <Panel step="2" title="Bajas pendientes de cobertura" tone="red"
      sub={esAdmin ? 'Como ADMIN ve todas las bajas abiertas. Pulse «Gestionar» para buscar backup.' : 'Ve las bajas que usted registró. Pulse «Gestionar» para buscar backup.'}
      right={<span className="v1p-count bad num">{items.length}</span>}>
      {!items.length ? <Empty title="No hay alertas pendientes">Todas las bajas reportadas tienen backup asignado.</Empty> : (
        <ul className="v1p-pend">
          {items.map((n) => {
            const ini = n.fechaInicioISO ? new Date(n.fechaInicioISO) : null;
            const rep = parseFecha(n.fecha);
            return (
              <li key={n.id} className={activo === n.id ? 'on' : ''}>
                <Avatar name={n.cajero} tone={toneOf(n.cajero)} />
                <div className="grow v1p-pend-main">
                  <b className="ellip">{n.cajero}</b>
                  <span className="v1p-pend-of ellip">{n.oficina}</span>
                  <span className="v1p-pend-meta">
                    <span className="chip">{n.descripcion}</span>
                    {ini && <span className="chip"><PIcon name="calendar" />{fechaCorta(ini)}{n.diasAusencia ? ' · ' + n.diasAusencia + ' d' : ''}</span>}
                    {dup(n) && <span className="badge b-warn" title="Hay otra alerta igual pendiente">Posible duplicado</span>}
                  </span>
                  <small className="muted">Reportó {n.reportadoPor || '—'}{rep ? ' · ' + fechaCorta(rep) : ''} · {n.id}</small>
                </div>
                <button type="button" className={'btn btn-sm ' + (activo === n.id ? 'btn-o' : 'v1p-btn-gold')} onClick={() => onGestionar(n)}>
                  {activo === n.id ? 'En gestión' : 'Gestionar'}<PIcon name="chevron" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
