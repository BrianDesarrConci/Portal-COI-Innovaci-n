/**
 * Validador del contrato de módulos. Revisa el manifiesto, la estructura de archivos, las importaciones,
 * las migraciones, los secretos y los choques con el portal. Devuelve { errores, avisos, manifiesto }:
 * con algún error el paquete no se instala.
 */
import fs from 'node:fs';
import path from 'node:path';
import { builtinModules } from 'node:module';
import {
  DEPENDENCIAS_APROBADAS, DIR_CLIENT, EXTENSIONES, IMPORTS_CLIENT, IMPORTS_SERVER, IMPORTS_TEST, LIMITES, MOTORES,
  RAIZ, RAIZ_PERMITIDOS, RE_ID, RE_MIGRACION, RE_SEMVER, RE_VARIABLE_BD, RESERVADOS, SECRETOS, TEXTO, compararVersiones, varBDSugerida,
} from './politica.js';
import { instalados } from './paquete.js';

const BUILTINS = new Set(builtinModules.flatMap((m) => [m, 'node:' + m]));
const esBuiltin = (spec) => BUILTINS.has(spec) || (spec.startsWith('node:') && /^node:[a-z_/]+$/.test(spec));

/** Vistas del portal (claves de VIEWS), grupos del menú e iconos disponibles. */
export async function contextoPortal() {
  const vistasSrc = fs.readFileSync(path.join(RAIZ, 'client', 'src', 'views', 'index.js'), 'utf8');
  const bloque = (vistasSrc.match(/const VIEWS = \{([\s\S]*?)\n\};/) || [])[1] || '';
  const vistas = [...bloque.matchAll(/^\s+([a-z0-9]+):/gm)].map((m) => m[1]);
  const navSrc = fs.readFileSync(path.join(RAIZ, 'client', 'src', 'lib', 'nav.js'), 'utf8');
  const grupos = [...navSrc.matchAll(/^\s+\['([^']+)', \[\[/gm)].map((m) => m[1]);
  const { PATHS } = await import('../../client/src/components/iconPaths.js');
  return { vistas, grupos, iconos: Object.keys(PATHS), instalados: instalados() };
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
    db: { motor: db.motor, variable: db.variable || (db.motor && db.motor !== 'ninguna' ? varBDSugerida(id) : null) },
    dependencias: { server: {}, client: {} },
  };
  if (menu.insignia !== undefined && menu.insignia !== null) {
    if (typeof menu.insignia === 'string' || typeof menu.insignia === 'number') out.menu.insignia = menu.insignia;
    else errores.push('module.json: "menu.insignia" debe ser texto o número.');
  }
  if (out.autor.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.autor.correo)) errores.push('module.json: "autor.correo" no es un correo válido.');
  if (!out.autor.correo) avisos.push('module.json: falta "autor.correo" (contacto del responsable del módulo).');
  if (acceso.roles !== undefined && (!Array.isArray(acceso.roles) || acceso.roles.some((r) => typeof r !== 'string' || !r.trim()))) errores.push('module.json: "acceso.roles" debe ser una lista de textos.');
  else out.acceso.roles = (acceso.roles || []).map((r) => r.trim());
  if (!MOTORES.includes(db.motor)) errores.push(`module.json: "db.motor" debe ser uno de ${MOTORES.join(', ')}.`);
  if (out.db.motor === 'ninguna') out.db.variable = null;
  else if (out.db.variable && !RE_VARIABLE_BD.test(out.db.variable)) errores.push(`module.json: "db.variable" debe tener la forma DB_<NOMBRE>_URL (p. ej. ${varBDSugerida(id || 'modulo')}).`);
  else if (RE_ID.test(id) && out.db.variable !== varBDSugerida(id)) avisos.push(`module.json: se recomienda "db.variable": "${varBDSugerida(id)}".`);
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
  if (man.db.motor && man.db.motor !== 'ninguna' && !migs.length) avisos.push('El módulo declara base de datos pero no trae migraciones.');

  // Código: importaciones, secretos y prácticas.
  for (const [ruta, buf] of archivos) {
    const ext = path.posix.extname(ruta).toLowerCase();
    if (!TEXTO.includes(ext)) continue;
    const src = buf.toString('utf8');
    for (const [re, que] of SECRETOS) if (re.test(src)) errores.push(`${ruta}: parece contener un secreto (${que}). Las credenciales van en variables de entorno.`);
    const lado = ruta.split('/')[0];
    if (['.js', '.mjs', '.jsx'].includes(ext) && EXTENSIONES[lado]) {
      revisarImports(ruta, src, lado, man, errores);
      if (lado === 'server') {
        if (/\bprocess\.env\b/.test(src)) avisos.push(`${ruta}: use config.env('NOMBRE') en lugar de process.env (lee MOD_<ID>_NOMBRE).`);
        if (/\b(eval|new Function)\s*\(/.test(src)) errores.push(`${ruta}: no se permite eval ni new Function.`);
        if (/\bprocess\.exit\s*\(/.test(src)) errores.push(`${ruta}: no se permite process.exit (detiene todo el portal).`);
        if (/\bfs\.(write|append|rm|unlink|mkdir)/.test(src)) avisos.push(`${ruta}: escribe en disco; en Vercel el disco es efímero, guarde los datos en la BD del módulo.`);
      }
      if (lado === 'client') {
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
    if (ctx.vistas.includes(man.id) || RESERVADOS.includes(man.id)) errores.push(`El id "${man.id}" choca con una vista o ruta existente del portal. Elija otro id.`);
    const previo = ctx.instalados.find((x) => x.id === man.id);
    if (previo) {
      if (!reemplazar) errores.push(`El módulo "${man.id}" ya está instalado (versión ${previo.manifiesto.version}). Use --reemplazar con una versión mayor.`);
      else if (compararVersiones(man.version, previo.manifiesto.version) <= 0) errores.push(`Para reemplazar "${man.id}" la versión debe ser mayor que ${previo.manifiesto.version} (se recibió ${man.version}).`);
    }
    if (man.db.variable) {
      const otro = ctx.instalados.find((x) => x.id !== man.id && x.manifiesto.db && x.manifiesto.db.variable === man.db.variable);
      if (otro) errores.push(`La variable ${man.db.variable} ya la usa el módulo "${otro.id}". Cada módulo tiene su propia BD.`);
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
