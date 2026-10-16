// Pulso de la operación: ventanas fijas del día con sus responsables (vista Día del tablero).
import Icon from '../../components/Icon.jsx';
import { Tag } from '../../components/ui.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { hhmm, toMin } from '../../lib/format.js';

export default function Pulse() {
  const { D, NOW_MIN, AN, firstName, go } = useApp();
  const ev = D.pulse.map((p) => Object.assign({ m: toMin(p.t) }, p));
  const start = 7 * 60 + 30, end = 20 * 60, pos = (m) => ((m - start) / (end - start)) * 100;
  const nextEv = ev.find((e) => e.m > NOW_MIN);
  const nowPos = pos(Math.min(Math.max(NOW_MIN, start), end));
  return (
    <div className="card">
      <div className="card-h">
        <div><h3>Pulso de la operación</h3><p>Ventanas fijas del día con sus responsables. Seleccione un punto para abrir su módulo.</p></div>
        <Tag cls="b-ok">Sin incumplimientos de ANS hoy</Tag>
      </div>
      <div className="pulse">
        <div className="pulse-track">
          <div className="pulse-axis" />
          <div className="pulse-done" style={{ width: nowPos + '%' }} />
          {ev.map((e, i) => {
            const doneE = e.m <= NOW_MIN;
            return (
              <div key={i} className={'pulse-ev ' + (doneE ? 'done ' : '') + (e.critical ? 'crit ' : '') + (nextEv === e ? 'next ' : '') + (i % 2 ? 'up' : '')} style={{ left: pos(e.m) + '%' }}>
                <button className="dotv" aria-label={e.label} onClick={() => go(e.view)}>{doneE && <Icon name="check" />}</button>
                <span className="tm">{hhmm(e.m)}</span>
                <span className="pulse-tip">{e.label + ', ' + firstName(e.owner)}</span>
              </div>
            );
          })}
          <div className="pulse-now" style={{ left: nowPos + '%' }}><span>Ahora, {hhmm(NOW_MIN)}</span></div>
        </div>
      </div>
      {nextEv && (
        <div className="pulse-next">
          <Icon name="clock" />
          <div className="grow"><span className="strong">Siguiente: {nextEv.label}</span> <span className="muted">a las {hhmm(nextEv.m)}, a cargo de {AN[nextEv.owner].name}</span></div>
          <button className="btn btn-o btn-sm" onClick={() => go(nextEv.view)}>Abrir módulo</button>
        </div>
      )}
    </div>
  );
}
