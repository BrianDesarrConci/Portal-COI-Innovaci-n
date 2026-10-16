// Formatos oficiales del arqueo: FOR-GOR-020-09 (efectivo), FOR-GOR-048-01 (títulos valor)
// y FOR-GOR-099-02 (cajeros automáticos). Mismos campos, cálculos y reglas que app.decodificado.js.
import { useState } from 'react';
import Icon from '../../../components/Icon.jsx';
import { fmt as fmtNum } from '../../../lib/format.js';
import {
  FMT, DENOM_DEFECTO, DENOMINACIONES, MAX_GAVETAS, MAX_MB_TIRILLA, MAX_CHEQUES, TIPOS_ARQUEO,
  n, cop, copSigned, usd, tonoDif, novDif, Chip, F, MoneyInput, Check, RadioPills, Note, leerArchivo, pesoMB, Plus
} from './shared.jsx';

// ===================== ESTADO INICIAL =====================
const resp = (nom) => ({ nom: nom || '', car: '', fir: false });
export function efectivoVacio(nombreLider, conUsd) {
  return { incluir: false, elemento: 'Bóveda', cajaNo: '', tipo: 'Arqueo de Control', billete: '', moneda: '', teorico: '',
    usdOn: !!conUsd, usdF: '', usdS: '', usdT: '', usdObs: '', obs: '', sistemas: '', r1: resp(nombreLider), r2: resp(''), r3: resp('') };
}
export const filaChequeVacia = () => ({ tipoTitulo: '', rangoInicial: '', rangoFinal: '', cant: '', invCont: '', observacion: '' });
export const chequesVacio = () => ({ acta: '', items: [filaChequeVacia(), filaChequeVacia(), filaChequeVacia()], anexos: '', nom: '', car: '', fir: false });
const gavetasDefecto = () => DENOM_DEFECTO.map((d) => ({ denominacion: d, cantidad: '' }));
/** atmVacio de V1: el código del Directorio se precarga salvo valores genéricos («Cajero», «ATM»). */
export function atmVacio(codigo, nombreLider) {
  const cod = String(codigo || '').trim();
  const precargar = cod && !/^cajero/i.test(cod) && !/^atm$/i.test(cod);
  return { cajeroNo: precargar ? cod : '', zona: '', nombreCajero: '', directorServicios: nombreLider || '', tipoArqueo: 'Arqueo de Control',
    gavetasEfectivo: gavetasDefecto(), gavetaPurga: gavetasDefecto(), gavetasDispensado: gavetasDefecto(), aprovisionamiento: gavetasDefecto(),
    observaciones: '', novedadesTecnicas: '', practico: { nombre: nombreLider || '', cargo: '', firmado: false }, practicadoA: { nombre: '', cargo: '', firmado: false }, tirillas: [] };
}

// ===================== CÁLCULOS =====================
export function calcEfectivo(ef) {
  const fisico = (parseFloat(ef.billete) || 0) + (parseFloat(ef.moneda) || 0);
  const t = parseFloat(ef.teorico) || 0;
  return { fisico, teorico: t, dif: fisico - t };
}
export function calcUsd(ef) {
  const f = parseFloat(ef.usdF) || 0, s = parseFloat(ef.usdS) || 0, t = parseFloat(ef.usdT) || 0;
  const dif = +(f - s).toFixed(2);
  return { dif, cop: t > 0 && dif !== 0 ? dif * t : 0 };
}
export function calcCheques(items) {
  let tc = 0, ti = 0;
  items.forEach((it) => { tc += n(it.cant); ti += n(it.invCont); });
  return { tc, ti, dif: ti - tc };
}
const sumaG = (arr) => arr.reduce((s, g) => s + n(g.denominacion) * n(g.cantidad), 0);
/** Fórmulas del FOR-GOR-099-02: físico = efectivo + purga; cajero = aprovisionamiento − dispensado. */
export function calcAtm(a) {
  const ef = sumaG(a.gavetasEfectivo), pu = sumaG(a.gavetaPurga), di = sumaG(a.gavetasDispensado), ap = sumaG(a.aprovisionamiento);
  const tf = ef + pu, tc = ap - di;
  return { ef, pu, di, ap, tf, tc, df: tf - tc };
}

