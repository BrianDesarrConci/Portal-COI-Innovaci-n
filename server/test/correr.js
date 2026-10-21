// Corre las pruebas del API (test/*.test.js) y las de cada módulo instalado (src/modulos/<id>/test/*.test.js).
// Se arma la lista aquí porque Node 18 no expande comodines en `node --test`.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pruebas = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort().map((f) => path.join(dir, f)) : []);
const modulos = path.join(raiz, 'src', 'modulos');
const archivos = pruebas(path.join(raiz, 'test')).concat(
  fs.readdirSync(modulos, { withFileTypes: true }).filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name)).flatMap((e) => pruebas(path.join(modulos, e.name, 'test')))
);
const r = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...archivos], { stdio: 'inherit', cwd: raiz });
process.exit(r.status === null ? 1 : r.status);
