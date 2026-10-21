// Módulos (vista, código, nombre, icono) y menú lateral, tal como en el demo.
import { fusionarMenu } from '../modulos/menu.js';

export const MODULES = [
  ['validacion', 'N1', 'Validación documental', 'filecheck'], ['novedades', 'N2', 'Novedades', 'inbox'], ['pqr', 'N3', 'PQR y encuestas', 'message'], ['alertas', 'N4', 'Alertas', 'bell'],
  ['reporteria', 'N5', 'Reportería y comités', 'chart'], ['facturacion', 'N6', 'Facturación', 'receipt'], ['oficinas', 'N7', 'Oficinas', 'pin'], ['fincomercio', 'N8', 'Fincomercio', 'store'], ['ptr', 'N9', 'Transacciones en vivo', 'activity'],
  ['malas', 'G1', 'Malas prácticas', 'alert'], ['papeleria', 'G2', 'Papelería', 'package'], ['usuarios', 'G3', 'Usuarios y planta', 'usercheck'], ['cheques', 'G4', 'Cheques y arqueos', 'wallet'], ['agrario', 'G5', 'Banco Agrario', 'building'], ['ingresos', 'G6', 'Correo de ingresos', 'mail'],
  ['traza', 'TRAZA', 'TRAZA', 'flow'], ['inicio', 'N0', 'Tablero gerencial', 'home']
];
// Menú lateral (listado acordado). El portafolio y los espacios Cliente 360 se abren desde «Clientes».
// Los módulos de los analistas (client/src/modulos) se agregan a su grupo con fusionarMenu.
export const NAV = fusionarMenu([
  ['Monitoreo', [['inicio', 'Tablero gerencial', 'home'], ['analistas', 'Analistas', 'users'], ['procesos', 'Procesos', 'layers'], ['clientes', 'Clientes', 'building'], ['catalogo', 'Catálogo de actividades', 'list'], ['bitacora', 'Bitácora', 'clock']]],
  ['COI V1 Opciones', [['coiv1', 'Inicio COI V1', 'home', 'V1'], ['granja', 'Granja de Usuarios', 'users'], ['experiencia', 'Experiencia de Cliente', 'message'], ['captura', 'Centro de captura', 'inbox'], ['arqueos', 'Control de Arqueos', 'wallet'], ['brain', 'Brain RT', 'activity'], ['adminv1', 'Administración', 'shield']]],
  ['Operación', [['validacion', 'Validación documental', 'filecheck'], ['novedades', 'Novedades', 'inbox', 12], ['pqr', 'PQR y encuestas', 'message'], ['alertas', 'Alertas', 'bell', 1], ['fincomercio', 'Fincomercio', 'store'], ['oficinas', 'Oficinas', 'pin']]],
  ['Cifras', [['reporteria', 'Reportería y comités', 'chart'], ['facturacion', 'Facturación', 'receipt'], ['ptr', 'Transacciones en vivo', 'activity']]],
  ['Módulos Apps Script', [['malas', 'Malas prácticas', 'alert', 'G1'], ['papeleria', 'Papelería', 'package', 'G2'], ['usuarios', 'Usuarios y planta', 'usercheck', 'G3'], ['cheques', 'Cheques y arqueos', 'wallet', 'G4'], ['agrario', 'Banco Agrario', 'building', 'G5'], ['ingresos', 'Correo de ingresos', 'mail', 'G6']]],
  ['Herramientas', [['traza', 'TRAZA', 'flow'], ['implementacion', 'Plan de implementación', 'flag']]]
]);
// Vistas fuera del menú y la entrada del menú que las contiene.
export const VIEW_HOME = { cliente: 'clientes', analista: 'analistas' };
export const VIEW_LABEL = {};
NAV.forEach((g) => g[1].forEach((it) => { VIEW_LABEL[it[0]] = [g[0], it[1]]; }));
export const NOTIFS = [['bad', 'Exceso de efectivo en BBVA Salitre', 'Hace 18 min', 'alertas'], ['warn', 'TRZ-0405 en prioridad crítica', 'CreSER, hoy', 'traza/TRZ-0405'], ['info', 'Comité BBVA listo para el 5 de noviembre', 'Reportería', 'reporteria'], ['ok', 'Soportes BBVA completos a las 10:42 a. m.', 'Validación documental', 'validacion']];
