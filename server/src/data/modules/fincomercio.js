// N8 Operación diaria de Fincomercio: datos de demostración del módulo.
export default {
  offices: ['Plaza Central', 'Restrepo', 'Kennedy', 'Suba', 'Chapinero', 'Soacha', 'Bosa', 'Fontibón', 'Usaquén', 'Engativá', 'Centro', 'Américas'],
  // Segundos restantes del ANS de la anulación en curso (11:24)
  anuSeconds: 11 * 60 + 24,
  // [transacción, oficina, motivo, tiempo, estado]
  anul: [['88412', 'Plaza Central', 'Valor errado', 'En curso', ''], ['88390', 'Suba', 'Cuenta errada', '8 min', 'ok'], ['88371', 'Kennedy', 'Duplicada', '11 min', 'ok'], ['88355', 'Restrepo', 'Valor errado', '6 min', 'ok'], ['88340', 'Chapinero', 'Cliente desiste', '9 min', 'ok'], ['88322', 'Soacha', 'Cuenta errada', '12 min', 'ok']],
  // [radicado, oficina, motivo, plazo, estado]
  pnc: [['PNC-0441', 'Plaza Central', 'Billete no apto', '5 días', 'En respuesta del líder'], ['PNC-0438', 'Kennedy', 'Faltante en cierre', '2 días', 'Soporte cargado'], ['PNC-0433', 'Suba', 'Firma de cajero', 'Cerrado', 'Cerrado']],
  // [oficina, política, valor, soportes]
  retiros: [['Kennedy', '4 millones nacional', '4.800.000', 'Soporte completo'], ['Centro', '9 millones Bogotá', '9.600.000', 'Falta biometría']],
  // [concepto, transacciones]
  biometria: [['Transacciones del cierre', 4820], ['Con biometría conforme', 4806], ['Diferencias en seguimiento', 14]],
  // [fecha, boletas, cruce biométrico]
  boleteria: [['Ayer', 164, 'Conforme'], ['Antier', 151, 'Conforme'], ['Hace 3 días', 172, '1 diferencia resuelta']],
  // [cajero, de, a, motivo]
  cajeros: [['Cajero 07', 'Kennedy', 'Plaza Central', 'Reemplazo'], ['Cajero 15', 'Suba', 'Usaquén', 'Traslado']]
};
