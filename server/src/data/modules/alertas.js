// N4 Alertas operativas: datos de demostración del módulo.
export default {
  // [nivel, título, detalle, responsable, cuándo]
  al: [['bad', 'Exceso de efectivo en BBVA Salitre', 'Saldo 38 % sobre el cupo de póliza. Transportadora solicitada a las 2:51 p. m.', 'lina', 'Hace 18 min'], ['warn', 'Llegada tarde en Banco de Occidente Calle 13', 'Apertura a las 7:52 a. m.; compromiso a las 7:30 a. m. Justificación pendiente del líder.', 'yesica', 'Hoy 8:30 a. m.'], ['info', 'Programación de fines de semana BBVA', 'Se enviará por correo y WhatsApp a las 5:30 p. m. con 9 oficinas programadas.', 'lina', 'Programada'], ['ok', 'Caída de datáfono resuelta en Davivienda oficina 7', 'Restablecido a la 1:12 p. m. tras 26 minutos.', 'maira', 'Cerrada']],
  // [oficina, % del cupo, acción]
  exc: [['BBVA Salitre', 138, 'Transportadora solicitada'], ['BBVA Chapinero', 92, 'Dentro del cupo'], ['Banco de Bogotá Calle 26', 104, 'Recolección programada 4:00 p. m.'], ['Fincomercio Plaza Central', 88, 'Dentro del cupo'], ['BBVA Kennedy', 97, 'Vigilancia']],
  // [oficina, apertura, minutos tarde, justificación]
  late: [['Calle 13', '7:52 a. m.', 22, 'Pendiente'], ['Unicentro', '7:41 a. m.', 11, 'Justificada: falla de transporte'], ['Plaza 80', '7:36 a. m.', 6, 'Justificada: apertura de bóveda']],
  // [día, oficinas, total]
  fds: [['Sábado', 'BBVA Salitre, Unicentro, Santafé, Titán, Gran Estación', '5 oficinas'], ['Domingo', 'BBVA Santafé, Titán, Gran Estación, Andino', '4 oficinas']],
  // [oficina, monitoreo, prueba conforme]
  alarmas: [['Plaza Central', 'Cliente', true], ['Restrepo', 'Cliente', true], ['Kennedy', 'Cliente', true], ['Suba', 'Seguridad Reval', true], ['Chapinero', 'Seguridad Reval', true], ['Soacha', 'Seguridad Reval', false], ['Bosa', 'Seguridad Reval', true], ['Fontibón', 'Seguridad Reval', true]]
};
