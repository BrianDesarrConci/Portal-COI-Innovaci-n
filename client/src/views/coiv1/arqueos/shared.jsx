// Control de Arqueos (COI V1): constantes, utilidades y piezas visuales comunes.
// Las reglas y textos se portan de app.decodificado.js / Código.gs sin cambiar la lógica.
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import Icon from '../../../components/Icon.jsx';
import { gas } from '../../../lib/gas.js';
import { fmt as fmtNum } from '../../../lib/format.js';

// ===================== CONSTANTES (iguales al backend) =====================
export const FMT = { EFECTIVO: 'FOR-GOR-020-09', CHEQUES: 'FOR-GOR-048-01', ATM: 'FOR-GOR-099-02' };
export const FMT_NOMBRE = { [FMT.EFECTIVO]: 'Efectivo', [FMT.CHEQUES]: 'Títulos valor', [FMT.ATM]: 'Cajero automático' };
export const DENOM_DEFECTO = [10000, 20000, 50000, 100000];
export const DENOMINACIONES = [2000, 5000, 10000, 20000, 50000, 100000];
export const MAX_GAVETAS = 8;
export const MAX_MB_TIRILLA = 8;
export const MAX_ATM_UI = 6;
export const MAX_CHEQUES = 50;
export const REV = { NOVEDAD: 'NOVEDAD SOPORTE', CORREGIDO: 'CORREGIDO', OK: 'OK' };
export const DIFE = { PENDIENTE: 'PENDIENTE EXPLICACION', RECUPERADO: 'RECUPERADO', NO_RECUPERADO: 'NO RECUPERADO', CRUZADO: 'CRUZADO / COMPENSADO', NO_CRUZADO: 'NO COMPENSADO' };
export const TIPOS_ARQUEO = ['Arqueo de Control', 'Arqueo Fin de Mes', 'Arqueo de Supervisión'];

// ===================== FORMATO =====================
/** Pesos colombianos: $ 1.234.567 (con signo − si es negativo). */
export const cop = (v) => { const x = Number(v) || 0; return (x < 0 ? '−' : '') + '$ ' + fmtNum(Math.abs(x)); };
/** Diferencia con signo explícito: +$ 5.000 / −$ 5.000 / $ 0. */
export const copSigned = (v) => { const x = Number(v) || 0; return (x > 0 ? '+' : x < 0 ? '−' : '') + '$ ' + fmtNum(Math.abs(x)); };
export const usd = (v) => { const x = Number(v) || 0; return (x < 0 ? '−' : '') + 'US$ ' + Math.abs(x).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
/** Valor numérico tolerante (igual a n() de V1). */
export function n(v) { const x = parseFloat(String(v === undefined || v === null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(x) ? 0 : x; }
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export function mesNombre(mes) { if (!mes || mes === 'TODOS') return 'Todos los meses'; const [y, m] = String(mes).split('-'); return (MESES[parseInt(m, 10) - 1] || mes) + ' ' + y; }
/** 'yyyy-MM-dd' con la fecha LOCAL (no toISOString, que adelanta el día después de las 7 p. m.). */
export function fechaLocalISO(d) { const z = (x) => String(x).padStart(2, '0'); return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()); }
export const mesLocal = () => fechaLocalISO(new Date()).slice(0, 7);
export const fechaLarga = (iso) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
/** Tono semántico de una diferencia: bad (faltante) · warn (sobrante) · ok. */
export const tonoDif = (v) => (v < 0 ? 'bad' : v > 0 ? 'warn' : 'ok');
export const novDif = (v) => (v < 0 ? 'Faltante' : v > 0 ? 'Sobrante' : 'Sin novedad');

// ===================== LLAMADAS CON MEMORIA (FCACHE de V1) =====================
// Evita repetir consultas al cambiar de pestaña. Se vacía tras cualquier escritura y con «Actualizar».
const FCACHE = {};
const FCACHE_TTL = 180000; // 3 min
export async function llamar(clave, fn, ...args) {
  const h = clave && FCACHE[clave];
  if (h && Date.now() - h.t < FCACHE_TTL) return h.v;
  const v = await gas(fn, ...args);
  if (clave && v !== null && v !== undefined && !(v && (v.error || v.success === false))) FCACHE[clave] = { t: Date.now(), v };
  return v;
}
export function invalidarFront() { Object.keys(FCACHE).forEach((k) => delete FCACHE[k]); }
/** ¿El error es porque la función aún no está migrada en el servidor? */
export const noDisponible = (e) => !!(e && /Función no disponible/i.test(e.message || ''));

/** Hook de consulta: { data, error, loading, reload }. `deps` relanza la consulta. */
export function useLlamada(clave, fn, args, deps = []) {
  const [st, setSt] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let vivo = true;
    setSt((s) => ({ ...s, loading: true, error: null }));
    llamar(clave, fn, ...args).then((data) => vivo && setSt({ data, error: null, loading: false }))
      .catch((error) => vivo && setSt({ data: null, error, loading: false }));
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, fn, tick, ...deps]);
  return { ...st, reload: () => setTick((t) => t + 1) };
}

