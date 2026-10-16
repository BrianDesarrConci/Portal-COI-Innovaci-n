import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';
import BrandMarks from './BrandMarks.jsx';
import { useOverlay } from '../components/Overlays.jsx';
import Constellation from './login/Constellation.jsx';
import OtpInput from './login/OtpInput.jsx';
import { CoiMark, Counters, Ticker } from './login/StageParts.jsx';
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
  const vizRef = useRef(null);
  const enteredRef = useRef(false);

  const later = useCallback((fn, ms) => { timers.current.push(window.setTimeout(fn, ms)); }, []);
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const firstName = (user?.name || '').split(' ')[0];
  const hello = useMemo(() => greeting(), []);
  const code = digits.join('');
  const complete = code.length === CODE_LEN;
  const step = phase === 'account' || phase === 'validating' ? 1 : 2;

  const startAccount = () => {
    if (phase !== 'account') return;
    setPhase('validating');
    later(() => setPhase('code'), reducedMotion() ? 200 : 850);
  };

  const verify = useCallback(() => {
    if (phase !== 'code') return;
    if (!complete) { setError(`Ingrese los ${CODE_LEN} dígitos del código.`); return; }
    setError('');
    setPhase('verifying');
    const fast = reducedMotion();
    later(() => setPhase('success'), fast ? 300 : 1100);
    later(() => setPhase('leaving'), fast ? 900 : 2100);
    later(() => { if (!enteredRef.current) { enteredRef.current = true; onEnter(); } }, fast ? 1100 : 2850);
  }, [phase, complete, later, onEnter]);

  // Envío automático al completar los 6 dígitos.
  useEffect(() => {
    if (phase === 'code' && complete) { const id = window.setTimeout(verify, 220); return () => window.clearTimeout(id); }
    return undefined;
  }, [phase, complete, verify]);

  useEffect(() => { if (phase === 'code') otpRef.current?.focus(digits.findIndex((d) => !d) === -1 ? CODE_LEN - 1 : digits.findIndex((d) => !d)); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const back = () => { setDigits(EMPTY); setError(''); setPhase('account'); window.setTimeout(() => continueRef.current?.focus(), 0); };
  const onDigits = (next) => { setDigits(next); if (error) setError(''); };

  const status = {
    account: '',
    validating: 'Validando la cuenta corporativa.',
    code: `Primera llave validada. Ingrese el código de ${CODE_LEN} dígitos.`,
    verifying: 'Verificando el código.',
    success: 'Identidad verificada. Abriendo COI.',
    leaving: 'Identidad verificada. Abriendo COI.',
  }[phase];

  return (
    <div className={'lx' + (phase === 'leaving' ? ' is-leaving' : '')}>
      {/* ---------- Escenario de marca ---------- */}
      <section className="lx-stage" aria-labelledby="lx-title">
        <div className="lx-dots" aria-hidden="true" />
        <Constellation className="lx-canvas" anchorRef={vizRef} />
        <div className="lx-scrim" aria-hidden="true" />

        <header className="lx-top">
          <BrandMarks size="lg" />
          <span className="lx-env"><span className="lx-env-dot" aria-hidden="true" />Plataforma corporativa</span>
        </header>

        <div className="lx-viz" ref={vizRef} aria-hidden="true" />

        <div className="lx-hero">
          <div className="lx-lock">
            <CoiMark size={44} />
            <span className="lx-lock-name">COI</span>
            <span className="lx-lock-sep" aria-hidden="true" />
            <span className="lx-lock-tag">Gestión y Monitoreo<br />de Apoyo al Negocio</span>
          </div>
          <p className="lx-eyebrow">Gerencia de Gestión del Negocio</p>
          <h1 id="lx-title" className="lx-h1">Toda la operación, <span className="lx-grad">medida y a la vista.</span></h1>
          <p className="lx-lede">16 clientes y 104 actividades en un solo lugar, con acuerdos de servicio medidos en tiempo real y evidencia de cada paso.</p>
        </div>

        <div className="lx-bottom">
          <Counters />
          <Ticker />
        </div>
      </section>

      {/* ---------- Acceso ---------- */}
      <main className="lx-side">
        <div className="lx-card" data-phase={phase}>
          <div className="lx-card-head">
            <span className="lx-secure"><Icon name="lock" />Acceso seguro</span>
            <span className="lx-stepof num" aria-hidden="true">Paso {step} de 2</span>
          </div>

          <h2 className="lx-hello">{hello}, {firstName}</h2>
          <p className="lx-intro">Ingrese con su cuenta corporativa. Los módulos visibles dependen de su rol.</p>

          <div className="lx-acct">
            <span className="lx-avatar" aria-hidden="true">{user.initials}</span>
            <div className="lx-acct-id">
              <div className="lx-acct-name">{user.name}</div>
              <div className="lx-acct-mail">{user.email}</div>
            </div>
            <span className="lx-role">{user.role}</span>
          </div>

          <div className="lx-keys" role="group" aria-label="Las Dos Llaves Universales">
            <div className="lx-keys-title"><Icon name="shield" />Las Dos Llaves Universales</div>
            <ol className="lx-steps">
              <li className={step > 1 ? 'done' : 'current'} aria-current={step === 1 ? 'step' : undefined}>
                <span className="lx-step-n">{step > 1 ? <Icon name="check" /> : '1'}</span>
                <span className="lx-step-t"><span className="lx-step-k">Llave 1</span><span className="lx-step-l">Cuenta corporativa</span></span>
              </li>
              <li className={phase === 'success' || phase === 'leaving' ? 'done' : step === 2 ? 'current' : ''} aria-current={step === 2 ? 'step' : undefined}>
                <span className="lx-step-n">{phase === 'success' || phase === 'leaving' ? <Icon name="check" /> : '2'}</span>
                <span className="lx-step-t"><span className="lx-step-k">Llave 2</span><span className="lx-step-l">Código de verificación</span></span>
              </li>
            </ol>
            <div className="lx-progress" aria-hidden="true"><span style={{ transform: `scaleX(${phase === 'success' || phase === 'leaving' ? 1 : step === 2 ? 0.5 : phase === 'validating' ? 0.25 : 0.04})` }} /></div>
          </div>

          <div className="lx-panel-wrap">
            {step === 1 && (
              <div className="lx-panel" key="p1">
                <button ref={continueRef} type="button" className={'lx-btn lx-btn-primary' + (phase === 'validating' ? ' is-busy' : '')}
                  onClick={startAccount} aria-disabled={phase === 'validating'}>
                  <span className="lx-btn-label">{phase === 'validating' ? 'Validando cuenta' : 'Continuar con cuenta corporativa'}</span>
                  {phase === 'validating' ? <span className="lx-spin" aria-hidden="true" /> : <Icon name="chevron" className="lx-btn-ic" />}
                </button>
                <div className="lx-or"><span>o</span></div>
                <button type="button" className="lx-btn lx-btn-ghost" disabled={phase === 'validating'}
                  onClick={() => toast('En producción se abre el selector de cuentas corporativas.')}>Usar otra cuenta</button>
                <p className="lx-note"><Icon name="lock" />Después de su cuenta corporativa, confirmará su identidad con un código temporal de {CODE_LEN} dígitos.</p>
              </div>
            )}

            {(phase === 'code' || phase === 'verifying') && (
              <form className="lx-panel" key="p2" noValidate onSubmit={(e) => { e.preventDefault(); verify(); }}>
                <div className="lx-code-head">
                  <span id="lx-code-l" className="lx-code-l">Código de verificación</span>
                  <button type="button" className="lx-link" onClick={back} disabled={phase === 'verifying'}><Icon name="back" />Volver</button>
                </div>
                <p id="lx-code-d" className="lx-code-d">Ingrese el código de {CODE_LEN} dígitos generado por su autenticador corporativo.</p>
                <OtpInput ref={otpRef} digits={digits} onChange={onDigits} onSubmit={verify}
                  disabled={phase === 'verifying'} invalid={!!error} labelledBy="lx-code-l" describedBy="lx-code-d lx-code-hint" />
                {error ? <p className="lx-err" role="alert"><Icon name="alert" />{error}</p>
                  : <p id="lx-code-hint" className="lx-hint"><Icon name="sparkle" />Código de demostración: cualquier combinación de {CODE_LEN} dígitos</p>}
                <button type="submit" className={'lx-btn lx-btn-primary' + (phase === 'verifying' ? ' is-busy' : '')} aria-disabled={phase === 'verifying'}>
                  <span className="lx-btn-label">{phase === 'verifying' ? 'Verificando código' : 'Verificar e ingresar'}</span>
                  {phase === 'verifying' ? <span className="lx-spin" aria-hidden="true" /> : <Icon name="chevron" className="lx-btn-ic" />}
                </button>
              </form>
            )}

            {(phase === 'success' || phase === 'leaving') && (
              <div className="lx-panel lx-success" key="p3">
                <svg className="lx-check" viewBox="0 0 64 64" aria-hidden="true">
                  <circle className="lx-check-ring" cx="32" cy="32" r="29" />
                  <path className="lx-check-tick" d="M20 33.5l8 8 16-17" />
                </svg>
                <div>
                  <div className="lx-success-t">Identidad verificada</div>
                  <div className="lx-success-d">Preparando su tablero de control…</div>
                </div>
              </div>
            )}
          </div>

          <p className="lx-sr" role="status" aria-live="polite">{status}</p>
        </div>

        <footer className="lx-foot">
          <ul className="lx-trust">
            <li><Icon name="usercheck" />Sesión única</li>
            <li><Icon name="lock" />Las Dos Llaves Universales</li>
            <li><Icon name="list" />Actividad registrada en bitácora</li>
          </ul>
          <p className="lx-help">¿Problemas para ingresar? Radique una solicitud en <b>TRAZA</b></p>
          <p className="lx-copy">© 2026 Reval S.A.S. y Multipagas S.A.S. Uso interno.</p>
        </footer>
      </main>

      {/* ---------- Transición de marca ---------- */}
      {phase === 'leaving' && (
        <div className="lx-curtain" aria-hidden="true">
          <div className="lx-curtain-mark">
            <CoiMark size={72} />
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
