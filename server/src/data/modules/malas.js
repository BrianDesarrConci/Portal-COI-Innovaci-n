// G1 Malas prácticas y fraccionamientos.
export default {
  // [oficina, tipo, detalle, líder, estado]
  casos: [
    ['Bancolombia Suba', 'Fraccionamiento', '6 depósitos de $ 9,8 M en 40 min', 'Líder Zona Norte', 'Enviado'],
    ['Bancolombia Kennedy', 'Mala práctica', 'Transacción sin firma del cliente', 'Líder Zona Sur', 'Enviado'],
    ['BBVA Restrepo', 'Fraccionamiento', '4 retiros consecutivos misma cédula', 'Líder Zona Sur', 'En respuesta'],
    ['Bancolombia Chía', 'Mala práctica', 'Cajero con dos sesiones abiertas', 'Líder Sabana', 'Respondido'],
    ['Bancolombia Centro', 'Mala práctica', 'Reclamación del cliente sin radicar', 'Líder Centro', 'En respuesta'],
  ],
  tendencia: { weeks: ['sem 37', 'sem 38', 'sem 39', 'sem 40', 'sem 41', 'sem 42'], data: [9, 7, 8, 6, 5, 5] },
  kpis: [
    ['Envío a líderes', 'Viernes', '4:00 p. m., automático', 'send'],
    ['Respuesta de líderes', '86 %', 'dentro de 5 días hábiles', 'check'],
    ['Reclamaciones Bancolombia', 2, 'en plazo', 'shield'],
  ],
};