/** Lee un archivo como { fileName, mimeType, base64 } (igual que FileReader de V1). */
export function leerArchivo(f, mimeDefecto) {
  return new Promise((resolve, reject) => {
    const rd = new FileReader();
    rd.onload = (e) => resolve({ fileName: f.name, mimeType: f.type || mimeDefecto || 'application/octet-stream', base64: String(e.target.result).split(',')[1] });
    rd.onerror = () => reject(new Error('No fue posible leer ' + f.name));
    rd.readAsDataURL(f);
  });
}
export const pesoMB = (b) => (b / 1024 / 1024).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' MB';

// ===================== CONTEXTO DE LA APP =====================
export const AqCtx = createContext(null);
export const useAq = () => useContext(AqCtx);

// ===================== PIEZAS VISUALES =====================
/** Chip de estado. tone: ok | bad | warn | info | navy | mute | violet(→ cian oscuro) */
export const Chip = ({ tone = 'mute', icon, children, title }) => (
  <span className={'aq-chip ' + tone} title={title}>{icon && <Icon name={icon} />}{children}</span>
);

export function Spinner({ label }) {
  return <div className="aq-spin-row" role="status"><span className="aq-spin" />{label && <span>{label}</span>}</div>;
}

export function Empty({ icon = 'inbox', title, children, tone }) {
  return (
    <div className={'aq-empty ' + (tone || '')}>
      <span className="aq-empty-ic"><Icon name={icon} /></span>
      <b>{title}</b>
      {children && <p>{children}</p>}
    </div>
  );
}

/** Aviso con borde lateral. tone: info | warn | bad | ok | navy */
export function Note({ tone = 'info', icon, title, children, className = '' }) {
  return (
    <div className={'aq-note ' + tone + ' ' + className}>
      {icon && <span className="aq-note-ic"><Icon name={icon} /></span>}
      <div>{title && <b className="aq-note-t">{title}</b>}{children && <div className="aq-note-b">{children}</div>}</div>
    </div>
  );
}

/** Error de servidor o función aún sin migrar (404 «Función no disponible»). */
export function ErrorBox({ error, onRetry }) {
  if (noDisponible(error)) {
    return (
      <Note tone="warn" icon="clock" title="Servicio en migración">
        Esta función de Control de Arqueos todavía se está portando al servidor del portal ({String(error.message).replace(/^.*: /, '')}). Vuelva a intentarlo en unos minutos.
        {onRetry && <div style={{ marginTop: 10 }}><button className="btn btn-o btn-sm" onClick={onRetry}>Reintentar</button></div>}
      </Note>
    );
  }
  return (
    <Note tone="bad" icon="alert" title="Error del sistema">
      {error && error.message ? error.message : String(error)}
      {onRetry && <div style={{ marginTop: 10 }}><button className="btn btn-o btn-sm" onClick={onRetry}>Reintentar</button></div>}
    </Note>
  );
}

/** Esqueleto de tabla para estados de carga. */
export function SkeletonRows({ rows = 6, head = true }) {
  return (
    <div className="aq-sk" aria-busy="true" aria-label="Cargando">
      {head && <div className="sk sk-line w30" style={{ height: 14, marginBottom: 16 }} />}
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="sk sk-row" style={{ marginBottom: 8 }} />)}
    </div>
  );
}

