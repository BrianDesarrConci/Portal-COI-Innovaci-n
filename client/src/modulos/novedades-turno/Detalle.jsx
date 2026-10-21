import { useState } from 'react';
import { Field, Icon, Loading, areaStyle, fieldStyle, puedeAcceder, useOverlay, useRecurso } from '@coi/sdk';
import { ETQ, Estado, Prioridad, fechaHora } from './comun.jsx';

/** Detalle de una novedad: datos, seguimiento y cambio de estado. */
export default function Detalle({ api, id, usuario, onCambio }) {
  const { toast } = useOverlay();
  const det = useRecurso(api, '/novedades/' + id);
  const [estado, setEstado] = useState(null);
  const [comentario, setComentario] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  if (!det.data) return <Loading error={det.error} />;
  const n = det.data;
  const nuevoEstado = estado || (n.estado === 'abierta' ? 'en_gestion' : n.estado);
  const puedeReabrir = puedeAcceder(usuario, ['lider']);
  const opciones = Object.entries(ETQ.estado).filter(([k]) => n.estado !== 'cerrada' || k === 'cerrada' || puedeReabrir);

  const guardar = async (e) => {
    e.preventDefault();
    setEnviando(true); setError('');
    try {
      await api.post(`/novedades/${id}/seguimiento`, { estado: nuevoEstado, comentario });
      setComentario(''); setEstado(null); det.reload(); onCambio(); toast('Seguimiento guardado.');
    } catch (err) { setError(err.message); } finally { setEnviando(false); }
  };

  return (
    <div className="novedades-turno-det">
      <div className="novedades-turno-meta">
        <Estado v={n.estado} /><Prioridad v={n.prioridad} />
        <span className="chip">{ETQ.categoria[n.categoria]}</span><span className="chip">Turno {ETQ.turno[n.turno].toLowerCase()}</span>
      </div>
      <p className="novedades-turno-texto">{n.descripcion}</p>
      <p className="small muted">Registrada por {n.creado_por} el {fechaHora(n.creado_en)}{n.cerrado_en ? ` · cerrada por ${n.cerrado_por} el ${fechaHora(n.cerrado_en)}` : ''}</p>

      <h4 className="novedades-turno-h">Seguimiento</h4>
      <div className="timeline-v">
        {n.seguimiento.map((s, i) => (
          <div key={i} className={'it' + (i === n.seguimiento.length - 1 ? ' cur' : '')}>
            <div className="strong small">{ETQ.estado[s.estado][0]} · {s.autor}</div>
            <div className="small">{s.comentario}</div>
            <div className="small muted">{fechaHora(s.creado_en)}</div>
          </div>
        ))}
      </div>

      <form className="novedades-turno-form" onSubmit={guardar}>
        <div className="novedades-turno-fila">
          <Field label="Nuevo estado">
            <select style={fieldStyle} value={nuevoEstado} onChange={(e) => setEstado(e.target.value)}>
              {opciones.map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Comentario"><textarea style={areaStyle} rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} required minLength={5} placeholder="Acción tomada, responsable o resultado." /></Field>
        {error && <p className="novedades-turno-error" role="alert"><Icon name="alert" />{error}</p>}
        {n.estado === 'cerrada' && !puedeReabrir && <p className="small muted">Para reabrir una novedad cerrada se requiere el rol de líder.</p>}
        <div className="novedades-turno-acciones"><button className="btn btn-p" disabled={enviando}><Icon name="send" />{enviando ? 'Guardando…' : 'Guardar seguimiento'}</button></div>
      </form>
    </div>
  );
}
