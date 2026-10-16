// G5 Banco Agrario.
export default {
  kpis: [
    ['Operaciones punteadas', '128', 'esta semana', 'check'],
    ['Guías faltantes', 1, 'alerta enviada a la transportadora', 'alert'],
    ['Certificaciones del mes', '75 de 76', 'infraestructura y publicidad', 'filecheck'],
    ['Pendientes 2025', 23, 'antes 41', 'list'],
  ],
  // [operación, precinto, guía, estado]
  punteo: [['OP-55120', 'PR-88214', 'GU-77125', 'ok'], ['OP-55121', 'PR-88215', '', 'warn'], ['OP-55124', 'PR-88219', 'GU-77131', 'ok'], ['OP-55128', 'PR-88223', 'GU-77140', 'ok'], ['OP-55130', 'PR-88227', 'GU-77144', 'ok']],
  // [certificación, alcance, avance]
  certificaciones: [['Certificación de infraestructura', 'Asesor y cajero', '38 de 38'], ['Certificación de publicidad', 'Material en oficina', '37 de 38'], ['Validación de incidencias', 'Reportadas por el banco', '4 cerradas']],
  // [tema, cantidad, estado]
  pendientes: [['Transacciones 2025 sin guía', 23, 'En conciliación con la transportadora'], ['Solicitudes de Oriana', 5, 'En gestión'], ['Reclamaciones potenciales', 0, 'Sin reclamaciones abiertas']],
};
