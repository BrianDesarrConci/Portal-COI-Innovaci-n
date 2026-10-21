/**
 * SDK de COI para los módulos de los analistas: `import { Card, Table, useRecurso } from '@coi/sdk';`
 * Es la única puerta de los módulos hacia el portal; así el portal puede evolucionar por dentro
 * sin romper los módulos. Vea docs/modulos/GUIA-ANALISTAS.md.
 */
// Componentes de presentación (misma línea gráfica del portal).
export {
  PageHead, Kpi, Kpis, Card, Table, Cell, Tabs, Tag, Bar, Num, StatusBadge, GoLink, Avatar,
  Spark, LineChart, HBars, DocRow, ListRow, Field, fieldStyle, areaStyle, Loading,
} from '../components/ui.jsx';
export { default as Icon } from '../components/Icon.jsx';
export { default as CountUp } from '../components/CountUp.jsx';
// Avisos y ventanas modales: const { toast, modal, closeModal } = useOverlay();
export { useOverlay, ModalBtn } from '../components/Overlays.jsx';
// Navegación del portal: const { go } = useApp(); go('inicio');
export { useApp } from '../context/AppContext.jsx';
// Sesión: const { usuario } = useAuth(); puedeAcceder(usuario, ['lider']).
export { useAuth, puedeAcceder } from '../context/AuthContext.jsx';
// Formatos colombianos (es-CO).
export { fmt, pct, money, MONTHS, DAYS, longDate, shortDate, dshort, cap, norm, hhmm } from '../lib/format.js';
// API del módulo.
export { crearApi, useRecurso } from './api.js';
// Clientes del portal (19, con su segmento) para listas y filtros.
export { CLIENTES, SEGMENTOS } from '../lib/clientes.js';
