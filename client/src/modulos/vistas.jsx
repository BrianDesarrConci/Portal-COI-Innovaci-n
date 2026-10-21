/**
 * Vistas de los módulos de los analistas. Cada una carga el código del módulo bajo demanda
 * (React.lazy), verifica el rol y aísla sus fallas para no afectar el resto del portal.
 */
import { Component, Suspense, useMemo } from 'react';
import { Loading, PageHead } from '../components/ui.jsx';
import { puedeAcceder, useAuth } from '../context/AuthContext.jsx';
import { crearApi } from '../sdk/api.js';
import { MODULOS } from './registro.generado.js';

class LimiteModulo extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err) { console.error('[módulo ' + this.props.mod.id + ']', err); }
  render() {
    const { mod } = this.props;
    if (this.state.err) {
      return <PageHead title={mod.nombre + ' no está disponible'}
        sub={`El módulo presentó una falla (versión ${mod.version}, responsable: ${mod.autor.nombre}). Detalle técnico: ${this.state.err.message}`} />;
    }
    return this.props.children;
  }
}

function crearVista(mod) {
  function VistaModulo({ sub }) {
    const { usuario } = useAuth();
    const api = useMemo(() => crearApi(mod.id), []);
    if (!puedeAcceder(usuario, mod.acceso.roles)) {
      return <PageHead title="Acceso restringido" sub={`Su rol no tiene acceso a ${mod.nombre}. Si lo necesita, radique la solicitud en TRAZA.`} />;
    }
    const Modulo = mod.Componente;
    return (
      <LimiteModulo mod={mod}>
        <Suspense fallback={<Loading />}>
          <Modulo sub={sub} usuario={usuario} api={api} />
        </Suspense>
      </LimiteModulo>
    );
  }
  VistaModulo.displayName = 'Modulo(' + mod.id + ')';
  return VistaModulo;
}

/** id del módulo → componente de vista (se fusiona con el registro VIEWS). */
export const VISTAS_MODULOS = Object.fromEntries(MODULOS.map((m) => [m.id, crearVista(m)]));
export { MODULOS };
