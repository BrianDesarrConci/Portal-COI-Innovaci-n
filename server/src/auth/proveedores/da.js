/**
 * Proveedor DA (API de autenticación de Tecnología).
 *
 * Flujo: usuario + clave → (código de verificación si DA lo exige) → usuario del portal.
 * Todo lo específico de DA está en este archivo: rutas, cuerpo de las peticiones y lectura de la respuesta.
 * Al recibir la documentación oficial se ajustan `pedir`, `leerDesafio` y `mapearUsuario`; el resto del
 * portal (sesión, middleware, pantalla de ingreso) no cambia.
 *
 * Variables de entorno:
 *   DA_BASE_URL         URL base del API (obligatoria)
 *   DA_API_KEY          credencial del aplicativo COI ante DA (si DA la exige)
 *   DA_API_KEY_HEADER   encabezado donde va la credencial (por defecto x-api-key)
 *   DA_RUTA_LOGIN       por defecto /auth/login
 *   DA_RUTA_VERIFICAR   por defecto /auth/verificar
 *   DA_MAPA_ROLES       JSON { "PERFIL_EN_DA": "rol-coi" } (p. ej. {"ADMINISTRADOR":"admin"})
 *   DA_TIMEOUT_MS       por defecto 10000
 */
const env = (k, d) => (process.env[k] || d || '').trim();

export class ErrorDA extends Error {
  constructor(msg, status = 502) { super(msg); this.status = status; this.expose = true; }
}

function mapaRoles() {
  try { return JSON.parse(env('DA_MAPA_ROLES', '{}')); } catch { return {}; }
}

async function pedir(ruta, cuerpo) {
  const base = env('DA_BASE_URL').replace(/\/+$/, '');
  if (!base) throw new ErrorDA('El ingreso con DA no está configurado (DA_BASE_URL).', 500);
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  if (env('DA_API_KEY')) headers[env('DA_API_KEY_HEADER', 'x-api-key')] = env('DA_API_KEY');
  let res;
  try {
    res = await fetch(base + ruta, {
      method: 'POST', headers, body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(Number(env('DA_TIMEOUT_MS', '10000')))
    });
  } catch (e) {
    console.error('[DA] sin respuesta:', e.message);
    throw new ErrorDA('El servicio de autenticación DA no responde. Intente de nuevo en unos minutos.');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 400 || res.status === 401 || res.status === 403) return { rechazo: data, status: res.status };
  if (!res.ok) {
    console.error('[DA] respuesta', res.status, ruta);
    throw new ErrorDA('El servicio de autenticación DA respondió con un error (' + res.status + ').');
  }
  return { data };
}

const primero = (o, ...claves) => { for (const k of claves) if (o && o[k] != null && o[k] !== '') return o[k]; return undefined; };

/** Si DA pide un segundo factor, devuelve la transacción a recordar; si no, null. */
function leerDesafio(d) {
  const requiere = primero(d, 'requiereCodigo', 'requiere_codigo', 'otpRequired', 'otp_required', 'mfaRequired', 'mfa');
  const tx = primero(d, 'transaccion', 'transaction', 'transactionId', 'idTransaccion', 'challengeId', 'challenge_id');
  const token = primero(d, 'token', 'access_token', 'accessToken');
  if (!requiere && !(tx && !token)) return null;
  return { tx, longitud: Number(primero(d, 'longitud', 'length', 'digits')) || 6, destino: primero(d, 'destino', 'destination', 'canal') };
}

const iniciales = (nombre) => String(nombre || '').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'U';

/** Convierte la respuesta de DA al usuario del portal. */
export function mapearUsuario(d, usuarioIngresado) {
  const u = primero(d, 'usuario', 'user', 'perfil', 'profile', 'data') || d;
  const nombre = primero(u, 'nombre', 'nombreCompleto', 'name', 'fullName', 'displayName') || usuarioIngresado;
  const perfiles = [].concat(primero(u, 'roles', 'perfiles', 'profiles', 'groups', 'grupos') || []).map((r) => (typeof r === 'string' ? r : primero(r, 'nombre', 'name', 'codigo', 'code'))).filter(Boolean);
  const mapa = mapaRoles();
  const roles = [...new Set(perfiles.map((p) => mapa[p] || String(p).toLowerCase()))];
  return {
    usuario: {
      id: String(primero(u, 'id', 'idUsuario', 'userId', 'sub', 'username', 'usuario') || usuarioIngresado),
      nombre: String(nombre),
      correo: String(primero(u, 'correo', 'email', 'mail') || ''),
      iniciales: iniciales(nombre),
      cargo: String(primero(u, 'cargo', 'title', 'jobTitle', 'puesto') || ''),
      roles
    },
    token: primero(d, 'token', 'access_token', 'accessToken')
  };
}

function rechazo(r, porDefecto) {
  const m = primero(r.rechazo, 'mensaje', 'message', 'error');
  return { error: typeof m === 'string' ? m : r.status === 400 ? 'Datos de ingreso incompletos.' : porDefecto };
}

export default {
  nombre: 'da',
  config: () => ({ campos: ['usuario', 'clave'], codigo: { longitud: 6 } }),

  async iniciar({ usuario, clave }) {
    if (!usuario || !clave) return { error: 'Ingrese su usuario y su clave.' };
    const r = await pedir(env('DA_RUTA_LOGIN', '/auth/login'), { usuario, clave });
    if (r.rechazo) return rechazo(r, 'Usuario o clave incorrectos.');
    const des = leerDesafio(r.data);
    if (des) return { desafio: { datos: { tx: des.tx, usuario }, longitud: des.longitud, destino: des.destino } };
    const m = mapearUsuario(r.data, usuario);
    return { usuario: m.usuario, token: m.token };
  },

  async verificar({ datos, codigo }) {
    if (!/^\d{4,8}$/.test(String(codigo || ''))) return { error: 'Ingrese el código de verificación completo.' };
    const r = await pedir(env('DA_RUTA_VERIFICAR', '/auth/verificar'), { transaccion: datos.tx, usuario: datos.usuario, codigo: String(codigo) });
    if (r.rechazo) return rechazo(r, 'Código incorrecto o vencido.');
    const m = mapearUsuario(r.data, datos.usuario);
    return { usuario: m.usuario, token: m.token };
  }
};
