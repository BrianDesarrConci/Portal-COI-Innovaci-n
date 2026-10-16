import { useState } from 'react';
import Icon from '../components/Icon.jsx';
import BrandMarks from './BrandMarks.jsx';
import { useOverlay } from '../components/Overlays.jsx';

export default function Login({ user, onEnter }) {
  const [loading, setLoading] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const { toast } = useOverlay();
  const enter = () => {
    setLoading(true);
    setTimeout(() => { setLeaving(true); setTimeout(onEnter, 380); }, 900);
  };
  return (
    <div className={'login' + (leaving ? ' leaving' : '')}>
      <section className="login-brand">
        <svg className="lg-grid" aria-hidden="true"><defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.2" /></pattern></defs><rect width="100%" height="100%" fill="url(#dots)" /></svg>
        <svg className="lg-rings" viewBox="0 0 600 600" aria-hidden="true">
          <circle cx="300" cy="300" r="290" /><circle cx="300" cy="300" r="236" /><circle cx="300" cy="300" r="182" /><circle cx="300" cy="300" r="128" /><circle cx="300" cy="300" r="74" />
          <circle className="arc-c" cx="300" cy="300" r="236" strokeDasharray="260 1223" />
          <circle className="arc-g" cx="300" cy="300" r="128" strokeDasharray="150 654" strokeDashoffset="-330" />
          <circle className="node c" cx="503" cy="178" r="7" /><circle className="node g" cx="190" cy="408" r="6" /><circle className="node" cx="300" cy="64" r="4" />
        </svg>
        <div className="lb-top"><BrandMarks size="lg" /><span className="env">Plataforma corporativa</span></div>
        <div className="lb-mid">
          <p className="lb-k">Gerencia de Gestión del Negocio</p>
          <div className="prod-lock"><span className="prod-name">COI</span><span className="prod-tag">Gestión y Monitoreo<br />de Apoyo al Negocio</span></div>
          <p className="lb-sub">La operación de 16 clientes y 104 actividades en un solo lugar, con acuerdos de servicio medidos y evidencia de cada paso.</p>
          <ul className="lb-feats">
            <li><span><Icon name="activity" /></span><div><b>Monitoreo en tiempo real</b><small>Tablero gerencial diario, mensual, trimestral y semestral</small></div></li>
            <li><span><Icon name="shield" /></span><div><b>ANS y evaluaciones por cliente</b><small>Versión vigente de cada acuerdo y su medición</small></div></li>
            <li><span><Icon name="sparkle" /></span><div><b>Procesos automatizados</b><small>Validación documental, alertas, reportería y facturación</small></div></li>
          </ul>
        </div>
        <div className="lb-foot">© 2026 Reval S.A.S. y Multipagas S.A.S. Uso interno.</div>
      </section>
      <section className="login-side">
        <div className="login-card">
          <div className="lc-mark"><Icon name="lock" /></div>
          <h2>Iniciar sesión en COI</h2>
          <p className="muted">Ingrese con su cuenta corporativa. Los módulos visibles dependen de su rol.</p>
          <div className="acct">
            <span className="avatar">{user.initials}</span>
            <div className="grow"><div className="strong">{user.name}</div><div className="small muted">{user.email}</div></div>
            <span className="role-pill">{user.role}</span>
          </div>
          <button className={'btn btn-p btn-lg btn-block' + (loading ? ' loading' : '')} disabled={loading} onClick={enter}>
            <span className="btn-label">{loading ? 'Verificando credenciales' : 'Continuar con cuenta corporativa'}</span><span className="spinner" aria-hidden="true" />
          </button>
          <div className="or"><span>o</span></div>
          <button className="btn btn-o btn-block" type="button" onClick={() => toast('En producción se abre el selector de cuentas corporativas.')}>Usar otra cuenta</button>
          <div className="lc-sec">
            <Icon name="shield" />
            <span>Sesión única protegida con el estándar Las Dos Llaves Universales. Su actividad queda registrada en la bitácora.</span>
          </div>
        </div>
        <div className="login-links"><span>¿Problemas para ingresar? Radique una solicitud en TRAZA</span></div>
      </section>
    </div>
  );
}
