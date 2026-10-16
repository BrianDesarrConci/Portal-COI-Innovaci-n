// Mis Solicitudes (líder) · Aprobaciones (regional) · Log de Normalizaciones (analista).
// Portado de renderNormalizaciones / tarjetaNorm / decidir de app.decodificado.js.
import { useState } from 'react';
import Icon from '../../../components/Icon.jsx';
import { gas } from '../../../lib/gas.js';
import { Chip, ErrorBox, Empty, SkeletonRows, BusyBtn, useAq, useLlamada, DocLink } from './shared.jsx';

const TITULO = { Lider: 'Mis Solicitudes de Normalización', Regional: 'Aprobaciones de Normalización', Analista: 'Log de Normalizaciones' };
const SUB = {
  Lider: 'Extemporáneos que solicitaste contar a tu meta.',
  Regional: 'Solicitudes de tus líderes. Al aprobar, el arqueo cuenta a la meta.',
  Analista: 'Registro de auditoría completo de solicitudes y decisiones.'
};
const EST = { PENDIENTE: ['warn', 'Pendiente', 'clock'], APROBADA: ['ok', 'Aprobada', 'check'], RECHAZADA: ['bad', 'Rechazada', 'x'] };

export default function Normalizaciones() {
  const { user } = useAq();
  const rol = user.rol;
  const r = useLlamada('', 'listarNormalizaciones', [user.idUsuario, user.rol]);
  const [filtro, setFiltro] = useState('TODAS');
  const data = Array.isArray(r.data) ? r.data : [];
  const cuenta = (e) => data.filter((x) => x.estado === e).length;
  const pendientes = cuenta('PENDIENTE');
  const lista = filtro === 'TODAS' ? data : data.filter((x) => x.estado === filtro);
  const filtros = [['TODAS', 'Todas', data.length], ['PENDIENTE', 'Pendientes', pendientes], ['APROBADA', 'Aprobadas', cuenta('APROBADA')], ['RECHAZADA', 'Rechazadas', cuenta('RECHAZADA')]];

  return (
    <>
      <div className="aq-vhead">
        <div>
          <h2>{TITULO[rol] || TITULO.Analista}</h2>
          <p>{SUB[rol] || SUB.Analista} {pendientes > 0 && <b className="aq-t-warn">{pendientes} pendiente(s)</b>}</p>
        </div>
        {!r.loading && !r.error && data.length > 0 && (
          <div className="aq-seg" role="tablist" aria-label="Estado de la solicitud">
            {filtros.map(([id, t, c]) => <button key={id} role="tab" aria-selected={filtro === id} className={filtro === id ? 'on' : ''} onClick={() => setFiltro(id)}>{t}{c > 0 && <span className={'aq-seg-n' + (id === 'PENDIENTE' ? ' hot' : '')}>{c}</span>}</button>)}
          </div>
        )}
      </div>
      {r.error ? <ErrorBox error={r.error} onRetry={r.reload} />
        : r.loading ? <div className="card aq-pad"><SkeletonRows rows={4} /></div>
          : !data.length ? <div className="card"><Empty icon="inbox" title="No hay solicitudes de normalización.">{rol === 'Lider' ? 'Desde «Mis Arqueos» puede solicitar la normalización de un arqueo extemporáneo.' : 'Cuando un líder solicite normalizar un extemporáneo aparecerá aquí.'}</Empty></div>
            : !lista.length ? <div className="card"><Empty icon="search" title="Sin solicitudes en este estado." /></div>
              : <div className="aq-norm-list">{lista.map((nz) => <Tarjeta key={nz.idSolicitud} nz={nz} rol={rol} />)}</div>}
    </>
  );
}

function Tarjeta({ nz, rol }) {
  const { user, despuesDeEscribir, abrirModal, cerrarModal } = useAq();
  const [com, setCom] = useState('');
  const [busy, setBusy] = useState('');
  const est = EST[nz.estado] || ['mute', nz.estado, 'flag'];
  const puedeDecidir = rol === 'Regional' && nz.estado === 'PENDIENTE';

  async function decidir(decision) {
    setBusy(decision);
    try {
      const res = await gas('decidirNormalizacion', nz.idSolicitud, decision, com, user.idUsuario, user.rol);
      if (res.success) despuesDeEscribir();
      else abrirModal({ title: 'No se pudo registrar la decisión', icon: 'alert', tone: 'bad', body: <><p>{res.message}</p><div className="aq-actions"><button className="btn btn-o" onClick={cerrarModal}>Cerrar</button></div></> });
    } catch (e) {
      abrirModal({ title: 'Error', icon: 'alert', tone: 'bad', body: <><p>{e.message}</p><div className="aq-actions"><button className="btn btn-o" onClick={cerrarModal}>Cerrar</button></div></> });
    }
    setBusy('');
  }

  return (
    <article className={'card aq-norm ' + est[0]}>
      <div className="aq-norm-h">
        <span className="aq-user-av lg">{String(nz.lider).charAt(0)}</span>
        <div className="aq-norm-t">
          <b>{nz.lider} · {nz.oficina}</b>
          <small><span className="aq-mono">{nz.formato}</span> · Arqueo del {nz.fechaReal} · {nz.diasHabiles} días hábiles · Solicitado {nz.fechaSolicitud}</small>
        </div>
        <Chip tone={est[0]} icon={est[2]}>{est[1]}</Chip>
      </div>
      <div className="aq-norm-just">
        <p className="aq-sec-lbl">Justificación del líder</p>
        <p>{nz.justificacion}</p>
      </div>
      <div className="aq-norm-f">
        {nz.estado !== 'PENDIENTE'
          ? <span className="aq-dim small">Decidido por <b className="aq-t-navy">{nz.aprobador}</b> el {nz.fechaDecision}{nz.comentario ? ' · «' + nz.comentario + '»' : ''}</span>
          : <span className="aq-dim small">{rol === 'Regional' ? 'Esperando su decisión.' : 'Esperando decisión de la Regional.'}</span>}
        {nz.urlPdf && <DocLink href={nz.urlPdf} icon="file" tone="green">Ver soporte</DocLink>}
      </div>
      {puedeDecidir && (
        <div className="aq-norm-dec">
          <input className="aq-in" aria-label="Comentario de la decisión" placeholder="Comentario (opcional)" value={com} onChange={(e) => setCom(e.target.value)} />
          <BusyBtn busy={busy === 'APROBAR'} disabled={!!busy} className="btn btn-p" onClick={() => decidir('APROBAR')}><Icon name="check" />Aprobar</BusyBtn>
          <BusyBtn busy={busy === 'RECHAZAR'} disabled={!!busy} className="btn aq-btn-bad" onClick={() => decidir('RECHAZAR')}><Icon name="x" />Rechazar</BusyBtn>
        </div>
      )}
    </article>
  );
}
