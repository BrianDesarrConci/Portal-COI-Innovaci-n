/**
 * Estado de cada opción del menú. Datos puros: lo usan el menú (lib/nav.js), la vista «En construcción»
 * y el validador de módulos (scripts/modulos), que lo importa desde Node.
 *
 *   activo        funciona con datos reales
 *   desarrollo    un analista lo está construyendo ahora (va primero en el menú, con su cinta)
 *   construccion  aún no se ha desarrollado (cinta «En construcción», sin datos)
 *
 * PENDIENTES son los módulos que entregan los analistas. Su clave es el "id" oficial que debe llevar el
 * module.json: al instalar el .zip, el módulo toma el lugar de la opción en construcción.
 */
export const PENDIENTES = {
  validacion:  { codigo: 'N1', nombre: 'Validación documental', icono: 'filecheck', grupo: 'Operación', descripcion: 'Recepción y validación de los soportes documentales que exige cada cliente.' },
  novedades:   { codigo: 'N2', nombre: 'Novedades', icono: 'inbox', grupo: 'Operación', descripcion: 'Registro, asignación y cierre de las novedades operativas de los clientes.' },
  alertas:     { codigo: 'N4', nombre: 'Alertas', icono: 'bell', grupo: 'Operación', descripcion: 'Alertas operativas (excesos de efectivo, incumplimientos) y su atención.' },
  fincomercio: { codigo: 'N8', nombre: 'Fincomercio', icono: 'store', grupo: 'Operación', descripcion: 'Operación especializada del cliente Fincomercio.' },
  oficinas:    { codigo: 'N7', nombre: 'Oficinas', icono: 'pin', grupo: 'Operación', descripcion: 'Red de oficinas y puntos de atención por cliente.' },
  reporteria:  { codigo: 'N5', nombre: 'Reportería y comités', icono: 'chart', grupo: 'Cifras', descripcion: 'Informes periódicos y preparación de los comités con cada cliente.' },
  facturacion: { codigo: 'N6', nombre: 'Facturación', icono: 'receipt', grupo: 'Cifras', descripcion: 'Preliquidación y soporte de la facturación por cliente.' },
  ptr:         { codigo: 'N9', nombre: 'Transacciones en vivo', icono: 'activity', grupo: 'Cifras', descripcion: 'Seguimiento de las transacciones en línea (PTR).' },
  malas:       { codigo: 'G1', nombre: 'Malas prácticas', icono: 'alert', grupo: 'Módulos Apps Script', descripcion: 'Reporte y seguimiento de malas prácticas en oficinas.' },
  papeleria:   { codigo: 'G2', nombre: 'Papelería', icono: 'package', grupo: 'Módulos Apps Script', descripcion: 'Solicitudes y entregas de papelería.' },
  usuarios:    { codigo: 'G3', nombre: 'Usuarios y planta', icono: 'usercheck', grupo: 'Módulos Apps Script', descripcion: 'Planta de personal y usuarios por oficina.' },
  cheques:     { codigo: 'G4', nombre: 'Cheques y arqueos', icono: 'wallet', grupo: 'Módulos Apps Script', descripcion: 'Control de cheques y arqueos de valores.' },
  agrario:     { codigo: 'G5', nombre: 'Banco Agrario', icono: 'building', grupo: 'Módulos Apps Script', descripcion: 'Operación especializada del cliente Banco Agrario.' },
  ingresos:    { codigo: 'G6', nombre: 'Correo de ingresos', icono: 'mail', grupo: 'Módulos Apps Script', descripcion: 'Gestión del buzón de correo de ingresos.' },
};

/**
 * Módulos que un analista está construyendo ahora: clave → { analista, entrega }.
 * Ejemplo: validacion: { analista: 'Lina', entrega: '2026-11-27' }
 */
export const EN_DESARROLLO = {};

/** Opciones propias del portal que todavía no tienen datos reales (se muestran con cinta y contadores en cero). */
export const PORTAL_EN_CONSTRUCCION = ['analistas', 'procesos', 'bitacora'];

/** Estado de una opción del menú. Los módulos instalados de los analistas son siempre "activo". */
export function estadoDe(clave, instalados = []) {
  if (instalados.includes(clave)) return 'activo';
  if (EN_DESARROLLO[clave]) return 'desarrollo';
  if (PENDIENTES[clave] || PORTAL_EN_CONSTRUCCION.includes(clave)) return 'construccion';
  return 'activo';
}
