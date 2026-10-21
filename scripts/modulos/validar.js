/**
 * Validador del contrato de módulos. Revisa el manifiesto, la estructura de archivos, las importaciones,
 * las migraciones, los secretos y los choques con el portal. Devuelve { errores, avisos, manifiesto }:
 * con algún error el paquete no se instala.
 */
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import { pathToFileURL } from 'node:url';
import {
  DEPENDENCIAS_APROBADAS, DIR_CLIENT, EXTENSIONES, IMPORTS_CLIENT, IMPORTS_SERVER, IMPORTS_TEST, LIMITES, MOTORES,
  RAIZ, RAIZ_PERMITIDOS, RE_ID, RE_MIGRACION, RE_PREFIJO, RE_SEMVER, RE_VARIABLE_BD, RESERVADOS, SECRETOS, SQL_POSTGRES, SQL_PROHIBIDO,
  TABLAS_PORTAL, TEXTO, compararVersiones, prefijoSugerido, varBDSugerida,
} from './politica.js';
import { instalados } from './paquete.js';
import { dividirSQL, esqueletoSQL, tablasDe } from '../../server/src/modulos/sql.js';

const BUILTINS = new Set(builtinModules.flatMap((m) => [m, 'node:' + m]));
const esBuiltin = (spec) => BUILTINS.has(spec) || (spec.startsWith('node:') && /^node:[a-z_/]+$/.test(spec));

/** Módulos del plan (client/src/lib/estados.js → PENDIENTES): id oficial → { codigo, nombre, grupo, … }. */
async function pendientesDelPlan() {
  const f = path.join(RAIZ, 'client', 'src', 'lib', 'estados.js');
  if (!fs.existsSync(f)) return {};
  try { return (await import(pathToFileURL(f).href)).PENDIENTES || {}; } catch { return {}; }
}