/** Campo con etiqueta accesible. */
export function F({ label, req, hint, children, className = '', htmlFor }) {
  return (
    <div className={'aq-f ' + className}>
      {label && <label className="aq-lbl" htmlFor={htmlFor}>{label}{req && <span className="aq-req" aria-hidden="true">*</span>}</label>}
      {children}
      {hint && <p className="aq-hint">{hint}</p>}
    </div>
  );
}

/** Entrada de dinero COP con separador de miles. `value` es el texto de dígitos ('' = vacío). */
export function MoneyInput({ value, onChange, id, ariaLabel, prefix = '$', placeholder = '0', strong }) {
  const shown = value === '' || value === null || value === undefined ? '' : fmtNum(Number(value));
  return (
    <div className={'aq-money' + (strong ? ' strong' : '')}>
      <span className="aq-money-p">{prefix}</span>
      <input id={id} aria-label={ariaLabel} inputMode="numeric" autoComplete="off" placeholder={placeholder} value={shown}
        onChange={(e) => { const d = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, ''); onChange(d); }} />
    </div>
  );
}

/** Modal propio del módulo (mismo estilo que el modal del portal, con ancho configurable). */
export function AqModal({ title, icon, tone = 'navy', sub, right, wide, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', k);
    const prev = document.activeElement;
    ref.current && ref.current.focus();
    const ov = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', k); document.body.style.overflow = ov; prev && prev.focus && prev.focus(); };
  }, [onClose]);
  return (
    <div className="modal-bg aq-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'modal aq-modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="modal-h aq-modal-h">
          <div className="aq-modal-title">
            {icon && <span className={'aq-modal-ic ' + tone}><Icon name={icon} /></span>}
            <div><h3>{title}</h3>{sub && <p>{sub}</p>}</div>
          </div>
          <div className="aq-modal-right">{right}<button ref={ref} className="btn btn-g btn-sm" onClick={onClose} aria-label="Cerrar"><Icon name="x" /><span className="aq-hide-sm">Cerrar</span></button></div>
        </div>
        <div className="modal-b aq-modal-b">{children}</div>
      </div>
    </div>
  );
}

/** Mensaje de estado de un formulario (éxito / error / progreso). */
export function Msg({ msg }) {
  if (!msg || !msg.text) return <span className="aq-sr" aria-live="polite" />;
  return <p className={'aq-msg ' + (msg.tone || '')} aria-live="polite">{msg.tone === 'busy' && <span className="aq-spin sm" />}{msg.text}</p>;
}

/** Botón con estado de carga. */
export function BusyBtn({ busy, className = 'btn btn-p', children, ...p }) {
  return <button {...p} className={className + (busy ? ' loading' : '')} disabled={busy || p.disabled}>{busy ? <span className="aq-spin sm light" /> : null}{children}</button>;
}

/** Interruptor accesible (checkbox estilizado). */
export function Check({ checked, onChange, children, id, disabled, tone }) {
  return (
    <label className={'aq-check' + (checked ? ' on' : '') + (disabled ? ' dis' : '') + (tone ? ' ' + tone : '')} htmlFor={id}>
      <input type="checkbox" id={id} checked={!!checked} disabled={disabled} onChange={(e) => onChange && onChange(e.target.checked)} />
      <span className="aq-check-box" aria-hidden="true"><Icon name="check" /></span>
      <span className="aq-check-t">{children}</span>
    </label>
  );
}

/** Grupo de opciones tipo radio en píldoras. */
export function RadioPills({ name, value, options, onChange, ariaLabel }) {
  return (
    <div className="aq-pills" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => {
        const v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o;
        return (
          <label key={v} className={'aq-pill' + (value === v ? ' on' : '')}>
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />{t}
          </label>
        );
      })}
    </div>
  );
}

/** Enlace a un documento generado (abre en pestaña nueva). */
export const DocLink = ({ href, icon = 'file', children, tone }) => (
  <a className={'aq-doclink ' + (tone || '')} href={href} target="_blank" rel="noopener noreferrer"><Icon name={icon} />{children}</a>
);

/** Ícono «más» (no existe en el set de íconos del portal). */
export const Plus = () => <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
