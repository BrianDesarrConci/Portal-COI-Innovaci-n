// N6 Facturación y conciliación: datos de demostración del módulo.
export default {
  kpis: [
    ['Facturas listas', '6 de 8', 'cierre de octubre', 'receipt'],
    ['Descuentos por falta de personal', '$ 0', 'en el mes; histórico 2026 consolidado', 'shield'],
    ['Partidas abiertas', 14, 'cada una con código y responsable', 'list'],
    ['Datáfonos conciliados hoy', '19 de 19', 'Davivienda', 'check'],
  ],
  // [cliente, alcance, novedades, validadas, responsable]
  facturacion: [
    ['BBVA', 'Facturación, horas extra y complementarios', 32, 32, 'lina'],
    ['Banco Popular y SNR', 'Novedades validadas por líderes', 18, 18, 'lina'],
    ['Indega', 'Programación mensual', 1, 1, 'lina'],
    ['Davivienda', 'CTL con cruce sistema y Drive', 19, 17, 'yesica'],
    ['Banco de Bogotá', '50 oficinas con control de descuentos', 50, 48, 'maira'],
    ['Citibank', 'Horas extra liquidadas por el líder', 46, 46, 'maira'],
    ['Fincomercio', 'Horas extra y adiciones de tiempo', 12, 12, 'maira'],
    ['Banco Caja Social', 'Facturación mensual', 1, 1, 'maira'],
  ],
  // [código, cliente, concepto, valor, estado]
  partidas: [
    ['PC-2022-014', 'Banco Popular', 'Consignación sin soporte', '2.340.000', 'Sofía, en revisión con Milena'],
    ['PC-2022-021', 'Banco Popular', 'Diferencia en canje', '870.500', 'Soporte enviado'],
    ['PC-2026-103', 'BBVA', 'Recaudo manual sin tipificar', '1.120.000', 'Tipificado hoy'],
    ['PC-2026-109', 'Davivienda', 'Datáfono sin cierre', '455.000', 'Conciliado'],
  ],
  // [radicado, oficina, valor, estado]
  reembolsos: [
    ['RE-0881', 'Davivienda oficina 4', '380.000', 'Enviado a Eduardo'],
    ['RE-0883', 'Davivienda oficina 11', '1.020.000', 'Aprobado'],
    ['RE-0885', 'Davivienda oficina 7', '215.000', 'En revisión'],
  ],
  cuentasCobro: [['CC-0212', 'Restrepo', '450.000', 'Descontado en nómina'], ['CC-0215', 'Suba', '1.200.000', 'En Tesorería'], ['CC-0219', 'Bosa', '300.000', 'En Diferencias']],
  descuentosVehiculares: [['DV-0091', 'Descuento vehicular, oficina 3', 'Factura generada'], ['DV-0094', 'Descuento vehicular, oficina 12', 'Dentro del rango, por facturar']],
  // [tipo, transacciones, tipificadas]
  recaudoManual: [['Consignación a cuenta', 1284, 1284], ['Pago de tarjeta', 512, 512], ['Recaudo de convenio', 377, 371]],
  // [mes, millones descontados]
  descuentos: [['ene', 0], ['feb', 1.8], ['mar', 2.4], ['abr', 1.1], ['may', 0.9], ['jun', 0.6], ['jul', 0.4], ['ago', 0.2], ['sep', 0], ['oct', 0]],
};
