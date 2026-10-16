// Experiencia de Cliente — Radicación PQR (COI V1, sección "reportes"). El formulario de V1
// (experiencia.html + iniciarModuloPQR) queda completo con guardarPQR / obtenerHistorialPQR.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { fmt, norm } from '../../lib/format.js';
import { V1Bar, V1Guard, useV1 } from './V1Session.jsx';
import { V1Hero, Panel, F, PIcon, Empty, Skeleton, ErrorBox, gas, fileToBase64, fmtBytes, Pill } from './portal/kit.jsx';
import { COL } from './portal/granjaLogic.js';

const TIPOS = [
  ['Petición', 'form', '#242A54', 'Solicitud formal del cliente'],
  ['Queja', 'alert', '#D6453D', 'Inconformidad con la atención'],
  ['Reclamo', 'warn', '#C99A00', 'Exige corrección o reparación'],
  ['Sugerencia', 'sparkle', '#21BBEA', 'Propuesta de mejora'],
  ['Felicitación', 'star', '#048C38', 'Reconocimiento al servicio'],
  ['Solicitud de información', 'message', '#6C74A8', 'Consulta o aclaración']
];
const TIPO = Object.fromEntries(TIPOS.map((t) => [t[0], t]));
const MAX = 5 * 1024 * 1024;
const OK_TYPES = ['image/png', 'image/jpeg', 'application/pdf'];
const ahoraLocal = () => { const a = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${a.getFullYear()}-${p(a.getMonth() + 1)}-${p(a.getDate())}T${p(a.getHours())}:${p(a.getMinutes())}`; };

export default function Experiencia() {
  return (<><V1Bar /><V1Guard modulo="experiencia"><PQRModulo /></V1Guard></>);
}

function PQRModulo() {
  const { sesion } = useV1();
  const [hist, setHist] = useState(null);
  const [err, setErr] = useState(null);
  const [ptrs, setPtrs] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState('');
  const histRef = useRef(null);
  const esAdmin = String(sesion.rol || '').trim().toUpperCase() === 'ADMIN';

  const cargarHistorial = useCallback(async () => {
    try { setErr(null); setHist(await gas('obtenerHistorialPQR', sesion.nombre, sesion.rol)); } catch (e) { setErr(e); }
  }, [sesion.nombre, sesion.rol]);
  useEffect(() => { cargarHistorial(); }, [cargarHistorial]);
  useEffect(() => {
    // Códigos PTR del directorio para ubicar la oficina del caso.
    gas('obtenerListaCajeros').then((l) => {
      const m = new Map();
      (Array.isArray(l) ? l : []).forEach((f) => { const k = String(f[COL.PTR] ?? '').trim(); if (k && !m.has(k)) m.set(k, { oficina: f[COL.OFICINA], muni: f[COL.MUNICIPIO], cliente: f[COL.CLIENTE], zona: f[COL.ZONA] }); });
      setPtrs(m);
    }).catch(() => setPtrs(new Map()));
  }, []);

  const porTipo = useMemo(() => {
    const c = Object.fromEntries(TIPOS.map((t) => [t[0], 0]));
    (hist || []).forEach((r) => { c[r.tipificacion] = (c[r.tipificacion] || 0) + 1; });
    return c;
  }, [hist]);
  const total = hist ? hist.length : 0;
  const verTipo = (t) => { setFiltroTipo((x) => (x === t ? '' : t)); setTimeout(() => histRef.current && histRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50); };

  return (
    <div className="v1p">
      <V1Hero eyebrow="COI V1 · Servicio al cliente" icon="headset" title="Experiencia de Cliente"
        sub="Radicación de Peticiones, Quejas y Reclamos. Al guardar se genera la constancia de radicación y el caso queda registrado en el libro PQR."
        right={<div className="v1p-hero-card"><span className="v1p-k"><PIcon name="database" />Libro PQR · COI V1</span><b className="num v1p-hero-big">{hist ? fmt(total) : '—'}</b><small>{esAdmin ? 'radicaciones en total (vista ADMIN)' : 'radicaciones suyas'}</small></div>} />

      <div className="v1p-tipos">
        {TIPOS.map((t) => {
          const n = porTipo[t[0]] || 0;
          return (
            <button key={t[0]} type="button" className={'card v1p-tipo' + (filtroTipo === t[0] ? ' on' : '')} style={{ '--c': t[2] }} onClick={() => verTipo(t[0])} title={'Ver ' + t[0] + ' en el historial'}>
              <span className="v1p-stat-ic"><PIcon name={t[1]} /></span>
              <span className="v1p-tipo-l">{t[0]}</span>
              <b className="num">{hist ? fmt(n) : '—'}</b>
              <span className="v1p-tipo-bar"><i style={{ width: (total ? (n / total) * 100 : 0) + '%' }} /></span>
            </button>
          );
        })}
      </div>

      <div className="v1p-pqr-grid mt">
        <Formulario sesion={sesion} ptrs={ptrs} onRadicado={cargarHistorial} />
        <aside className="v1p-pqr-side">
          <Panel icon="flow" title="Cómo funciona">
            <ol className="v1p-steps">
              <li><b>Identifique el punto</b><span>Escriba el código PTR; COI ubica la oficina en el directorio.</span></li>
              <li><b>Tipifique el caso</b><span>Petición, queja, reclamo, sugerencia, felicitación o solicitud de información.</span></li>
              <li><b>Describa y adjunte</b><span>Soporte opcional en PNG, JPG o PDF de hasta 5 MB.</span></li>
              <li><b>Radique</b><span>Se asigna el número PQR, se guarda la constancia y queda en el historial.</span></li>
            </ol>
          </Panel>
          <Panel icon="shield" title="Visibilidad" className="mt">
            <p className="small muted">{esAdmin ? 'Su rol es ADMIN: ve todas las PQR radicadas por cualquier usuario.' : 'Ve solo las PQR que usted radicó. Los usuarios ADMIN ven todas, igual que en la Granja de Usuarios.'}</p>
          </Panel>
        </aside>
      </div>

      <div ref={histRef} className="v1p-anchor mt">
        {err ? <ErrorBox error={err} onRetry={cargarHistorial} /> : <HistorialPQR items={hist} tipo={filtroTipo} setTipo={setFiltroTipo} esAdmin={esAdmin} />}
      </div>
    </div>
  );
}

function Formulario({ sesion, ptrs, onRadicado }) {
  const { toast } = useApp();
  const [codigo, setCodigo] = useState('');
  const [fecha, setFecha] = useState(ahoraLocal());
  const [tipo, setTipo] = useState('');
  const [desc, setDesc] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [drag, setDrag] = useState(false);
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(null);
  const input = useRef(null);

  const ptr = ptrs && codigo.trim() ? ptrs.get(codigo.trim().replace(/^PTR-?/i, '')) : null;
  const sugerencias = useMemo(() => {
    if (!ptrs || !codigo.trim() || ptr) return [];
    const t = norm(codigo.trim());
    const out = [];
    for (const [k, v] of ptrs) { if (k.startsWith(codigo.trim()) || norm(v.oficina).includes(t)) out.push([k, v]); if (out.length >= 6) break; }
    return out;
  }, [ptrs, codigo, ptr]);

  const elegirArchivo = (f) => {
    if (!f) return;
    if (!OK_TYPES.includes(f.type)) { setErrs((e) => ({ ...e, archivo: 'Solo PNG, JPG o PDF.' })); return; }
    if (f.size > MAX) { setErrs((e) => ({ ...e, archivo: 'El archivo supera 5 MB.' })); return; }
    setErrs((e) => ({ ...e, archivo: null })); setArchivo(f);
  };

  async function radicar() {
    const e = {};
    if (!codigo.trim()) e.codigo = 'Ingrese el código PTR.';
    if (!fecha) e.fecha = 'Indique fecha y hora.';
    if (!tipo) e.tipo = 'Seleccione la tipificación.';
    if (!desc.trim()) e.desc = 'Describa la situación del cliente.';
    setErrs(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const adjunto = archivo ? { name: archivo.name, mimeType: archivo.type, data: await fileToBase64(archivo) } : null;
      const res = await gas('guardarPQR', { codigoPTR: codigo.trim(), oficina: ptr ? ptr.oficina : '', fecha, tipificacion: tipo, descripcion: desc.trim(), adjunto, usuario: sesion.nombre, rol: sesion.rol });
      toast(res.msg);
      if (res.success) {
        setOk({ ...res, tipo, codigo: codigo.trim(), oficina: ptr ? ptr.oficina : '' });
        setCodigo(''); setFecha(ahoraLocal()); setTipo(''); setDesc(''); setArchivo(null);
        onRadicado();
      }
    } catch (x) { toast('❌ ' + x.message); } finally { setBusy(false); }
  }

  if (ok) {
    return (
      <section className="card v1p-ok">
        <div className="v1p-ok-badge"><Icon name="check" /></div>
        <span className="v1p-k">PQR radicada</span>
        <h2 className="num">{ok.id}</h2>
        <p>{TIPO[ok.tipo] ? ok.tipo : ''} para el código PTR <b>{ok.codigo}</b>{ok.oficina ? <> · {ok.oficina}</> : null}. La constancia quedó guardada y el caso ya aparece en el historial.</p>
        <div className="v1p-ok-act">
          <a className="btn btn-p btn-lg" href={ok.urlConfirmacion} target="_blank" rel="noopener noreferrer"><PIcon name="printer" />Ver constancia</a>
          {ok.urlAdjunto && <a className="btn btn-o btn-lg" href={ok.urlAdjunto} target="_blank" rel="noopener noreferrer"><PIcon name="paperclip" />Ver soporte</a>}
          <button type="button" className="btn btn-g btn-lg" onClick={() => setOk(null)}><PIcon name="plus" />Radicar otra</button>
        </div>
      </section>
    );
  }

  return (
    <Panel icon="form" title="Radicar PQR" sub="Los campos con * son obligatorios.">
      <div className="v1p-form">
        <F label="Código PTR" req error={errs.codigo} hint={ptr ? null : 'Código del punto de atención (columna PTR del directorio).'}>
          <div className="v1p-combo">
            <Icon name="ticket" />
            <input className="inp" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Ej: 725" autoComplete="off" />
            {sugerencias.length > 0 && (
              <ul className="v1p-combo-list" role="listbox">
                {sugerencias.map(([k, v]) => <li key={k} role="option" aria-selected="false" onMouseDown={(e) => { e.preventDefault(); setCodigo(k); }}><span className="v1p-ptr num">{k}</span><span className="grow"><b>{v.oficina}</b><small>{v.muni || '—'} · {v.cliente || 'Sin cliente'}</small></span></li>)}
              </ul>
            )}
          </div>
          {ptr && <span className="v1p-ptr-ok"><Icon name="pin" /><b>{ptr.oficina}</b> · {ptr.muni || '—'} · {ptr.zona}</span>}
        </F>
        <F label="Fecha y hora" req error={errs.fecha}>
          <input className="inp" type="datetime-local" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        </F>
        <F label="Tipificación de novedad" req wide error={errs.tipo}>
          <div className="v1p-tipo-pick" role="radiogroup" aria-label="Tipificación">
            {TIPOS.map((t) => (
              <button key={t[0]} type="button" role="radio" aria-checked={tipo === t[0]} className={tipo === t[0] ? 'on' : ''} style={{ '--c': t[2] }} onClick={() => setTipo(t[0])}>
                <PIcon name={t[1]} /><span><b>{t[0]}</b><small>{t[3]}</small></span>
              </button>
            ))}
          </div>
        </F>
        <F label="Descripción" req wide error={errs.desc} hint={`${fmt(desc.length)} / 5.000 caracteres`}>
          <textarea className="inp v1p-area" rows={5} maxLength={5000} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Describe detalladamente la situación del cliente..." />
        </F>
        <F label="Adjuntar soporte (opcional)" wide error={errs.archivo}>
          {archivo ? (
            <div className="v1p-file">
              <span className="v1p-file-ic"><PIcon name={archivo.type === 'application/pdf' ? 'file' : 'paperclip'} /></span>
              <span className="grow"><b className="ellip">{archivo.name}</b><small>{fmtBytes(archivo.size)} · {archivo.type === 'application/pdf' ? 'PDF' : 'Imagen'}</small></span>
              <button type="button" className="btn btn-g btn-sm" onClick={() => setArchivo(null)}><Icon name="x" />Quitar</button>
            </div>
          ) : (
            <div className={'v1p-drop' + (drag ? ' over' : '')} role="button" tabIndex={0}
              onClick={() => input.current && input.current.click()} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current && input.current.click(); } }}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); elegirArchivo(e.dataTransfer.files[0]); }}>
              <Icon name="upload" />
              <b>Arrastra un archivo o haz clic para seleccionar</b>
              <small>PNG, JPG, PDF — máx. 5 MB</small>
            </div>
          )}
          <input ref={input} type="file" accept=".png,.jpg,.jpeg,.pdf" hidden onChange={(e) => { elegirArchivo(e.target.files[0]); e.target.value = ''; }} />
        </F>
      </div>
      <div className="v1p-form-foot">
        <div className="v1p-preview"><PIcon name="printer" /><span>Se genera la constancia de radicación imprimible (PDF desde el navegador) y queda enlazada al caso.</span></div>
        <button type="button" className={'btn btn-p btn-lg v1p-cta' + (busy ? ' loading' : '')} onClick={radicar} disabled={busy}><span className="spinner" /><Icon name="send" />Radicar PQR y generar constancia</button>
      </div>
    </Panel>
  );
}

function HistorialPQR({ items, tipo, setTipo, esAdmin }) {
  const [q, setQ] = useState('');
  const [limite, setLimite] = useState(10);
  const lista = useMemo(() => {
    const t = norm(q.trim());
    return (items || []).filter((r) => (!tipo || r.tipificacion === tipo) && (!t || [r.id, r.codigoPTR, r.oficina, r.tipificacion, r.descripcion, r.radicadoPor].some((x) => norm(x || '').includes(t))));
  }, [items, q, tipo]);
  return (
    <Panel icon="list" title="Historial de PQR radicados" sub={esAdmin ? 'Todas las radicaciones (vista ADMIN), más recientes primero.' : 'Sus radicaciones, más recientes primero.'}
      right={<div className="v1p-search"><Icon name="search" /><input className="inp" placeholder="Buscar en historial..." value={q} onChange={(e) => { setQ(e.target.value); setLimite(10); }} /></div>} flush>
      <div className="v1p-chips-row">
        <button type="button" className={'v1p-chip-t' + (!tipo ? ' on' : '')} onClick={() => setTipo('')}>Todas</button>
        {TIPOS.map((t) => <button key={t[0]} type="button" className={'v1p-chip-t' + (tipo === t[0] ? ' on' : '')} style={{ '--c': t[2] }} onClick={() => setTipo(tipo === t[0] ? '' : t[0])}><i className="v1p-dot" />{t[0]}</button>)}
      </div>
      {!items ? <div className="v1p-pad"><Skeleton rows={4} h={40} /></div> : !lista.length ? (
        <Empty icon="inbox" title={items.length ? 'Sin coincidencias' : 'Aún no hay PQR radicadas'}>{items.length ? 'Ajuste la búsqueda o la tipificación.' : 'La primera radicación creará el libro PQR en COI V1.'}</Empty>
      ) : (
        <div className="scroll-x">
          <table className="t v1p-table">
            <thead><tr><th>Radicado</th><th>Punto (PTR)</th><th>Tipificación</th><th>Evento</th><th>Descripción</th><th>Radicó</th><th className="r">Documentos</th></tr></thead>
            <tbody>
              {lista.slice(0, limite).map((r) => {
                const t = TIPO[r.tipificacion];
                return (
                  <tr key={r.id}>
                    <td data-label="Radicado"><div className="cell-main num">{r.id}</div><div className="cell-sub">{r.fechaRadicacion}</div></td>
                    <td data-label="Punto"><div className="cell-main">PTR {r.codigoPTR}</div><div className="cell-sub ellip" style={{ maxWidth: 220 }}>{r.oficina || 'Oficina no identificada'}</div></td>
                    <td data-label="Tipificación"><span className="v1p-tipo-tag" style={{ '--c': t ? t[2] : '#646B80' }}>{t && <PIcon name={t[1]} />}{r.tipificacion}</span></td>
                    <td data-label="Evento" className="nowrap num">{r.fechaEvento}</td>
                    <td data-label="Descripción"><span className="v1p-clamp" title={r.descripcion}>{r.descripcion}</span></td>
                    <td data-label="Radicó"><div className="cell-main">{r.radicadoPor || '—'}</div><div className="cell-sub"><Pill v={r.estado} /></div></td>
                    <td data-label="Documentos" className="r">
                      <div className="v1p-docs">
                        {r.urlConfirmacion && <a className="btn btn-o btn-sm" href={r.urlConfirmacion} target="_blank" rel="noopener noreferrer" title="Constancia de radicación"><PIcon name="printer" />Constancia</a>}
                        {r.urlAdjunto && <a className="btn btn-g btn-sm" href={r.urlAdjunto} target="_blank" rel="noopener noreferrer" title={r.adjunto}><PIcon name="paperclip" />Soporte</a>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {lista.length > limite && <div className="v1p-more-wrap"><button type="button" className="btn btn-g v1p-more" onClick={() => setLimite((l) => l + 20)}>Ver más ({fmt(lista.length - limite)})<Icon name="down" /></button></div>}
    </Panel>
  );
}
