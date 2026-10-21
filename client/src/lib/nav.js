// Módulos (vista, código, nombre, icono) y menú lateral.
import { fusionarMenu } from '../modulos/menu.js';
import { MODULOS } from '../modulos/registro.generado.js';
import { PENDIENTES, estadoDe } from './estados.js';

export const MODULES = [
  ['validacion', 'N1', 'Validación documental', 'filecheck'], ['novedades', 'N2', 'Novedades', 'inbox'], ['pqr', 'N3', 'PQR y encuestas', 'message'], ['alertas', 'N4', 'Alertas', 'bell'],
  ['reporteria', 'N5', 'Reportería y comités', 'chart'], ['facturacion', 'N6', 'Facturación', 'receipt'], ['oficinas', 'N7', 'Oficinas', 'pin'], ['fincomercio', 'N8', 'Fincomercio', 'store'], ['ptr', 'N9', 'Transacciones en vivo', 'activity'],
  ['malas', 'G1', 'Malas prácticas', 'alert'], ['papeleria', 'G2', 'Papelería', 'package'], ['usuarios', 'G3', 'Usuarios y planta', 'usercheck'], ['cheques', 'G4', 'Cheques y arqueos', 'wallet'], ['agrario', 'G5', 'Banco Agrario', 'building'], ['ingresos', 'G6', 'Correo de ingresos', 'mail'],
  ['traza', 'TRAZA', 'TRAZA', 'flow'], ['inicio', 'N0', 'Tablero gerencial', 'home']
];

/** Opciones en construcción de un grupo, tomadas del plan de módulos (lib/estados.js). */
const pendientesDe = (grupo, conCodigo) => Object.entries(PENDIENTES).filter(([, p]) => p.grupo === grupo)
  .map(([k, p]) => (conCodigo ? [k, p.nombre, p.icono, p.codigo] : [k, p.nombre, p.icono]));

// Menú lateral. El portafolio y los espacios Cliente 360 se abren desde «Clientes».
// Los módulos de los analistas (client/src/modulos) ocupan el lugar de su opción en construcción.
const BASE = [
  ['Monitoreo', [['inicio', 'Tablero gerencial', 'home'], ['clientes', 'Clientes', 'building'], ['catalogo', 'Catálogo de actividades', 'list'], ['analistas', 'Analistas', 'users'], ['procesos', 'Procesos', 'layers'], ['bitacora', 'Bitácora', 'clock']]],
  ['COI V1 Opciones', [['coiv1', 'Inicio COI V1', 'home', 'V1'], ['granja', 'Granja de Usuarios', 'users'], ['experiencia', 'Experiencia de Cliente', 'message'], ['captura', 'Centro de captura', 'inbox'], ['arqueos', 'Control de Arqueos', 'wallet'], ['brain', 'Brain RT', 'activity'], ['adminv1', 'Administración', 'shield']]],
  ['Operación', [['pqr', 'PQR y encuestas', 'message'], ...pendientesDe('Operación')]],
  ['Herramientas', [['traza', 'TRAZA', 'flow'], ['implementacion', 'Plan de implementación', 'flag']]],
  ['Cifras', pendientesDe('Cifras')],
  ['Módulos Apps Script', pendientesDe('Módulos Apps Script', true)],
];

const RANGO = { activo: 0, desarrollo: 1, construccion: 2 };
const INSTALADOS = MODULOS.map((m) => m.id);

/**
 * Ordena el menú por estado: primero «En desarrollo» (lo que los analistas construyen ahora), luego los
 * grupos con opciones en funcionamiento y al final los que solo tienen opciones en construcción.
 * Cada opción queda como [vista, etiqueta, icono, insignia, estado].
 */
function ordenarMenu(nav) {
  const desarrollo = [];
  const grupos = nav.map(([nombre, items, ...resto]) => {
    const con = items.map((it) => [it[0], it[1], it[2], it[3], estadoDe(it[0], INSTALADOS)]);
    desarrollo.push(...con.filter((it) => it[4] === 'desarrollo'));
    const quedan = con.filter((it) => it[4] !== 'desarrollo').sort((a, b) => RANGO[a[4]] - RANGO[b[4]]);
    return [nombre, quedan, ...resto];
  }).filter((g) => g[1].length);
  const activo = (g) => g[1].some((it) => it[4] === 'activo');
  const out = grupos.filter(activo).concat(grupos.filter((g) => !activo(g)));
  if (desarrollo.length) out.unshift(['En desarrollo', desarrollo]);
  return out;
}

export const NAV = ordenarMenu(fusionarMenu(BASE));
// Vistas fuera del menú y la entrada del menú que las contiene.
export const VIEW_HOME = { cliente: 'clientes', analista: 'analistas' };
export const VIEW_LABEL = {};
NAV.forEach((g) => g[1].forEach((it) => { VIEW_LABEL[it[0]] = [g[0], it[1]]; }));
/** Estado de cada opción del menú (activo, desarrollo o construccion). */
export const ESTADO = {};
NAV.forEach((g) => g[1].forEach((it) => { ESTADO[it[0]] = it[4]; }));