/** Vistas del portal (claves de VIEWS), grupos del menú, iconos y módulos del plan. */
export async function contextoPortal() {
  const vistasSrc = fs.readFileSync(path.join(RAIZ, 'client', 'src', 'views', 'index.js'), 'utf8');
  const bloque = (vistasSrc.match(/const VIEWS = \{([\s\S]*?)\n\};/) || [])[1] || '';
  const vistas = [...bloque.matchAll(/^\s+([a-z0-9]+):/gm)].map((m) => m[1]);
  const navSrc = fs.readFileSync(path.join(RAIZ, 'client', 'src', 'lib', 'nav.js'), 'utf8');
  const grupos = [...navSrc.matchAll(/^\s+\['([^']+)', \[\[/gm)].map((m) => m[1]);
  const { PATHS } = await import('../../client/src/components/iconPaths.js');
  return { vistas, grupos, iconos: Object.keys(PATHS), instalados: instalados(), pendientes: await pendientesDelPlan() };
}

/** Valida y completa el manifiesto. */
export function validarManifiesto(m, errores = [], avisos = []) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) { errores.push('module.json debe ser un objeto JSON.'); return null; }
  const texto = (v, campo, min = 1, max = 120) => {
    if (typeof v !== 'string' || v.trim().length < min || v.trim().length > max) errores.push(`module.json: "${campo}" debe ser un texto de ${min} a ${max} caracteres.`);
    return typeof v === 'string' ? v.trim() : '';
  };
  const id = String(m.id || '');
  if (!RE_ID.test(id)) errores.push(`module.json: "id" inválido ("${id}"). Use minúsculas, números y guiones, empezando por letra (2 a 31 caracteres).`);
  if (!RE_SEMVER.test(String(m.version || ''))) errores.push(`module.json: "version" debe ser semver (p. ej. 1.0.0); se recibió "${m.version}".`);
  const autor = m.autor || {};
  const menu = m.menu || {};
  const acceso = m.acceso || {};
  const db = m.db || { motor: 'ninguna' };
  const out = {
    id,
    nombre: texto(m.nombre, 'nombre', 3, 60),
    version: String(m.version || ''),
    descripcion: typeof m.descripcion === 'string' ? m.descripcion.trim() : '',
    autor: { nombre: texto(autor.nombre, 'autor.nombre', 3, 80), correo: typeof autor.correo === 'string' ? autor.correo.trim() : '' },
    menu: {
      grupo: texto(menu.grupo, 'menu.grupo', 2, 40),
      etiqueta: texto(menu.etiqueta, 'menu.etiqueta', 2, 40),
      icono: typeof menu.icono === 'string' ? menu.icono : 'box',
      orden: Number.isFinite(menu.orden) ? menu.orden : 100,
    },
    acceso: { roles: [] },
    db: db.motor === 'ninguna' ? { motor: 'ninguna' } : { motor: db.motor, prefijo: db.prefijo || (RE_ID.test(id) ? prefijoSugerido(id) : '') },
    dependencias: { server: {}, client: {} },
  };
  if (m.nuevo === true) out.nuevo = true;
  else if (m.nuevo !== undefined) errores.push('module.json: "nuevo" solo puede ser true (módulo que no está en el plan).');
  if (menu.insignia !== undefined && menu.insignia !== null) {
    if (typeof menu.insignia === 'string' || typeof menu.insignia === 'number') out.menu.insignia = menu.insignia;
    else errores.push('module.json: "menu.insignia" debe ser texto o número.');
  }
  if (out.autor.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.autor.correo)) errores.push('module.json: "autor.correo" no es un correo válido.');
  if (!out.autor.correo) avisos.push('module.json: falta "autor.correo" (contacto del responsable del módulo).');
  if (acceso.roles !== undefined && (!Array.isArray(acceso.roles) || acceso.roles.some((r) => typeof r !== 'string' || !r.trim()))) errores.push('module.json: "acceso.roles" debe ser una lista de textos.');
  else out.acceso.roles = (acceso.roles || []).map((r) => r.trim());
  if (db.motor === 'postgres') errores.push('module.json: los módulos de COI usan MySQL. Use "db": { "motor": "mysql", "prefijo": "…_" } y migraciones en sintaxis MySQL.');
  else if (!MOTORES.includes(db.motor)) errores.push(`module.json: "db.motor" debe ser "mysql" o "ninguna"; se recibió "${db.motor}".`);
  if (out.db.motor === 'mysql') {
    if (!db.prefijo) avisos.push(`module.json: falta "db.prefijo"; se usará "${out.db.prefijo}". Decláralo para que todas las tablas lo lleven.`);
    else if (!RE_PREFIJO.test(db.prefijo)) errores.push(`module.json: "db.prefijo" inválido ("${db.prefijo}"). Use de 2 a 11 minúsculas o números, empezando por letra y terminando en "_" (p. ej. "${prefijoSugerido(id || 'modulo')}").`);
    if (db.variable !== undefined && db.variable !== null) {
      if (!RE_VARIABLE_BD.test(db.variable)) errores.push(`module.json: "db.variable" debe tener la forma DB_<NOMBRE>_URL (p. ej. ${varBDSugerida(id || 'modulo')}). Omítala para usar la base del portal.`);
      else out.db.variable = db.variable;
    }
  }
  const deps = m.dependencias || {};
  if (typeof deps !== 'object' || Array.isArray(deps)) errores.push('module.json: "dependencias" debe ser { "server": {...}, "client": {...} }.');
  else {
    for (const k of Object.keys(deps)) if (!['server', 'client'].includes(k)) errores.push(`module.json: "dependencias.${k}" no es válido; use "server" o "client".`);
    for (const lado of ['server', 'client']) {
      for (const [pkg, ver] of Object.entries(deps[lado] || {})) {
        out.dependencias[lado][pkg] = String(ver);
        if (!DEPENDENCIAS_APROBADAS[lado].includes(pkg)) errores.push(`Dependencia ${lado} "${pkg}" no aprobada. Requiere revisión: agréguela a DEPENDENCIAS_APROBADAS en scripts/modulos/politica.js si se acepta.`);
      }
    }
  }
  return out;
}

