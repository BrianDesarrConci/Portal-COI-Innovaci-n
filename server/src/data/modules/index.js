// Mapa estático de datos por módulo (/api/modules/:view). Importaciones literales para que
// el empaquetador de funciones (Vercel) incluya cada archivo.
export const MODULE_DATA = {
  "agrario": () => import('./agrario.js'),
  "alertas": () => import('./alertas.js'),
  "cheques": () => import('./cheques.js'),
  "clientes": () => import('./clientes.js'),
  "facturacion": () => import('./facturacion.js'),
  "fincomercio": () => import('./fincomercio.js'),
  "ingresos": () => import('./ingresos.js'),
  "inicio": () => import('./inicio.js'),
  "malas": () => import('./malas.js'),
  "novedades": () => import('./novedades.js'),
  "oficinas": () => import('./oficinas.js'),
  "papeleria": () => import('./papeleria.js'),
  "pqr": () => import('./pqr.js'),
  "procesos": () => import('./procesos.js'),
  "ptr": () => import('./ptr.js'),
  "reporteria": () => import('./reporteria.js'),
  "usuarios": () => import('./usuarios.js'),
  "validacion": () => import('./validacion.js'),
};
