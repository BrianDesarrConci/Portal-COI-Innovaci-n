// Ajustes de entorno que deben cargarse antes que el resto del servidor.
// En Vercel el sistema de archivos solo permite escribir en /tmp: allí van la base JSON de TRAZA,
// las escrituras de COI V1 sobre la copia de Sheets, la bandeja de salida y los archivos generados.
// Es almacenamiento efímero (se pierde al reciclar la función); para datos persistentes use
// Google Sheets en vivo (GOOGLE_SERVICE_ACCOUNT_JSON).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.env.VERCEL && !process.env.DATA_DIR) process.env.DATA_DIR = path.join(os.tmpdir(), 'coi-data');

// En local se leen las variables de .env en la raíz del repositorio (COI_MYSQL_URL, COI_TEST_MYSQL_URL…).
// Las variables ya definidas en el sistema tienen prioridad. En Vercel se usan las del proyecto.
const archivoEnv = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '.env');
if (!process.env.VERCEL && fs.existsSync(archivoEnv)) {
  for (const linea of fs.readFileSync(archivoEnv, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    let v = m[2];
    if (/^"(.*)"$/.test(v)) v = v.slice(1, -1).replace(/\\n/g, '\n');
    else if (/^'(.*)'$/.test(v)) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    process.env[m[1]] = v;
  }
}
