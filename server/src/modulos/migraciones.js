/**
 * Migraciones versionadas de la BD de cada módulo (server/migraciones/NNN_nombre.sql).
 * Se aplican en orden, cada una en su transacción, y quedan registradas en la tabla coi_migraciones
 * de la propia BD del módulo con su checksum. Si una migración ya aplicada cambia, se detiene:
 * los cambios se hacen siempre con una migración nueva.
 * Nota MySQL: las sentencias DDL (CREATE/ALTER) confirman la transacción por sí solas.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

const TABLA = `CREATE TABLE IF NOT EXISTS coi_migraciones (
  nombre VARCHAR(200) PRIMARY KEY,
  checksum CHAR(64) NOT NULL,
  aplicada TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

/** Checksum independiente del fin de línea (Windows / Unix). */
export const checksum = (sql) => crypto.createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');

/** Lee el SQL de cada migración. `lista` = [{ nombre, url | ruta | sql }]. */
export function leerMigraciones(lista) {
  return lista.map((m) => ({ nombre: m.nombre, sql: m.sql !== undefined ? m.sql : fs.readFileSync(m.url || m.ruta, 'utf8') }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

/**
 * Aplica las migraciones pendientes. Devuelve { aplicadas: [nombres nuevos], total }.
 * `db` es el manejador de abrirBD(); `id` se usa para el bloqueo entre instancias.
 */
export async function migrar(db, id, lista, log = console) {
  if (!db) return { aplicadas: [], total: 0 };
  const migs = leerMigraciones(lista);
  const p = db.motor === 'mysql' ? ['?', '?'] : ['$1', '$2'];
  return db.bloqueo('coi_migraciones:' + id, async () => {
    await db.ejecutar(TABLA);
    const { rows } = await db.query('SELECT nombre, checksum FROM coi_migraciones ORDER BY nombre');
    const hechas = new Map(rows.map((r) => [r.nombre, String(r.checksum).trim()]));
    for (const m of migs) {
      if (hechas.has(m.nombre) && hechas.get(m.nombre) !== checksum(m.sql)) {
        throw Object.assign(new Error(`La migración ${m.nombre} del módulo ${id} cambió después de aplicada. No edite migraciones aplicadas: cree una nueva.`), { status: 500 });
      }
    }
    for (const nombre of hechas.keys()) if (!migs.some((m) => m.nombre === nombre)) log.warn(`la migración aplicada ${nombre} ya no está en el código.`);
    const aplicadas = [];
    for (const m of migs) {
      if (hechas.has(m.nombre)) continue;
      await db.transaccion(async (tx) => {
        await tx.ejecutar(m.sql);
        await tx.query(`INSERT INTO coi_migraciones (nombre, checksum) VALUES (${p[0]}, ${p[1]})`, [m.nombre, checksum(m.sql)]);
      });
      aplicadas.push(m.nombre);
      log.info(`migración aplicada ${m.nombre}`);
    }
    return { aplicadas, total: migs.length };
  });
}

/** Migraciones registradas en la BD del módulo (para diagnóstico). */
export async function estadoMigraciones(db) {
  if (!db || !db.configurada) return [];
  try { return (await db.query('SELECT nombre, aplicada FROM coi_migraciones ORDER BY nombre')).rows; } catch { return []; }
}
