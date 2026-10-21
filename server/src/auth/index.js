/**
 * Ingreso al portal.
 *
 *   GET  /api/auth/config      proveedor activo y campos que pide la pantalla de ingreso
 *   POST /api/auth/login       { usuario, clave }      → { usuario } o { desafio, longitud, destino }
 *   POST /api/auth/verificar   { desafio, codigo }     → { usuario }
 *   GET  /api/auth/me          usuario de la sesión (401 sin sesión)
 *   POST /api/auth/logout
 *
 * Proveedor (AUTH_PROVEEDOR): "da" (API DA de Tecnología) o "demo". Si no se indica, se usa DA cuando
 * DA_BASE_URL está configurada. Con DA todo /api exige sesión; en la demo el API sigue abierto
 * (salvo AUTH_REQUERIDO=1) y, sin sesión, actúa como el usuario de demostración.
 */
import { Router } from 'express';
import demo, { USUARIO_DEMO } from './proveedores/demo.js';
import da from './proveedores/da.js';
import * as sesion from './sesion.js';
import { registrarAcceso } from './accesos.js';

const PROVEEDORES = { demo, da };
const DESAFIO_MS = 5 * 60 * 1000;

export function proveedorActivo() {
  const p = (process.env.AUTH_PROVEEDOR || '').trim().toLowerCase();
  if (PROVEEDORES[p]) return PROVEEDORES[p];
  return process.env.DA_BASE_URL ? da : demo;
}

const exigeSesion = (prov) => prov.nombre !== 'demo' || process.env.AUTH_REQUERIDO === '1';

/** Rutas de /api que no exigen sesión. */
const PUBLICAS = [/^\/api\/health$/, /^\/api\/auth(\/|$)/];

/** Carga req.usuario desde la cookie y bloquea /api sin sesión cuando el proveedor lo exige. */
export function cargarSesion(req, res, next) {
  const prov = proveedorActivo();
  let key;
  try { key = sesion.secreto(prov.nombre); } catch (e) { return next(e); }
  const s = sesion.leer(sesion.leerCookie(req), key);
  if (s && s.p === prov.nombre) { req.usuario = s.u; req.sesionAuth = s; }
  else if (!exigeSesion(prov)) req.usuario = { ...USUARIO_DEMO, roles: [...USUARIO_DEMO.roles] };

  const ruta = req.path;
  if (!req.sesionAuth && exigeSesion(prov) && ruta.startsWith('/api') && !PUBLICAS.some((r) => r.test(ruta))) {
    return res.status(401).json({ error: 'Sesión no iniciada o vencida.', sesion: false });
  }
  next();
}

/** Límite simple de intentos por IP y ruta (memoria del proceso; AUTH_MAX_INTENTOS, por defecto 10). */
function limitador(ventanaMs) {
  const hits = new Map();
  return (req, res, next) => {
    const ahora = Date.now();
    const k = req.ip + ' ' + req.path;
    const h = (hits.get(k) || []).filter((t) => ahora - t < ventanaMs);
    if (h.length >= (Number(process.env.AUTH_MAX_INTENTOS) || 10)) return res.status(429).json({ error: 'Demasiados intentos. Espere unos minutos e intente de nuevo.' });
    h.push(ahora); hits.set(k, h);
    if (hits.size > 5000) hits.clear();
    next();
  };
}

function abrirSesion(req, res, prov, resultado) {
  const u = resultado.usuario;
  const usuario = {
    id: String(u.id), nombre: String(u.nombre || ''), correo: String(u.correo || ''),
    iniciales: String(u.iniciales || ''), cargo: String(u.cargo || ''), roles: Array.isArray(u.roles) ? u.roles.map(String) : []
  };
  const payload = { p: prov.nombre, u: usuario, exp: Date.now() + sesion.duracionMs() };
  if (resultado.token && String(resultado.token).length < 2000) payload.t = String(resultado.token);
  sesion.escribirCookie(req, res, sesion.firmar(payload, sesion.secreto(prov.nombre)), sesion.duracionMs());
  registrarAcceso({ evento: 'ingreso', proveedor: prov.nombre, usuario: usuario.id, nombre: usuario.nombre, ip: req.ip });
  return usuario;
}

const router = Router();
const intentos = limitador(5 * 60 * 1000);

router.get('/config', (_req, res) => {
  const prov = proveedorActivo();
  res.json({ proveedor: prov.nombre, demo: prov.nombre === 'demo', ...prov.config() });
});

router.post('/login', intentos, async (req, res, next) => {
  const prov = proveedorActivo();
  try {
    const { usuario, clave } = req.body || {};
    const r = await prov.iniciar({ usuario: String(usuario || '').trim(), clave: String(clave || '') });
    if (r.error) {
      registrarAcceso({ evento: 'rechazo', proveedor: prov.nombre, usuario: String(usuario || '').slice(0, 80), ip: req.ip });
      return res.status(401).json({ error: r.error });
    }
    if (r.desafio) {
      const token = sesion.firmar({ p: prov.nombre, d: r.desafio.datos, exp: Date.now() + DESAFIO_MS }, sesion.secreto(prov.nombre));
      return res.json({ desafio: token, longitud: r.desafio.longitud, destino: r.desafio.destino || null });
    }
    res.json({ usuario: abrirSesion(req, res, prov, r) });
  } catch (e) { next(e); }
});

router.post('/verificar', intentos, async (req, res, next) => {
  const prov = proveedorActivo();
  try {
    const { desafio, codigo } = req.body || {};
    const d = sesion.leer(desafio, sesion.secreto(prov.nombre));
    if (!d || d.p !== prov.nombre || !d.d) return res.status(401).json({ error: 'La verificación venció. Vuelva a iniciar sesión.', reiniciar: true });
    const r = await prov.verificar({ datos: d.d, codigo: String(codigo || '').trim() });
    if (r.error) {
      registrarAcceso({ evento: 'codigo-rechazado', proveedor: prov.nombre, ip: req.ip });
      return res.status(401).json({ error: r.error });
    }
    res.json({ usuario: abrirSesion(req, res, prov, r) });
  } catch (e) { next(e); }
});

router.get('/me', (req, res) => {
  if (!req.sesionAuth) return res.status(401).json({ error: 'Sesión no iniciada.', sesion: false });
  res.json({ usuario: req.usuario, vence: new Date(req.sesionAuth.exp).toISOString() });
});

router.post('/logout', (req, res) => {
  if (req.sesionAuth) registrarAcceso({ evento: 'salida', proveedor: req.sesionAuth.p, usuario: req.usuario.id, ip: req.ip });
  sesion.borrarCookie(req, res);
  res.json({ ok: true });
});

export default router;
