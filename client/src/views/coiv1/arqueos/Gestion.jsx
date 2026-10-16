// Gestión de novedades de un arqueo: detalle, gestión del analista/regional, respuesta del líder,
// solicitud de normalización y lista de pendientes. Portado de app.decodificado.js (secciones
// «GESTION DE NOVEDADES» y «NORMALIZACIONES») con las mismas validaciones y llamadas.
import { useEffect, useRef, useState } from 'react';
import Icon from '../../../components/Icon.jsx';
import { gas } from '../../../lib/gas.js';
import { FMT, REV, DIFE, MAX_MB_TIRILLA, cop, usd, Chip, Spinner, Note, ErrorBox, Msg, BusyBtn, F, useAq, leerArchivo, pesoMB, DocLink } from './shared.jsx';

/** Índice de arqueos ya cargados (equivale a HIST de V1) para abrir modales sin volver a consultar. */
export const HIST_IDX = new Map();
export const registrarHist = (lista) => (lista || []).forEach((r) => HIST_IDX.set(String(r.id), r));

const esDifValida = (d) => d !== '' && d !== 'Pendiente N8N' && d !== null && d !== undefined && !isNaN(parseFloat(d));
/** Diferencia legible según el formato (cheques en unidades, el resto en pesos). */
export function difTexto(r) {
  if (!esDifValida(r.diferencia)) return r.diferencia === 'Pendiente N8N' ? 'Pendiente OCR' : '—';
  const v = parseFloat(r.diferencia);
  if (r.formato === FMT.CHEQUES) return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' tít.';
  return (v > 0 ? '+' : '') + cop(v);
}
export const difTono = (r) => { if (!esDifValida(r.diferencia)) return 'mute'; const v = parseFloat(r.diferencia); return v < 0 ? 'bad' : v > 0 ? 'warn' : 'ok'; };
const urls = (s) => String(s || '').split(' | ').map((x) => x.trim()).filter(Boolean);

/** Chips del estado de gestión (badgesGestion de V1). */
export function BadgesGestion({ r, vacio }) {
  const b = [];
  if (r.estadoRevision === REV.NOVEDAD) b.push(<Chip key="rv" tone="bad" icon="alert" title={r.obsAnalista}>Soporte con novedad</Chip>);
  else if (r.estadoRevision === REV.CORREGIDO) b.push(<Chip key="rv" tone="info" icon="upload">Corregido · pendiente OK</Chip>);
  else if (r.estadoRevision === REV.OK) b.push(<Chip key="rv" tone="ok" icon="check">OK</Chip>);
  if (r.explicacionSolicitada) {
    if (!r.estadoDiferencia || r.estadoDiferencia === DIFE.PENDIENTE) b.push(<Chip key="ex" tone="bad" icon="chat">Explicación pendiente</Chip>);
    else b.push(<Chip key="ex" tone={r.estadoDiferencia === DIFE.RECUPERADO || r.estadoDiferencia === DIFE.CRUZADO ? 'ok' : 'warn'}>{r.estadoDiferencia}</Chip>);
  } else if (r.estadoDiferencia && r.estadoDiferencia !== DIFE.PENDIENTE) b.push(<Chip key="ex" tone="ok">{r.estadoDiferencia}</Chip>);
  if (r.tipologia) b.push(<Chip key="tp" tone="navy" title="Tipología">{r.tipologia}</Chip>);
  if (r.obsAnalista && r.estadoRevision !== REV.NOVEDAD) b.push(<Chip key="ob" tone="mute" icon="pen" title={r.obsAnalista}>Obs.</Chip>);
  if (r.usdDiferencia !== null && r.usdDiferencia !== undefined && r.usdDiferencia !== '') {
    const u = Number(r.usdDiferencia);
    b.push(<Chip key="usd" tone={u < 0 ? 'bad' : u > 0 ? 'warn' : 'ok'}>USD {u > 0 ? '+' : ''}{u.toFixed(2)}</Chip>);
  }
  return b.length ? <div className="aq-chips">{b}</div> : (vacio === undefined ? <span className="aq-dim">—</span> : vacio);
}