const RE_IMPORTS = [
  /\bimport\s+(?:[\w*{}\s,$]+\s+from\s+)?['"]([^'"]+)['"]/g,
  /\bexport\s+(?:\*|\{[^}]*\})\s*(?:as\s+\w+\s+)?from\s+['"]([^'"]+)['"]/g,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
];
const sinComentarios = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"\\])\/\/.*$/gm, '$1');
const paqueteDe = (spec) => spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];

function revisarImports(ruta, src, lado, man, errores) {
  const codigo = sinComentarios(src);
  const specs = new Set();
  for (const re of RE_IMPORTS) for (const m of codigo.matchAll(re)) specs.add(m[1]);
  for (const spec of specs) {
    if (spec.startsWith('.')) {
      const destino = path.posix.normalize(path.posix.join(path.posix.dirname(ruta), spec));
      const raizPermitida = lado === 'test' ? ['test/', 'server/'] : [lado + '/'];
      if (destino.startsWith('..') || !raizPermitida.some((r) => destino.startsWith(r))) {
        errores.push(`${ruta}: la importación "${spec}" sale de la carpeta ${lado}/ del módulo.${lado === 'client' ? ' Use @coi/sdk para los componentes del portal.' : ''}`);
      }
      continue;
    }
    if (lado === 'client') {
      if (IMPORTS_CLIENT.includes(spec) || man.dependencias.client[paqueteDe(spec)]) continue;
      errores.push(`${ruta}: importación no permitida "${spec}". En la interfaz use react, react-router-dom o @coi/sdk (u otra dependencia aprobada y declarada).`);
    } else {
      if (esBuiltin(spec) || IMPORTS_SERVER.includes(spec) || man.dependencias.server[paqueteDe(spec)]) {
        if (spec === 'child_process' || spec === 'node:child_process') errores.push(`${ruta}: no se permite ejecutar procesos del sistema (child_process).`);
        continue;
      }
      if (lado === 'test' && IMPORTS_TEST.includes(spec)) continue;
      errores.push(`${ruta}: importación no permitida "${spec}". En el servidor use módulos de Node, express o dependencias aprobadas y declaradas.`);
    }
  }
}

/** Revisa una migración: sintaxis MySQL, sentencias prohibidas y que solo toque tablas con el prefijo del módulo. */
export function revisarMigracion(ruta, sql, prefijo, errores, avisos) {
  if (/^\s*DELIMITER\b/im.test(sql)) errores.push(`${ruta}: no se permiten procedimientos ni triggers (DELIMITER). La lógica va en server/.`);
  const sentencias = dividirSQL(sql);
  if (!sentencias.length) errores.push(`${ruta}: la migración está vacía.`);
  sentencias.forEach((sentencia, i) => {
    const n = `${ruta} (sentencia ${i + 1})`;
    const s = esqueletoSQL(sentencia);
    for (const [re, que] of SQL_PROHIBIDO) if (re.test(s)) errores.push(`${n}: no se permite ${que}.`);
    if (SQL_POSTGRES.test(s)) errores.push(`${n}: sintaxis de PostgreSQL (SERIAL, TIMESTAMPTZ, ::tipo, ILIKE, RETURNING, JSONB). Use MySQL: INT AUTO_INCREMENT, DATETIME, CAST(), LIKE.`);
    if (TABLAS_PORTAL.some((t) => new RegExp('\\b' + t + '\\b', 'i').test(s))) errores.push(`${n}: la tabla coi_migraciones es del portal; no la modifique.`);
    for (const { nombre, como } of tablasDe(sentencia)) {
      if (nombre.includes('.')) errores.push(`${n}: ${como} ${nombre} apunta a otra base. Use solo tablas de la base del portal, sin "base.tabla".`);
      else if (!nombre.toLowerCase().startsWith(prefijo)) errores.push(`${n}: ${como} ${nombre}: toda tabla del módulo debe empezar por su prefijo "${prefijo}" (p. ej. ${prefijo}${nombre.toLowerCase()}).`);
      else if (nombre !== nombre.toLowerCase()) avisos.push(`${n}: use minúsculas en el nombre de la tabla ${nombre} (MySQL en Linux distingue mayúsculas).`);
    }
    if (/^DROP\s+(?:TEMPORARY\s+)?TABLE\s+(?!IF\s+EXISTS)/i.test(s)) avisos.push(`${n}: DROP TABLE sin IF EXISTS. Confirme que borrar la tabla (y sus datos) es intencional.`);
    if (/^CREATE\s+(?:TEMPORARY\s+)?TABLE\b/i.test(s)) {
      const motor = s.match(/\bENGINE\s*=?\s*(\w+)/i);
      if (motor && motor[1].toLowerCase() !== 'innodb') avisos.push(`${n}: use ENGINE=InnoDB (se encontró ${motor[1]}).`);
    }
    for (const m of s.matchAll(/\b(?:CHARSET|CHARACTER\s+SET)\s*=?\s*(\w+)/gi)) {
      if (m[1].toLowerCase() !== 'utf8mb4') avisos.push(`${n}: use el juego de caracteres utf8mb4 (se encontró ${m[1]}); con otro se dañan tildes y eñes.`);
    }
  });
}

