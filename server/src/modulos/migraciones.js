/**
 * Migraciones versionadas de cada módulo (server/migraciones/NNN_nombre.sql) sobre la base MySQL compartida.
 * Se aplican en orden y quedan registradas en la tabla común coi_migraciones (módulo + nombre + checksum).
 * Si una migración ya aplicada cambia, se detiene: los cambios se hacen siempre con una migración nueva.
 *
 * Cada migración corre sentencia por sentencia en una transacción y se registra solo si todas terminan.
 * Ojo: en MySQL las sentencias de estructura (CREATE/ALTER/DROP) se confirman solas; si una migración
 * falla a mitad, las sentencias de estructura anteriores ya quedaron aplicadas. Por eso conviene una
 * migración pequeña por cambio.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import { dividirSQL } from './sql.js';

const TABLA = `CREATE TABLE IF NOT EXISTS coi_migraciones (
  modulo VARCHAR(40) NOT NULL,
  nombre VARCHAR(200) NOT NULL,
  checksum CHAR(64) NOT NULL,
  aplicada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (modulo, nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

/** Checksum independiente del fin de línea (Windows / Unix). */
export const checksum = (sql) => crypto.createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');

/** Lee el SQL de cada migración. `lista` = [{ nombre, url | ruta | sql }]. */
export function leerMigraciones(lista) {
  return lista.map((m) => ({ nombre: m.nombre, sql: m.sql !== undefined ? m.sql : fs.readFileSync(m.url || m.ruta, 'utf8') }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

async function registradas(db, id) {
  await db.ejecutar(TABLA);
  const { rows } = await db.query('SELECT nombre, checksum FROM coi_migraciones WHERE modulo = ? ORDER BY nombre', [id]);
  return new Map(rows.map((r) => [r.nombre, String(r.checksum).trim()]));
}

/**
 * Aplica las migraciones pendientes del módulo `id`. Devuelve { aplicadas: [nombres nuevos], total }.
 * `db` es el manejador de abrirBD().
 */
export async function migrar(db, id, lista, log = console) {
  if (!db || db.configurada === false) return { aplicadas: [], total: 0 };
  const migs = leerMigraciones(lista);
  return db.bloqueo('coi_migraciones:' + id, async () => {
    const hechas = await registradas(db, id);
    for (const m of migs) {
      if (hechas.has(m.nombre) && hechas.get(m.nombre) !== checksum(m.sql)) {
        throw Object.assign(new Error(`La migración ${m.nombre} del módulo ${id} cambió después de aplicada. No edite migraciones aplicadas: cree una nueva.`), { status: 500 });
      }
    }
    for (const nombre of hechas.keys()) if (!migs.some((m) => m.nombre === nombre)) log.warn(`la migración aplicada ${nombre} ya no está en el código.`);
    const aplicadas = [];
    for (const m of migs) {
      if (hechas.has(m.nombre)) continue;
      const sentencias = dividirSQL(m.sql);
      try {
        await db.transaccion(async (tx) => {
          for (let i = 0; i < sentencias.length; i++) {
            try { await tx.query(sentencias[i]); } catch (e) { e.sentencia = i + 1; throw e; }
          }
          await tx.query('INSERT INTO coi_migraciones (modulo, nombre, checksum) VALUES (?, ?, ?)', [id, m.nombre, checksum(m.sql)]);
        });
      } catch (e) {
        const donde = e.sentencia ? ` en la sentencia ${e.sentencia} de ${sentencias.length}` : '';
        throw Object.assign(new Error(`La migración ${m.nombre} del módulo ${id} falló${donde}: ${e.message}`), { status: 500, causa: e });
      }
      aplicadas.push(m.nombre);
      log.info(`migración aplicada ${m.nombre}`);
    }
    return { aplicadas, total: migs.length };
  });
}

/** Migraciones registradas del módulo (para diagnóstico). */
export async function estadoMigraciones(db, id) {
  if (!db || db.configurada === false) return [];
  try { return (await db.query('SELECT nombre, aplicada FROM coi_migraciones WHERE modulo = ? ORDER BY nombre', [id])).rows; } catch { return []; }
}

/** Nombres de las migraciones del código que aún no están aplicadas. */
export async function pendientes(db, id, lista) {
  const hechas = await registradas(db, id);
  return leerMigraciones(lista).map((m) => m.nombre).filter((n) => !hechas.has(n));
}
