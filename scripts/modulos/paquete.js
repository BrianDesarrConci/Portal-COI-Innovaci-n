/**
 * Paquetes de módulo: lectura (zip, carpeta o módulo instalado), instalación repartida entre
 * server/ y client/ (Vercel construye cada uno como un servicio aparte) y empaquetado de vuelta a .zip.
 * Un paquete es un Map<ruta canónica, Buffer>, con rutas como "module.json", "server/index.js", "client/index.jsx".
 */
import fs from 'node:fs';
import path from 'node:path';
import { leerZip, escribirZip } from './zip.js';
import { BASURA, DIR_CLIENT, DIR_PLANTILLA, DIR_SERVER, LIMITES, prefijoSugerido } from './politica.js';

function listar(dir, base = dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    // node_modules y .git no se recorren: se dejan marcados para que el validador los rechace.
    if (e.isDirectory() && (e.name === 'node_modules' || e.name === '.git')) out.push(path.relative(base, p).split(path.sep).join('/') + '/(omitido)');
    else if (e.isDirectory()) listar(p, base, out);
    else if (e.isFile()) out.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return out.sort();
}

/**
 * Quita la carpeta raíz del zip (<id>/...) si existe y descarta archivos basura.
 * Devuelve { archivos, descartados }.
 */
export function normalizarRaiz(mapa) {
  const archivos = new Map();
  let descartados = 0;
  const limpias = [...mapa.keys()].filter((r) => { if (BASURA(r)) { descartados++; return false; } return true; });
  let prefijo = '';
  if (!limpias.includes('module.json')) {
    const candidatos = limpias.filter((r) => /^[^/]+\/module\.json$/.test(r));
    if (candidatos.length !== 1) throw new Error('No se encontró module.json en la raíz del paquete (ni en una única carpeta raíz).');
    prefijo = candidatos[0].slice(0, -'module.json'.length);
  }
  for (const r of limpias) {
    if (prefijo && !r.startsWith(prefijo)) throw new Error(`Archivo fuera de la carpeta del módulo: ${r}`);
    archivos.set(r.slice(prefijo.length), mapa.get(r));
  }
  return { archivos, descartados };
}

/** Lee todos los archivos de una carpeta como Map<ruta, Buffer> (sin validar estructura). */
export function leerCarpeta(dir) {
  const mapa = new Map();
  for (const r of listar(dir)) mapa.set(r, r.endsWith('/(omitido)') ? Buffer.alloc(0) : fs.readFileSync(path.join(dir, r)));
  return mapa;
}

/** Lee un paquete desde un .zip, una carpeta con la estructura del contrato o el id de un módulo instalado. */
export function leerPaquete(origen) {
  if (/^[a-z][a-z0-9-]*$/.test(origen) && !fs.existsSync(origen) && fs.existsSync(path.join(DIR_SERVER, origen, 'module.json'))) {
    return { archivos: paqueteInstalado(origen), descartados: 0 };
  }
  if (!fs.existsSync(origen)) throw new Error('No existe: ' + origen);
  if (fs.statSync(origen).isDirectory()) return normalizarRaiz(leerCarpeta(origen));
  return normalizarRaiz(leerZip(fs.readFileSync(origen), { archivo: LIMITES.archivo, total: LIMITES.total, entradas: LIMITES.entradas }));
}

/** Arma el paquete canónico a partir de un módulo instalado (server/src/modulos/<id> + client/src/modulos/<id>). */
export function paqueteInstalado(id) {
  const mapa = new Map();
  const ds = path.join(DIR_SERVER, id), dc = path.join(DIR_CLIENT, id);
  if (!fs.existsSync(path.join(ds, 'module.json'))) throw new Error('El módulo no está instalado: ' + id);
  for (const r of listar(ds)) mapa.set(r, fs.readFileSync(path.join(ds, r)));
  for (const r of listar(dc)) mapa.set('client/' + r, fs.readFileSync(path.join(dc, r)));
  return mapa;
}

/** Destino en el repositorio de una ruta canónica del paquete. */
export function destino(id, ruta) {
  return ruta.startsWith('client/') ? path.join(DIR_CLIENT, id, ...ruta.slice(7).split('/')) : path.join(DIR_SERVER, id, ...ruta.split('/'));
}

export function instalarPaquete(id, archivos) {
  for (const [ruta, buf] of archivos) {
    const d = destino(id, ruta);
    fs.mkdirSync(path.dirname(d), { recursive: true });
    fs.writeFileSync(d, buf);
  }
}

export function eliminarInstalado(id) {
  fs.rmSync(path.join(DIR_SERVER, id), { recursive: true, force: true });
  fs.rmSync(path.join(DIR_CLIENT, id), { recursive: true, force: true });
}

/** Ids de los módulos instalados con su manifiesto. */
export function instalados() {
  if (!fs.existsSync(DIR_SERVER)) return [];
  return fs.readdirSync(DIR_SERVER, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(DIR_SERVER, e.name, 'module.json')))
    .map((e) => ({ id: e.name, manifiesto: JSON.parse(fs.readFileSync(path.join(DIR_SERVER, e.name, 'module.json'), 'utf8')) }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Empaqueta el módulo con la carpeta raíz <id>/ (lo que el analista entrega). */
export function empaquetar(id, archivos = paqueteInstalado(id)) {
  return escribirZip([...archivos.keys()].sort().map((r) => [id + '/' + r, archivos.get(r)]));
}

/**
 * Paquete nuevo a partir de modulos/_plantilla con los datos del módulo.
 * opciones: { nombre, grupo, icono, autor, correo, motor ('mysql' | 'ninguna'), prefijo, nuevo }
 */
export function paqueteDesdePlantilla(id, o = {}) {
  const motor = o.motor || 'mysql';
  const prefijo = o.prefijo || prefijoSugerido(id);
  const reemplazos = {
    __ID__: id, __NOMBRE__: o.nombre || id, __GRUPO__: o.grupo || 'Operación', __ICONO__: o.icono || 'box',
    __AUTOR__: o.autor || 'Nombre del analista', __CORREO__: o.correo || 'analista@reval.com.co', __PREFIJO__: prefijo,
  };
  const final = new Map();
  for (const [ruta, buf] of leerCarpeta(DIR_PLANTILLA)) {
    if (motor === 'ninguna' && ruta.startsWith('server/migraciones/')) continue;
    let txt = buf.toString('utf8').replace(/__[A-Z]+__/g, (k) => (reemplazos[k] !== undefined ? reemplazos[k] : k));
    if (ruta === 'module.json') {
      const m = JSON.parse(txt);
      if (motor === 'ninguna') m.db = { motor: 'ninguna' };
      if (o.nuevo) m.nuevo = true;
      txt = JSON.stringify(m, null, 2) + '\n';
    }
    final.set(ruta, Buffer.from(txt));
  }
  return final;
}
