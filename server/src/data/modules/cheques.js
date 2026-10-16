// G4 Cheques, arqueos y valores.
export default {
  kpis: [
    ['Cheques en custodia', 10430, 'central y 12 oficinas', 'wallet'],
    ['Proyección de temporada', 15000, 'solicitud sugerida: 4.570', 'chart'],
    ['Arqueos del mes', '50 de 50', 'BBVA, Fincomercio e Itaú', 'shield'],
    ['Órdenes de no pago', 2, 'Porvenir', 'alert'],
  ],
  // [ubicación, cheques, años de cobertura]
  inventario: [['Bogotá, custodia central', 7120, 2.1], ['Puerto Boyacá', 900, 9], ['Tunja', 640, 3.2], ['Barranquilla', 520, 2.6], ['Medellín Centro', 480, 1.4], ['Cali Norte', 410, 1.8], ['Bucaramanga', 360, 2.2]],
  // [concepto, cheques, destacado]
  proyeccion: [['Proyección de temporada', '15.000'], ['Inventario utilizable en Bogotá', '7.120'], ['Traslados autorizados dentro de Bogotá', '3.310'], ['Solicitud sugerida por la plataforma de Davivienda', '4.570', true]],
  recomendacion: 'Mantener en Puerto Boyacá el inventario actual hasta su consumo, porque no puede trasladarse fuera del municipio, y solicitar 4.570 cheques en lugar de 15.000 para no sobrestockear la custodia.',
  // [cliente, oficinas, arqueos, resultado]
  arqueos: [['BBVA', 32, 32, 'Sin diferencias'], ['Fincomercio', 12, 12, 'Sin diferencias'], ['Itaú', 6, 6, '1 diferencia justificada']],
  // [radicado, cliente, motivo, estado, clase]
  noPago: [
    ['ONP-0118', 'Porvenir', 'Solicitud del afiliado', 'Cheque perforado y carta recibidos', 'b-ok'],
    ['ONP-0121', 'Porvenir', 'Falla de PTR, anulado en Multifondos', 'Esperando sellos de anulación', 'b-warn'],
  ],
  zunchos: [['SC-0331', 'Porvenir', '500 cheques', 'Arqueo de cofre realizado'], ['SC-0334', 'Citibank', '20 zunchos', 'En alistamiento']],
  bo: [['BO recibidos hoy', 18], ['Ingresados sin corrección', 17], ['Revisados por la analista', 1]],
  cofre: { uso: 96, nota: 'Se solicitó un cofre mediano adicional' },
  controlInterno: ['Arqueo de custodia central', '3 de octubre, sin diferencias'],
};