// ===================== PIEZAS =====================
function Seccion({ id, icon, titulo, codigo, opcional, adicional, extra, children }) {
  return (
    <section className="aq-fmt" id={id} aria-labelledby={id + '-t'}>
      <header className="aq-fmt-h">
        <span className="aq-fmt-ic"><Icon name={icon} /></span>
        <div className="aq-fmt-tt"><h3 id={id + '-t'}>{titulo}</h3><span className="aq-mono">{codigo}</span></div>
        {extra}
        <span className={'aq-fmt-req ' + (opcional ? 'opt' : '')}>{opcional ? (adicional ? 'Opcional · visita adicional' : 'Opcional') : 'Obligatorio'}</span>
      </header>
      <div className="aq-fmt-b">{children}</div>
    </section>
  );
}

function SubT({ n: num, children }) { return <h4 className="aq-subt">{num && <span>{num}</span>}{children}</h4>; }

/** Caja de responsable con firma digital. */
function Responsable({ id, titulo, sub, v, onChange, req }) {
  return (
    <div className={'aq-resp-card' + (v.fir ? ' signed' : '')}>
      <div className="aq-resp-h"><b>{titulo}{req && <span className="aq-req">*</span>}</b><small>{sub}</small></div>
      <F label="Nombre (legible)" htmlFor={id + '-nom'}><input id={id + '-nom'} className="aq-in" value={v.nom} onChange={(e) => onChange({ ...v, nom: e.target.value })} autoComplete="name" /></F>
      <F label="Cargo" htmlFor={id + '-car'}><input id={id + '-car'} className="aq-in" value={v.car} onChange={(e) => onChange({ ...v, car: e.target.value })} /></F>
      <Check id={id + '-fir'} checked={v.fir} onChange={(x) => onChange({ ...v, fir: x })} tone="sign">Firmar digitalmente</Check>
      {v.fir && <div className="aq-stamp" aria-hidden="true"><Icon name="shield" />Firmado digitalmente{v.nom ? ' · ' + v.nom : ''}</div>}
    </div>
  );
}

/** Resultado de diferencia (faltante / sobrante / sin novedad). */
export function DifBox({ label = 'Diferencia', valor, texto, small }) {
  const t = tonoDif(valor);
  return (
    <div className={'aq-difbox ' + t + (small ? ' sm' : '')}>
      <span>{label}</span>
      <b className="num">{texto !== undefined ? texto : copSigned(valor)}</b>
      <em>{novDif(valor)}</em>
    </div>
  );
}