/** Enlaces de soporte: PDF, tirillas y correcciones. */
export function Soportes({ r, compact }) {
  const pdf = r.urlPdf || r.url;
  const out = [];
  if (pdf && pdf !== 'Arqueo Digital') out.push(<DocLink key="pdf" href={pdf} icon="file" tone="green">{compact ? 'PDF' : 'Ver PDF'}</DocLink>);
  if (r.urlTirillas) out.push(<DocLink key="tir" href={urls(r.urlTirillas)[0]} icon="receipt" tone="navy">Tirillas</DocLink>);
  const corr = urls(r.urlCorreccion);
  if (corr.length) {
    if (compact) out.push(<DocLink key="cor" href={corr[corr.length - 1]} icon="upload" tone="cyan">Corregido</DocLink>);
    else corr.forEach((u, i) => out.push(<DocLink key={'c' + i} href={u} icon="upload" tone="cyan">Corrección {i + 1}</DocLink>));
  }
  return out.length ? <div className="aq-links">{out}</div> : <span className="aq-dim">—</span>;
}

/** Resumen del arqueo (resumenArqueoHtml). */
export function ResumenArqueo({ r }) {
  const { user } = useAq();
  const tono = r.novedad === 'FALTANTE' ? 'bad' : r.novedad === 'SOBRANTE' ? 'warn' : 'ok';
  return (
    <div className="aq-resumen">
      <div className="aq-resumen-grid">
        <div><span>Oficina</span><b>{r.oficina}</b></div>
        <div><span>Fecha del arqueo</span><b>{r.fechaReal}</b></div>
        <div><span>Formato</span><b className="aq-mono">{r.formato}</b></div>
        <div><span>Elemento</span><b>{[r.elemento, r.numeroElem].filter(Boolean).join(' ') || '—'}</b></div>
        {user.rol !== 'Lider' && <div><span>Líder</span><b>{r.nombreLider || r.lider}</b></div>}
        <div><span>Novedad</span><b className={'aq-t-' + tono}>{r.novedad || '—'} {esDifValida(r.diferencia) ? '· ' + difTexto(r) : ''}</b></div>
        {r.usdDiferencia !== null && r.usdDiferencia !== undefined && r.usdDiferencia !== '' && <div><span>Diferencia USD</span><b>{usd(r.usdDiferencia)}</b></div>}
      </div>
      <div className="aq-resumen-links"><Soportes r={r} /></div>
      {r.observaciones && <p className="aq-resumen-obs"><b>Obs. del líder en el formato:</b> {r.observaciones}</p>}
    </div>
  );
}

