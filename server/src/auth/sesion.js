/**
 * Sesión del portal en una cookie firmada (HMAC-SHA256), sin estado en el servidor:
 * funciona igual en local y en las funciones de Vercel.
 * Contenido: { u: usuario, t?: datos del proveedor (p. ej. token de DA), exp: epoch ms }.
 */
import crypto from 'node:crypto';

export const COOKIE = 'coi_sesion';
const DEMO_SECRET = 'coi-demo-no-usar-en-produccion';

/** Duración de la sesión en minutos (COI_SESION_MINUTOS, por defecto 8 h). */
export const duracionMs = () => (Number(process.env.COI_SESION_MINUTOS) || 480) * 60 * 1000;

/**
 * Secreto de firma. Con el proveedor DA es obligatorio (COI_SESSION_SECRET, 32+ caracteres);
 * en la demo, si falta, se usa uno fijo para que todas las instancias acepten la misma cookie.
 */
export function secreto(proveedor) {
  const s = process.env.COI_SESSION_SECRET;
  if (s && s.length >= 32) return s;
  if (proveedor === 'demo') return DEMO_SECRET;
  const err = new Error('Falta COI_SESSION_SECRET (mínimo 32 caracteres) para el ingreso con DA.');
  err.status = 500; err.expose = true;
  throw err;
}

const b64 = (buf) => Buffer.from(buf).toString('base64url');
const firma = (datos, key) => b64(crypto.createHmac('sha256', key).update(datos).digest());

export function firmar(payload, key) {
  const datos = b64(JSON.stringify(payload));
  return datos + '.' + firma(datos, key);
}

export function leer(valor, key) {
  if (!valor || typeof valor !== 'string') return null;
  const i = valor.lastIndexOf('.');
  if (i <= 0) return null;
  const datos = valor.slice(0, i);
  const esperada = Buffer.from(firma(datos, key));
  const recibida = Buffer.from(valor.slice(i + 1));
  if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) return null;
  try {
    const p = JSON.parse(Buffer.from(datos, 'base64url').toString('utf8'));
    return p && p.exp > Date.now() ? p : null;
  } catch { return null; }
}

export function leerCookie(req, nombre = COOKIE) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const parte of raw.split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nombre) {
      try { return decodeURIComponent(parte.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

const seguro = (req) => req.secure || req.headers['x-forwarded-proto'] === 'https';

export function escribirCookie(req, res, valor, maxAgeMs) {
  const partes = [`${COOKIE}=${encodeURIComponent(valor)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
  if (seguro(req)) partes.push('Secure');
  res.append('Set-Cookie', partes.join('; '));
}

export const borrarCookie = (req, res) => escribirCookie(req, res, '', 0);
