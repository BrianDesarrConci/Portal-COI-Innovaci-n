import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import BrandMarks from './BrandMarks.jsx';
import { useOverlay } from '../components/Overlays.jsx';
import OtpInput from './login/OtpInput.jsx';
import { api } from '../lib/api.js';
import './login/login.css';

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'Buenos días';
  if (h >= 12 && h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const FACTS = [['16', 'Clientes con ANS'], ['104', 'Actividades monitoreadas'], ['11', 'Procesos transversales']];
const PILARES = [
  ['activity', 'Monitoreo de la operación', 'Tablero gerencial diario, mensual y por periodo.'],
  ['shield', 'Acuerdos de servicio medidos', 'Cumplimiento de ANS y evaluaciones por cliente.'],
  ['list', 'Trazabilidad completa', 'Evidencia y bitácora de cada actividad.']
];

/** Marca de producto tipográfica: "COI" con el punto cian de la marca. */
const Wordmark = ({ size = 30 }) => <span className="lx-wordmark" style={{ fontSize: size }}>COI<i aria-hidden="true" /></span>;

const vacio = (n) => Array(n).fill('');
const inicialesDe = (s) => String(s || '').split(/[\s._@-]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'U';

/**
 * Ingreso a COI en dos pasos (Las Dos Llaves Universales), contra /api/auth.
 * Con DA: usuario y clave → código de verificación (si DA lo exige). En la demo: cuenta fija + código.
 * Fases: account → validating → code → verifying → success → leaving → onEnter(usuario).
 */
export default function Login({ config, onEnter }) {
  const { toast } = useOverlay();
  const pideCredenciales = (config.campos || []).includes('usuario');
  const cuenta = config.cuenta || null;
  const [phase, setPhase] = useState('account');
  const [codeLen, setCodeLen] = useState(config.codigo?.longitud || 6);
  const [digits, setDigits] = useState(() => vacio(config.codigo?.longitud || 6));
  const [error, setError] = useState('');
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [desafio, setDesafio] = useState(null);
  const [entrante, setEntrante] = useState(null);
  const timers = useRef([]);
  const otpRef = useRef(null);
  const continueRef = useRef(null);
  const userRef = useRef(null);
  const enteredRef = useRef(false);
  const CODE_LEN = codeLen;

  const later = useCallback((fn, ms) => { timers.current.push(window.setTimeout(fn, ms)); }, []);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const firstName = (cuenta?.nombre || '').split(' ')[0];
  const hello = useMemo(() => greeting(), []);
  const acct = cuenta || (usuario ? { nombre: usuario, correo: 'Cuenta corporativa DA', iniciales: inicialesDe(usuario) } : null);
  const complete = digits.join('').length === CODE_LEN;
  const step = phase === 'account' || phase === 'validating' ? 1 : 2;
  const verified = phase === 'success' || phase === 'leaving';

  // Animación de entrada al portal una vez el servidor abre la sesión.
  const finish = useCallback((u) => {
    setEntrante(u);
    const fast = reducedMotion();
    setPhase('success');
    later(() => setPhase('leaving'), fast ? 450 : 800);
    later(() => { if (!enteredRef.current) { enteredRef.current = true; onEnter(u); } }, fast ? 650 : 1350);
  }, [later, onEnter]);

  const startAccount = async () => {
    if (phase !== 'account') return;
    if (pideCredenciales && (!usuario.trim() || !clave)) { setError('Ingrese su usuario y su clave.'); (usuario.trim() ? null : userRef.current)?.focus(); return; }
    setError('');
    setPhase('validating');
    const t0 = Date.now();
    try {
      const r = await api.post('/api/auth/login', pideCredenciales ? { usuario: usuario.trim(), clave } : {});
      await new Promise((ok) => later(ok, Math.max(0, (reducedMotion() ? 150 : 600) - (Date.now() - t0))));
      if (r.usuario) { setClave(''); finish(r.usuario); return; }
      const n = r.longitud || 6;
      setDesafio({ token: r.desafio, destino: r.destino });
      setCodeLen(n); setDigits(vacio(n));
      setClave('');
      setPhase('code');
    } catch (e) {
      setError(e.message);
      setPhase('account');
    }
  };

  const verify = useCallback(async () => {
    if (phase !== 'code') return;
    if (!complete) { setError(`Ingrese los ${CODE_LEN} dígitos del código.`); return; }
    setError('');
    setPhase('verifying');
    try {
      const r = await api.post('/api/auth/verificar', { desafio: desafio?.token, codigo: digits.join('') });
      finish(r.usuario);
    } catch (e) {
      if (e.data?.reiniciar) { setDigits(vacio(CODE_LEN)); setError(e.message); setPhase('account'); return; }
      setDigits(vacio(CODE_LEN)); setError(e.message); setPhase('code');
      window.setTimeout(() => otpRef.current?.focus(0), 0);
    }
  }, [phase, complete, CODE_LEN, desafio, digits, finish]);

  // Envío automático al completar los 6 dígitos.
  useEffect(() => {
    if (phase === 'code' && complete) { const id = window.setTimeout(verify, 200); return () => window.clearTimeout(id); }
    return undefined;
  }, [phase, complete, verify]);

  useEffect(() => {
    if (phase !== 'code') return;
    const i = digits.findIndex((d) => !d);
    otpRef.current?.focus(i === -1 ? CODE_LEN - 1 : i);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = () => {
    setDigits(vacio(CODE_LEN)); setError(''); setDesafio(null); setPhase('account');
    window.setTimeout(() => (pideCredenciales ? userRef.current : continueRef.current)?.focus(), 0);
  };
  const onDigits = (next) => { setDigits(next); if (error) setError(''); };

  const status = {
    account: '',
    validating: 'Validando la cuenta corporativa.',
    code: `Cuenta validada. Ingrese el código de ${CODE_LEN} dígitos.`,
    verifying: 'Verificando el código.',
    success: 'Identidad verificada. Abriendo COI.',
    leaving: 'Identidad verificada. Abriendo COI.',
  }[phase];

  const stepCls = (n) => (n < step || verified ? 'done' : n === step ? 'current' : '');

  return (
    <div className={'lx' + (phase === 'leaving' ? ' is-leaving' : '')}>
      {/* ---------- Panel institucional ---------- */}
      <section className="lx-stage" aria-labelledby="lx-title">
        <header className="lx-top"><BrandMarks size="lg" /></header>

        <div className="lx-hero">
          <div className="lx-lock">
            <Wordmark />
            <span className="lx-lock-sep" aria-hidden="true" />
            <span className="lx-lock-tag">Gestión y Monitoreo<br />de Apoyo al Negocio</span>
          </div>
          <p className="lx-eyebrow">Gerencia de Gestión del Negocio</p>
          <h1 id="lx-title" className="lx-h1">Operación, servicio y cumplimiento en un solo lugar.</h1>
          <p className="lx-lede">Plataforma para gestionar y medir los acuerdos de servicio de Reval S.A.S. y Multipagas S.A.S. con sus clientes.</p>
          <ul className="lx-pillars">
            {PILARES.map(([ic, t, d]) => (
              <li key={t}><span className="lx-pillar-ic"><Icon name={ic} /></span><div><b>{t}</b><small>{d}</small></div></li>
            ))}
          </ul>
          <dl className="lx-facts">
            {FACTS.map(([n, l]) => (
              <div key={l}><dt className="num">{n}</dt><dd>{l}</dd></div>
            ))}
          </dl>
        </div>

        <footer className="lx-stage-foot">
          <span>© 2026 Reval S.A.S. · Multipagas S.A.S.</span>
          <span>Uso interno · Información confidencial</span>
        </footer>
      </section>

      {/* ---------- Acceso ---------- */}
      <main className="lx-side">
        <div className="lx-card" data-phase={phase}>
          <div className="lx-card-head">
            <h2 className="lx-title">Iniciar sesión</h2>
            <span className="lx-stepof num" aria-hidden="true">Paso {step} de 2</span>
          </div>
          <p className="lx-intro">{hello}{firstName ? ', ' + firstName : ''}. Ingrese con su cuenta corporativa; los módulos visibles dependen de su rol.</p>

          <ol className="lx-steps" aria-label="Las Dos Llaves Universales">
            <li className={stepCls(1)} aria-current={step === 1 ? 'step' : undefined}><span className="lx-step-bar" /><span className="lx-step-l">{stepCls(1) === 'done' && <Icon name="check" />}Cuenta corporativa</span></li>
            <li className={stepCls(2)} aria-current={step === 2 ? 'step' : undefined}><span className="lx-step-bar" /><span className="lx-step-l">{stepCls(2) === 'done' && <Icon name="check" />}Código de verificación</span></li>
          </ol>

          {acct && (cuenta || step === 2 || verified) && (
            <div className="lx-acct">
              <span className="lx-avatar" aria-hidden="true">{(entrante && entrante.iniciales) || acct.iniciales}</span>
              <div className="lx-acct-id">
                <div className="lx-acct-name">{(entrante && entrante.nombre) || acct.nombre}</div>
                <div className="lx-acct-mail">{(entrante && entrante.correo) || acct.correo}</div>
              </div>
              {((entrante && entrante.cargo) || acct.cargo) && <span className="lx-role">{(entrante && entrante.cargo) || acct.cargo}</span>}
            </div>
          )}

          {step === 1 && !pideCredenciales && (
            <div className="lx-panel" key="p1">
              {error && <p className="lx-msg lx-err" role="alert"><Icon name="alert" />{error}</p>}
              <button ref={continueRef} type="button" className={'lx-btn' + (phase === 'validating' ? ' is-busy' : '')}
                onClick={startAccount} aria-disabled={phase === 'validating'}>
                {phase === 'validating' ? <><span className="lx-spin" aria-hidden="true" />Validando cuenta</> : 'Continuar con cuenta corporativa'}
              </button>
              <button type="button" className="lx-link lx-other" disabled={phase === 'validating'}
                onClick={() => toast('En producción el ingreso se hace con su usuario y clave de DA.')}>Usar otra cuenta</button>
            </div>
          )}

          {step === 1 && pideCredenciales && (
            <form className="lx-panel" key="p1c" noValidate onSubmit={(e) => { e.preventDefault(); startAccount(); }}>
              <label className="lx-field">
                <span>Usuario corporativo</span>
                <input ref={userRef} name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} autoFocus
                  value={usuario} onChange={(e) => { setUsuario(e.target.value); if (error) setError(''); }} disabled={phase === 'validating'} aria-invalid={!!error} />
              </label>
              <label className="lx-field">
                <span>Clave</span>
                <input name="password" type="password" autoComplete="current-password"
                  value={clave} onChange={(e) => { setClave(e.target.value); if (error) setError(''); }} disabled={phase === 'validating'} aria-invalid={!!error} />
              </label>
              {error ? <p className="lx-msg lx-err" role="alert"><Icon name="alert" />{error}</p> : <p className="lx-msg">Use las mismas credenciales de los aplicativos corporativos (DA).</p>}
              <button ref={continueRef} type="submit" className={'lx-btn' + (phase === 'validating' ? ' is-busy' : '')} aria-disabled={phase === 'validating'}>
                {phase === 'validating' ? <><span className="lx-spin" aria-hidden="true" />Validando cuenta</> : 'Continuar'}
              </button>
            </form>
          )}

          {(phase === 'code' || phase === 'verifying') && (
            <form className="lx-panel" key="p2" noValidate onSubmit={(e) => { e.preventDefault(); verify(); }}>
              <p id="lx-code-l" className="lx-code-l">Código de verificación</p>
              <p id="lx-code-d" className="lx-code-d">Ingrese el código de {CODE_LEN} dígitos {desafio?.destino ? <>enviado a <b>{desafio.destino}</b></> : 'generado por su autenticador corporativo'}.</p>
              <OtpInput ref={otpRef} digits={digits} onChange={onDigits} onSubmit={verify}
                disabled={phase === 'verifying'} invalid={!!error} labelledBy="lx-code-l" describedBy="lx-code-d lx-code-hint" />
              {error
                ? <p className="lx-msg lx-err" role="alert"><Icon name="alert" />{error}</p>
                : <p id="lx-code-hint" className="lx-msg">{config.aviso || 'El código vence en 5 minutos.'}</p>}
              <button type="submit" className={'lx-btn' + (phase === 'verifying' ? ' is-busy' : '')} aria-disabled={phase === 'verifying'}>
                {phase === 'verifying' ? <><span className="lx-spin" aria-hidden="true" />Verificando</> : 'Verificar e ingresar'}
              </button>
              <button type="button" className="lx-link lx-other" onClick={back} disabled={phase === 'verifying'}>Cambiar de cuenta</button>
            </form>
          )}

          {verified && (
            <div className="lx-panel lx-success" key="p3">
              <svg className="lx-check" viewBox="0 0 48 48" aria-hidden="true">
                <circle className="lx-check-ring" cx="24" cy="24" r="21" />
                <path className="lx-check-tick" d="M15 24.5l6 6 12-13" />
              </svg>
              <div>
                <div className="lx-success-t">Identidad verificada</div>
                <div className="lx-success-d">Abriendo su tablero de control.</div>
              </div>
            </div>
          )}

          <div className="lx-card-foot">
            <Icon name="shield" />
            <span>Protegido con <b>Las Dos Llaves Universales</b>. Sesión única; su actividad queda registrada en la bitácora.</span>
          </div>
          <p className="lx-sr" role="status" aria-live="polite">{status}</p>
        </div>

        <p className="lx-help">¿Problemas para ingresar? Radique una solicitud en <b>TRAZA</b>.</p>
      </main>

      {/* ---------- Transición ---------- */}
      {phase === 'leaving' && (
        <div className="lx-curtain" aria-hidden="true">
          <div className="lx-curtain-mark">
            <div>
              <div className="lx-curtain-name"><Wordmark size={44} /></div>
              <div className="lx-curtain-tag">Gestión y Monitoreo de Apoyo al Negocio</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
