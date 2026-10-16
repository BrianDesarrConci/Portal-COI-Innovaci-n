// Cargar Arqueo (líder): diligenciamiento digital de los formatos oficiales o carga de soporte manual.
// Portado de renderCargar / consultarVisita / pintarRequisitos / construirFormatos / enviarArqueo /
// modalResultado / enviarManual de app.decodificado.js, con las mismas validaciones y llamadas.
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../../../components/Icon.jsx';
import { gas } from '../../../lib/gas.js';
import {
  FMT, DENOMINACIONES, MAX_ATM_UI, n, cop, copSigned, usd, tonoDif, fechaLocalISO, fechaLarga,
  Chip, F, Note, ErrorBox, Spinner, Msg, BusyBtn, useAq, leerArchivo, pesoMB, invalidarFront
} from './shared.jsx';
import { FormEfectivo, FormCheques, FormAtm, efectivoVacio, chequesVacio, atmVacio, calcEfectivo, calcUsd, calcCheques, calcAtm } from './Formatos.jsx';

const MAX_MB_MANUAL = 25;
/** Clave normalizada del cajero (claveCajero_ del backend). */
const claveCajero = (v) => String(v || '').toUpperCase().replace(/^CAJERO\s*/, '').replace(/^ATM\s*/, '').trim() || '1';

/** Etiqueta legible del requisito ATM: código si es uno, cantidad si son varios. */
function etiquetaATM(r) {
  if (!r.atm) return 'Sin cajero';
  const cods = Array.isArray(r.codigosATM) ? r.codigosATM.filter((c) => String(c).trim()) : [];
  if (cods.length > 1) return 'ATM x' + cods.length + ' (' + cods.join(', ') + ')';
  if (cods.length === 1 && !/^cajero/i.test(cods[0])) return 'Cajero ' + cods[0];
  return 'Cajero automático';
}

