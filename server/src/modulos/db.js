/**
 * Base de datos de los módulos: MySQL, por tablas. Todos los módulos comparten la base del portal
 * (COI_MYSQL_URL) y cada uno trabaja solo con las tablas que empiezan por su prefijo ("db.prefijo" del
 * manifiesto, p. ej. "nt_"). Un módulo puede ir a otra base con su propia variable (DB_<ID>_URL).
 *
 * API para los módulos:
 *   db.motor                           'mysql'
 *   db.query(sql, params) → { rows, info }   parámetros con ? (nunca concatene valores en el SQL)
 *   db.transaccion(async (tx) => …)    tx.query dentro de BEGIN…COMMIT (ROLLBACK si falla)
 *   db.prefijo                         prefijo de las tablas del módulo
 *
 * Conexión (variables de entorno):
 *   COI_MYSQL_URL   mysql://usuario:clave@servidor:3306/base   (DB_<ID>_URL tiene prioridad para ese módulo)
 *   DB_SSL=1        conexión cifrada verificando el certificado; DB_SSL_CA = certificado PEM de la CA (opcional)
 *   DB_ZONA         zona horaria de la sesión y de las fechas (por defecto -05:00, Colombia)
 *   DB_POOL_MAX     conexiones por pool (por defecto 5)
 * Los DECIMAL llegan como texto (sin pérdida de precisión); conviértalos con Number() si el valor lo permite.
 * Sin URL, el módulo se monta igual y cada consulta responde 503 con un mensaje claro.
 */
import { dividirSQL } from './sql.js';

/** Error con estado HTTP y mensaje visible para el usuario. */
export function errorBD(msg, status = 503) {
  const e = new Error(msg);
  e.status = status; e.expose = true;
  return e;
}

export const varBD = (id) => 'DB_' + id.toUpperCase().replace(/-/g, '_') + '_URL';

/** Formato del prefijo de tablas: 2 a 11 letras o números, empieza por letra y termina en "_". */
export const RE_PREFIJO = /^[a-z][a-z0-9]{1,10}_$/;

/** Prefijo sugerido a partir del id: "validacion" → "validacion_", "control-remesas" → "cr_". */
export function prefijoSugerido(id) {
  const plano = String(id).replace(/[^a-z0-9]/g, '');
  if (plano.length <= 11) return plano + '_';
  const iniciales = String(id).split('-').filter(Boolean).map((p) => p[0]).join('');
  return (iniciales.length >= 2 ? iniciales : plano.slice(0, 11)) + '_';
}

/** URL de la base del módulo: su variable propia o la base compartida del portal. */
export function urlDe(man) {
  const propia = (man.db && man.db.variable) || varBD(man.id);
  return process.env[propia] || process.env.COI_MYSQL_URL || null;
}

/** De dónde sale la URL (para diagnósticos): 'DB_X_URL', 'COI_MYSQL_URL' o null. */
export function origenURL(man) {
  const propia = (man.db && man.db.variable) || varBD(man.id);
  return process.env[propia] ? propia : process.env.COI_MYSQL_URL ? 'COI_MYSQL_URL' : null;
}

function sinConfigurar(man) {
  const falla = async () => { throw errorBD('La base de datos MySQL del portal no está configurada (COI_MYSQL_URL).'); };
  return { motor: 'mysql', prefijo: man.db.prefijo, configurada: false, query: falla, ejecutar: falla, transaccion: falla, bloqueo: falla, cerrar: async () => {} };
}

const zona = () => process.env.DB_ZONA || '-05:00';

function opcionesSSL() {
  if (process.env.DB_SSL !== '1') return undefined;
  const ca = process.env.DB_SSL_CA ? process.env.DB_SSL_CA.replace(/\\n/g, '\n') : undefined;
  return { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
}

// Un pool por URL: los módulos que comparten la base comparten conexiones.
const pools = new Map();

async function obtenerPool(url) {
  let ent = pools.get(url);
  if (!ent) {
    const { default: my } = await import('mysql2/promise');
    const pool = my.createPool({
      uri: url,
      connectionLimit: Number(process.env.DB_POOL_MAX) || 5,
      charset: 'utf8mb4',
      timezone: zona(),
      ssl: opcionesSSL(),
      decimalNumbers: false,
      supportBigNumbers: true,
      waitForConnections: true,
    });
    // La sesión usa la misma zona que el controlador: NOW() y las fechas de JavaScript coinciden.
    pool.on('connection', (c) => c.query('SET time_zone = ?', [zona()], () => {}));
    ent = { pool, usos: 0 };
    pools.set(url, ent);
  }
  ent.usos += 1;
  return ent;
}

const filas = ([r]) => ({ rows: Array.isArray(r) ? r : [], info: Array.isArray(r) ? undefined : r });

/** Ejecuta un script de varias sentencias en una conexión. Si una falla, el error lleva `sentencia` (1, 2, …). */
async function correrScript(c, sentencias) {
  for (let i = 0; i < sentencias.length; i++) {
    try { await c.query(sentencias[i]); } catch (e) { e.sentencia = i + 1; throw e; }
  }
}

export async function conectar(url, man) {
  const ent = await obtenerPool(url);
  const { pool } = ent;
  let cerrado = false;
  const conConexion = async (fn) => { const c = await pool.getConnection(); try { return await fn(c); } finally { c.release(); } };
  const tx = (c) => ({ query: async (s, p) => filas(await c.query(s, p)), ejecutar: (s) => correrScript(c, dividirSQL(s)) });
  return {
    motor: 'mysql',
    prefijo: man && man.db ? man.db.prefijo : undefined,
    configurada: true,
    url,
    query: async (sql, params) => filas(await pool.query(sql, params)),
    ejecutar: (sql) => conConexion((c) => correrScript(c, dividirSQL(sql))),
    transaccion: (fn) => conConexion(async (c) => {
      await c.beginTransaction();
      try { const r = await fn(tx(c)); await c.commit(); return r; }
      catch (e) { await c.rollback().catch(() => {}); throw e; }
    }),
    // Bloqueo con nombre: evita que dos instancias (p. ej. dos funciones de Vercel) migren a la vez.
    bloqueo: (clave, fn) => conConexion(async (c) => {
      const [[r]] = await c.query('SELECT GET_LOCK(?, 60) AS ok', [clave]);
      if (!r || Number(r.ok) !== 1) throw errorBD('No se obtuvo el bloqueo de migraciones (' + clave + '). Intente de nuevo.', 503);
      try { return await fn(); } finally { await c.query('SELECT RELEASE_LOCK(?)', [clave]).catch(() => {}); }
    }),
    async cerrar() {
      if (cerrado) return;
      cerrado = true;
      ent.usos -= 1;
      if (ent.usos <= 0) { pools.delete(url); await pool.end().catch(() => {}); }
    },
  };
}

/**
 * Abre la BD de un módulo según su manifiesto. Devuelve null si "db.motor" es "ninguna".
 * Opciones: { url } fuerza una URL (null = sin configurar; lo usan las pruebas).
 */
export async function abrirBD(man, opciones = {}) {
  const { log = console } = opciones;
  const motor = man.db && man.db.motor;
  if (!motor || motor === 'ninguna') return null;
  if (motor !== 'mysql') throw new Error(`Motor de BD no soportado en ${man.id}: ${motor}. Los módulos usan MySQL.`);
  const url = 'url' in opciones ? opciones.url : urlDe(man);
  if (!url) {
    if (!('url' in opciones)) log.warn('sin COI_MYSQL_URL; las operaciones de BD responderán 503.');
    return sinConfigurar(man);
  }
  return conectar(url, man);
}
