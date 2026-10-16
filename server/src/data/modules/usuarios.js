// G3 Usuarios, planta y directorios.
export default {
  kpis: [
    ['Novedades de la semana', 4, '2 ingresos, 1 retiro, 1 traslado', 'usercheck'],
    ['Plantas enviadas', '3 de 3', 'Bogotá, Popular y Coopcentral', 'send'],
    ['Usuarios creados en el mes', 9, 'en sistemas de clientes', 'users'],
    ['Directorios actualizados', '4 de 4', 'red transaccional', 'list'],
  ],
  // [funcionario, novedad, oficina, backup, notificado]
  granja: [
    ['Andrea Castillo', 'Ingreso', 'BBVA Salitre', 'Asignado', 'Lunes 8:05 a. m.'],
    ['Jorge Pinzón', 'Retiro', 'Banco Popular Centro', 'Asignado', 'Lunes 8:05 a. m.'],
    ['Carolina Mesa', 'Traslado', 'Fincomercio Suba', 'Asignado', 'Lunes 8:05 a. m.'],
    ['Diego Rincón', 'Ingreso', 'Citibank Bulevar', 'Pendiente', 'Programado'],
  ],
  // [cliente, frecuencia, mantener, ingresar, eliminar]
  planta: [['Banco de Bogotá', 'Quincenal', 12, 3, 2], ['Banco Popular', 'Semanal', 8, 1, 1], ['Coopcentral', 'Semanal', 4, 0, 1]],
  // [sistema, responsable, usuarios, estado]
  creacion: [
    ['Reconocer (Colfondos)', 'Jully Ríos', 3, 'Creados'],
    ['BBVA', 'Jully Ríos', 2, 'Creados'],
    ['Banco Agrario, incluye MAC', 'Jully Ríos', 1, 'Actualización de MAC'],
    ['Porvenir, por MAC del equipo', 'William', 1, 'En gestión'],
    ['Banco Popular', 'Líderes, con la planta semanal', 2, 'Notificados'],
  ],
  informePlanta: [['Cajeros', 142], ['Backups', 38], ['Supernumerarios', 21], ['Supervisores', 12], ['Control interno', 4]],
  directorios: [['Protección', '1 oct'], ['Porvenir', '1 oct'], ['Davivienda', '1 oct'], ['AV Villas', '1 oct']],
};