const PARECE_SQL = /^\s*(?:SELECT|INSERT|UPDATE|DELETE|REPLACE|WITH|CREATE|ALTER|DROP|TRUNCATE)\b/i;
const LITERALES = /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g;

/** Revisa el SQL escrito en el código del servidor: interpolaciones (inyección) y tablas sin prefijo. */
function revisarSQLCodigo(ruta, codigo, prefijo, errores, avisos) {
  const sinPrefijo = new Set();
  for (const [lit] of codigo.matchAll(LITERALES)) {
    const txt = lit.slice(1, -1);
    if (!PARECE_SQL.test(txt)) continue;
    if (lit[0] === '`' && txt.includes('${')) {
      errores.push(`${ruta}: SQL armado con \${…} ("${txt.trim().slice(0, 50)}…"). Pase los valores como parámetros "?" en db.query(sql, [valores]); así se evita la inyección de SQL.`);
      continue;
    }
    if (/\$\d/.test(txt) || SQL_POSTGRES.test(txt)) errores.push(`${ruta}: SQL con sintaxis de PostgreSQL ("${txt.trim().slice(0, 50)}…"). En MySQL los parámetros son "?" y no existen RETURNING, ILIKE ni ::tipo.`);
    if (!prefijo) continue;
    const ctes = new Set([...txt.matchAll(/\b(\w+)\s+AS\s*\(/gi)].map((m) => m[1].toLowerCase()));
    for (const m of txt.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE)\s+`?([A-Za-z_][\w$]*)(?![\w$])`?(?!\s*\()/gi)) {
      const t = m[1].toLowerCase();
      const antes = txt.slice(0, m.index);
      // ON DUPLICATE KEY UPDATE col = …, EXTRACT(YEAR FROM col), TRIM(… FROM col) no son tablas.
      if (/DUPLICATE\s+KEY\s*$/i.test(antes) || /\b(?:EXTRACT|TRIM|SUBSTRING|POSITION)\s*\([^()]*$/i.test(antes)) continue;
      if (t === 'dual' || ctes.has(t) || t.startsWith(prefijo)) continue;
      sinPrefijo.add(m[1]);
    }
  }
  if (sinPrefijo.size) avisos.push(`${ruta}: el SQL menciona tablas sin el prefijo "${prefijo}": ${[...sinPrefijo].join(', ')}. Un módulo solo usa sus propias tablas.`);
  if (/\.query\(\s*(['"`])[^'"`]*\1\s*\+/.test(codigo)) avisos.push(`${ruta}: SQL concatenado con "+" en db.query(). Use un texto fijo y parámetros "?".`);
}

/** Revisa la línea gráfica: clases con el prefijo del módulo, colores y fuentes del portal. */
function revisarEstilos(ruta, src, id, avisos) {
  const ext = path.posix.extname(ruta);
  if (ext === '.css') {
    const css = src.replace(/\/\*[\s\S]*?\*\//g, '');
    const ajenos = new Set();
    for (const [, prel] of css.matchAll(/([^{}]+)\{/g)) {
      const p = prel.trim();
      if (!p || p.startsWith('@') || /^(from|to|\d+(\.\d+)?%)(\s*,\s*(from|to|\d+(\.\d+)?%))*$/i.test(p)) continue;
      const propio = new RegExp('^\\.' + id + '(?:-[\\w-]*)?(?![\\w-])');
      for (const sel of p.split(',').map((x) => x.trim()).filter(Boolean)) if (!propio.test(sel)) ajenos.add(sel);
    }
    if (ajenos.size) avisos.push(`${ruta}: estos selectores no empiezan por una clase "${id}-…" y pueden cambiar otras pantallas: ${[...ajenos].slice(0, 6).join(' | ')}${ajenos.size > 6 ? ' …' : ''}.`);
    if (/font-family\s*:(?![^;]*var\()/i.test(css)) avisos.push(`${ruta}: use las fuentes del portal (font-family: var(--font-body) o var(--font-display)).`);
    if (/@import\s|url\(\s*['"]?https?:/i.test(css)) avisos.push(`${ruta}: no cargue hojas de estilo ni fuentes externas.`);
  }
  const colores = new Set((ext === '.css' ? src : [...src.matchAll(/['"`](#[0-9a-fA-F]{3,8})['"`]/g)].map((m) => m[1]).join(' ')).match(/#[0-9a-fA-F]{3,8}\b/g) || []);
  if (colores.size) avisos.push(`${ruta}: colores escritos a mano (${[...colores].slice(0, 5).join(', ')}). Use las variables del portal: var(--navy), var(--green), var(--cyan), var(--gold) (solo acento), var(--line), var(--muted), var(--red).`);
}

/**
 * Valida un paquete (Map<ruta, Buffer>).
 * ctx = contextoPortal() y opciones { reemplazar }.
 */
export function validarPaquete(archivos, ctx, { reemplazar = false } = {}) {
  const errores = [], avisos = [];
  let manifiesto = null;
  const raw = archivos.get('module.json');
  if (!raw) errores.push('Falta module.json.');
  else {
    try { manifiesto = validarManifiesto(JSON.parse(raw.toString('utf8')), errores, avisos); }
    catch (e) { errores.push('module.json no es JSON válido: ' + e.message); }
  }
  const man = manifiesto || validarManifiesto({}, [], []);

  // Estructura y tamaños.
  let total = 0;
  if (archivos.size > LIMITES.entradas) errores.push(`El paquete tiene demasiados archivos (${archivos.size}, máximo ${LIMITES.entradas}).`);
  for (const [ruta, buf] of archivos) {
    total += buf.length;
    const segs = ruta.split('/');
    const ext = path.posix.extname(ruta).toLowerCase();
    if (segs.includes('node_modules')) { errores.push(`No incluya node_modules (${ruta.replace('/(omitido)', '')}). Declare las dependencias en module.json.`); continue; }
    if (segs.some((s) => s.startsWith('.'))) { errores.push(`Archivo oculto no permitido: ${ruta}${/\.env/.test(ruta) ? ' (las credenciales van en variables de entorno, nunca en el código)' : ''}.`); continue; }
    if (buf.length > LIMITES.archivo) errores.push(`Archivo demasiado grande: ${ruta} (${Math.round(buf.length / 1024)} KB).`);
    if (segs.length === 1) {
      if (/^package(-lock)?\.json$/.test(ruta)) errores.push(`${ruta} no se usa: declare las dependencias en "dependencias" de module.json.`);
      else if (!RAIZ_PERMITIDOS.includes(ruta)) errores.push(`Archivo no permitido en la raíz del módulo: ${ruta}.`);
      continue;
    }
    const lado = segs[0];
    if (!EXTENSIONES[lado]) { errores.push(`Carpeta no permitida: ${segs[0]}/ (${ruta}). Use server/, client/ o test/.`); continue; }
    if (ext === '.sql') {
      if (!(lado === 'server' && segs[1] === 'migraciones' && segs.length === 3)) errores.push(`Los .sql van solo en server/migraciones/: ${ruta}.`);
      else if (!RE_MIGRACION.test(segs[2])) errores.push(`Nombre de migración inválido: ${segs[2]}. Use NNN_descripcion.sql (p. ej. 001_inicial.sql).`);
      continue;
    }
    if (!EXTENSIONES[lado].includes(ext)) errores.push(`Tipo de archivo no permitido en ${lado}/: ${ruta}.`);
  }
  if (total > LIMITES.total) errores.push(`El paquete supera ${LIMITES.total / 1024 / 1024} MB.`);
  if (!archivos.has('server/index.js')) errores.push('Falta server/index.js (export default async function registrar({ router, db, ... })).');
  if (!archivos.has('client/index.jsx')) errores.push('Falta client/index.jsx (export default function Modulo({ sub, usuario, api })).');
  if (!archivos.has('README.md')) avisos.push('Falta README.md con la descripción del módulo.');

  // Migraciones: numeración única y coherente con el motor.
  const migs = [...archivos.keys()].filter((r) => /^server\/migraciones\/[^/]+\.sql$/.test(r)).map((r) => r.split('/')[2]).filter((n) => RE_MIGRACION.test(n)).sort();
  const nums = migs.map((n) => Number(n.slice(0, 3)));
  if (new Set(nums).size !== nums.length) errores.push('Hay migraciones con el mismo número.');
  nums.forEach((n, i) => { if (n !== i + 1) avisos.push(`Las migraciones deberían numerarse 001, 002, …; se encontró ${migs[i]}.`); });
  if (man.db.motor === 'ninguna' && migs.length) errores.push('El módulo tiene migraciones pero "db.motor" es "ninguna".');
  if (man.db.motor === 'mysql' && !migs.length) avisos.push('El módulo declara base de datos pero no trae migraciones.');
  if (man.db.motor === 'mysql' && man.db.prefijo) {
    for (const n of migs) revisarMigracion('server/migraciones/' + n, archivos.get('server/migraciones/' + n).toString('utf8'), man.db.prefijo, errores, avisos);
  }

  // Código: importaciones, secretos y prácticas.
  for (const [ruta, buf] of archivos) {
    const ext = path.posix.extname(ruta).toLowerCase();
    if (!TEXTO.includes(ext)) continue;
    const src = buf.toString('utf8');
    for (const [re, que] of SECRETOS) if (re.test(src)) errores.push(`${ruta}: parece contener un secreto (${que}). Las credenciales van en variables de entorno.`);
    const lado = ruta.split('/')[0];
    if (ext === '.css' && lado === 'client') revisarEstilos(ruta, src, man.id, avisos);
    if (['.js', '.mjs', '.jsx'].includes(ext) && EXTENSIONES[lado]) {
      revisarImports(ruta, src, lado, man, errores);
      if (lado === 'server') {
        if (/\bprocess\.env\b/.test(src)) avisos.push(`${ruta}: use config.env('NOMBRE') en lugar de process.env (lee MOD_<ID>_NOMBRE).`);
        if (/\b(eval|new Function)\s*\(/.test(src)) errores.push(`${ruta}: no se permite eval ni new Function.`);
        if (/\bprocess\.exit\s*\(/.test(src)) errores.push(`${ruta}: no se permite process.exit (detiene todo el portal).`);
        if (/\bfs\.(write|append|rm|unlink|mkdir)/.test(src)) avisos.push(`${ruta}: escribe en disco; en Vercel el disco es efímero, guarde los datos en la BD del módulo.`);
        revisarSQLCodigo(ruta, sinComentarios(src), man.db.motor === 'mysql' ? man.db.prefijo : '', errores, avisos);
      }
      if (lado === 'client') {
        revisarEstilos(ruta, src, man.id, avisos);
        if (/dangerouslySetInnerHTML/.test(src)) avisos.push(`${ruta}: usa dangerouslySetInnerHTML; asegúrese de no insertar HTML de usuarios.`);
        if (/fetch\(\s*['"`]https?:/.test(src)) avisos.push(`${ruta}: llama servicios externos desde el navegador; hágalo desde server/ con config.env().`);
      }
    }
  }
  const idx = archivos.get('server/index.js');
  if (idx && !/export\s+default\b/.test(idx.toString('utf8'))) errores.push('server/index.js debe tener "export default" (función registrar).');
  const cli = archivos.get('client/index.jsx');
  if (cli && !/export\s+default\b/.test(cli.toString('utf8'))) errores.push('client/index.jsx debe tener "export default" (componente del módulo).');

  // Choques con el portal y con otros módulos.
  if (manifiesto && RE_ID.test(man.id)) {
    const pendientes = ctx.pendientes || {};
    const plan = pendientes[man.id];
    if (RESERVADOS.includes(man.id) || (ctx.vistas.includes(man.id) && !plan)) errores.push(`El id "${man.id}" choca con una vista o ruta existente del portal. Elija otro id.`);
    else if (!plan && !man.nuevo && Object.keys(pendientes).length) {
      avisos.push(`El id "${man.id}" no es un módulo del plan (${Object.keys(pendientes).join(', ')}). Si reemplaza uno, use su id oficial; si es un módulo nuevo, agregue "nuevo": true en module.json.`);
    }
    if (plan && plan.grupo && man.menu.grupo !== plan.grupo) avisos.push(`El módulo "${man.id}" ocupa el lugar de «${plan.nombre}» en el grupo ${plan.grupo}; "menu.grupo" dice ${man.menu.grupo}.`);
    const previo = ctx.instalados.find((x) => x.id === man.id);
    if (previo) {
      if (!reemplazar) errores.push(`El módulo "${man.id}" ya está instalado (versión ${previo.manifiesto.version}). Use --reemplazar con una versión mayor.`);
      else if (compararVersiones(man.version, previo.manifiesto.version) <= 0) errores.push(`Para reemplazar "${man.id}" la versión debe ser mayor que ${previo.manifiesto.version} (se recibió ${man.version}).`);
    }
    if (man.db.motor === 'mysql') {
      const otro = ctx.instalados.find((x) => x.id !== man.id && x.manifiesto.db && x.manifiesto.db.motor === 'mysql'
        && (x.manifiesto.db.prefijo || prefijoSugerido(x.id)) === man.db.prefijo);
      if (otro) errores.push(`El prefijo de tablas "${man.db.prefijo}" ya lo usa el módulo "${otro.id}". Cada módulo necesita un prefijo propio.`);
    }
    const etiqueta = ctx.instalados.find((x) => x.id !== man.id && x.manifiesto.menu && x.manifiesto.menu.etiqueta === man.menu.etiqueta && x.manifiesto.menu.grupo === man.menu.grupo);
    if (etiqueta) avisos.push(`La etiqueta de menú "${man.menu.etiqueta}" ya existe en el grupo ${man.menu.grupo} (módulo ${etiqueta.id}).`);
  }
  if (man.menu.grupo && !ctx.grupos.includes(man.menu.grupo) && !ctx.instalados.some((x) => x.id !== man.id && x.manifiesto.menu && x.manifiesto.menu.grupo === man.menu.grupo)) {
    avisos.push(`El grupo de menú "${man.menu.grupo}" no existe; se creará antes de «Herramientas». Grupos actuales: ${ctx.grupos.join(', ')}.`);
  }
  if (!ctx.iconos.includes(man.menu.icono)) {
    avisos.push(`El icono "${man.menu.icono}" no existe; se usará "box". Disponibles: ${ctx.iconos.join(', ')}.`);
    man.menu.icono = 'box';
  }
  return { errores, avisos, manifiesto: errores.length ? manifiesto : man };
}

/** ¿Hay archivos de cliente sueltos sin módulo de servidor? (instalación incompleta) */
export function huerfanosCliente() {
  if (!fs.existsSync(DIR_CLIENT)) return [];
  const ids = new Set(instalados().map((x) => x.id));
  return fs.readdirSync(DIR_CLIENT, { withFileTypes: true }).filter((e) => e.isDirectory() && !ids.has(e.name)).map((e) => e.name);
}
