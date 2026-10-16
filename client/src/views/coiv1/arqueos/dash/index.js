// Pestañas de tableros de Control de Arqueos (las implementa el módulo de tableros).
// Cada componente recibe { user } con la forma de currentUser de V1: { rol, idUsuario, nombre, correo }.
import { PageHead } from '../../../../components/ui.jsx';
const Pend = (t) => function Pendiente() { return <PageHead title={t} sub="En migración." />; };
export const DashboardTab = Pend('Dashboard');
export const LideresTab = Pend('Cumplimiento por líder');
export const NovedadesTab = Pend('Faltantes y sobrantes');
export const ClientesTab = Pend('Por cliente / oficina');
export const RegionalTab = Pend('Regional y zona');
export const AnaliticaTab = Pend('Analítica');
export const TendenciasTab = Pend('Tendencias');