/** Bitácora de gestión (obtenerBitacoraArqueo) como línea de tiempo. */
export function Bitacora({ id }) {
  const [ev, setEv] = useState(null);
  useEffect(() => {
    let vivo = true;
    gas('obtenerBitacoraArqueo', id).then((x) => vivo && setEv(Array.isArray(x) ? x : [])).catch(() => vivo && setEv(false));
    return () => { vivo = false; };
  }, [id]);
  if (ev === null) return <Spinner label="Cargando bitácora…" />;
  if (ev === false) return null;
  return (
    <div className="aq-bita">
      <p className="aq-sec-lbl">Bitácora de gestión</p>
      {ev.length ? (
        <ol className="aq-tl">
          {ev.map((e, i) => (
            <li key={i}>
              <span className="aq-tl-dot" />
              <div>
                <div className="aq-tl-h"><b>{String(e.accion || '').replace(/_/g, ' ')}</b><span>{e.fecha}</span></div>
                <div className="aq-tl-b">{e.actor} ({e.rol}){e.detalle ? ': ' + e.detalle : ''}{e.notificado === 'SI' && <span className="aq-tl-n"><Icon name="mail" />notificado</span>}</div>
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="aq-dim small">Sin eventos de gestión registrados.</p>}
    </div>
  );
}

/** Historial de mensajes de la gestión (historialGestionHtml). */
export function HistorialGestion({ r }) {
  return (
    <div className="aq-hg">
      {r.obsAnalista && <Note tone="warn" icon="pen" title={'Observación / mensaje del analista' + (r.revisor ? ' (' + r.revisor + (r.fechaRevision ? ' · ' + r.fechaRevision : '') + ')' : '')}>{r.obsAnalista}</Note>}
      {r.respuestaLider && <Note tone="info" icon="send" title={'Respuesta del líder' + (r.fechaCorreccion ? ' (' + r.fechaCorreccion + ')' : '')}>{r.respuestaLider}</Note>}
      {r.explicacionLider && (
        <Note tone="navy" icon="chat" title={'Explicación de la diferencia' + (r.fechaExplicacion ? ' (' + r.fechaExplicacion + ')' : '')}>
          {r.explicacionLider}
          <div className="aq-chips" style={{ marginTop: 8 }}>
            <Chip tone="navy">{r.tipologia || 'Sin tipología'}</Chip>
            <Chip tone={r.estadoDiferencia === DIFE.RECUPERADO || r.estadoDiferencia === DIFE.CRUZADO ? 'ok' : 'warn'}>{r.estadoDiferencia || ''}</Chip>
          </div>
        </Note>
      )}
      <Bitacora id={r.id} />
    </div>
  );
}

// ===================== CARGA DEL ARQUEO (conArqueo) =====================
function useArqueo(id) {
  const { user } = useAq();
  const [st, setSt] = useState(() => ({ r: HIST_IDX.get(String(id)) || null, error: null }));
  useEffect(() => {
    if (st.r) return undefined;
    let vivo = true;
    gas('obtenerArqueo', id, user.idUsuario, user.rol)
      .then((x) => { if (!vivo) return; if (x) { HIST_IDX.set(String(id), x); setSt({ r: x, error: null }); } else setSt({ r: null, error: new Error('Arqueo no encontrado.') }); })
      .catch((e) => vivo && setSt({ r: null, error: e }));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return st;
}

/** Contenedor de los modales que dependen de un arqueo. */
export function ArqueoModal({ tipo, id }) {
  const { r, error } = useArqueo(id);
  if (error) return <ErrorBox error={error} />;
  if (!r) return <Spinner label="Cargando arqueo…" />;
  if (tipo === 'gestion') return <GestionBody r={r} />;
  if (tipo === 'respuesta') return <RespuestaBody r={r} />;
  return <DetalleBody r={r} />;
}

function DetalleBody({ r }) {
  const { cerrarModal } = useAq();
  return (
    <>
      <BadgesGestion r={r} vacio={null} />
      <ResumenArqueo r={r} />
      <HistorialGestion r={r} />
      <div className="aq-actions"><button className="btn btn-o" onClick={cerrarModal}>Cerrar</button></div>
    </>
  );
}

// ===================== GESTIÓN (ANALISTA / REGIONAL) =====================
function GestionBody({ r }) {
  const { user, cerrarModal, despuesDeEscribir } = useAq();
  const tieneDif = r.novedad === 'FALTANTE' || r.novedad === 'SOBRANTE' || (r.usdDiferencia && Number(r.usdDiferencia) !== 0);
  const [accion, setAccion] = useState('OBSERVACION');
  const [texto, setTexto] = useState(r.obsAnalista || '');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const sob = r.novedad === 'SOBRANTE';
  const ops = [
    ['OBSERVACION', 'Observación general', 'Registra un comentario sobre el arqueo. No genera pendiente al líder.', 'pen', 'navy', true],
    ['NOVEDAD_SOPORTE', 'Novedad en el soporte', 'Inconsistencia en el PDF / tirillas. Notifica al líder, habilita la corrección y recarga del soporte.', 'alert', 'bad', true],
    ['SOLICITAR_EXPLICACION', 'Solicitar explicación del ' + (sob ? 'sobrante' : 'faltante'), 'El líder debe explicar, indicar tipología y si fue ' + (sob ? 'cruzado / compensado' : 'recuperado') + '. Alerta persistente hasta responder.', 'chat', 'warn', !!tieneDif],
    ['OK', 'Marcar OK', 'Novedad subsanada: la información queda lista para consolidación.', 'check', 'ok', true]
  ];
  async function enviar(forzada) {
    const acc = forzada || accion;
    if (acc === 'NOVEDAD_SOPORTE' && !texto.trim()) return setMsg({ tone: 'bad', text: 'Describe la inconsistencia del soporte.' });
    if (acc === 'OBSERVACION' && !texto.trim()) return setMsg({ tone: 'bad', text: 'Escribe la observación.' });
    setBusy(true); setMsg({ tone: 'busy', text: 'Aplicando…' });
    try {
      const res = await gas('gestionarArqueo', r.id, acc, { texto }, user.idUsuario, user.rol);
      setMsg({ tone: res.success ? 'ok' : 'bad', text: res.message });
      if (res.success) { HIST_IDX.delete(String(r.id)); setTimeout(() => { cerrarModal(); despuesDeEscribir('historial'); }, 900); }
    } catch (e) { setMsg({ tone: 'bad', text: 'Error: ' + e.message }); }
    setBusy(false);
  }
  return (
    <>
      <BadgesGestion r={r} vacio={null} />
      <ResumenArqueo r={r} />
      <HistorialGestion r={r} />
      <div className="aq-divider" />
      <p className="aq-sec-lbl">Acción</p>
      <div className="aq-optgrid" role="radiogroup" aria-label="Acción de gestión">
        {ops.map(([v, t, d, ic, tone, ok]) => (
          <label key={v} className={'aq-opt ' + tone + (accion === v ? ' on' : '') + (ok ? '' : ' dis')}>
            <input type="radio" name="g-accion" value={v} checked={accion === v} disabled={!ok} onChange={() => setAccion(v)} />
            <span className="aq-opt-ic"><Icon name={ic} /></span>
            <span><b>{t}</b><small>{d}</small></span>
          </label>
        ))}
      </div>
      <F label="Mensaje para el líder / observación" hint="Obligatorio para observación y novedad de soporte." htmlFor="g-texto">
        <textarea id="g-texto" className="aq-in" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Mensaje para el líder / observación" />
      </F>
      <Msg msg={msg} />
      <div className="aq-actions spread">
        {r.estadoRevision === REV.OK ? <button className="btn btn-g btn-sm aq-t-bad" onClick={() => enviar('REABRIR')} disabled={busy}><Icon name="lock" />Reabrir registro</button> : <span />}
        <div className="aq-actions-r">
          <button className="btn btn-o" onClick={cerrarModal}>Cancelar</button>
          <BusyBtn busy={busy} className="btn btn-p" onClick={() => enviar()}><Icon name="send" />Aplicar</BusyBtn>
        </div>
      </div>
    </>
  );
}

// ===================== RESPUESTA DEL LÍDER =====================
function RespuestaBody({ r }) {
  const { user, cerrarModal, despuesDeEscribir, tipologias } = useAq();
  const pend = r.pendienteLider || [];
  const pideSoporte = pend.indexOf('SOPORTE') >= 0;
  const pideExpl = pend.indexOf('EXPLICACION') >= 0;
  const esSobrante = r.novedad === 'SOBRANTE' || (r.novedad !== 'FALTANTE' && r.usdDiferencia > 0);
  const opcionesEstado = esSobrante
    ? [[DIFE.CRUZADO, 'Sobrante cruzado / compensado'], [DIFE.NO_CRUZADO, 'Sobrante NO compensado (pendiente)']]
    : [[DIFE.RECUPERADO, 'Faltante recuperado'], [DIFE.NO_RECUPERADO, 'Faltante NO recuperado']];
  const [respuesta, setRespuesta] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [explicacion, setExplicacion] = useState('');
  const [tip, setTip] = useState('');
  const [tipOtra, setTipOtra] = useState('');
  const [estado, setEstado] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const lista = tipologias && tipologias.length ? tipologias : ['Otra'];

  async function enviar() {
    const errm = (t) => setMsg({ tone: 'bad', text: t });
    const datos = {};
    if (pideSoporte) {
      datos.respuesta = respuesta.trim();
      if (!datos.respuesta && !archivo) return errm('Describe la corrección y/o adjunta el soporte corregido.');
      if (archivo && archivo.size > MAX_MB_TIRILLA * 1024 * 1024) return errm('El archivo supera ' + MAX_MB_TIRILLA + ' MB.');
    }
    if (pideExpl) {
      datos.explicacion = explicacion.trim();
      let t = tip;
      if (t === 'Otra' && tipOtra.trim()) t = 'Otra: ' + tipOtra.trim();
      datos.tipologia = t; datos.estadoDiferencia = estado;
      if (!datos.explicacion) return errm('Escribe la explicación de la diferencia.');
      if (!datos.tipologia) return errm('Selecciona la tipología.');
      if (!datos.estadoDiferencia) return errm('Indica el estado de la diferencia.');
    }
    setBusy(true); setMsg({ tone: 'busy', text: 'Enviando…' });
    try {
      if (pideSoporte && archivo) datos.archivo = await leerArchivo(archivo, 'application/pdf');
      const res = await gas('responderNovedad', r.id, datos, user.idUsuario, user.rol);
      setMsg({ tone: res.success ? 'ok' : 'bad', text: res.message });
      if (res.success) { HIST_IDX.delete(String(r.id)); setTimeout(() => { cerrarModal(); despuesDeEscribir('historial'); }, 1100); }
    } catch (e) { errm('Error: ' + e.message); }
    setBusy(false);
  }

  return (
    <>
      <ResumenArqueo r={r} />
      {r.obsAnalista && <Note tone="warn" icon="pen" title={'Mensaje del analista' + (r.fechaRevision ? ' (' + r.fechaRevision + ')' : '')}>{r.obsAnalista}</Note>}
      {!pideSoporte && !pideExpl && <Note tone="ok" icon="check" title="Sin pendientes">Este arqueo no tiene novedades por responder.</Note>}
      {pideSoporte && (
        <section className="aq-resp bad">
          <h4><span>1</span>Corrección del soporte</h4>
          <F label="Describe la corrección realizada" htmlFor="rp-respuesta">
            <textarea id="rp-respuesta" className="aq-in" rows={3} value={respuesta} onChange={(e) => setRespuesta(e.target.value)} placeholder="Describe la corrección realizada" />
          </F>
          <F label={'Soporte corregido (PDF o imagen, máx. ' + MAX_MB_TIRILLA + ' MB)'} htmlFor="rp-archivo">
            <div className={'aq-drop sm' + (archivo ? ' has' : '')}>
              <input ref={fileRef} id="rp-archivo" type="file" accept="application/pdf,.pdf,image/*" onChange={(e) => setArchivo(e.target.files[0] || null)} />
              <Icon name="upload" />
              <span>{archivo ? <><b>{archivo.name}</b> · {pesoMB(archivo.size)}</> : <>Arrastre el archivo o <u>selecciónelo</u></>}</span>
            </div>
          </F>
        </section>
      )}
      {pideExpl && (
        <section className="aq-resp warn">
          <h4><span>{pideSoporte ? 2 : 1}</span>Explicación del {esSobrante ? 'sobrante' : 'faltante'}</h4>
          <F label="Explicación" req htmlFor="rp-explicacion">
            <textarea id="rp-explicacion" className="aq-in" rows={3} value={explicacion} onChange={(e) => setExplicacion(e.target.value)} placeholder="Explica el origen de la diferencia y las acciones tomadas" />
          </F>
          <div className="aq-g2">
            <F label="Tipología" req htmlFor="rp-tipologia">
              <select id="rp-tipologia" className="aq-in" value={tip} onChange={(e) => setTip(e.target.value)}>
                <option value="">Selecciona…</option>
                {lista.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              {tip === 'Otra' && <input className="aq-in" style={{ marginTop: 8 }} aria-label="Especifica la tipología" placeholder="Especifica la tipología" value={tipOtra} onChange={(e) => setTipOtra(e.target.value)} />}
            </F>
            <F label="Estado de la diferencia" req htmlFor="rp-estado">
              <select id="rp-estado" className="aq-in" value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="">Selecciona…</option>
                {opcionesEstado.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}
              </select>
            </F>
          </div>
        </section>
      )}
      <Msg msg={msg} />
      <div className="aq-actions">
        <button className="btn btn-o" onClick={cerrarModal}>Cancelar</button>
        {(pideSoporte || pideExpl) && <BusyBtn busy={busy} onClick={enviar}><Icon name="send" />Enviar respuesta</BusyBtn>}
      </div>
    </>
  );
}

// ===================== NORMALIZACIÓN =====================
export function NormalizarBody({ idArqueo }) {
  const { user, cerrarModal, despuesDeEscribir } = useAq();
  const [j, setJ] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  async function enviar() {
    if (!j.trim()) return setMsg({ tone: 'bad', text: 'La justificación es obligatoria.' });
    setBusy(true); setMsg({ tone: 'busy', text: 'Enviando…' });
    try {
      const res = await gas('solicitarNormalizacion', idArqueo, user.idUsuario, j);
      setMsg({ tone: res.success ? 'ok' : 'bad', text: res.message });
      if (res.success) setTimeout(() => { cerrarModal(); despuesDeEscribir('historial'); }, 1200);
    } catch (e) { setMsg({ tone: 'bad', text: 'Error: ' + e.message }); }
    setBusy(false);
  }
  return (
    <>
      <Note tone="info" icon="flow">Un arqueo extemporáneo (más de 2 días hábiles entre la fecha real y la carga) no suma a la meta. Si su Regional aprueba la solicitud, queda <b>NORMALIZADO</b> y cuenta.</Note>
      <F label="Justificación del reporte extemporáneo" req htmlFor="norm-just">
        <textarea id="norm-just" className="aq-in" rows={5} value={j} onChange={(e) => setJ(e.target.value)} placeholder="Ej: El arqueo se realizó el lunes en sitio, pero la oficina no tenía conexión a internet. Se reporta al recuperar señal…" />
      </F>
      <Msg msg={msg} />
      <div className="aq-actions">
        <button className="btn btn-o" onClick={cerrarModal}>Cancelar</button>
        <BusyBtn busy={busy} onClick={enviar}><Icon name="send" />Enviar solicitud</BusyBtn>
      </div>
    </>
  );
}

// ===================== PENDIENTES =====================
export function PendientesBody() {
  const { user, pend, abrir, cerrarModal } = useAq();
  const P = pend || { items: [] };
  const items = (P.items || []).filter((i) => (user.rol === 'Lider' ? i.quien === 'LIDER' : true));
  return (
    <>
      <p className="aq-dim small" style={{ marginBottom: 12 }}>{user.rol === 'Lider' ? 'Debes responder cada una para que la alerta desaparezca.' : 'Estado de la gestión de novedades.'}</p>
      {items.length ? (
        <div className="aq-pend-list">
          {items.map((i) => (
            <div key={i.id} className={'aq-pend-item' + (i.quien === 'LIDER' ? ' lider' : '')}>
              <div className="aq-pend-main">
                <b>{i.oficina} · {i.fechaReal}</b>
                <small>
                  <span className="aq-mono">{i.formato}</span>{i.novedad ? ' · ' + i.novedad : ''}
                  {i.diferencia !== '' && i.diferencia !== 'Pendiente N8N' ? ' · ' + (i.formato === FMT.CHEQUES ? i.diferencia : cop(i.diferencia)) : ''}
                  {user.rol !== 'Lider' ? ' · líder ' + i.nombreLider : ''}
                </small>
                {i.obsAnalista && <p className="aq-pend-obs"><b>Analista:</b> {i.obsAnalista}</p>}
              </div>
              <div className="aq-pend-side">
                <div className="aq-chips">{(i.tipos || []).map((t) => <Chip key={t} tone={t === 'CONFIRMAR OK' ? 'info' : 'bad'}>{t === 'SOPORTE' ? 'Corregir soporte' : t === 'EXPLICACION' ? 'Explicar diferencia' : t}</Chip>)}</div>
                {i.quien === 'LIDER' && user.rol === 'Lider'
                  ? <button className="btn btn-p btn-sm" onClick={() => abrir('respuesta', i.id)}><Icon name="send" />Responder</button>
                  : user.rol !== 'Lider' ? <button className="btn btn-o btn-sm" onClick={() => abrir('gestion', i.id)}><Icon name="filecheck" />Gestionar</button> : null}
              </div>
            </div>
          ))}
        </div>
      ) : <p className="aq-dim" style={{ textAlign: 'center', padding: 24 }}>Sin novedades pendientes.</p>}
      <div className="aq-actions"><button className="btn btn-o" onClick={cerrarModal}>Cerrar</button></div>
    </>
  );
}
