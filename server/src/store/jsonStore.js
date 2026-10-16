import fs from 'node:fs';
import path from 'node:path';

/**
 * Almacén JSON en disco, suficiente para la fase inicial (sin motor de base de datos).
 * Cada colección es un archivo <DATA_DIR>/<nombre>.json. Las escrituras son atómicas
 * (archivo temporal + rename) y se serializan en memoria.
 */
export function createStore(name, seed) {
  const dir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'var'));
  const file = path.join(dir, name + '.json');
  let data;
  if (fs.existsSync(file)) {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } else {
    data = typeof seed === 'function' ? seed() : structuredClone(seed);
    persist();
  }
  function persist() {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  }
  return {
    get: () => data,
    /** Aplica una mutación y guarda. */
    update(fn) { const out = fn(data); persist(); return out; }
  };
}
