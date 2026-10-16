// Brain RT (COI V1, sección "brain-rt"): centro de acceso a Oracle Analytics Cloud.
// La contraseña de V1 no se muestra ni se guarda: la gestiona TI y se solicita por TRAZA.
import { useState } from 'react';
import Icon from '../../components/Icon.jsx';
import { useApp } from '../../context/AppContext.jsx';
import { V1Bar, V1Guard } from './V1Session.jsx';
import { V1Hero, Panel, PIcon } from './portal/kit.jsx';

// URLs de abrirBrainRT() y abrirTablero() en js.html.
const OAC = 'https://oacreval-idgsoiclq8pt-ia.analytics.ocp.oraclecloud.com';
const TABLEROS = [
  { k: 'brain', icon: 'brain', title: 'Brain RT', tag: 'Tiempo real', desc: 'Consulta de información transaccional en tiempo real de la red de oficinas.', path: 'PROYECTO RT / BRAIN RT',
    url: OAC + '/ui/dv/?pageid=visualAnalyzer&reportmode=full&reportpath=%2F%40Catalog%2Fshared%2FPROYECTO%20RT%2FBRAIN%20RT' },
  { k: 'panel', icon: 'chart', title: 'Panel de Gestión Transaccional', tag: 'Tablero de control', desc: 'Tablero de control corporativo para el seguimiento de la información transaccional.', path: 'Tablero de control / Panel de Gestión Transaccional',
    url: OAC + '/ui/dv/?pageid=visualAnalyzer&reportmode=full&reportpath=%2F%40Catalog%2Fshared%2FTablero%20de%20control%2FPanel%20de%20Gesti%C3%B3n%20Transaccional&viewermode=false' }
];
const FEATS = [
  ['zap', 'Tiempo real', 'Consulta información actualizada al instante.', '#C99A00'],
  ['search', 'Consultas', 'Seguimiento de transacciones y operaciones.', '#21BBEA'],
  ['trend', 'Análisis', 'Validación de información para la operación.', '#048C38'],
  ['database', 'Oracle OAC', 'Información centralizada para el negocio.', '#6C74A8']
];
const USUARIO_OAC = 'tablerosoci@multival.com.co';

export default function Brain() {
  return (<><V1Bar /><V1Guard modulo="brain"><BrainModulo /></V1Guard></>);
}

function BrainModulo() {
  const { toast, go } = useApp();
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(USUARIO_OAC); setCopiado(true); toast('Usuario copiado.'); setTimeout(() => setCopiado(false), 1800); }
    catch { toast('No se pudo copiar; seleccione el texto manualmente.'); }
  };
  return (
    <div className="v1p">
      <V1Hero eyebrow="COI V1 · Analítica" icon="brain" title="Brain RT" tone="deep"
        sub="Centro de acceso a Oracle Analytics Cloud para la consulta de transacciones operativas en tiempo real."
        right={<a className="btn btn-lg v1p-btn-gold" href={TABLEROS[0].url} target="_blank" rel="noopener noreferrer"><PIcon name="external" />Acceder a Oracle Analytics</a>}>
        <div className="v1p-hero-chips"><span><span className="v1p-live" />Oracle Analytics Cloud</span><span>Catálogo compartido · Reval</span></div>
      </V1Hero>

      <div className="v1p-feats mt">
        {FEATS.map((f) => (
          <div key={f[1]} className="card v1p-feat" style={{ '--c': f[3] }}>
            <span className="v1p-stat-ic"><PIcon name={f[0]} /></span>
            <b>{f[1]}</b><small>{f[2]}</small>
          </div>
        ))}
      </div>

      <div className="v1p-brain-grid mt">
        <div className="v1p-brain-left">
        <div className="v1p-tableros">
          {TABLEROS.map((t) => (
            <section key={t.k} className="card v1p-tablero">
              <div className="v1p-tablero-art" aria-hidden="true">
                <svg viewBox="0 0 220 90" preserveAspectRatio="none">
                  <path d="M0 70 C30 60 40 30 70 38 S120 70 150 40 S200 20 220 26 L220 90 L0 90Z" className="a" />
                  <path d="M0 70 C30 60 40 30 70 38 S120 70 150 40 S200 20 220 26" className="l" />
                </svg>
                <span className="v1p-app-ic"><PIcon name={t.icon} /></span>
              </div>
              <div className="v1p-tablero-b">
                <span className="v1p-app-tag">{t.tag}</span>
                <h3>{t.title}</h3>
                <p>{t.desc}</p>
                <code className="v1p-path"><PIcon name="layers" />{t.path}</code>
                <a className="btn btn-p btn-lg v1p-cta" href={t.url} target="_blank" rel="noopener noreferrer"><PIcon name="external" />Acceder a Oracle Analytics</a>
              </div>
            </section>
          ))}
        </div>
          <Panel icon="flow" title="Cómo acceder" className="mt v1p-como">
            <ol className="v1p-steps">
              <li><b>Solicite las credenciales</b><span>Radique una solicitud en TRAZA; TI entrega la contraseña vigente.</span></li>
              <li><b>Abra Oracle Analytics</b><span>Use «Acceder a Oracle Analytics» en el tablero que necesita.</span></li>
              <li><b>Inicie sesión</b><span>Con el usuario corporativo indicado arriba.</span></li>
              <li><b>Consulte</b><span>Filtre por oficina, cliente o fecha y exporte si lo requiere.</span></li>
            </ol>
          </Panel>
        </div>
        <aside>
          <Panel icon="key" title="Credenciales de acceso" sub="Cuenta corporativa para Oracle Analytics Cloud" tone="gold">
            <label className="v1p-cred">
              <span className="v1p-k">Usuario</span>
              <span className="v1p-cred-v"><code>{USUARIO_OAC}</code><button type="button" className="btn btn-o btn-sm" onClick={copiar}>{copiado ? <Icon name="check" /> : <PIcon name="copy" />}{copiado ? 'Copiado' : 'Copiar'}</button></span>
            </label>
            <div className="v1p-cred">
              <span className="v1p-k">Contraseña</span>
              <div className="v1p-cred-lock">
                <Icon name="lock" />
                <div><b>Credenciales gestionadas por TI</b><small>Por seguridad la contraseña no se muestra en COI. Solicítela por TRAZA.</small></div>
              </div>
              <button type="button" className="btn btn-o btn-block mt8" onClick={() => go('traza')}><Icon name="flow" />Solicitar acceso por TRAZA</button>
            </div>
            <p className="v1p-note info"><Icon name="alert" /><span>Estas credenciales son exclusivas para el acceso al portal <b>Oracle Analytics Cloud</b>.</span></p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
