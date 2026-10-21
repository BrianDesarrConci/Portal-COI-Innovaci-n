/**
 * Utilidades de texto SQL (MySQL) compartidas por el ejecutor de migraciones y el validador de módulos.
 * dividirSQL respeta comillas ('…', "…", `…`) y comentarios (-- …, # …, /* … *\/): un ";" dentro de un texto
 * o de un comentario no corta la sentencia.
 */

/** Recorre el SQL y entrega cada carácter con su contexto: 'codigo', 'texto' o 'comentario'. */
function recorrer(sql, fn) {
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i], d = sql[i + 1];
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < n && sql[j] !== c) j += sql[j] === '\\' && c !== '`' ? 2 : 1;
      fn(sql.slice(i, j + 1), 'texto');
      i = j + 1;
    } else if ((c === '-' && d === '-' && /\s/.test(sql[i + 2] || ' ')) || c === '#') {
      let j = sql.indexOf('\n', i);
      if (j === -1) j = n;
      fn(sql.slice(i, j), 'comentario');
      i = j;
    } else if (c === '/' && d === '*') {
      let j = sql.indexOf('*/', i + 2);
      j = j === -1 ? n : j + 2;
      fn(sql.slice(i, j), 'comentario');
      i = j;
    } else {
      fn(c, 'codigo');
      i += 1;
    }
  }
}

/** Divide un script en sentencias (sin el ";" final), descartando las vacías y las que solo tienen comentarios. */
export function dividirSQL(sql) {
  const out = [];
  let actual = '', util = false;
  recorrer(String(sql).replace(/\r\n/g, '\n'), (t, tipo) => {
    if (tipo === 'codigo' && t === ';') {
      if (util) out.push(actual.trim());
      actual = ''; util = false;
      return;
    }
    actual += t;
    if (tipo !== 'comentario' && t.trim()) util = true;
  });
  if (util) out.push(actual.trim());
  return out;
}

/** Quita los comentarios y reemplaza el contenido de los textos ('…', "…") por '' para analizar la sentencia. */
export function esqueletoSQL(sentencia) {
  let out = '';
  recorrer(sentencia, (t, tipo) => {
    if (tipo === 'comentario') out += ' ';
    else if (tipo === 'texto' && t[0] !== '`') out += t[0] + t[0];
    else out += t;
  });
  return out.replace(/\s+/g, ' ').trim();
}

/** Nombre de tabla sin comillas invertidas; conserva el punto de "base.tabla" para detectarlo. */
export const limpiarNombre = (s) => String(s || '').replace(/`/g, '').trim();

const NOMBRE = '(`[^`]+`(?:\\.`[^`]+`)?|[A-Za-z0-9_$]+(?:\\.[A-Za-z0-9_$]+)?)';

/**
 * Tablas que toca una sentencia (crear, alterar, borrar, renombrar, índices, vistas, escrituras y llaves foráneas).
 * Devuelve [{ nombre, como }]. Pensado para migraciones: no es un analizador SQL completo.
 */
export function tablasDe(sentencia) {
  const s = esqueletoSQL(sentencia);
  const out = [];
  const add = (re, como) => { for (const m of s.matchAll(re)) out.push({ nombre: limpiarNombre(m[1]), como }); };
  add(new RegExp(`^CREATE\\s+(?:TEMPORARY\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${NOMBRE}`, 'gi'), 'CREATE TABLE');
  add(new RegExp(`^CREATE\\s+(?:TEMPORARY\\s+)?TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?\\S+\\s+\\(?\\s*LIKE\\s+${NOMBRE}`, 'gi'), 'CREATE TABLE … LIKE');
  add(new RegExp(`^ALTER\\s+(?:ONLINE\\s+|IGNORE\\s+)?TABLE\\s+${NOMBRE}`, 'gi'), 'ALTER TABLE');
  add(new RegExp(`^ALTER\\s+TABLE\\s+\\S+\\s+.*?\\bRENAME\\s+(?:TO\\s+|AS\\s+)?${NOMBRE}`, 'gi'), 'RENAME');
  add(new RegExp(`^TRUNCATE\\s+(?:TABLE\\s+)?${NOMBRE}`, 'gi'), 'TRUNCATE');
  add(new RegExp(`^(?:CREATE|DROP)\\s+(?:UNIQUE\\s+|FULLTEXT\\s+|SPATIAL\\s+)?INDEX\\s+\\S+\\s+ON\\s+${NOMBRE}`, 'gi'), 'INDEX');
  add(new RegExp(`^CREATE\\s+(?:OR\\s+REPLACE\\s+)?(?:ALGORITHM\\s*=\\s*\\w+\\s+)?(?:DEFINER\\s*=\\s*\\S+\\s+)?(?:SQL\\s+SECURITY\\s+\\w+\\s+)?VIEW\\s+${NOMBRE}`, 'gi'), 'VIEW');
  add(new RegExp(`^(?:INSERT|REPLACE)\\s+(?:LOW_PRIORITY\\s+|DELAYED\\s+|HIGH_PRIORITY\\s+)?(?:IGNORE\\s+)?(?:INTO\\s+)?${NOMBRE}`, 'gi'), 'INSERT');
  add(new RegExp(`^UPDATE\\s+(?:LOW_PRIORITY\\s+)?(?:IGNORE\\s+)?${NOMBRE}`, 'gi'), 'UPDATE');
  add(new RegExp(`^DELETE\\s+(?:LOW_PRIORITY\\s+)?(?:QUICK\\s+)?(?:IGNORE\\s+)?FROM\\s+${NOMBRE}`, 'gi'), 'DELETE');
  add(new RegExp(`\\bREFERENCES\\s+${NOMBRE}`, 'gi'), 'REFERENCES');
  const drop = s.match(/^DROP\s+(?:TEMPORARY\s+)?(TABLE|VIEW)\s+(?:IF\s+EXISTS\s+)?(.+?)(?:\s+(?:RESTRICT|CASCADE))?$/i);
  if (drop) for (const t of drop[2].split(',')) out.push({ nombre: limpiarNombre(t), como: 'DROP ' + drop[1].toUpperCase() });
  const ren = s.match(/^RENAME\s+TABLES?\s+(.+)$/i);
  if (ren) for (const par of ren[1].split(',')) for (const t of par.split(/\s+TO\s+/i)) out.push({ nombre: limpiarNombre(t), como: 'RENAME TABLE' });
  return out;
}
