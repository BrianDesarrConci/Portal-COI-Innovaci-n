// Corre las pruebas del API (test/*.test.js), las de cada módulo instalado (src/modulos/<id>/test/*.test.js)
// y las del módulo de ejemplo (modulos/_ejemplo/<id>/test). Las de base de datos usan COI_TEST_MYSQL_URL;
// sin ella se omiten.
// Se arma la lista aquí porque Node 18 no expande comodines en `node --test`.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import '../src/env.js'; // .env local (COI_TEST_MYSQL_URL)

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pruebas = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort().map((f) => path.join(dir, f)) : []);
const deCarpetas = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : [])
  .filter((e) => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name)).flatMap((e) => pruebas(path.join(dir, e.name, 'test')));
const archivos = pruebas(path.join(raiz, 'test'))
  .concat(deCarpetas(path.join(raiz, 'src', 'modulos')))
  .concat(deCarpetas(path.join(raiz, '..', 'modulos', '_ejemplo')));
if (!process.env.COI_TEST_MYSQL_URL) console.log('# Sin COI_TEST_MYSQL_URL: se omiten las pruebas que usan MySQL.');
const r = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...archivos], { stdio: 'inherit', cwd: raiz });
process.exit(r.status === null ? 1 : r.status);
