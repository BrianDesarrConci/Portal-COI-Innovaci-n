// N3 PQR, reclamaciones y encuestas: datos de demostración del módulo.
export default {
  // [radicado, asunto, cliente, etapa, ampliaciones, días hábiles restantes, responsable]
  pqr: [['PQR-1182', 'Demora en pago de cesantías', 'Varios', 'Respuesta del líder', 1, 9, 'lina'], ['PQR-1185', 'Trato del cajero en oficina Kennedy', 'BBVA', 'Ampliación de información', 2, 6, 'monica'], ['PQR-1190', 'Cobro de comisión no informado', 'Banco Popular', 'Análisis con video', 1, 12, 'yesica'], ['PQR-1193', 'Fila extensa en hora pico', 'Bancolombia', 'Radicada por código QR', 0, 14, 'monica'], ['PQR-1196', 'Billete rechazado en ventanilla', 'Fincomercio', 'Respuesta del líder', 1, 11, 'lina']],
  // [radicado, asunto, cliente, días restantes, estado]
  jur: [['DP-0214', 'Derecho de petición: certificación de pagos', 'Varios', 4, 'En Jurídica'], ['DP-0217', 'Derecho de petición: copia de grabación', 'BBVA', 10, 'Respuesta en revisión'], ['TU-0031', 'Tutela por demora en cesantías', 'Colfondos', 2, 'Respuesta radicada']],
  // [regional, satisfacción, encuestas]
  enc: [['Bogotá Centro', 92.4, 118], ['Bogotá Norte', 94.1, 102], ['Antioquia Norte', 90.8, 96], ['Nororiental', 89.7, 88], ['Occidente', 91.9, 121], ['Costa', 90.3, 117]],
  // [control, resultado, clase]
  calidad: [['Código de oficina corregido', '23 registros', 'b-info'], ['Líder asignado desde el Directorio Nacional', '642 de 642', 'b-ok'], ['Gerente regional asignado', '642 de 642', 'b-ok'], ['Duplicados descartados', '7 registros', 'b-mute']]
};
