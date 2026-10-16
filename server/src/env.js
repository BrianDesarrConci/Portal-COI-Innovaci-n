// Ajustes de entorno que deben cargarse antes que el resto del servidor.
// En Vercel el sistema de archivos solo permite escribir en /tmp: allí van la base JSON de TRAZA,
// las escrituras de COI V1 sobre la copia de Sheets, la bandeja de salida y los archivos generados.
// Es almacenamiento efímero (se pierde al reciclar la función); para datos persistentes use
// Google Sheets en vivo (GOOGLE_SERVICE_ACCOUNT_JSON).
import os from 'node:os';
import path from 'node:path';

if (process.env.VERCEL && !process.env.DATA_DIR) process.env.DATA_DIR = path.join(os.tmpdir(), 'coi-data');
