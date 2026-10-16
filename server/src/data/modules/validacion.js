// N1 Validación documental: datos de demostración del módulo.
export default {
  offices: ['Chapinero', 'Salitre', 'Unicentro', 'Usaquén', 'Kennedy', 'Suba', 'Soacha', 'Chía', 'Zipaquirá', 'Fontibón', 'Restrepo', 'Galerías', 'Cedritos', 'Calle 72', 'Centro Internacional', 'Modelia', 'Bosa', 'Tunal', 'Américas', 'Teusaquillo', 'Toberín', 'Madrid', 'Mosquera', 'Funza', 'Facatativá', 'Girardot', 'Fusagasugá', 'Calle 100', 'Plaza de las Américas', 'Ciudad Salitre', 'Centro Mayor'],
  checks: ['Fecha', 'Orientación', 'Completitud', 'Oficina'],
  // [empleador, fondo, día de 5 hábiles, último movimiento]
  cartas: [['Construcciones Andinas S.A.S.', 'Colfondos', 1, 'Esperando respuesta del empleador'], ['Distribuidora La Sabana', 'Colfondos', 2, 'Segundo correo enviado a las 10:00 a. m.'], ['Agroindustrias del Huila', 'Protección', 3, 'Datos remitidos a Karen, Colfondos'], ['Transportes Boyacá Ltda.', 'Colfondos', 4, 'Tercer correo programado a las 2:00 p. m.'], ['Hotel Plaza Mayor', 'Protección', 1, 'Carta, cédula y tirilla completas'], ['Clínica San Rafael', 'Colfondos', 2, 'Esperando respuesta del empleador']],
  // [zona, novedades, cerradas]
  base1000: [['Bogotá Centro', 14, 13], ['Bogotá Norte', 11, 11], ['Medellín', 7, 7], ['Cali', 6, 6], ['Barranquilla', 4, 4], ['Bucaramanga', 3, 3]],
  // [declaración, oficina, valor, validación]
  decl: [['DE-30418', 'Plaza Central', '12.500.000', 'ok'], ['DE-30419', 'Suba', '8.200.000', 'ok'], ['DE-30420', 'Kennedy', '6.700.000', 'firma'], ['DE-30421', 'Chapinero', '15.000.000', 'ok'], ['DE-30422', 'Restrepo', '5.400.000', 'huella'], ['DE-30423', 'Soacha', '9.800.000', 'ok']],
  // [oficina, contenido, completo]
  fotos: [['Agrario Más Cerca Tunja', 'Fachada, tarifario y vista interna', true], ['Agrario Más Cerca Duitama', 'Fachada y tarifario', true], ['Agrario Más Cerca Sogamoso', 'Falta vista interna', false], ['Agrario Más Cerca Chiquinquirá', 'Fachada, tarifario y vista interna', true]]
};
