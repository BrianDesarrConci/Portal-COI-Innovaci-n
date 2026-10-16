// Procesos transversales: filas adicionales de actividades monitoreadas y proceso con alerta.
export default {
  // [proceso, título, descripción, vista, módulos, etiqueta, clase de etiqueta]
  extra: [
    ['P0', 'Tablero gerencial y control de ANS', 'Base de indicadores de la Gerencia y revisión de acuerdos de servicio, cubiertas por el tablero desde el hito 1.', 'inicio', 'N0', 'En operación', 'b-ok'],
    ['M', 'Analítica que se mantiene', 'Tableros de Oracle y Power BI, control de apertura en COI, informes mensuales y reportería bajo demanda de Hernán. Se monitorean en COI sin automatizar.', 'analista/hernan', 'Monitoreo', 'Monitoreada', 'b-mute'],
  ],
  alertProcess: 'T5',
};
