// Paso 3 · Selección de personal backup (prepararAsignacion, aplicarFiltroInteligente,
// renderizarTablaFiltrada, filtrarBackups y procesarAsignacionBackup de js.html).
import { useEffect, useMemo, useState } from 'react';
import Icon from '../../../../components/Icon.jsx';
import { useApp } from '../../../../context/AppContext.jsx';
import { fmt, norm } from '../../../../lib/format.js';
import { Panel, PIcon, Modal, Avatar, toneOf, Skeleton, gas } from '../kit.jsx';
import GeoMap from '../GeoMap.jsx';
import { origenDe, rankBackups, scoreTone, whatsappUrl, coord } from '../granjaLogic.js';

const TONE = { hi: '#048C38', mid: '#C99A00', lo: '#8A90A8' };

export default function Asignacion({ gestion, lista, sesion, onCancel, onAsignado }) {
  const { toast } = useApp();
  const [backups, setBackups] = useState(null);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState('');
  const [fil, setFil] = useState({ ciudad: false, negocio: false });
  const [limite, setLimite] = useState(12);
  const [foco, setFoco] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const [busy, setBusy] = useState(false);

  const origen = useMemo(() => origenDe(lista, gestion.oficina), [lista, gestion.oficina]);

  useEffect(() => {
    let vivo = true;
    setBackups(null); setErr(null); setQ(''); setLimite(12); setFoco(null);
    gas('obtenerCajerosBackup').then((b) => vivo && setBackups(b)).catch((e) => vivo && setErr(e));
    return () => { vivo = false; };
  }, [gestion.id]);

  const candidatos = useMemo(() => (origen && backups ? rankBackups(origen, backups, gestion.cajero) : []), [origen, backups, gestion.cajero]);
  const filtrados = useMemo(() => {
    const t = norm(q.trim());
    return candidatos.filter((c) => (!fil.ciudad || c.mismaCiudad) && (!fil.negocio || c.mismoNegocio)
      && (!t || norm(c.nombre).includes(t) || norm(c.oficina).includes(t) || norm(c.ciudad).includes(t) || norm(c.negocio || '').includes(t)));
  }, [candidatos, q, fil]);

  const top = filtrados.slice(0, limite);
  const sel = foco ? filtrados.find((c) => c.nombre === foco) : top[0];
  const oLat = origen ? coord(origen.lat) : null, oLon = origen ? coord(origen.lon) : null;

  async function asignar(c) {
    setBusy(true);
    try {
      const res = await gas('asignarBackup', gestion.id, c.nombre, sesion.nombre);
      if (res && res.success) { toast(res.msg); setConfirmar(null); onAsignado(); }
      else toast('⚠️ ' + (res ? res.msg : 'Error desconocido'));
    } catch (e) { toast('❌ Error de comunicación con el servidor: ' + e.message); } finally { setBusy(false); }
  }

  return (
    <Panel step="3" title="Selección de personal backup" tone="green" className="v1p-asig"
      sub="Candidatos con BACKUP = SI, ordenados por cercanía y afinidad con la oficina afectada."
      right={<button type="button" className="btn btn-o btn-sm" onClick={onCancel}><Icon name="x" />Cancelar gestión</button>}>
      <div className="v1p-asig-ctx">
        <div className="v1p-asig-who">
          <span className="v1p-k">Cubrir a</span>
          <b>{gestion.cajero}</b>
          <span>{gestion.oficina}</span>
        </div>
        {origen && <>
          <div><span className="v1p-k">Municipio</span><b>{origen.ciudad || '—'}</b></div>
          <div><span className="v1p-k">Cliente</span><b>{origen.negocio || '—'}</b></div>
          <div><span className="v1p-k">Zona</span><b>{origen.zona || '—'}</b></div>
        </>}
        <div className="v1p-asig-rule" title="Regla de aplicarFiltroInteligente (V1)">
          <span><b>+100</b> mismo municipio</span><span><b>+50</b> mismo cliente</span><span><b>−1</b> por km</span>
        </div>
      </div>

      {!origen ? (
        <div className="v1p-error"><Icon name="alert" /><div className="grow"><b>No se encontraron datos para la oficina: {gestion.oficina}</b><small>La oficina no aparece en el directorio con coordenadas, por eso no se pueden calcular candidatos.</small></div></div>
      ) : err ? (
        <div className="v1p-error"><Icon name="alert" /><div className="grow"><b>No se pudo consultar el personal backup.</b><small>{err.message}</small></div></div>
      ) : !backups ? (
        <div className="v1p-asig-load"><span className="v1p-spin" />Analizando perfiles para cubrir <b>{gestion.oficina}</b>…<Skeleton rows={5} h={42} /></div>
      ) : (
        <div className="v1p-asig-grid">
          <div className="v1p-asig-list">
            <div className="v1p-toolbar">
              <div className="v1p-search grow"><Icon name="search" /><input className="inp" placeholder="Buscar backup por nombre, oficina, ciudad o negocio" value={q} onChange={(e) => { setQ(e.target.value); setLimite(12); }} /></div>
              <button type="button" className={'v1p-chip-t' + (fil.ciudad ? ' on' : '')} onClick={() => setFil((f) => ({ ...f, ciudad: !f.ciudad }))}><Icon name="pin" />Mismo municipio</button>
              <button type="button" className={'v1p-chip-t' + (fil.negocio ? ' on' : '')} onClick={() => setFil((f) => ({ ...f, negocio: !f.negocio }))}><Icon name="building" />Mismo cliente</button>
              <span className="v1p-counter"><Icon name="users" /><b className="num">{fmt(filtrados.length)}</b> disponibles</span>
            </div>
            {!filtrados.length ? <p className="v1p-note warn">⚠️ No se encontraron candidatos disponibles con esos criterios.</p> : (
              <ol className="v1p-cands">
                {top.map((c, i) => {
                  const tone = scoreTone(c.puntos);
                  const wa = whatsappUrl(c.nombre, c.telefono, gestion.oficina, origen.negocio);
                  return (
                    <li key={c.nombre + c.oficina} className={(sel && sel.nombre === c.nombre ? 'on ' : '') + (i === 0 && !q && !fil.ciudad && !fil.negocio ? 'best' : '')} onMouseEnter={() => setFoco(c.nombre)}>
                      <span className={'v1p-score ' + tone}><b className="num">{c.puntos}</b><small>pts</small></span>
                      <Avatar name={c.nombre} tone={toneOf(c.nombre)} />
                      <div className="grow v1p-cand-main">
                        <b className="ellip">{c.nombre}</b>
                        <span className="ellip">{c.oficina}</span>
                        <span className="v1p-cand-tags">
                          {i === 0 && !q && !fil.ciudad && !fil.negocio && <span className="v1p-best">Mejor opción</span>}
                          <span className={'chip' + (c.mismaCiudad ? ' ok' : '')}><Icon name="pin" />{c.ciudad || 'Sin municipio'}</span>
                          {c.negocio && <span className={'chip' + (c.mismoNegocio ? ' ok' : '')}>{c.negocio}</span>}
                          <span className="chip num"><PIcon name="route" />{fmt(Number(c.distancia), 1)} km</span>
                        </span>
                      </div>
                      <div className="v1p-cand-act">
                        <button type="button" className="btn btn-p btn-sm" onClick={() => setConfirmar(c)}><Icon name="usercheck" />Asignar</button>
                        {wa ? <a className="btn btn-o btn-sm v1p-wa" href={wa} target="_blank" rel="noopener noreferrer" title={'Escribir a ' + c.nombre + ' por WhatsApp'}><Icon name="chat" />Mensaje</a>
                          : <button type="button" className="btn btn-o btn-sm" disabled title={'⚠️ No hay teléfono registrado para ' + c.nombre}><Icon name="chat" />Sin teléfono</button>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            {filtrados.length > limite && <button type="button" className="btn btn-g v1p-more" onClick={() => setLimite((l) => l + 24)}>Ver {fmt(Math.min(24, filtrados.length - limite))} candidatos más<Icon name="down" /></button>}
          </div>
          <div className="v1p-asig-map">
            <GeoMap fit label="Oficina afectada y candidatos"
              points={top.map((c) => ({ key: c.nombre + c.oficina, lat: c.lat, lon: c.lon, color: TONE[scoreTone(c.puntos)], r: sel && sel.nombre === c.nombre ? 5.5 : 3.6, ring: sel && sel.nombre === c.nombre, title: `${c.nombre} · ${c.oficina} · ${c.distancia} km` }))}
              marks={oLat != null ? [{ key: 'o', lat: oLat, lon: oLon, kind: 'origin', label: origen.ciudad || 'Oficina' }] : []}
              lines={sel && sel.lat != null && oLat != null ? [[{ lat: oLat, lon: oLon }, { lat: sel.lat, lon: sel.lon }]] : []}
              onPick={(p) => { const c = top.find((x) => x.nombre + x.oficina === p.key); if (c) setFoco(c.nombre); }}
              legend={[['Oficina afectada', '#D6453D'], ['> 100 pts', TONE.hi], ['51 a 100', TONE.mid], ['≤ 50', TONE.lo]]} />
            {sel && (
              <div className="v1p-asig-sel">
                <span className="v1p-k">Seleccionado en el mapa</span>
                <b>{sel.nombre}</b>
                <small>{sel.oficina} · {fmt(Number(sel.distancia), 1)} km · {sel.puntos} pts</small>
              </div>
            )}
          </div>
        </div>
      )}

      {confirmar && (
        <Modal title="Confirmar asignación de backup" icon="usercheck" onClose={() => !busy && setConfirmar(null)}
          foot={<>
            <button type="button" className="btn btn-o" onClick={() => setConfirmar(null)} disabled={busy}>Cancelar</button>
            <button type="button" className={'btn btn-p' + (busy ? ' loading' : '')} onClick={() => asignar(confirmar)} disabled={busy}><span className="spinner" /><Icon name="check" />Asignar y marcar CUBIERTA</button>
          </>}>
          <div className="v1p-confirm">
            <div className="v1p-swap">
              <div><Avatar name={gestion.cajero} tone={toneOf(gestion.cajero)} size="lg" /><b>{gestion.cajero}</b><small>En baja · {gestion.oficina}</small></div>
              <span className="v1p-swap-ic"><PIcon name="swap" /></span>
              <div><Avatar name={confirmar.nombre} tone={toneOf(confirmar.nombre)} size="lg" /><b>{confirmar.nombre}</b><small>Backup · {confirmar.oficina}</small></div>
            </div>
            <ul className="v1p-checks">
              <li><Icon name="check" /><span>La novedad <b>{gestion.id}</b> pasa a estado <b>CUBIERTA</b>.</span></li>
              <li><Icon name="check" /><span>{confirmar.nombre} queda con BACKUP = <b>NO</b> en DATOS MANUALES mientras dure la cobertura.</span></li>
              <li><Icon name="check" /><span>Al cerrar la novedad (o al vencer los días) vuelve a quedar disponible.</span></li>
            </ul>
          </div>
        </Modal>
      )}
    </Panel>
  );
}
