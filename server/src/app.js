import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import trazaRouter from './routes/traza.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = path.join(here, 'data', 'modules');

const catalog = JSON.parse(await readFile(path.join(here, 'data', 'catalog.json'), 'utf8'));

/** Crea la aplicación Express. Se exporta aparte de index.js para poder probarla. */
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'coi-api', time: new Date().toISOString() }));

  // Catálogo base del área: clientes, 104 actividades, analistas, procesos, ANS y pulso del día.
  app.get('/api/catalog', (_req, res) => res.json(catalog));

  // Datos de cada módulo operativo (N1…N9, G1…G6). Un archivo por vista en data/modules.
  app.get('/api/modules/:view', async (req, res, next) => {
    const { view } = req.params;
    if (!/^[a-z0-9-]+$/.test(view)) return res.status(400).json({ error: 'Nombre de módulo no válido' });
    const file = path.join(MODULES_DIR, view + '.js');
    if (!fs.existsSync(file)) return res.status(404).json({ error: 'Módulo sin datos: ' + view });
    try {
      const mod = await import(file);
      res.json(mod.default);
    } catch (err) { next(err); }
  });

  app.use('/api/traza', trazaRouter);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  // En producción, Node sirve también el build de React.
  const dist = path.resolve(here, '..', '..', 'client', 'dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.expose ? err.message : 'Error interno del servidor' });
  });
  return app;
}
