// N7 Torre de control de oficinas: datos de demostración del módulo.
export default {
  // [cliente, número de oficinas monitoreadas]
  groups: [['BBVA', 32], ['Banco de Occidente', 6], ['Banco Popular', 14], ['Fincomercio', 12]],
  // [oficina, necesidad, prioridad, antigüedad, estado]
  adec: [['Banco Popular Itagüí', 'Filtración en techo de caja', 'Alta, impacto en salud', 'Abierta desde 2022', 'Contratista asignado'], ['Banco Popular Bucaramanga', 'Aire acondicionado', 'Alta, impacto en salud', 'Abierta desde 2022', 'Visita técnica 22 oct'], ['Banco Popular Centro', 'Cambio de cerradura', 'Media', '12 días', 'Solicitud CD radicada'], ['Banco Popular Suba', 'Iluminación', 'Baja', '5 días', 'En cotización']],
  // [tipo, oficina, contenido, fecha]
  actas: [['Acta de recepción', 'BBVA Titán', 'Inventario, entrega y destrucción de formatos', '14 oct'], ['Acta de cierre', 'BBVA Galerías', 'Inventario y entrega al banco', '9 oct'], ['Acta de recepción', 'Banco de Occidente Plaza 80', 'Inventario inicial', '2 oct']],
  // [oficina, estado, clase]
  disp: [['BBVA Unicentro', 'Disponible', 'b-ok'], ['BBVA Chía', 'Cerrada por mantenimiento', 'b-warn'], ['Banco Popular Itagüí', 'Operación parcial', 'b-warn'], ['Fincomercio Bosa', 'Disponible', 'b-ok']],
  // Despliegue de PTR en Banco de Bogotá
  ptr: { installed: 31, total: 50, blocks: [['Cuenta de correo propia pendiente', 12], ['Acceso a equipo del banco', 5], ['Prueba de transacción pendiente', 2]] }
};
