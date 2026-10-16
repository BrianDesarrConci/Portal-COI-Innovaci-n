// N0 Tablero gerencial: hitos del plan y pendientes fijos del periodo en curso.
export default {
  // [fecha ISO, hito]
  milestones: [
    ['2026-10-30', 'Hito 1: COI en producción'],
    ['2026-11-27', 'Hito 2: validación documental, PQR, gestión interna y analítica'],
    ['2026-12-18', 'Hito 3: novedades, personal y valores, alertas'],
    ['2027-01-15', 'Hito 4: reportería, Fincomercio, facturación y oficinas'],
    ['2027-01-22', 'Hito 5: entrega formal'],
  ],
  // Comités mensuales que se agregan a cada mes del periodo (día 5).
  committees: { day: 5, text: 'BBVA, Banco Popular, Davivienda y Fincomercio' },
  // [tono, título, detalle, vista] que se muestran solo en el periodo en curso.
  currentAttention: [
    ['warn', 'Exceso de efectivo en BBVA Salitre', 'Transportadora solicitada; alerta abierta', 'alertas'],
    ['info', 'PQR con menos de 6 días de plazo', '1 caso en ampliación de información', 'pqr'],
    ['info', 'Davivienda espera 2 validaciones de líderes', 'Facturación del mes', 'facturacion'],
  ],
  emptyAttention: ['ok', 'Periodo sin pendientes abiertos', 'Todos los compromisos quedaron cerrados', 'bitacora'],
};
