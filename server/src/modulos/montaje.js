/**
 * Monta un módulo: abre su BD, aplica sus migraciones y llama a su función registrar() con un Router
 * de Express que ya captura los errores de los manejadores async.
 *
 * Contexto que recibe registrar({ router, db, config, log, modulo, acceso }):
 *   router   Router de Express montado en /api/m/<id> (req.usuario = usuario de la sesión)
 *   db       BD propia del módulo (ver db.js) o null si "db.motor" es "ninguna"
 *   config   { id, env(nombre, defecto) } lee la variable MOD_<ID>_<NOMBRE>
 *   log      { info, warn, error } con el prefijo del módulo
 *   modulo   manifiesto del módulo
 *   acceso   { tieneRol(usuario, rol), puedeAcceder(usuario, roles) }
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Router } from 'express';
import { puedeAcceder, tieneRol } from '../auth/roles.js';
import { abrirBD, prefijoSugerido } from './db.js';
import { migrar } from './migraciones.js';

const RE_MIGRACION = /^(\d{3})_[a-z0-9_]+\.sql$/;

/** Completa los valores por defecto del manifiesto. */
export function normalizar(man) {
  return {
    ...man,
    acceso: { roles: (man.acceso && man.acceso.roles) || [] },
    db: man.db && man.db.motor && man.db.motor !== 'ninguna'
      ? { ...man.db, prefijo: man.db.prefijo || prefijoSugerido(man.id) }
      : { motor: 'ninguna', variable: null },
  };
}

export const prefijoConfig = (id) => 'MOD_' + id.toUpperCase().replace(/-/g, '_') + '_';

function crearLog(id) {
  const p = `[módulo ${id}]`;
  return { info: (...a) => console.log(p, ...a), warn: (...a) => console.warn(p, ...a), error: (...a) => console.error(p, ...a) };
}

/** Envuelve un manejador para que los errores (también de funciones async) lleguen a next(). */
function envolver(fn) {
  if (Array.isArray(fn)) return fn.map(envolver);
  if (typeof fn !== 'function' || fn.stack) return fn; // otros Router se dejan tal cual
  if (fn.length === 4) return (err, req, res, next) => { try { const r = fn(err, req, res, next); if (r && r.then) r.catch(next); } catch (e) { next(e); } };
  return (req, res, next) => { try { const r = fn(req, res, next); if (r && r.then) r.catch(next); } catch (e) { next(e); } };
}
const METODOS = ['get', 'post', 'put', 'patch', 'delete', 'all', 'use', 'options', 'head'];
function routerSeguro() {
  const r = Router();
  for (const m of METODOS) { const orig = r[m].bind(r); r[m] = (...args) => orig(...args.map(envolver)); }
  const route = r.route.bind(r);
  r.route = (ruta) => {
    const ro = route(ruta);
    for (const m of METODOS.filter((x) => x !== 'use')) { const orig = ro[m].bind(ro); ro[m] = (...args) => { orig(...args.map(envolver)); return ro; }; }
    return ro;
  };
  return r;
}

/**
 * Prepara un módulo. `entrada` = { manifiesto, registrar, migraciones: [{ nombre, url | ruta }] }.
 * `opciones.url` fuerza la URL de MySQL (null = sin base; lo usan las pruebas).
 * Devuelve { manifiesto, db, manejador, migraciones: { aplicadas, total } }.
 */
export async function montar(entrada, opciones = {}) {
  const man = normalizar(entrada.manifiesto);
  const log = crearLog(man.id);
  const db = await abrirBD(man, { ...opciones, log });
  const migraciones = db && db.configurada !== false ? await migrar(db, man.id, entrada.migraciones || [], log) : { aplicadas: [], total: 0 };
  const router = routerSeguro();
  const pre = prefijoConfig(man.id);
  const config = { id: man.id, env: (nombre, defecto) => (process.env[pre + nombre] !== undefined ? process.env[pre + nombre] : defecto) };
  await entrada.registrar({ router, db, config, log, modulo: man, acceso: { tieneRol, puedeAcceder } });
  router.use((req, res) => res.status(404).json({ error: `Ruta no encontrada en el módulo ${man.id}: ${req.method} ${req.path}` }));
  // eslint-disable-next-line no-unused-vars
  router.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) log.error(err);
    res.status(status).json({ error: status < 500 || err.expose ? err.message : `Error interno del módulo ${man.id}` });
  });
  return { manifiesto: man, db, manejador: router, migraciones };
}

/** Carga un módulo directamente desde su carpeta (pruebas y CLI): server/src/modulos/<id>. */
export async function cargarDesdeCarpeta(dir) {
  const d = dir instanceof URL ? fileURLToPath(dir) : String(dir).startsWith('file:') ? fileURLToPath(dir) : dir;
  const manifiesto = JSON.parse(fs.readFileSync(path.join(d, 'module.json'), 'utf8'));
  const { default: registrar } = await import(pathToFileURL(path.join(d, 'server', 'index.js')).href);
  const dirMig = path.join(d, 'server', 'migraciones');
  const migraciones = fs.existsSync(dirMig) ? fs.readdirSync(dirMig).filter((n) => RE_MIGRACION.test(n)).sort().map((nombre) => ({ nombre, ruta: path.join(dirMig, nombre) })) : [];
  return { manifiesto, registrar, migraciones };
}
