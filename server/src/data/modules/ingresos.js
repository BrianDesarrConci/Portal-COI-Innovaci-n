// G6 Correo de ingresos.
export default {
  kpis: [
    ['Correos del periodo', 118, '15 oct a 15 nov', 'mail'],
    ['Oficinas BBVA', 32, 'un correo por oficina', 'building'],
    ['Oficinas Indega', 86, 'Bancolombia', 'building'],
    ['Tiempo de preparación', '5 min', 'antes una jornada', 'clock'],
  ],
  // [destino, correos, tipos de personal, estado]
  lotes: [
    ['BBVA', 32, 'cajeros, backups, supernumerarios, supervisores y control interno', 'Enviado'],
    ['Bancolombia (Indega)', 86, 'cajeros, backups y supervisores', 'Enviado'],
    ['Técnicos de mantenimiento', 4, 'cerraduras e internet', 'Programado'],
  ],
  preview: {
    oficina: 'BBVA Salitre',
    para: 'buzón de la oficina BBVA Salitre',
    personal: [['Andrea Castillo', 'Cajera'], ['Luis Ramírez', 'Backup'], ['Sandra Gómez', 'Supervisora'], ['Pedro Ortiz', 'Control interno']],
  },
};
