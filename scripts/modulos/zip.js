/**
 * Lectura y escritura de archivos .zip sin dependencias (node:zlib).
 * Soporta los zip comunes de Windows, macOS y Linux: entradas "stored" (0) y "deflate" (8), nombres UTF-8.
 * No soporta zip cifrados ni ZIP64 (los módulos son pequeños).
 */
import zlib from 'node:zlib';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Normaliza una ruta de entrada y rechaza rutas absolutas o que salen de la carpeta (zip-slip). */
export function rutaSegura(nombre) {
  const r = String(nombre).replace(/\\/g, '/');
  if (r.startsWith('/') || /^[a-zA-Z]:/.test(r)) throw new Error('Ruta absoluta no permitida en el zip: ' + nombre);
  const partes = [];
  for (const p of r.split('/')) {
    if (p === '' || p === '.') continue;
    if (p === '..') throw new Error('Ruta no permitida en el zip: ' + nombre);
    partes.push(p);
  }
  return partes.join('/');
}

/**
 * Lee un zip. Devuelve Map<ruta, Buffer> (solo archivos; las carpetas se omiten).
 * `limites` = { archivo: bytes por archivo, total: bytes totales, entradas: máximo de entradas }.
 */
export function leerZip(buf, limites = {}) {
  const { archivo = 5 * 1024 * 1024, total = 25 * 1024 * 1024, entradas = 2000 } = limites;
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('El archivo no es un .zip válido.');
  const n = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  if (n === 0xffff || p === 0xffffffff) throw new Error('Zip64 no soportado; comprima el módulo con un zip estándar.');
  if (n > entradas) throw new Error(`El zip tiene demasiadas entradas (${n}, máximo ${entradas}).`);
  const out = new Map();
  let acumulado = 0;
  for (let k = 0; k < n; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Directorio central del zip dañado.');
    const flags = buf.readUInt16LE(p + 8);
    const metodo = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const tamC = buf.readUInt32LE(p + 20);
    const tamU = buf.readUInt32LE(p + 24);
    const lNombre = buf.readUInt16LE(p + 28), lExtra = buf.readUInt16LE(p + 30), lCom = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const crudo = buf.subarray(p + 46, p + 46 + lNombre);
    const nombre = (flags & 0x800 ? crudo.toString('utf8') : crudo.toString('latin1'));
    p += 46 + lNombre + lExtra + lCom;
    if (nombre.endsWith('/') || nombre.endsWith('\\')) continue;
    if (flags & 1) throw new Error('El zip está cifrado: ' + nombre);
    if (tamU > archivo) throw new Error(`Archivo demasiado grande en el zip: ${nombre} (${tamU} bytes).`);
    acumulado += tamU;
    if (acumulado > total) throw new Error('El contenido del zip supera el tamaño máximo permitido.');
    if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('Encabezado local del zip dañado: ' + nombre);
    const ini = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const datos = buf.subarray(ini, ini + tamC);
    let contenido;
    if (metodo === 0) contenido = Buffer.from(datos);
    else if (metodo === 8) contenido = zlib.inflateRawSync(datos, { maxOutputLength: Math.max(tamU, 1) });
    else throw new Error(`Método de compresión no soportado (${metodo}) en ${nombre}.`);
    if (contenido.length !== tamU || crc32(contenido) !== crc) throw new Error('Archivo dañado dentro del zip: ' + nombre);
    out.set(rutaSegura(nombre), contenido);
  }
  return out;
}

/** Escribe un zip a partir de [[ruta, Buffer], ...]. Fecha fija para que el resultado sea reproducible. */
export function escribirZip(entradas) {
  const locales = [], central = [];
  let offset = 0;
  const FECHA_DOS = ((2026 - 1980) << 9) | (1 << 5) | 1; // 1 de enero de 2026
  for (const [ruta, contenido] of entradas) {
    const nombre = Buffer.from(rutaSegura(ruta), 'utf8');
    const datos = Buffer.isBuffer(contenido) ? contenido : Buffer.from(contenido);
    const comp = zlib.deflateRawSync(datos, { level: 9 });
    const usarDeflate = comp.length < datos.length;
    const cuerpo = usarDeflate ? comp : datos;
    const crc = crc32(datos);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x800, 6); h.writeUInt16LE(usarDeflate ? 8 : 0, 8);
    h.writeUInt16LE(0, 10); h.writeUInt16LE(FECHA_DOS, 12); h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(cuerpo.length, 18); h.writeUInt32LE(datos.length, 22); h.writeUInt16LE(nombre.length, 26); h.writeUInt16LE(0, 28);
    locales.push(h, nombre, cuerpo);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x800, 8); c.writeUInt16LE(usarDeflate ? 8 : 0, 10);
    c.writeUInt16LE(0, 12); c.writeUInt16LE(FECHA_DOS, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(cuerpo.length, 20); c.writeUInt32LE(datos.length, 24);
    c.writeUInt16LE(nombre.length, 28); c.writeUInt32LE(0, 38); c.writeUInt32LE(offset, 42);
    central.push(c, nombre);
    offset += h.length + nombre.length + cuerpo.length;
  }
  const dir = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(entradas.length, 8); fin.writeUInt16LE(entradas.length, 10);
  fin.writeUInt32LE(dir.length, 12); fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...locales, dir, fin]);
}
