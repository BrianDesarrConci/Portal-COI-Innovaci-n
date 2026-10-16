// N2 Novedades y requerimientos: datos de demostración del módulo.
export default {
  // [canal, cliente, asunto, responsable, minutos para vencer ANS, prioridad]
  nov: [
    ['wa', 'BBVA', 'Exceso de efectivo en oficina Salitre', 'lina', 22, 'Alta'], ['mail', 'Banco Popular', 'Reporte de transportadora con voucher pendiente', 'yesica', 95, 'Media'],
    ['form', 'Fincomercio', 'PNC de la oficina Plaza Central', 'maira', 4320, 'Media'], ['aranda', 'BBVA', 'Falla de alarma en oficina Chía', 'lina', 180, 'Alta'],
    ['wa', 'Davivienda', 'Novedad de transportadora oficina 14', 'maira', 40, 'Alta'], ['mail', 'Banco de Bogotá', 'Diferencia operativa: faltante de caja', 'maira', 300, 'Alta'],
    ['form', 'Banco Agrario', 'Evidencia fotográfica de fachada', 'yesica', 600, 'Baja'], ['mail', 'Coopcentral', 'Solicitud de creación de usuario', 'jully', 1440, 'Baja'],
    ['wa', 'Citibank', 'Requerimiento de oficina Bulevar', 'maira', 1200, 'Media'], ['mail', 'Colfondos', 'Anulación en PTR por valor errado', 'jully', 240, 'Media'],
    ['mail', 'Banco Unión', 'Corrección de giro 4471', 'maira', 700, 'Media'], ['wa', 'Colfondos', 'Consulta de cajero: carta de cesantías con NIT duplicado', 'jully', 360, 'Media'], ['mail', 'Fincomercio', 'Requerimiento del cliente con solicitud de video, oficina Kennedy', 'maira', 2880, 'Media'], ['mail', 'Banco Caja Social', 'Pedido de bolsas de envío para 3 oficinas', 'maira', 2400, 'Baja'], ['form', 'BBVA', 'Solicitud de cambio de clave de bóveda', 'lina', 150, 'Alta']
  ],
  // [tema, detalle, clase, estado]
  reunion: [['Insumos y bolsas MTI', 'Pedido aprobado para 6 oficinas', 'b-ok', 'Cerrado'], ['Precintos y extintores', 'Recarga de extintores en 3 oficinas', 'b-info', 'En gestión'], ['Personal de Sumar', 'Reemplazo en oficina Usaquén', 'b-info', 'En gestión'], ['Mantenimientos', 'Aire acondicionado en Chapinero', 'b-warn', 'Pendiente del banco']],
  // [oficina, hora programada, confirmada]
  canje: [['Chapinero', '10:20 a. m.', true], ['Salitre', '10:45 a. m.', true], ['Usaquén', '11:10 a. m.', true], ['Kennedy', '11:40 a. m.', false], ['Suba', '12:05 p. m.', false], ['Centro', '12:30 p. m.', false]]
};
