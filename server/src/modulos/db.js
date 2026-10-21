/**
 * Base de datos propia de cada módulo. El manifiesto declara el motor y la variable de entorno con la URL:
 *   "db": { "motor": "postgres" | "mysql" | "ninguna", "variable": "DB_<ID>_URL" }
 *
 * API uniforme para los módulos:
 *   db.motor                          'postgres' | 'mysql'
 *   db.query(sql, params) → { rows }  una sentencia con parámetros ($1, $2… en PostgreSQL; ? en MySQL)
 *   db.transaccion(async (tx) => …)   tx.query / tx.ejecutar dentro de BEGIN…COMMIT (ROLLBACK si falla)
 *   db.ejecutar(sql)                  script de varias sentencias, sin parámetros (migraciones)
 *
 * Sin la variable de entorno, un módulo PostgreSQL usa PGlite (PostgreSQL embebido en WASM) guardado en
 * $DATA_DIR/modulos/<id>: sirve para desarrollo y demostración, no para producción.
 * Los controladores se cargan solo cuando un módulo los necesita.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dirDatos = () => path.resolve(process.env.DATA_DIR || path.join(here, '..', '..', 'var'));

/** Error con estado HTTP y mensaje visible para el usuario. */
export function errorBD(msg, status = 503) {
  const e = new Error(msg);
  e.status = status; e.expose = true;
  return e;
}

function sinConfigurar(man) {
  const falla = async () => { throw errorBD(`BD del módulo ${man.id} no configurada (${man.db.variable}).`); };
  return { motor: man.db.motor, configurada: false, query: falla, ejecutar: falla, transaccion: falla, bloqueo: falla, cerrar: async () => {} };
}

async function postgres(url) {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX) || 5, idleTimeoutMillis: 30000 });
  pool.on('error', (e) => console.error('[módulos] error en la conexión PostgreSQL:', e.message));
  const conCliente = async (fn) => { const c = await pool.connect(); try { return await fn(c); } finally { c.release(); } };
  const tx = (c) => ({ query: (s, p) => c.query(s, p), ejecutar: (s) => c.query(s) });
  return {
    motor: 'postgres',
    configurada: true,
    query: (sql, params) => pool.query(sql, params),
    ejecutar: (sql) => pool.query(sql),
    transaccion: (fn) => conCliente(async (c) => {
      await c.query('BEGIN');
      try { const r = await fn(tx(c)); await c.query('COMMIT'); return r; }
      catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; }
    }),
    // Bloqueo consultivo: evita que dos instancias apliquen migraciones a la vez.
    bloqueo: (clave, fn) => conCliente(async (c) => {
      await c.query('SELECT pg_advisory_lock(hashtext($1))', [clave]);
      try { return await fn(); } finally { await c.query('SELECT pg_advisory_unlock(hashtext($1))', [clave]).catch(() => {}); }
    }),
    cerrar: () => pool.end(),
  };
}

async function mysql(url) {
  const { default: my } = await import('mysql2/promise');
  const pool = my.createPool({ uri: url, connectionLimit: Number(process.env.DB_POOL_MAX) || 5, dateStrings: false });
  const filas = ([r]) => ({ rows: Array.isArray(r) ? r : [], info: Array.isArray(r) ? undefined : r });
  // Las migraciones usan una conexión aparte que admite varias sentencias; el pool normal no.
  const script = async (sql) => { const c = await my.createConnection({ uri: url, multipleStatements: true }); try { await c.query(sql); } finally { await c.end(); } };
  return {
    motor: 'mysql',
    configurada: true,
    query: async (sql, params) => filas(await pool.query(sql, params)),
    ejecutar: script,
    transaccion: async (fn) => {
      const c = await pool.getConnection();
      try {
        await c.beginTransaction();
        const r = await fn({ query: async (s, p) => filas(await c.query(s, p)), ejecutar: async (s) => { for (const x of dividir(s)) await c.query(x); } });
        await c.commit();
        return r;
      } catch (e) { await c.rollback().catch(() => {}); throw e; } finally { c.release(); }
    },
    bloqueo: async (clave, fn) => {
      const c = await pool.getConnection();
      try {
        await c.query('SELECT GET_LOCK(?, 60)', [clave]);
        try { return await fn(); } finally { await c.query('SELECT RELEASE_LOCK(?)', [clave]).catch(() => {}); }
      } finally { c.release(); }
    },
    cerrar: () => pool.end(),
  };
}

/** Divide un script SQL en sentencias por ";" al final de línea (suficiente para migraciones de MySQL). */
function dividir(sql) {
  return sql.split(/;\s*(?:\r?\n|$)/).map((s) => s.trim()).filter((s) => s && !/^(--[^\n]*\n?)+$/.test(s));
}

async function pglite(id, memoria) {
  const { PGlite } = await import('@electric-sql/pglite');
  let dir;
  if (!memoria) { dir = path.join(dirDatos(), 'modulos', id); fs.mkdirSync(dir, { recursive: true }); }
  const db = new PGlite(dir);
  await db.waitReady;
  let cola = Promise.resolve();
  // PGlite atiende una operación a la vez: las transacciones se encadenan.
  const enCola = (fn) => { const r = cola.then(fn, fn); cola = r.catch(() => {}); return r; };
  return {
    motor: 'postgres',
    configurada: true,
    embebida: true,
    query: (sql, params) => db.query(sql, params),
    ejecutar: (sql) => db.exec(sql),
    transaccion: (fn) => enCola(() => db.transaction((t) => fn({ query: (s, p) => t.query(s, p), ejecutar: (s) => t.exec(s) }))),
    bloqueo: (_clave, fn) => fn(),
    cerrar: () => db.close(),
  };
}

/**
 * Abre la BD de un módulo según su manifiesto. Devuelve null si el motor es "ninguna".
 * Opciones: { memoria } para PGlite en memoria (pruebas), { url } para forzar una URL.
 */
export async function abrirBD(man, { memoria = false, url, log = console } = {}) {
  const motor = man.db && man.db.motor;
  if (!motor || motor === 'ninguna') return null;
  const cadena = url || (man.db.variable && process.env[man.db.variable]);
  if (motor === 'postgres') {
    if (cadena) return postgres(cadena);
    if (!memoria) log.warn(`sin ${man.db.variable}; se usa PostgreSQL embebido (PGlite) en ${path.join(dirDatos(), 'modulos', man.id)}. Solo para desarrollo y demostración.`);
    return pglite(man.id, memoria);
  }
  if (motor === 'mysql') {
    if (cadena) return mysql(cadena);
    log.warn(`sin ${man.db.variable}; las operaciones de BD responderán 503.`);
    return sinConfigurar(man);
  }
  throw new Error(`Motor de BD no soportado en ${man.id}: ${motor}`);
}
