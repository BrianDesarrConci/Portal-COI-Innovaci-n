/**
 * Proveedor de demostración: conserva el ingreso de la demo (cuenta fija + cualquier código de 6 dígitos).
 * Se usa mientras no esté configurado DA (AUTH_PROVEEDOR=demo o sin DA_BASE_URL).
 */
export const USUARIO_DEMO = Object.freeze({
  id: 'demo-nparrado',
  nombre: 'Nubia Parrado',
  correo: 'nubia.parrado@reval.com.co',
  iniciales: 'NP',
  cargo: 'Directora',
  roles: ['admin']
});

const LONGITUD = 6;

export default {
  nombre: 'demo',
  config: () => ({
    campos: [],
    codigo: { longitud: LONGITUD },
    cuenta: { nombre: USUARIO_DEMO.nombre, correo: USUARIO_DEMO.correo, iniciales: USUARIO_DEMO.iniciales, cargo: USUARIO_DEMO.cargo },
    aviso: `Ambiente de demostración: cualquier código de ${LONGITUD} dígitos es válido.`
  }),
  async iniciar() {
    return { desafio: { datos: { id: USUARIO_DEMO.id }, longitud: LONGITUD, destino: 'su autenticador corporativo' } };
  },
  async verificar({ codigo }) {
    if (!new RegExp(`^\\d{${LONGITUD}}$`).test(String(codigo || ''))) return { error: `Ingrese los ${LONGITUD} dígitos del código.` };
    return { usuario: { ...USUARIO_DEMO, roles: [...USUARIO_DEMO.roles] } };
  }
};
