import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import BrandMarks from './BrandMarks.jsx';
import { useOverlay } from '../components/Overlays.jsx';
import CoiEmblem from './login/CoiEmblem.jsx';
import OtpInput from './login/OtpInput.jsx';
import { CoiMark } from './login/StageParts.jsx';
import './login/login.css';

const CODE_LEN = 6;
const EMPTY = Array(CODE_LEN).fill('');
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function greeting(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'Buenos días';
  if (h >= 12 && h < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

const FACTS = [['16', 'Clientes con ANS'], ['104', 'Actividades monitoreadas'], ['11', 'Procesos transversales']];

/**
 * Ingreso a COI en dos pasos (Las Dos Llaves Universales).
 * Fases: account → validating → code → verifying → success → leaving → onEnter().
 */
export default function Login({ user, onEnter }) {
  const { toast } = useOverlay();
  const [phase, setPhase] = useState('account');
  const [digits, setDigits] = useState(EMPTY);
  const [error, setError] = useState('');
  const timers = useRef([]);
  const otpRef = useRef(null);
  const continueRef = useRef(null);
  const enteredRef = useRef(false);

  const later = useCallback((fn, ms) => { timers.current.push(window.setTimeout(fn, ms)); }, []);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const firstName = (user?.name || '').split(' ')[0];
  const hello = useMemo(() => greeting(), []);
  const complete = digits.join('').length === CODE_LEN;
  const step = phase === 'account' || phase === 'validating' ? 1 : 2;
  const verified = phase === 'success' || phase === 'leaving';

  const startAccount = () => {
    if (phase !== 'account') return;
    setPhase('validating');
    later(() => setPhase('code'), reducedMotion() ? 150 : 700);
  };

  const verify = useCallback(() => {
    if (phase !== 'code') return;
    if (!complete) { setError(`Ingrese los ${CODE_LEN} dígitos del código.`); return; }
    setError('');
    setPhase('verifying');
    const fast = reducedMotion();
    later(() => setPhase('success'), fast ? 250 : 900);
    later(() => setPhase('leaving'), fast ? 700 : 1700);
    later(() => { if (!enteredRef.current) { enteredRef.current = true; onEnter(); } }, fast ? 900 : 2250);
  }, [phase, complete, later, onEnter]);

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

  const back = () => { setDigits(EMPTY); setError(''); setPhase('account'); window.setTimeout(() => continueRef.current?.focus(), 0); };
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

        <div className="lx-mid">
        <div className="lx-hero">
          <div className="lx-lock">
            <CoiMark size={40} />
            <span className="lx-lock-name">COI</span>
            <span className="lx-lock-sep" aria-hidden="true" />
            <span className="lx-lock-tag">Gestión y Monitoreo<br />de Apoyo al Negocio</span>
          </div>
          <h1 id="lx-title" className="lx-h1">Operación, servicio y cumplimiento en un solo lugar.</h1>
          <p className="lx-lede">Plataforma de la Gerencia de Gestión del Negocio para gestionar y medir los acuerdos de servicio con nuestros clientes.</p>
          <dl className="lx-facts">
            {FACTS.map(([n, l]) => (
              <div key={l}><dt className="num">{n}</dt><dd>{l}</dd></div>
            ))}
          </dl>
        </div>
        <div className="lx-art"><CoiEmblem /></div>
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
          <p className="lx-intro">{hello}, {firstName}. Ingrese con su cuenta corporativa; los módulos visibles dependen de su rol.</p>

          <ol className="lx-steps" aria-label="Las Dos Llaves Universales">
            <li className={stepCls(1)} aria-current={step === 1 ? 'step' : undefined}><span className="lx-step-bar" /><span className="lx-step-l">{stepCls(1) === 'done' && <Icon name="check" />}Cuenta corporativa</span></li>
            <li className={stepCls(2)} aria-current={step === 2 ? 'step' : undefined}><span className="lx-step-bar" /><span className="lx-step-l">{stepCls(2) === 'done' && <Icon name="check" />}Código de verificación</span></li>
          </ol>

          <div className="lx-acct">
            <span className="lx-avatar" aria-hidden="true">{user.initials}</span>
            <div className="lx-acct-id">
              <div className="lx-acct-name">{user.name}</div>
              <div className="lx-acct-mail">{user.email}</div>
            </div>
            <span className="lx-role">{user.role}</span>
          </div>

          {step === 1 && (
            <div className="lx-panel" key="p1">
              <button ref={continueRef} type="button" className={'lx-btn' + (phase === 'validating' ? ' is-busy' : '')}
                onClick={startAccount} aria-disabled={phase === 'validating'}>
                {phase === 'validating' ? <><span className="lx-spin" aria-hidden="true" />Validando cuenta</> : 'Continuar con cuenta corporativa'}
              </button>
              <button type="button" className="lx-link lx-other" disabled={phase === 'validating'}
                onClick={() => toast('En producción se abre el selector de cuentas corporativas.')}>Usar otra cuenta</button>
            </div>
          )}

          {(phase === 'code' || phase === 'verifying') && (
            <form className="lx-panel" key="p2" noValidate onSubmit={(e) => { e.preventDefault(); verify(); }}>
              <p id="lx-code-l" className="lx-code-l">Código de verificación</p>
              <p id="lx-code-d" className="lx-code-d">Ingrese el código de {CODE_LEN} dígitos generado por su autenticador corporativo.</p>
              <OtpInput ref={otpRef} digits={digits} onChange={onDigits} onSubmit={verify}
                disabled={phase === 'verifying'} invalid={!!error} labelledBy="lx-code-l" describedBy="lx-code-d lx-code-hint" />
              {error
                ? <p className="lx-msg lx-err" role="alert"><Icon name="alert" />{error}</p>
                : <p id="lx-code-hint" className="lx-msg">Ambiente de demostración: cualquier código de {CODE_LEN} dígitos es válido.</p>}
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
            <CoiMark size={56} />
            <div>
              <div className="lx-curtain-name">COI</div>
              <div className="lx-curtain-tag">Gestión y Monitoreo de Apoyo al Negocio</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
