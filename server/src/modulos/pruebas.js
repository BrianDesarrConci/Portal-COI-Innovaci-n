/**
 * Ayudas para probar un módulo con node:test (se importan como '#coi/pruebas').
 *
 *   import { test, before, after } from 'node:test';
 *   import { probarModulo, requiereMySQL } from '#coi/pruebas';
 *   let m;
 *   before(async () => { m = await probarModulo(new URL('..', import.meta.url)); });   // carpeta del módulo
 *   after(() => m.cerrar());
 *   test('crea un registro', { skip: requiereMySQL }, async () => {
 *     const r = await m.pedir('POST', '/registros', { titulo: 'x' });                 // → { status, body }
 *   });
 *
 * La base de pruebas es MySQL real: COI_TEST_MYSQL_URL (mysql://usuario:clave@127.0.0.1:3306/base). Cada
 * probarModulo() crea una base temporal coi_test_<aleatorio>, aplica las migraciones y la borra al cerrar.
 * Sin COI_TEST_MYSQL_URL el módulo se monta sin base (responde 503) y las pruebas marcadas con
 * { skip: requiereMySQL } se omiten: así `npm test` nunca falla por no tener MySQL a mano.
 */
import crypto from 'node:crypto';
import express from 'express';
import { cargarDesdeCarpeta } from './montaje.js';
import { crearRouterModulos } from './router.js';

export const USUARIO_PRUEBA = { id: 'prueba', nombre: 'Usuario de Prueba', correo: 'prueba@reval.com.co', iniciales: 'UP', cargo: 'Analista', roles: ['analista'] };

const URL_PRUEBAS = process.env.COI_TEST_MYSQL_URL || '';
/** Para { skip: requiereMySQL }: false si hay MySQL de pruebas, o el motivo de la omisión. */
export const requiereMySQL = URL_PRUEBAS ? false : 'Sin COI_TEST_MYSQL_URL: se omiten las pruebas con base de datos.';

/**
 * Crea una base temporal en el MySQL de pruebas. Devuelve { url, nombre, borrar() } o null sin COI_TEST_MYSQL_URL.
 * El usuario de pruebas necesita permiso para crear bases (p. ej. GRANT ALL ON `coi\_test%`.* TO ...).
 */
export async function baseTemporal() {
  if (!URL_PRUEBAS) return null;
  const { default: my } = await import('mysql2/promise');
  const nombre = 'coi_test_' + crypto.randomBytes(5).toString('hex');
  const admin = await my.createConnection({ uri: URL_PRUEBAS });
  try { await admin.query(`CREATE DATABASE \`${nombre}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`); } finally { await admin.end(); }
  const u = new URL(URL_PRUEBAS);
  u.pathname = '/' + nombre;
  return {
    url: u.toString(),
    nombre,
    async borrar() {
      const c = await my.createConnection({ uri: URL_PRUEBAS });
      try { await c.query(`DROP DATABASE IF EXISTS \`${nombre}\``); } finally { await c.end(); }
    },
  };
}

export async function probarModulo(dir, { usuario = USUARIO_PRUEBA } = {}) {
  const entrada = await cargarDesdeCarpeta(dir);
  const id = entrada.manifiesto.id;
  const usaBD = entrada.manifiesto.db && entrada.manifiesto.db.motor === 'mysql';
  const temporal = usaBD ? await baseTemporal() : null;
  const router = crearRouterModulos([entrada], { url: temporal ? temporal.url : null });
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  // Cada petición puede simular otro usuario con el encabezado x-prueba-usuario (JSON) o "anonimo".
  app.use((req, _res, next) => {
    const h = req.headers['x-prueba-usuario'];
    req.usuario = h === 'anonimo' ? undefined : h ? JSON.parse(h) : usuario;
    next();
  });
  app.use('/api/m', router);
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api/m/${id}`;
  let db;
  try { ({ db } = await router.preparar(id)); } catch (e) {
    await new Promise((r) => server.close(r));
    if (temporal) await temporal.borrar();
    throw e;
  }
  return {
    id, base, db,
    /** true si el módulo tiene una base MySQL de pruebas conectada. */
    conBD: !!(db && db.configurada !== false),
    /** Petición al módulo. Devuelve { status, body }. `como` = otro usuario o 'anonimo'. */
    async pedir(metodo, ruta, cuerpo, { como } = {}) {
      const headers = {};
      if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
      if (como) headers['x-prueba-usuario'] = como === 'anonimo' ? 'anonimo' : JSON.stringify(como);
      const r = await fetch(base + ruta, { method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
      const txt = await r.text();
      let body; try { body = JSON.parse(txt); } catch { body = txt; }
      return { status: r.status, body };
    },
    async cerrar() {
      await new Promise((r) => server.close(r));
      await router.cerrar();
      if (temporal) await temporal.borrar();
    },
  };
}
