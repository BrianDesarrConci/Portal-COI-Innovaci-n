// Pestañas de tableros de Control de Arqueos (COI V1).
// Cada componente recibe { user } con la forma de currentUser de V1: { rol, idUsuario, nombre, correo }.
//  - DashboardTab: "Mi cumplimiento" (Lider) o "Dashboard Regional / Global" (Regional, Analista).
//  - LideresTab, NovedadesTab, ClientesTab, RegionalTab, AnaliticaTab, TendenciasTab.
// Las acciones de gestión de la pestaña de novedades se piden con el evento de ventana
// `coi:arqueos:gestion` (cancelable; detail = { id, accion: 'gestionar' | 'responder' | 'detalle', novedad }).
export { DashboardTab } from './DashboardTab.jsx';
export { LideresTab } from './LideresTab.jsx';
export { NovedadesTab } from './NovedadesTab.jsx';
export { ClientesTab } from './ClientesTab.jsx';
export { RegionalTab } from './RegionalTab.jsx';
export { AnaliticaTab } from './AnaliticaTab.jsx';
export { TendenciasTab } from './TendenciasTab.jsx';