// ===================== A. EFECTIVO =====================
export function FormEfectivo({ ef, setEf, encabezado, opcional, adicional, mostrarIncluir }) {
  const c = calcEfectivo(ef);
  const u = calcUsd(ef);
  /** Igual que calcDif de V1: completa «SIN NOVEDAD» si la diferencia es $0 y lo retira si aparece diferencia. */
  const setMonto = (campo, val) => setEf((p) => {
    const nx = { ...p, [campo]: val };
    const k = calcEfectivo(nx);
    if (k.dif === 0 && (nx.billete !== '' || nx.teorico !== '')) { if (!nx.obs.trim()) nx.obs = 'SIN NOVEDAD'; } else if (nx.obs === 'SIN NOVEDAD') nx.obs = '';
    return nx;
  });
  const set = (campo) => (val) => setEf((p) => ({ ...p, [campo]: val }));
  return (
    <Seccion id="fmt-efectivo" icon="wallet" titulo="Arqueo de efectivo" codigo={FMT.EFECTIVO} opcional={opcional} adicional={adicional}>
      {mostrarIncluir && <Check id="ef-incluir" checked={ef.incluir} onChange={set('incluir')}>Incluir el arqueo de efectivo en este registro</Check>}
      <p className="aq-preamble">
        Siendo las <b>{encabezado.hora || '—'}</b> horas del <b>{encabezado.fechaTxt}</b> en la oficina <b className="aq-t-green">{encabezado.oficina || '—'}</b>, se efectuó el arqueo de efectivo en modalidad <b>{encabezado.modalidad || '—'}</b>, según las siguientes especificaciones:
      </p>
      <div className="aq-g2">
        <F label="Elemento de arqueo">
          <div className="aq-inline">
            <RadioPills name="r-elemento" value={ef.elemento} onChange={set('elemento')} options={[['Bóveda', 'Bóveda'], ['Caja', 'Caja']]} ariaLabel="Elemento de arqueo" />
            {ef.elemento === 'Caja' && <input className="aq-in xs" aria-label="Número de caja" placeholder="Caja No." value={ef.cajaNo} onChange={(e) => set('cajaNo')(e.target.value)} />}
          </div>
        </F>
        <F label="Tipo de arqueo"><RadioPills name="r-tipo" value={ef.tipo} onChange={set('tipo')} options={TIPOS_ARQUEO} ariaLabel="Tipo de arqueo" /></F>
      </div>

      <SubT n="1">Conteo y saldo</SubT>
      <div className="aq-cuenta">
        <div className="aq-cuenta-row"><label htmlFor="d-billete">Billete</label><span className="aq-lead" /><MoneyInput id="d-billete" value={ef.billete} onChange={(v) => setMonto('billete', v)} /></div>
        <div className="aq-cuenta-row"><label htmlFor="d-moneda">Moneda</label><span className="aq-lead" /><MoneyInput id="d-moneda" value={ef.moneda} onChange={(v) => setMonto('moneda', v)} /></div>
        <div className="aq-cuenta-row total"><span>Total efectivo físico</span><span className="aq-lead" /><b className="num">{cop(c.fisico)}</b></div>
        <div className="aq-cuenta-row"><label htmlFor="d-teorico">Saldo según sistema</label><span className="aq-lead" /><MoneyInput id="d-teorico" value={ef.teorico} onChange={(v) => setMonto('teorico', v)} /></div>
        <div className="aq-cuenta-row dif">
          <span>Diferencia</span>
          <span className="aq-dif-flags"><Chip tone={c.dif < 0 ? 'bad' : 'mute'} icon={c.dif < 0 ? 'check' : undefined}>Faltante</Chip><Chip tone={c.dif > 0 ? 'warn' : 'mute'} icon={c.dif > 0 ? 'check' : undefined}>Sobrante</Chip></span>
          <DifBox valor={c.dif} label="" small />
        </div>
      </div>

      <div className="aq-usd">
        <Check id="ef-usd-incluir" checked={ef.usdOn} onChange={set('usdOn')}>Esta oficina también maneja moneda extranjera (dólares USD)</Check>
        {ef.usdOn && (
          <div className="aq-usd-box">
            <p className="aq-sec-lbl">1.1 Arqueo de moneda extranjera (USD)</p>
            <div className="aq-g3">
              <F label="Dólares físicos (USD)" htmlFor="d-usd-fisico"><div className="aq-money"><span className="aq-money-p">US$</span><input id="d-usd-fisico" type="number" step="0.01" inputMode="decimal" value={ef.usdF} onChange={(e) => set('usdF')(e.target.value)} /></div></F>
              <F label="Saldo USD según sistema" htmlFor="d-usd-sistema"><div className="aq-money"><span className="aq-money-p">US$</span><input id="d-usd-sistema" type="number" step="0.01" inputMode="decimal" value={ef.usdS} onChange={(e) => set('usdS')(e.target.value)} /></div></F>
              <F label="Tasa de referencia (COP por USD, opcional)" htmlFor="d-usd-tasa"><MoneyInput id="d-usd-tasa" value={ef.usdT} onChange={set('usdT')} /></F>
            </div>
            <div className="aq-usd-res">
              <DifBox label="Diferencia USD" valor={u.dif} texto={(u.dif > 0 ? '+' : '') + usd(u.dif)} small />
              {u.cop !== 0 && <span className="aq-dim small">Equivale a {cop(u.cop)} COP</span>}
            </div>
            <F label="Observaciones del arqueo en dólares" htmlFor="d-usd-obs"><textarea id="d-usd-obs" className="aq-in" rows={2} value={ef.usdObs} onChange={(e) => set('usdObs')(e.target.value)} placeholder="Si hay diferencia, justifíquela aquí" /></F>
          </div>
        )}
      </div>

      <SubT n="2">Observaciones</SubT>
      <F label="Observaciones" hint="Se completa «SIN NOVEDAD» automáticamente si la diferencia es $ 0. Si hay faltante o sobrante, justifíquelo aquí." htmlFor="d-obs">
        <textarea id="d-obs" className={'aq-in' + (c.dif !== 0 && (!ef.obs.trim() || ef.obs === 'SIN NOVEDAD') && (ef.billete !== '' || ef.teorico !== '') ? ' need' : '')} rows={3} value={ef.obs} onChange={(e) => set('obs')(e.target.value)} placeholder="SIN NOVEDAD" />
      </F>
      <F label="Verificación de Sistemas" htmlFor="d-sistemas"><input id="d-sistemas" className="aq-in" value={ef.sistemas} onChange={(e) => set('sistemas')(e.target.value)} placeholder="Funcionario de Sistemas que verificó saldos (si aplica)" /></F>

      <SubT n="3">Responsables</SubT>
      <div className="aq-g3 resp">
        <Responsable id="r1" titulo="Quien practicó el arqueo" sub="Líder / funcionario que realiza el conteo" v={ef.r1} onChange={set('r1')} req />
        <Responsable id="r2" titulo="Quien acompañó el arqueo" sub="Testigo / segundo funcionario" v={ef.r2} onChange={set('r2')} />
        <Responsable id="r3" titulo="A quien se le practicó" sub="Persona responsable del efectivo" v={ef.r3} onChange={set('r3')} req />
      </div>
    </Seccion>
  );
}

