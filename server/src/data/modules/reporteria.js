// N5 Reportería y comités: datos de demostración del módulo.
export default {
  kpis: [
    ['Comités del mes', 5, '2 listos, 2 en preparación', 'chart'],
    ['Informes automáticos', 7, 'generados en su fecha', 'sparkle'],
    ['Horas de armado ahorradas', 26, 'en el mes', 'clock', 'h'],
    ['Auditorías Fincomercio', '9 de 12', 'checklist completo', 'shield'],
  ],
  // [cliente, alcance, fecha, estado, responsable]
  comites: [
    ['BBVA', 'Comité mensual de ANS, 32 oficinas', '5 nov', 'Listo', 'lina'],
    ['Banco Popular', 'Cifras de comité y partidas pendientes', '6 nov', 'Listo', 'yesica'],
    ['Davivienda', 'Cifras, acta y socialización con líderes', '7 nov', 'En preparación', 'yesica'],
    ['Fincomercio', 'Cifras y tablero de gestión', '8 nov', 'En preparación', 'maira'],
    ['Banco de Bogotá', 'Comité bimensual', '12 nov', 'Programado', 'maira'],
  ],
  // [informe, periodicidad, responsable]
  recurrentes: [
    ['Reporte diario de transacciones Indega', 'Todos los días, 9:00 a. m.', 'lina'],
    ['Indicador mensual de recaudo BBVA', 'Día 1 de cada mes', 'lina'],
    ['Informe de transacciones SNR y Citibank', 'Día 3 de cada mes', 'yesica'],
    ['Informe semestral de actas Davivienda', 'Enero y julio', 'yesica'],
    ['Consolidado de encuestas', 'Día 1 de cada mes', 'monica'],
    ['Auditorías mensuales Fincomercio', 'Última semana del mes', 'maira'],
    ['Cuadre de oficinas e indicadores BBVA', 'Todos los días, 11:00 a. m.', 'monica'],
  ],
  recaudo: { months: ['may', 'jun', 'jul', 'ago', 'sep', 'oct'], data: [41200, 43800, 42950, 45100, 47320, 48810] },
  // Oficinas Fincomercio auditadas; las primeras `auditadas` tienen checklist completo.
  auditorias: { oficinas: ['Plaza Central', 'Restrepo', 'Kennedy', 'Suba', 'Chapinero', 'Soacha', 'Bosa', 'Fontibón', 'Usaquén', 'Engativá', 'Centro', 'Américas'], auditadas: 9, mes: 'oct', primerDia: 2 },
  // Contenido del acta de comité (acción "Generar acta").
  acta: {
    indicadores: [['Cumplimiento de ANS', '95 %', '98,7 %'], ['Requerimientos atendidos en plazo', '95 %', '97,8 %'], ['Novedades operativas cerradas', '100 %', '100 %'], ['Evaluación del servicio', '4,0', '4,6']],
    compromisos: 'mantener la validación de soportes antes de las 11:00 a. m. y socializar el acta con los líderes en la semana.',
  },
};