export default function Cargar() {
  const { user, abrirModal, cerrarModal, irA, despuesDeEscribir } = useAq();
  const [ctx, setCtx] = useState({ loading: true });
  const [modo, setModo] = useState('digital');
  const ahora = new Date();
  const [fecha, setFecha] = useState(fechaLocalISO(ahora));
  const [hora, setHora] = useState(ahora.toTimeString().slice(0, 5));
  const [hoy, setHoy] = useState('');
  const [modalidad, setModalidad] = useState('');
  const [ofiIdx, setOfiIdx] = useState('');
  const [visita, setVisita] = useState(null); // null | 'cargando' | objeto
  const [sel, setSel] = useState({ efectivo: true, cheques: true, atm: true });
  const [ef, setEf] = useState(() => efectivoVacio(''));
  const [ch, setCh] = useState(chequesVacio);
  const [atms, setAtms] = useState([]);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const nombreLider = (ctx.data && ctx.data.nombreLider) || user.nombre || '';

  // getContextoArqueo: oficinas del Directorio Nacional + fecha de hoy en Colombia (servidor).
  useEffect(() => {
    let vivo = true;
    gas('getContextoArqueo', user.idUsuario, user.rol).then((c) => {
      if (!vivo) return;
      if (!c || !c.success) { setCtx({ error: new Error((c && c.message) || 'No fue posible leer el Directorio Nacional.') }); return; }
      if (Array.isArray(c.denominacionesATM) && c.denominacionesATM.length) DENOMINACIONES.splice(0, DENOMINACIONES.length, ...c.denominacionesATM);
      if (c.hoy) { setHoy(c.hoy); setFecha((f) => (!f || f > c.hoy ? c.hoy : f)); }
      setCtx({ data: c });
    }).catch((e) => vivo && setCtx({ error: e }));
    return () => { vivo = false; };
  }, [user]);

  const oficinas = (ctx.data && ctx.data.oficinas) || [];
  const ofi = ofiIdx === '' ? null : oficinas[parseInt(ofiIdx, 10)] || null;
  const r = ofi ? ofi.requiere || {} : {};
  const adicional = !!(visita && typeof visita === 'object' && visita.esAdicional);
  const elegido = (cual) => (adicional ? !!sel[cual] : true);

  // Al cambiar de oficina se arman de nuevo los formatos (construirFormatos).
  useEffect(() => {
    if (!ofi) { setAtms([]); return; }
    setEf(efectivoVacio(nombreLider, ofi.usd));
    setCh(chequesVacio());
    const req = ofi.requiere || {};
    const codigos = Array.isArray(req.codigosATM) && req.codigosATM.length ? req.codigosATM : [''];
    setAtms(req.atm ? codigos.slice(0, MAX_ATM_UI).map((c) => atmVacio(c, nombreLider)) : []);
    setIntentado(false); setMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ofiIdx]);

  // verificarVisitaMes: primera visita (todo obligatorio) o visita adicional (el líder elige).
  useEffect(() => {
    if (!ofi || !fecha) { setVisita(null); return undefined; }
    let vivo = true;
    setVisita('cargando');
    const aplicar = (v) => { if (!vivo) return; setVisita(v); setSel(v.esAdicional ? { efectivo: false, cheques: false, atm: false } : { efectivo: true, cheques: true, atm: true }); };
    gas('verificarVisitaMes', user.idUsuario, user.rol, ofi.oficina, fecha)
      .then((v) => aplicar(v && v.success ? v : { esAdicional: false, tipoVisita: 'PRIMERA VISITA', visitasPrevias: 0, cuentaMeta: true, error: (v && v.message) || '' }))
      .catch((e) => aplicar({ esAdicional: false, tipoVisita: 'PRIMERA VISITA', visitasPrevias: 0, cuentaMeta: true, error: e.message }));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ofiIdx, fecha]);

  const visitaObj = visita && typeof visita === 'object' ? visita : null;
  const atmYa = (visitaObj && visitaObj.atmArqueadosMes) || {};
  const atmYaArqueado = (cajeroNo) => atmYa[claveCajero(cajeroNo)] || '';
  const verEfectivo = !!ofi && (r.efectivo || r.sinParametrizar) && elegido('efectivo');
  const verCheques = !!ofi && !!r.cheques && elegido('cheques');
  const verAtm = !!ofi && !!r.atm && elegido('atm');
  const listo = !!ofi && !!visitaObj;
  const encabezado = { hora, fecha, fechaTxt: fechaLarga(fecha), oficina: ofi ? ofi.oficina : '', modalidad };
  const setAtm = (i, a) => setAtms((p) => p.map((x, k) => (k === i ? a : x)));

  // ---------- Validación (enviarArqueo de V1, reuniendo todos los faltantes) ----------
  const val = useMemo(() => {
    const errs = [];
    const e = (step, m) => errs.push({ step, m });
    if (!ofi) e('ofi', 'Selecciona la oficina.');
    if (!fecha) e('fecha', 'Indica la fecha real del arqueo.');
    if (hoy && fecha > hoy) e('fecha', 'La fecha del arqueo no puede ser futura. Hoy en Colombia es ' + hoy + '.');
    if (!hora) e('fecha', 'Indica la hora del arqueo.');
    if (!modalidad) e('modalidad', 'Falta indicar la modalidad del arqueo.');
    const payload = { idUsuario: user.idUsuario, rol: user.rol, nombreLider, oficina: ofi ? ofi.oficina : '', fechaArqueo: fecha, hora, modalidad, efectivo: null, cheques: null, atms: [] };
    if (!ofi || !visitaObj) return { errs, payload };
    if (adicional && !sel.efectivo && !sel.cheques && !sel.atm) e('formatos', 'Esta es una visita adicional del mes: marca arriba al menos un formato para diligenciar.');

    const incluirEf = elegido('efectivo') && (r.efectivo || adicional || (r.sinParametrizar && ef.incluir));
    if (incluirEf) {
      const b = parseFloat(ef.billete) || 0, m = parseFloat(ef.moneda) || 0, t = ef.teorico;
      let ok = true;
      if (t === '' || (ef.billete === '' && ef.moneda === '')) { e('montos', 'Arqueo de efectivo: ingresa el saldo del sistema y el conteo físico.'); ok = false; }
      const dif = (b + m) - parseFloat(t);
      if (ok && dif !== 0 && (!ef.obs.trim() || ef.obs === 'SIN NOVEDAD')) e('montos', 'Arqueo de efectivo: justifica el faltante/sobrante en Observaciones.');
      if (!ef.r1.nom.trim() || !ef.r3.nom.trim()) e('firmas', 'Arqueo de efectivo: completa quién practicó y a quién se le practicó.');
      if (!ef.r1.fir || !ef.r3.fir) e('firmas', 'Arqueo de efectivo: faltan las firmas digitales de los responsables.');
      const numeroElem = ef.elemento === 'Caja' ? ef.cajaNo : '';
      if (ef.elemento === 'Caja' && !numeroElem.trim()) e('montos', 'Arqueo de efectivo: indica el número de Caja.');
      let usdP = null;
      if (ef.usdOn) {
        if (ef.usdF === '' || ef.usdS === '') e('montos', 'Moneda extranjera: ingresa los dólares físicos y el saldo USD según sistema (o desmarca la opción).');
        else {
          const udif = (parseFloat(ef.usdF) || 0) - (parseFloat(ef.usdS) || 0);
          if (udif !== 0 && !ef.usdObs.trim()) e('montos', 'Moneda extranjera: justifica la diferencia en dólares.');
        }
        usdP = { fisico: ef.usdF, sistema: ef.usdS, tasa: ef.usdT, observaciones: ef.usdObs };
      }
      payload.efectivo = {
        elemento: ef.elemento, numeroElem, tipoArqueo: ef.tipo, montoBilletes: b, montoMonedas: m, montoTeorico: t, usd: usdP,
        observaciones: ef.obs || 'SIN NOVEDAD', sistemas: ef.sistemas,
        practico: { nombre: ef.r1.nom, cargo: ef.r1.car, firmado: ef.r1.fir },
        acompano: { nombre: ef.r2.nom, cargo: ef.r2.car, firmado: ef.r2.fir },
        practicadoA: { nombre: ef.r3.nom, cargo: ef.r3.car, firmado: ef.r3.fir }
      };
    }
    if (r.cheques && elegido('cheques')) {
      const items = ch.items.filter((it) => String(it.tipoTitulo || '').trim() !== '' || n(it.cant) !== 0 || n(it.invCont) !== 0);
      if (!items.length) e('montos', 'Arqueo de títulos valor: registra al menos un título.');
      for (let i = 0; i < items.length; i++) if (!String(items[i].tipoTitulo || '').trim()) { e('montos', 'Arqueo de títulos valor: la fila ' + (i + 1) + ' no tiene tipo de título.'); break; }
      if (!ch.nom.trim()) e('firmas', 'Arqueo de títulos valor: indica quién realiza el arqueo.');
      if (!ch.fir) e('firmas', 'Arqueo de títulos valor: falta la firma digital de quien realiza el arqueo.');
      payload.cheques = { actaNo: ch.acta, items, anexos: ch.anexos, tipoArqueo: 'Arqueo de Control', quienRealiza: { nombre: ch.nom, cargo: ch.car, firmado: ch.fir } };
    }
    if (r.atm && elegido('atm')) {
      atms.forEach((a, i) => {
        const p = 'Cajero #' + (i + 1) + ': ';
        if (!String(a.cajeroNo || '').trim()) e('montos', p + 'indica el número del cajero automático.');
        if (!a.practico.nombre.trim() || !a.practicadoA.nombre.trim()) e('firmas', p + 'completa las firmas de responsables.');
        if (!a.practico.firmado || !a.practicadoA.firmado) e('firmas', p + 'faltan las firmas digitales.');
        if (!a.tirillas.length) e('firmas', p + 'adjunta las tirillas en PDF (obligatorio).');
        const totCant = a.gavetasEfectivo.concat(a.gavetaPurga, a.gavetasDispensado, a.aprovisionamiento).reduce((s, g) => s + n(g.cantidad), 0);
        if (totCant === 0) e('montos', p + 'no registraste cantidades en ninguna gaveta.');
        payload.atms.push({ ...a, tirillas: a.tirillas.map((t) => ({ fileName: t.fileName, mimeType: t.mimeType, base64: t.base64 })) });
      });
    }
    if (!payload.efectivo && !payload.cheques && !payload.atms.length && !(adicional && !sel.efectivo && !sel.cheques && !sel.atm)) e('formatos', 'No hay ningún formato diligenciado para guardar.');
    return { errs, payload };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ofi, fecha, hora, hoy, modalidad, visitaObj, adicional, sel, ef, ch, atms, nombreLider, user]);

  async function enviar() {
    setIntentado(true);
    if (val.errs.length) {
      setMsg({ tone: 'bad', text: val.errs[0].m });
      const map = { ofi: 'aq-s-datos', fecha: 'aq-s-datos', modalidad: 'aq-s-modalidad', formatos: 'aq-s-formatos', montos: 'aq-s-formatos', firmas: 'aq-s-formatos' };
      const el = document.getElementById(map[val.errs[0].step]);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setBusy(true); setMsg({ tone: 'busy', text: 'Guardando y generando PDF…' });
    try {
      const res = await gas('procesarArqueoIntegral', val.payload);
      if (res && res.success) {
        setMsg(null);
        invalidarFront();
        abrirModal({ title: res.extemporaneo === 'SÍ' ? 'Arqueo registrado como extemporáneo' : 'Arqueo registrado', icon: res.extemporaneo === 'SÍ' ? 'clock' : 'check', tone: res.extemporaneo === 'SÍ' ? 'warn' : 'ok', wide: true,
          body: <Resultado res={res} onHistorial={() => { cerrarModal(); irA('historial'); }} onOtro={cerrarModal} /> });
        despuesDeEscribir();
      } else setMsg({ tone: 'bad', text: String((res && res.message) || 'No fue posible guardar el arqueo.') });
    } catch (e) { setMsg({ tone: 'bad', text: 'Error de conexión: ' + e.message }); }
    setBusy(false);
  }

  // ---------- Pasos (estado visual del flujo) ----------
  const stepErr = (s) => val.errs.some((x) => x.step === s);
  const pasos = [
    ['aq-s-datos', 'Oficina', !!ofi, stepErr('ofi')],
    ['aq-s-datos', 'Fecha y hora', !!fecha && !!hora && !stepErr('fecha'), stepErr('fecha')],
    ['aq-s-modalidad', 'Modalidad', !!modalidad, stepErr('modalidad')],
    ['aq-s-formatos', 'Formatos', listo && !stepErr('formatos') && !stepErr('montos'), stepErr('formatos') || stepErr('montos')],
    ['aq-s-formatos', 'Firmas y soportes', listo && !stepErr('firmas'), stepErr('firmas')],
    ['aq-s-enviar', 'Guardar', false, false]
  ];
  const cur = pasos.findIndex((p) => !p[2]);

  if (ctx.loading) return <div className="card aq-pad"><Spinner label="Consultando el Directorio Nacional…" /></div>;
  if (ctx.error) return <ErrorBox error={ctx.error} />;

  return (
    <>
      <div className="aq-vhead">
        <div>
          <h2>Registrar arqueo</h2>
          <p>Los formatos exigidos se determinan automáticamente desde el Directorio Nacional según la oficina que elijas.</p>
        </div>
        <div className="aq-seg big" role="tablist" aria-label="Forma de registro">
          <button role="tab" aria-selected={modo === 'digital'} className={modo === 'digital' ? 'on' : ''} onClick={() => setModo('digital')}><Icon name="pen" />Diligenciar</button>
          <button role="tab" aria-selected={modo === 'manual'} className={modo === 'manual' ? 'on' : ''} onClick={() => setModo('manual')}><Icon name="upload" />Adjuntar soporte</button>
        </div>
      </div>

      {modo === 'digital' && (
        <ol className="aq-steps" aria-label="Progreso del registro">
          {pasos.map(([anc, t, done, bad], i) => (
            <li key={t} className={(done ? 'done' : '') + (i === cur ? ' cur' : '') + (bad && intentado ? ' bad' : '')}>
              <button type="button" onClick={() => { const el = document.getElementById(anc); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
                <i>{done ? <Icon name="check" /> : bad && intentado ? '!' : i + 1}</i><span>{t}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      <div className={'aq-load' + (modo === 'manual' ? ' manual' : '')}>
        <div className="aq-load-main">
          <section className="card aq-step" id="aq-s-datos">
            <div className="aq-step-h"><span className="aq-step-n">1</span><div><h3>Oficina, fecha y hora</h3><p>Seleccione la oficina asignada en el Directorio Nacional y cuándo se practicó el arqueo.</p></div></div>
            {!oficinas.length ? (
              <Note tone="warn" icon="alert" title="No tienes oficinas asignadas en el Directorio Nacional">La columna <b>LÍDER DE EXCELENCIA</b> del directorio no registra tu nombre. Solicita a Gestión Administrativa la actualización del directorio o el registro de tu alias en la hoja <b>Alias_Lideres</b>.</Note>
            ) : (
              <div className="aq-g-dates">
                <F label="Oficina" req htmlFor="f-oficina" hint={oficinas.length + ' oficina(s) asignada(s).'}>
                  <select id="f-oficina" className="aq-in lg" value={ofiIdx} onChange={(e) => setOfiIdx(e.target.value)}>
                    <option value="">Selecciona la oficina…</option>
                    {oficinas.map((o, i) => <option key={o.oficina + i} value={i}>{o.oficina}</option>)}
                  </select>
                </F>
                <F label="Fecha real del arqueo" req htmlFor="f-fecha" hint={<>+2 días hábiles = extemporáneo (no cuenta a la meta, normalizable).{hoy && <> Hoy en Colombia: <b>{hoy}</b></>}</>}>
                  <input id="f-fecha" type="date" className="aq-in lg" value={fecha} max={hoy || fechaLocalISO(new Date())} onChange={(e) => setFecha(e.target.value)} />
                </F>
                <F label="Hora del arqueo" req htmlFor="f-hora"><input id="f-hora" type="time" className="aq-in lg" value={hora} onChange={(e) => setHora(e.target.value)} /></F>
              </div>
            )}
          </section>

          <section className="card aq-step" id="aq-s-modalidad">
            <div className="aq-step-h"><span className="aq-step-n">2</span><div><h3>¿Cómo se realizó este arqueo?</h3><p>Dato obligatorio para el registro y el PDF.</p></div></div>
            <div className="aq-modos" role="radiogroup" aria-label="Modalidad del arqueo">
              {[['PRESENCIAL', 'pin', 'Presencial', 'Estuve en la oficina contando el efectivo'], ['VIRTUAL', 'eye', 'Virtual', 'Lo supervisé por videollamada o de forma remota']].map(([v, ic, t, d]) => (
                <label key={v} className={'aq-modo' + (modalidad === v ? ' on' : '')}>
                  <input type="radio" name="modalidad" value={v} checked={modalidad === v} onChange={() => setModalidad(v)} />
                  <span className="aq-modo-ic"><Icon name={ic} /></span>
                  <span><b>{t}</b><small>{d}</small></span>
                  <span className="aq-modo-ok"><Icon name="check" /></span>
                </label>
              ))}
            </div>
            {intentado && !modalidad && <p className="aq-msg bad">Selecciona si el arqueo fue presencial o virtual.</p>}
          </section>

          {modo === 'digital' ? (
            <section id="aq-s-formatos" className="aq-formatos">
              {!ofi ? (
                oficinas.length ? <div className="card aq-hint-card"><Icon name="building" /><div><b>Tienes {oficinas.length} oficina(s) asignada(s).</b><p>Selecciona una para ver los formatos que debes diligenciar.</p></div></div> : null
              ) : visita === 'cargando' ? <div className="card aq-pad"><Spinner label="Verificando visitas del mes a esta oficina…" /></div>
                : visitaObj && (
                  <>
                    <Requisitos ofi={ofi} visita={visitaObj} sel={sel} setSel={setSel} />
                    {verEfectivo && <FormEfectivo ef={ef} setEf={setEf} encabezado={encabezado} opcional={r.sinParametrizar || adicional} adicional={adicional} mostrarIncluir={r.sinParametrizar && !adicional} />}
                    {verCheques && <FormCheques ch={ch} setCh={setCh} encabezado={encabezado} opcional={adicional} adicional={adicional} />}
                    {verAtm && atms.map((a, i) => <FormAtm key={i} a={a} i={i} total={atms.length} setAtm={setAtm} encabezado={encabezado} opcional={adicional} adicional={adicional} yaArqueado={atmYaArqueado(a.cajeroNo)} />)}
                    {!verEfectivo && !verCheques && !verAtm && (adicional
                      ? <div className="card aq-hint-card cyan"><Icon name="flag" /><div><b>Elige arriba qué formatos deseas diligenciar</b><p>Ninguno es obligatorio en esta visita adicional, pero debes marcar al menos uno para poder registrar el arqueo.</p></div></div>
                      : <div className="card aq-hint-card"><Icon name="inbox" /><div><b>Esta oficina no exige ningún formato según el Directorio Nacional.</b></div></div>)}
                  </>
                )}
            </section>
          ) : <Manual ofi={ofi} fecha={fecha} modalidad={modalidad} />}
        </div>

        {modo === 'digital' && (
          <aside className="aq-load-side" id="aq-s-enviar" aria-label="Resumen del registro">
            <Resumen ofi={ofi} visita={visitaObj} fecha={fecha} hora={hora} modalidad={modalidad}
              ef={verEfectivo && (r.efectivo || adicional || ef.incluir) ? ef : null} ch={verCheques ? ch : null} atms={verAtm ? atms : []} atmYaArqueado={atmYaArqueado}
              errs={val.errs} intentado={intentado} msg={msg} busy={busy} onEnviar={enviar} />
          </aside>
        )}
      </div>
    </>
  );
}

/** Banda de visita del mes + formatos exigidos (pintarRequisitos). */
function Requisitos({ ofi, visita, sel, setSel }) {
  const r = ofi.requiere || {};
  const adicional = !!visita.esAdicional;
  const ya = visita.atmArqueadosMes || {};
  const yaTxt = Object.keys(ya).length ? (
    <p className="aq-band-x"><Icon name="building" />Cajero(s) con arqueo válido este mes: {Object.keys(ya).map((k) => k + ' (' + ya[k] + ')').join(', ')}. Puedes volver a arquearlos, pero <b>el ATM solo suma a la meta una vez al mes</b>.</p>
  ) : null;
  const chips = [
    ['efectivo', r.efectivo || r.sinParametrizar, FMT.EFECTIVO, 'Efectivo', 'wallet'],
    ['cheques', r.cheques, FMT.CHEQUES, 'Títulos valor', 'receipt'],
    ['atm', r.atm, FMT.ATM, etiquetaATM(r), 'building']
  ];
  return (
    <div className="card aq-req-card">
      <div className={'aq-band ' + (adicional ? 'adicional' : 'primera')}>
        <span className="aq-band-ic"><Icon name={adicional ? 'activity' : 'flag'} /></span>
        <div>
          {adicional ? (
            <>
              <b>Visita adicional del mes · esta será la visita N.° {(visita.visitasPrevias || 0) + 1}</b>
              <p>Esta oficina ya tuvo su primera visita del mes{visita.primeraFecha ? <> el <b>{visita.primeraFecha}</b></> : ''}, donde se diligenciaron todos los formatos exigidos. Por eso <b>ningún formato es obligatorio ahora</b>: elige abajo cuáles deseas realizar. <b>El arqueo de efectivo de esta visita SÍ suma a tu meta de 30</b>; el arqueo ATM solo suma si el cajero aún no tiene arqueo válido en el mes.</p>
            </>
          ) : (
            <>
              <b>Primera visita del mes a esta oficina</b>
              <p>Debes diligenciar <b>todos</b> los formatos parametrizados en el Directorio Nacional. El arqueo de efectivo y el de cada cajero ATM <b>suman a tu meta</b> del mes (el de títulos valor es complementario).</p>
            </>
          )}
          {yaTxt}
          {visita.error && <p className="aq-band-x"><Icon name="alert" />No fue posible verificar las visitas ({visita.error}); se asume primera visita.</p>}
        </div>
      </div>
      <div className="aq-req-body">
        <div className="aq-req-ofi">
          <p className="aq-sec-lbl">{adicional ? 'Formatos disponibles (opcionales)' : 'Formatos exigidos para esta oficina'}</p>
          <h3>{ofi.oficina}</h3>
          <p className="aq-dim small">Medio de pago: <b className="aq-t-navy">{ofi.medioPago}</b> · ATM: <b className="aq-t-navy">{ofi.atmValor || '—'}</b>{ofi.cliente ? <> · Cliente: <b className="aq-t-navy">{ofi.cliente}</b></> : null}</p>
        </div>
        <div className="aq-req-chips">
          {chips.map(([k, exigido, cod, txt, ic]) => {
            if (!exigido) return <span key={k} className="aq-req-chip off"><Icon name="x" /><span><b>{cod}</b><small>{k === 'atm' ? 'Sin cajero' : txt + ' · no aplica'}</small></span></span>;
            if (!adicional) return <span key={k} className={'aq-req-chip on ' + k}><Icon name={ic} /><span><b>{cod}</b><small>{txt}</small></span></span>;
            const on = !!sel[k];
            return (
              <label key={k} className={'aq-req-chip tog ' + k + (on ? ' on' : '')}>
                <input type="checkbox" checked={on} onChange={(e) => setSel((s) => ({ ...s, [k]: e.target.checked }))} />
                <span className="aq-req-sw" aria-hidden="true" />
                <span><b>{cod}</b><small>{txt}</small></span>
              </label>
            );
          })}
        </div>
      </div>
      {r.sinParametrizar && (
        <Note tone="warn" icon="alert" className="aq-req-note">Esta oficina no tiene <b>MEDIO DE PAGO</b> parametrizado en el Directorio Nacional (valor: «{ofi.medioPago}»). El arqueo de efectivo queda habilitado como opcional; reporta la novedad a Gestión Administrativa para que actualicen la BD.</Note>
      )}
    </div>
  );
}

/** Resumen pegajoso del registro: diferencias en vivo, aporte a la meta y verificación previa. */
function Resumen({ ofi, visita, fecha, hora, modalidad, ef, ch, atms, atmYaArqueado, errs, intentado, msg, busy, onEnviar }) {
  const filas = [];
  let meta = 0;
  if (ef) {
    const c = calcEfectivo(ef);
    const lleno = ef.teorico !== '' || ef.billete !== '' || ef.moneda !== '';
    filas.push({ k: 'ef', t: 'Efectivo', cod: FMT.EFECTIVO, v: lleno ? copSigned(c.dif) : 'Sin diligenciar', tone: lleno ? tonoDif(c.dif) : 'mute', sub: lleno ? 'Físico ' + cop(c.fisico) + ' · Sistema ' + cop(c.teorico) : '', meta: 'Suma a la meta' });
    if (ef.usdOn && (ef.usdF !== '' || ef.usdS !== '')) { const u = calcUsd(ef); filas.push({ k: 'usd', t: 'Dólares (USD)', v: (u.dif > 0 ? '+' : '') + usd(u.dif), tone: tonoDif(u.dif), sub: u.cop ? 'Equivale a ' + cop(u.cop) : '' }); }
    meta += 1;
  }
  if (ch) {
    const t = calcCheques(ch.items);
    filas.push({ k: 'ch', t: 'Títulos valor', cod: FMT.CHEQUES, v: (t.dif > 0 ? '+' : t.dif < 0 ? '−' : '') + Math.abs(t.dif) + ' tít.', tone: tonoDif(t.dif), sub: t.tc + ' en libros · ' + t.ti + ' contados', meta: 'Complementario' });
  }
  atms.forEach((a, i) => {
    const c = calcAtm(a);
    const ya = atmYaArqueado(a.cajeroNo);
    if (!ya) meta += 1;
    filas.push({ k: 'atm' + i, t: 'ATM ' + (a.cajeroNo || '#' + (i + 1)), cod: FMT.ATM, v: copSigned(c.df), tone: tonoDif(c.df), sub: 'Físico ' + cop(c.tf) + ' · Cajero ' + cop(c.tc), meta: ya ? 'ATM ya contado' : 'Suma a la meta' });
  });
  const pend = errs.length;
  return (
    <div className="aq-sum">
      <div className="aq-sum-h">
        <p className="aq-eyebrow">Resumen del registro</p>
        <h3>{ofi ? ofi.oficina : 'Sin oficina'}</h3>
        <div className="aq-chips">
          {fecha && <Chip tone="mute" icon="clock">{fecha} · {hora || '—'}</Chip>}
          {modalidad && <Chip tone="navy">{modalidad === 'VIRTUAL' ? 'Virtual' : 'Presencial'}</Chip>}
          {visita && <Chip tone={visita.esAdicional ? 'info' : 'ok'}>{visita.esAdicional ? 'Visita adicional N.° ' + ((visita.visitasPrevias || 0) + 1) : 'Primera visita'}</Chip>}
        </div>
      </div>
      <div className="aq-sum-list">
        {filas.length ? filas.map((f) => (
          <div key={f.k} className={'aq-sum-row ' + f.tone}>
            <div><b>{f.t}</b>{f.sub && <small>{f.sub}</small>}{f.meta && <em className={f.meta === 'Suma a la meta' ? 'ok' : ''}>{f.meta}</em>}</div>
            <span className="num">{f.v}</span>
          </div>
        )) : <p className="aq-dim small">Los formatos que diligencie aparecerán aquí con su diferencia en vivo.</p>}
      </div>
      {filas.length > 0 && (
        <div className="aq-sum-meta"><span>Aporte estimado a la meta</span><b>{meta}</b><small>Sujeto a extemporaneidad (más de 2 días hábiles).</small></div>
      )}
      <div className={'aq-sum-check' + (pend ? '' : ' ok')}>
        {pend ? (
          <>
            <p><Icon name="alert" />{pend} punto(s) por completar</p>
            <ul>{errs.slice(0, intentado ? 8 : 4).map((x, i) => <li key={i}>{x.m}</li>)}{errs.length > (intentado ? 8 : 4) && <li>…</li>}</ul>
          </>
        ) : <p><Icon name="check" />Todo listo para guardar</p>}
      </div>
      <Msg msg={msg} />
      <BusyBtn busy={busy} className="btn btn-p btn-lg btn-block aq-submit" onClick={onEnviar}><Icon name="file" />Guardar arqueo y generar PDF</BusyBtn>
      <p className="aq-dim xs">Se genera un PDF por formato con sello de trazabilidad para el analista.</p>
    </div>
  );
}

/** Modal de resultado (modalResultado de V1). */
function Resultado({ res, onHistorial, onOtro }) {
  const ext = res.extemporaneo === 'SÍ';
  return (
    <>
      <div className={'aq-res-hero ' + (ext ? 'warn' : 'ok')}>
        <span className="aq-res-ic"><Icon name={ext ? 'clock' : 'check'} /></span>
        <p>{res.message}</p>
        <div className="aq-chips center">
          {res.tipoVisita === 'VISITA ADICIONAL' ? <Chip tone="info" icon="activity">Visita adicional N.° {res.visitaNroMes || ''}</Chip> : <Chip tone="ok" icon="flag">Primera visita del mes</Chip>}
          {ext ? <Chip tone="bad">Extemporáneo · no suma hasta normalizar</Chip> : <Chip tone={(res.sumanMeta || 0) > 0 ? 'ok' : 'mute'} icon="star">Suma {res.sumanMeta || 0} a tu meta</Chip>}
          {(res.atmRepetidos || 0) > 0 && <Chip tone="warn">{res.atmRepetidos} ATM ya contado este mes</Chip>}
        </div>
      </div>
      <p className="aq-sec-lbl" style={{ marginTop: 18 }}>Documentos generados</p>
      <div className="aq-res-docs">
        {(res.resultados || []).map((x) => (
          <a key={x.idArqueo} className="aq-res-doc" href={x.url} target="_blank" rel="noopener noreferrer">
            <span className="aq-res-doc-ic"><Icon name="file" /></span>
            <span className="aq-res-doc-t"><b>{x.nombre}</b><small><span className="aq-mono">{x.formato}</span> · {x.idArqueo}</small></span>
            <span className="aq-res-doc-s">
              <span className={'aq-t-' + (x.novedad === 'FALTANTE' ? 'bad' : x.novedad === 'SOBRANTE' ? 'warn' : 'ok')}>{x.novedad}{x.usd && x.usd.novedad !== 'SIN NOVEDAD' ? ' · USD ' + x.usd.novedad : ''}</span>
              <small className={x.cuentaMeta ? 'aq-t-ok' : ''}>{x.cuentaMeta ? 'Suma a la meta' : x.formato === FMT.CHEQUES ? 'Complementario' : 'ATM ya contado'}</small>
            </span>
            <Icon name="download" />
          </a>
        ))}
      </div>
      <div className="aq-actions">
        <button className="btn btn-o" onClick={onHistorial}>Ver mis arqueos</button>
        <button className="btn btn-p" onClick={onOtro}><Icon name="upload" />Registrar otro</button>
      </div>
    </>
  );
}

/** Carga de soporte diligenciado en papel (enviarManual → procesarArqueo). */
function Manual({ ofi, fecha, modalidad }) {
  const { user, abrirModal, cerrarModal, irA, despuesDeEscribir } = useAq();
  const [formato, setFormato] = useState(FMT.EFECTIVO);
  const [elemento, setElemento] = useState('Bóveda');
  const [numero, setNumero] = useState('');
  const [file, setFile] = useState(null);
  const [over, setOver] = useState(false);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const inRef = useRef(null);
  async function enviar() {
    if (!ofi) return setMsg({ tone: 'bad', text: 'Selecciona la oficina.' });
    if (!modalidad) return setMsg({ tone: 'bad', text: 'Indica si el arqueo fue presencial o virtual.' });
    if (!file) return setMsg({ tone: 'bad', text: 'Adjunta el documento.' });
    if (file.size > MAX_MB_MANUAL * 1024 * 1024) return setMsg({ tone: 'bad', text: 'El archivo supera ' + MAX_MB_MANUAL + ' MB.' });
    setBusy(true); setMsg({ tone: 'busy', text: 'Subiendo soporte…' });
    try {
      const a = await leerArchivo(file);
      const res = await gas('procesarArqueo', { tipo: 'manual', idUsuario: user.idUsuario, rol: user.rol, oficina: ofi.oficina, modalidad, formato, elemento, numeroElem: numero, tipoArqueo: 'Arqueo de Control', fechaArqueo: fecha, fileName: a.fileName, mimeType: a.mimeType, base64: a.base64 });
      if (res && res.success) {
        setMsg(null);
        const ext = res.extemporaneo === 'SÍ';
        abrirModal({ title: ext ? 'Soporte cargado como extemporáneo' : 'Soporte cargado', icon: ext ? 'clock' : 'check', tone: ext ? 'warn' : 'ok',
          body: (
            <>
              <div className={'aq-res-hero ' + (ext ? 'warn' : 'ok')}><span className="aq-res-ic"><Icon name={ext ? 'clock' : 'check'} /></span><p>{res.message}</p>
                <div className="aq-chips center">{res.idArqueo && <Chip tone="mute">{res.idArqueo}</Chip>}<Chip tone="info" icon="sparkle">El robot N8N extraerá montos y diferencia</Chip></div></div>
              <div className="aq-actions"><button className="btn btn-o" onClick={() => { cerrarModal(); irA('historial'); }}>Ver mis arqueos</button><button className="btn btn-p" onClick={cerrarModal}>Cargar otro</button></div>
            </>
          ) });
        despuesDeEscribir();
      } else setMsg({ tone: 'bad', text: (res && res.message) || 'No fue posible cargar el soporte.' });
    } catch (e) { setMsg({ tone: 'bad', text: 'Error: ' + e.message }); }
    setBusy(false);
  }
  return (
    <section className="card aq-step" id="aq-s-formatos">
      <div className="aq-step-h"><span className="aq-step-n">3</span><div><h3>Adjuntar soporte firmado</h3><p>Para formatos diligenciados en papel.</p></div></div>
      <Note tone="warn" icon="sparkle">Usa esta opción solo si diligenciaste el formato en papel. Adjunta el documento firmado (PDF o foto); el robot N8N hará OCR y extraerá montos y diferencia.</Note>
      <div className="aq-g3" style={{ marginTop: 16 }}>
        <F label="Formato del soporte" htmlFor="m-formato">
          <select id="m-formato" className="aq-in" value={formato} onChange={(e) => setFormato(e.target.value)}>
            <option value={FMT.EFECTIVO}>{FMT.EFECTIVO} · Efectivo</option>
            <option value={FMT.CHEQUES}>{FMT.CHEQUES} · Títulos valor</option>
            <option value={FMT.ATM}>{FMT.ATM} · Cajeros automáticos</option>
          </select>
        </F>
        <F label="Elemento" htmlFor="m-elemento">
          <select id="m-elemento" className="aq-in" value={elemento} onChange={(e) => setElemento(e.target.value)}>
            <option value="Bóveda">Bóveda</option><option value="Caja">Caja</option><option value="Títulos Valor">Títulos Valor</option><option value="ATM">Cajero ATM</option>
          </select>
        </F>
        <F label="Número (Caja / ATM / Acta)" htmlFor="m-numero"><input id="m-numero" className="aq-in" placeholder="Ej. 01" value={numero} onChange={(e) => setNumero(e.target.value)} /></F>
      </div>
      <label className={'aq-drop big' + (over ? ' over' : '') + (file ? ' has' : '')} htmlFor="f-archivo"
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}>
        <input ref={inRef} id="f-archivo" type="file" accept="application/pdf,.pdf,image/*" onChange={(e) => setFile(e.target.files[0] || null)} />
        <span className="aq-drop-ic"><Icon name={file ? 'file' : 'upload'} /></span>
        <span>{file ? <><b>{file.name}</b><small>{pesoMB(file.size)} · clic para cambiar</small></> : <><b>Arrastre el documento aquí o selecciónelo</b><small>PDF o fotografía del formato firmado</small></>}</span>
      </label>
      <div className="aq-actions spread">
        <Msg msg={msg} />
        <BusyBtn busy={busy} className="btn btn-p btn-lg" onClick={enviar}><Icon name="upload" />Subir soporte</BusyBtn>
      </div>
    </section>
  );
}

