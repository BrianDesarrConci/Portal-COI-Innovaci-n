/**
 * Registro único de clientes del portal. Todos los clientes tienen el mismo espacio de trabajo
 * (Cliente 360 en /cliente/:key); ninguno vive suelto en el menú.
 *  - key:        identificador de la ruta (y del catálogo del tablero, cuando existe).
 *  - nombre:     nombre comercial.
 *  - real:       valor de la columna CLIENTE en el Directorio Nacional y la Granja (null si no tiene red de oficinas).
 *  - segmento:   agrupación de negocio para el menú.
 *  - modulo:     vista del módulo especializado del cliente, si lo tiene.
 *  - catalogo:   true si el cliente está en el catálogo de actividades y ANS del tablero.
 */
export const SEGMENTOS = ['Bancos', 'Fondos de pensiones', 'Cooperativas y financieras', 'Sector público', 'Red propia'];

export const CLIENTES = [
  { key: 'bbva', nombre: 'BBVA', real: 'BBVA', segmento: 'Bancos', catalogo: true },
  { key: 'bogota', nombre: 'Banco de Bogotá', real: 'BANCO BOGOTA', segmento: 'Bancos', catalogo: true },
  { key: 'agrario', nombre: 'Banco Agrario', real: 'BANCO AGRARIO', segmento: 'Bancos', modulo: { view: 'agrario', nombre: 'Operación Banco Agrario' }, catalogo: true },
  { key: 'davivienda', nombre: 'Davivienda', real: 'DAVIVIENDA', segmento: 'Bancos', catalogo: true },
  { key: 'popular', nombre: 'Banco Popular', real: 'BANCO POPULAR', segmento: 'Bancos', catalogo: true },
  { key: 'bancolombia', nombre: 'Bancolombia', real: 'BANCOLOMBIA', segmento: 'Bancos', catalogo: true },
  { key: 'occidente', nombre: 'Banco de Occidente', real: 'BANCO OCCIDENTE', segmento: 'Bancos', catalogo: true },
  { key: 'itau', nombre: 'Itaú', real: 'ITAU', segmento: 'Bancos', catalogo: false },
  { key: 'cajasocial', nombre: 'Banco Caja Social', real: 'BANCO CAJA SOCIAL', segmento: 'Bancos', catalogo: true },
  { key: 'citibank', nombre: 'Citibank', real: 'CITI', segmento: 'Bancos', catalogo: true },
  { key: 'avvillas', nombre: 'AV Villas', real: 'AV VILLAS', segmento: 'Bancos', catalogo: false },
  { key: 'union', nombre: 'Banco Unión', real: null, segmento: 'Bancos', catalogo: true },
  { key: 'colfondos', nombre: 'Colfondos', real: null, segmento: 'Fondos de pensiones', catalogo: true },
  { key: 'proteccion', nombre: 'Protección', real: null, segmento: 'Fondos de pensiones', catalogo: true },
  { key: 'porvenir', nombre: 'Porvenir', real: null, segmento: 'Fondos de pensiones', modulo: { view: 'cheques', nombre: 'Cheques, arqueos y valores' }, catalogo: true },
  { key: 'fincomercio', nombre: 'Fincomercio', real: 'FINCOMERCIO', segmento: 'Cooperativas y financieras', modulo: { view: 'fincomercio', nombre: 'Operación diaria Fincomercio' }, catalogo: true },
  { key: 'coopcentral', nombre: 'Coopcentral', real: 'COOPCENTRAL', segmento: 'Cooperativas y financieras', catalogo: true },
  { key: 'snr', nombre: 'SNR', real: 'SNR', segmento: 'Sector público', catalogo: true },
  { key: 'multival', nombre: 'Multival (red propia)', real: 'MULTIVAL', segmento: 'Red propia', catalogo: false }
];
export const CLIENTE = Object.fromEntries(CLIENTES.map((c) => [c.key, c]));
/** Cliente cuyo módulo especializado es la vista dada (p. ej. 'fincomercio' → Fincomercio). */
export const clientePorModulo = (view) => CLIENTES.find((c) => c.modulo && c.modulo.view === view) || null;