// ===================== B. TÍTULOS VALOR =====================
export function FormCheques({ ch, setCh, encabezado, opcional, adicional }) {
  const t = calcCheques(ch.items);
  const setItem = (i, campo, val) => setCh((p) => ({ ...p, items: p.items.map((it, k) => (k === i ? { ...it, [campo]: val } : it)) }));
  const set = (campo) => (val) => setCh((p) => ({ ...p, [campo]: val }));
  return (
    <Seccion id="fmt-cheques" icon="receipt" titulo="Arqueo de títulos valor" codigo={FMT.CHEQUES} opcional={opcional} adicional={adicional}>
      <div className="aq-g3">
        <div className="aq-ro"><span>Oficina</span><b>{encabezado.oficina || '—'}</b></div>
        <div className="aq-ro"><span>Fecha</span><b>{encabezado.fecha || '—'} · {encabezado.hora || '—'}</b></div>
        <F label="Acta N.º" htmlFor="ch-acta"><input id="ch-acta" className="aq-in" placeholder="Ej. 015" value={ch.acta} onChange={(e) => set('acta')(e.target.value)} /></F>
      </div>
      <div className="aq-grid-wrap">
        <table className="aq-grid">
          <thead><tr><th>#</th><th>Tipo de título</th><th>Rango inicial</th><th>Rango final</th><th>Cant.</th><th>Inv. cont.</th><th>Dif.</th><th>Observación</th><th><span className="aq-sr">Quitar</span></th></tr></thead>
          <tbody>
            {ch.items.map((it, i) => {
              const dif = n(it.invCont) - n(it.cant);
              return (
                <tr key={i}>
                  <td className="ro c">{i + 1}</td>
                  <td><input aria-label={'Tipo de título fila ' + (i + 1)} value={it.tipoTitulo} onChange={(e) => setItem(i, 'tipoTitulo', e.target.value)} placeholder="Ej. CHEQUES HABILITADOS" /></td>
                  <td><input aria-label={'Rango inicial fila ' + (i + 1)} className="c" value={it.rangoInicial} onChange={(e) => setItem(i, 'rangoInicial', e.target.value)} /></td>
                  <td><input aria-label={'Rango final fila ' + (i + 1)} className="c" value={it.rangoFinal} onChange={(e) => setItem(i, 'rangoFinal', e.target.value)} /></td>
                  <td><input aria-label={'Cantidad fila ' + (i + 1)} type="number" min="0" className="r" value={it.cant} onChange={(e) => setItem(i, 'cant', e.target.value)} /></td>
                  <td><input aria-label={'Inventario contado fila ' + (i + 1)} type="number" min="0" className="r" value={it.invCont} onChange={(e) => setItem(i, 'invCont', e.target.value)} /></td>
                  <td className={'ro r num aq-t-' + tonoDif(dif)}>{dif}</td>
                  <td><input aria-label={'Observación fila ' + (i + 1)} value={it.observacion} onChange={(e) => setItem(i, 'observacion', e.target.value)} /></td>
                  <td className="c">{ch.items.length > 1 && <button type="button" className="aq-x" aria-label={'Quitar fila ' + (i + 1)} onClick={() => setCh((p) => ({ ...p, items: p.items.filter((_, k) => k !== i) }))}><Icon name="x" /></button>}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr><td colSpan={4} className="c">Totales</td><td className="r num">{t.tc}</td><td className="r num">{t.ti}</td><td className={'r num aq-t-' + tonoDif(t.dif)}>{t.dif}</td><td colSpan={2} /></tr></tfoot>
        </table>
      </div>
      <div className="aq-rowline">
        <button type="button" className="btn btn-g btn-sm aq-t-green" disabled={ch.items.length >= MAX_CHEQUES} onClick={() => setCh((p) => ({ ...p, items: p.items.concat(filaChequeVacia()) }))}><Plus />Agregar título</button>
        <span className="aq-dim small">{ch.items.length} de {MAX_CHEQUES} filas</span>
      </div>
      <F label="Anexos" htmlFor="ch-anexos"><textarea id="ch-anexos" className="aq-in" rows={2} value={ch.anexos} onChange={(e) => set('anexos')(e.target.value)} placeholder="Ej: Arqueo control, con cheques sin custodia y cinco cheques con la primera firma." /></F>
      <p className="aq-legal">Se hace constar que los títulos verificados por los funcionarios que practicaron el arqueo fueron devueltos en su totalidad, a entera satisfacción.</p>
      <div className="aq-g2 resp">
        <Responsable id="ch" titulo="Quien realiza el arqueo" sub="Nombre legible, cargo y firma" v={{ nom: ch.nom, car: ch.car, fir: ch.fir }} onChange={(v) => setCh((p) => ({ ...p, nom: v.nom, car: v.car, fir: v.fir }))} req />
        <p className="aq-legal sm">Nota: este documento es propiedad intelectual de REVAL; se prohíbe su reproducción total o parcial sin previa autorización escrita de su propietario.</p>
      </div>
    </Seccion>
  );
}

// ===================== C. CAJEROS AUTOMÁTICOS =====================
function TablaGavetas({ titulo, grupo, arr, conEtiqueta, onChange, idp }) {
  const setG = (k, campo, val) => onChange(arr.map((g, j) => (j === k ? { ...g, [campo]: val } : g)));
  const sub = sumaG(arr);
  return (
    <div className="aq-gav">
      <div className="aq-gav-h"><b>{titulo}</b><span className="num">{cop(sub)}</span></div>
      <table className="aq-grid gav">
        <thead><tr><th><span className="aq-sr">Gaveta</span></th><th>Denominación</th><th>Cantidad</th><th className="r">Valor</th><th><span className="aq-sr">Quitar</span></th></tr></thead>
        <tbody>
          {arr.map((g, k) => (
            <tr key={k}>
              <td className="ro">{conEtiqueta ? 'Gaveta ' + (k + 1) : ''}</td>
              <td>
                <select aria-label={titulo + ' gaveta ' + (k + 1) + ' denominación'} value={n(g.denominacion)} onChange={(e) => setG(k, 'denominacion', Number(e.target.value))}>
                  {DENOMINACIONES.map((d) => <option key={d} value={d}>$ {fmtNum(d)}</option>)}
                  {DENOMINACIONES.indexOf(n(g.denominacion)) < 0 && n(g.denominacion) > 0 && <option value={n(g.denominacion)}>$ {fmtNum(n(g.denominacion))}</option>}
                </select>
              </td>
              <td><input id={idp + grupo + k} aria-label={titulo + ' gaveta ' + (k + 1) + ' cantidad'} type="number" min="0" inputMode="numeric" className="c" value={g.cantidad} onChange={(e) => setG(k, 'cantidad', e.target.value)} /></td>
              <td className="ro r num">{cop(n(g.denominacion) * n(g.cantidad))}</td>
              <td className="c">{arr.length > 1 && <button type="button" className="aq-x" aria-label={'Quitar gaveta ' + (k + 1)} onClick={() => onChange(arr.filter((_, j) => j !== k))}><Icon name="x" /></button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {arr.length < MAX_GAVETAS && <button type="button" className="aq-gav-add" onClick={() => onChange(arr.concat({ denominacion: DENOMINACIONES[DENOMINACIONES.length - 1], cantidad: '' }))}><Plus />Agregar gaveta</button>}
    </div>
  );
}

function Tirillas({ i, tirillas, onChange }) {
  const [msg, setMsg] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [over, setOver] = useState(false);
  async function agregar(files) {
    files = Array.from(files || []);
    if (!files.length) return;
    const invalidos = files.filter((f) => f.type.indexOf('pdf') < 0 && f.name.toLowerCase().slice(-4) !== '.pdf');
    if (invalidos.length) { setMsg('Solo se aceptan archivos PDF. Revisa: ' + invalidos.map((f) => f.name).join(', ')); return; }
    const pesados = files.filter((f) => f.size > MAX_MB_TIRILLA * 1024 * 1024);
    if (pesados.length) { setMsg('Archivo demasiado pesado (máx. ' + MAX_MB_TIRILLA + ' MB): ' + pesados.map((f) => f.name).join(', ')); return; }
    setMsg(''); setLeyendo(true);
    try {
      const leidos = await Promise.all(files.map(async (f) => ({ ...(await leerArchivo(f, 'application/pdf')), size: f.size })));
      onChange(tirillas.concat(leidos));
    } catch (e) { setMsg(e.message); }
    setLeyendo(false);
  }
  return (
    <div>
      <label className={'aq-drop' + (over ? ' over' : '') + (tirillas.length ? ' has' : '')} htmlFor={'tir-' + i}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); agregar(e.dataTransfer.files); }}>
        <input id={'tir-' + i} type="file" accept="application/pdf,.pdf" multiple onChange={(e) => { agregar(e.target.files); e.target.value = ''; }} />
        <span className="aq-drop-ic"><Icon name="upload" /></span>
        <span><b>{leyendo ? 'Preparando archivos…' : 'Arrastre las tirillas aquí o selecciónelas'}</b><small>PDF obligatorio · máx. {MAX_MB_TIRILLA} MB por archivo</small></span>
      </label>
      {msg && <p className="aq-msg bad">{msg}</p>}
      {tirillas.length > 0 && (
        <ul className="aq-files">
          {tirillas.map((t, k) => (
            <li key={k}><Icon name="file" /><span className="ellip">{t.fileName}</span>{t.size ? <small>{pesoMB(t.size)}</small> : null}
              <button type="button" className="aq-x" aria-label={'Quitar ' + t.fileName} onClick={() => onChange(tirillas.filter((_, j) => j !== k))}><Icon name="x" /></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FormAtm({ a, i, total, setAtm, encabezado, opcional, adicional, yaArqueado }) {
  const c = calcAtm(a);
  const set = (campo) => (val) => setAtm(i, { ...a, [campo]: val });
  const setF = (campo) => (v) => setAtm(i, { ...a, [campo]: { nombre: v.nom, cargo: v.car, firmado: v.fir } });
  const asResp = (p) => ({ nom: p.nombre, car: p.cargo, fir: p.firmado });
  return (
    <Seccion id={'fmt-atm-' + i} icon="building" titulo={'Arqueo cajero automático' + (total > 1 ? ' #' + (i + 1) + ' de ' + total : '')} codigo={FMT.ATM} opcional={opcional} adicional={adicional}
      extra={a.cajeroNo ? <Chip tone="navy">ATM {a.cajeroNo}</Chip> : null}>
      {yaArqueado && <Note tone="warn" icon="alert">Este cajero ya tiene arqueo válido el <b>{yaArqueado}</b>. Puede registrar un nuevo arqueo de control, pero <b>no sumará de nuevo a su meta</b> (el ATM cuenta una vez al mes).</Note>}
      <div className="aq-g3">
        <div className="aq-ro"><span>Fecha</span><b>{encabezado.fecha || '—'}</b></div>
        <div className="aq-ro"><span>Hora</span><b>{encabezado.hora || '—'}</b></div>
        <div className="aq-ro"><span>Oficina</span><b>{encabezado.oficina || '—'}</b></div>
        <F label="Director de servicios" htmlFor={'atm-dir-' + i}><input id={'atm-dir-' + i} className="aq-in" value={a.directorServicios} onChange={(e) => set('directorServicios')(e.target.value)} /></F>
        <F label="Cajero (responsable)" htmlFor={'atm-caj-' + i}><input id={'atm-caj-' + i} className="aq-in" value={a.nombreCajero} onChange={(e) => set('nombreCajero')(e.target.value)} /></F>
        <F label="Zona" htmlFor={'atm-zona-' + i}><input id={'atm-zona-' + i} className="aq-in" value={a.zona} onChange={(e) => set('zona')(e.target.value)} /></F>
      </div>
      <div className="aq-g2">
        <F label="Cajero automático N.º" req htmlFor={'atm-no-' + i}><input id={'atm-no-' + i} className="aq-in" placeholder="Ej. 3596" value={a.cajeroNo} onChange={(e) => set('cajeroNo')(e.target.value)} /></F>
        <F label="Tipo de arqueo"><RadioPills name={'atm-tipo-' + i} value={a.tipoArqueo} onChange={set('tipoArqueo')} options={TIPOS_ARQUEO} ariaLabel="Tipo de arqueo del cajero" /></F>
      </div>

      <SubT n="1">Gavetas</SubT>
      <p className="aq-dim small" style={{ marginTop: -6 }}>Elija la denominación de cada gaveta según el cajero (incluye $ 100.000). Deje en blanco las que no apliquen.</p>
      <div className="aq-gav-grid">
        <TablaGavetas idp={'g' + i} titulo="Gavetas de efectivo" grupo="gavetasEfectivo" arr={a.gavetasEfectivo} conEtiqueta onChange={set('gavetasEfectivo')} />
        <TablaGavetas idp={'g' + i} titulo="Gaveta de purga" grupo="gavetaPurga" arr={a.gavetaPurga} onChange={set('gavetaPurga')} />
        <TablaGavetas idp={'g' + i} titulo="Gavetas dispensado" grupo="gavetasDispensado" arr={a.gavetasDispensado} conEtiqueta onChange={set('gavetasDispensado')} />
        <TablaGavetas idp={'g' + i} titulo="2. Aprovisionamiento" grupo="aprovisionamiento" arr={a.aprovisionamiento} conEtiqueta onChange={set('aprovisionamiento')} />
      </div>
      <div className="aq-atm-tot">
        <div><span>Total arqueo físico</span><b className="num">{cop(c.tf)}</b><small>Efectivo + purga</small></div>
        <div><span>Total cajero automático</span><b className="num">{cop(c.tc)}</b><small>Aprovisionamiento − dispensado</small></div>
        <DifBox valor={c.df} />
      </div>

      <F label="Observaciones · diferencias respecto a la tirilla entregada por el ATM" htmlFor={'atm-obs-' + i}><textarea id={'atm-obs-' + i} className="aq-in" rows={2} value={a.observaciones} onChange={(e) => set('observaciones')(e.target.value)} /></F>
      <F label="Novedades adicionales" hint="Billetes rotos o presuntamente falsos, y novedades técnicas de MI ATM con número de radicado de servicio técnico (no se imputan a la oficina, para no afectar el UPTIME)." htmlFor={'atm-nov-' + i}>
        <textarea id={'atm-nov-' + i} className="aq-in" rows={2} value={a.novedadesTecnicas} onChange={(e) => set('novedadesTecnicas')(e.target.value)} />
      </F>

      <SubT n="3">Firmas de responsables</SubT>
      <div className="aq-g2 resp">
        <Responsable id={'atm-p-' + i} titulo="Quien practicó el arqueo" sub="Líder / funcionario" v={asResp(a.practico)} onChange={setF('practico')} req />
        <Responsable id={'atm-a-' + i} titulo="A quien se le practicó el arqueo" sub="Persona responsable del efectivo" v={asResp(a.practicadoA)} onChange={setF('practicadoA')} req />
      </div>

      <SubT>Tirillas del cajero <span className="aq-req">*</span></SubT>
      <Tirillas i={i} tirillas={a.tirillas} onChange={set('tirillas')} />
    </Seccion>
  );
}
