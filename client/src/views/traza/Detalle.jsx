// Detalle de una solicitud (V.trazaDetalle): etapas, plan, bitácora real y acciones que escriben en el API.
import { useEffect, useMemo, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { Bar, Card, DocRow, Field, GoLink, Loading, PageHead, areaStyle, fieldStyle } from '../../components/ui.jsx';
import { ModalBtn } from '../../components/Overlays.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { useApi } from '../../hooks/useApi.js';
import { api } from '../../lib/api.js';
import { dshort, fmt } from '../../lib/format.js';
import { TZF, TZ_FLOW, TZ_OWNERS, PrioTag, Stepper, TzAvatar, hydrate, tzOpen } from './shared.jsx';

/** Texto de una entrada de la bitácora según su tipo. */
function logLine(b) {
  if (b.tipoEntrada === 'HORAS') return ['Registro de ' + fmt(b.horas, 1) + ' horas', b.detalle];
  if (b.tipoEntrada === 'NOTA') return ['Nota: ' + b.detalle];
  return [b.detalle];
}

export default function Detalle({ id, onChanged }) {
  const { NOW, go, toast, modal, closeModal } = useApp();
  const res = useApi('/api/traza/' + encodeURIComponent(id));
  const [busy, setBusy] = useState(false);
  const t = useMemo(() => (res.data ? hydrate(res.data) : null), [res.data]);

  // Radicado inexistente: como en el demo, se vuelve a la lista de solicitudes.
  useEffect(() => {
    if (res.error) { TZF.view = 'solicitudes'; toast(res.error.message); go('traza'); }
  }, [res.error, go, toast]);

  if (!t) return <Loading error={res.error} />;
  const open = tzOpen(t);
  const owner = TZ_OWNERS[t.owner] || { name: t.owner };
  const refresh = () => { res.reload(); onChanged && onChanged(); };

  async function send(url, body, msg) {
    const out = await api.post(url, body);
    refresh();
    return typeof msg === 'function' ? msg(out) : msg;
  }

  async function advance() {
    if (busy) return;
    setBusy(true);
    try { toast(await send('/api/traza/' + t.id + '/avanzar', {}, (x) => x.id + ' avanzó a ' + x.state.toLowerCase() + '.')); } catch (e) { toast(e.message); } finally { setBusy(false); }
  }

  /** Abre un modal con formulario; `v` guarda los valores y `submit` los envía al API. */
  function formModal(title, fields, v, submit) {
    const save = async () => {
      try { closeModal(await submit(v)); } catch (e) { toast(e.message); }
    };
    modal({
      title,
      body: <form style={{ display: 'grid', gap: 12 }} onSubmit={(e) => { e.preventDefault(); save(); }}>{fields}</form>,
      foot: <><ModalBtn className="btn btn-o">Cancelar</ModalBtn><button className="btn btn-p" onClick={save}>Guardar</button></>
    });
  }
  const logModal = (kind) => {
    if (kind === 'horas') {
      const v = { horas: '1.5', detalle: 'Conexión a la base de datos y ajuste de filtros.' };
      formModal('Registrar horas', <>
        <Field label="Horas invertidas"><input type="number" step="0.5" min="0.5" defaultValue={v.horas} onChange={(e) => { v.horas = e.target.value; }} style={{ ...fieldStyle, maxWidth: 140 }} /></Field>
        <Field label="Qué se hizo"><textarea rows={3} defaultValue={v.detalle} onChange={(e) => { v.detalle = e.target.value; }} style={areaStyle} /></Field>
      </>, v, (x) => send('/api/traza/' + t.id + '/bitacora', { tipo: 'HORAS', horas: x.horas, detalle: x.detalle }, 'Horas registradas en la bitácora.'));
    } else {
      const v = { detalle: 'Se validó el alcance con el solicitante.', notificar: 'Sí, por correo' };
      formModal('Agregar nota', <>
        <Field label="Nota"><textarea rows={3} defaultValue={v.detalle} onChange={(e) => { v.detalle = e.target.value; }} style={areaStyle} /></Field>
        <Field label="Notificar al solicitante"><select defaultValue={v.notificar} onChange={(e) => { v.notificar = e.target.value; }} style={{ ...fieldStyle, maxWidth: 200 }}><option>Sí, por correo</option><option>No</option></select></Field>
      </>, v, (x) => send('/api/traza/' + t.id + '/bitacora', { tipo: 'NOTA', detalle: x.detalle, notificar: x.notificar !== 'No' }, 'Nota agregada a la bitácora.'));
    }
  };
  const rejectModal = () => {
    const v = { motivo: '' };
    formModal('Rechazar ' + t.id, <>
      <Field label="Motivo del rechazo"><textarea rows={3} placeholder="Por qué no se atiende la solicitud" onChange={(e) => { v.motivo = e.target.value; }} style={areaStyle} /></Field>
    </>, v, (x) => send('/api/traza/' + t.id + '/rechazar', { motivo: x.motivo }, 'Solicitud ' + t.id + ' rechazada con motivo registrado.'));
  };
  const viewEvidence = () => modal({
    title: 'Soporte de cierre',
    body: <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>{[0, 1, 2].map((i) => <div key={i} className="thumb" style={{ width: '100%', height: 160 }} />)}</div>
      <p className="small muted" style={{ marginTop: 12 }}>Imágenes de demostración. Verificación automática: fecha, orientación, completitud y oficina conformes.</p>
    </>
  });

  const fi = TZ_FLOW.indexOf(t.state);
  const closed = t.state === 'Cerrada';
  const plan = [['Levantar requerimiento con el solicitante', true], ['Definir alcance, fuentes de datos y criterios de aceptación', fi >= 1 || closed], ['Desarrollo y pruebas internas', fi >= 3 || closed], ['Pruebas con el solicitante', closed], ['Documentación, despliegue en producción y cierre', closed]];
  const meta = [
    ['Solicitante', t.req], ['Área', t.area], ['Correo', t.email], ['Aplicativo', t.app], ['Tipo', t.type],
    ['Prioridad', <PrioTag prio={t.prio} />], ['Puntaje de criticidad', <><b className="num">{t.score}</b> de 100</>],
    ['Responsable', <span className="who"><TzAvatar owner={t.owner} />{owner.name}</span>],
    ['Radicada', dshort(t.created) + ' ' + t.created.getFullYear()],
    ['Fecha objetivo', <span className={open && t.target < NOW ? 'down' : ''}>{dshort(t.target) + ' ' + t.target.getFullYear()}</span>]
  ];
  if (t.closedAt) meta.push([t.state === 'Rechazada' ? 'Rechazada el' : 'Cerrada', dshort(new Date(t.closedAt)) + ' ' + new Date(t.closedAt).getFullYear()], ['Resolución', t.resolution]);

  const actions = open ? <>
    <button className="btn btn-o" onClick={() => logModal('nota')}><Icon name="message" />Agregar nota</button>
    <button className="btn btn-o" onClick={() => logModal('horas')}><Icon name="clock" />Registrar horas</button>
    <button className="btn btn-o" onClick={rejectModal}><Icon name="x" />Rechazar</button>
    <button className="btn btn-p" onClick={advance} disabled={busy}>Avanzar etapa<Icon name="chevron" /></button>
  </> : <button className="btn btn-o" onClick={() => toast('Documentación de ' + t.id + ' descargada.')}><Icon name="download" />Documentación</button>;

  return (
    <>
      <PageHead title={t.id + ', ' + t.title} sub={t.app + '. ' + t.type + ' solicitada por ' + t.req + '.'} right={actions}
        crumb={<><GoLink to="traza">TRAZA</GoLink> / {t.id}</>} />
      <div className="card"><div className="card-b"><Stepper t={t} /></div></div>
      <div className="grid g-main mt">
        <div>
          <Card title="Descripción"><p style={{ lineHeight: 1.6 }}>{t.desc}</p></Card>
          <div className="mt">
            <Card title="Plan de trabajo">
              <div className="plan">{plan.map((p) => <div key={p[0]} className={'pl ' + (p[1] ? 'ok' : '')}><i>{p[1] && <Icon name="check" />}</i><span>{p[0]}</span></div>)}</div>
            </Card>
          </div>
          <div className="mt">
            <Card title="Bitácora" sub="Cambios de estado, horas y notas">
              <div className="timeline-v">
                {t.bitacora.map((b, i) => {
                  const [main, extra] = logLine(b);
                  return (
                    <div key={b.idEntrada} className={'it ' + (i === 0 ? 'cur' : '')}>
                      <div className="strong">{main}</div>
                      {extra && <div className="small">{extra}</div>}
                      <div className="small muted">{dshort(new Date(b.fecha))}, {b.autor}</div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
        <div>
          <Card title="Detalle"><dl className="meta">{meta.map((m) => <FragmentRow key={m[0]} k={m[0]} v={m[1]} />)}</dl></Card>
          <div className="mt">
            <Card title="Horas" sub="Invertidas frente a estimadas">
              <div className="big-num" style={{ fontSize: 34 }}>{fmt(t.inv, 1)} <span className="small muted">de {fmt(t.est, 0)} h</span></div>
              <div style={{ marginTop: 10 }}><Bar v={t.est ? Math.min(100, t.inv / t.est * 100) : 0} cls={t.inv > t.est ? 'gd' : 'cy'} /></div>
            </Card>
          </div>
          <div className="mt">
            <Card title="Adjuntos">
              <DocRow title="Evidencia del solicitante" sub="Captura adjunta en la radicación" icon="file" right={<button className="btn btn-g btn-sm" onClick={viewEvidence}><Icon name="eye" />Ver</button>} />
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

const FragmentRow = ({ k, v }) => <><dt>{k}</dt><dd>{v}</dd></>;
