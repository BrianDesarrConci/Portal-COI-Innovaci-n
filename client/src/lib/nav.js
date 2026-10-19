// Módulos (vista, código, nombre, icono) y menú lateral, tal como en el demo.
export const MODULES = [
  ['validacion', 'N1', 'Validación documental', 'filecheck'], ['novedades', 'N2', 'Novedades', 'inbox'], ['pqr', 'N3', 'PQR y encuestas', 'message'], ['alertas', 'N4', 'Alertas', 'bell'],
  ['reporteria', 'N5', 'Reportería y comités', 'chart'], ['facturacion', 'N6', 'Facturación', 'receipt'], ['oficinas', 'N7', 'Oficinas', 'pin'], ['fincomercio', 'N8', 'Fincomercio', 'store'], ['ptr', 'N9', 'Transacciones en vivo', 'activity'],
  ['malas', 'G1', 'Malas prácticas', 'alert'], ['papeleria', 'G2', 'Papelería', 'package'], ['usuarios', 'G3', 'Usuarios y planta', 'usercheck'], ['cheques', 'G4', 'Cheques y arqueos', 'wallet'], ['agrario', 'G5', 'Banco Agrario', 'building'], ['ingresos', 'G6', 'Correo de ingresos', 'mail'],
  ['traza', 'TRAZA', 'TRAZA', 'flow'], ['inicio', 'N0', 'Tablero gerencial', 'home']
];
// Menú por negocio. Los clientes no tienen entradas sueltas: todos viven en el grupo Clientes
// (ver lib/clientes.js) con su espacio Cliente 360, que incluye su módulo especializado.
export const NAV = [
  ['Inicio', [['inicio', 'Tablero gerencial', 'home'], ['junta', 'Modo Comité', 'sparkle']]],
  ['Clientes', [['clientes', 'Todos los clientes', 'building']], 'clientes'],
  ['Operación', [['validacion', 'Validación documental', 'filecheck'], ['novedades', 'Novedades y requerimientos', 'inbox', 12], ['pqr', 'PQR y experiencia', 'message'], ['alertas', 'Alertas', 'bell', 1], ['oficinas', 'Torre de oficinas', 'pin'], ['papeleria', 'Papelería e insumos', 'package']]],
  ['Control y riesgo', [['arqueos', 'Control de arqueos', 'wallet'], ['cheques', 'Cheques y valores', 'receipt'], ['malas', 'Malas prácticas', 'alert']]],
  ['Personas', [['granja', 'Granja de usuarios', 'users'], ['usuarios', 'Planta por negocio', 'usercheck'], ['analistas', 'Equipo de analistas', 'star']]],
  ['Cifras', [['reporteria', 'Reportería y comités', 'chart'], ['facturacion', 'Facturación y conciliación', 'receipt'], ['ingresos', 'Correo de ingresos', 'mail'], ['ptr', 'Transacciones en vivo', 'activity'], ['brain', 'Brain RT · Oracle', 'layers']]],
  ['Herramientas', [['captura', 'Centro de captura', 'form'], ['traza', 'TRAZA', 'flow'], ['catalogo', 'Catálogo de actividades', 'list'], ['procesos', 'Procesos transversales', 'layers'], ['bitacora', 'Bitácora', 'clock'], ['implementacion', 'Plan de implementación', 'flag']]],
  ['Administración', [['adminv1', 'Usuarios y permisos', 'shield']]]
];
// Vistas que siguen existiendo pero ya no van en el menú: se muestran dentro de otra sección.
export const VIEW_HOME = { fincomercio: 'cliente/fincomercio', agrario: 'cliente/agrario', experiencia: 'pqr', coiv1: 'inicio', cliente: 'clientes', analista: 'analistas' };
export const VIEW_LABEL = {};
NAV.forEach((g) => g[1].forEach((it) => { VIEW_LABEL[it[0]] = [g[0], it[1]]; }));
Object.assign(VIEW_LABEL, { fincomercio: ['Clientes', 'Fincomercio'], agrario: ['Clientes', 'Banco Agrario'], experiencia: ['Operación', 'PQR y experiencia'], coiv1: ['Inicio', 'Inicio COI V1'] });
export const NOTIFS = [['bad', 'Exceso de efectivo en BBVA Salitre', 'Hace 18 min', 'alertas'], ['warn', 'TRZ-0405 en prioridad crítica', 'CreSER, hoy', 'traza/TRZ-0405'], ['info', 'Comité BBVA listo para el 5 de noviembre', 'Reportería', 'reporteria'], ['ok', 'Soportes BBVA completos a las 10:42 a. m.', 'Validación documental', 'validacion']];
