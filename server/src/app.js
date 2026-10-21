import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import trazaRouter from './routes/traza.js';
import coiv1Router from './coiv1/router.js';
import authRouter, { cargarSesion } from './auth/index.js';
import { puedeAcceder } from './auth/roles.js';
import { listarAccesos } from './auth/accesos.js';
import modulosRouter from './modulos/router.js';
import { MODULE_DATA } from './data/modules/index.js';

const catalog = JSON.parse(fs.readFileSync(new URL('./data/catalog.json', import.meta.url), 'utf8'));

/**
 * Crea la aplicación Express con el API. La interfaz React se monta en index.js
 * (build estático o Vite en modo middleware). Se exporta aparte para poder probarla.
 */
export function createApp() {
  const app = express();
  app.use(cors());
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '40mb' }));

  // Sesión: carga req.usuario y, con el proveedor DA, exige sesión en todo /api salvo health y auth.
  app.use(cargarSesion);
  app.use('/api/auth', authRouter);
  app.get('/api/admin/accesos', (req, res) => {
    if (!puedeAcceder(req.usuario, ['admin'])) return res.status(403).json({ error: 'Solo administradores.' });
    res.json(listarAccesos());
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'coi-api', time: new Date().toISOString() }));

  // Catálogo base del área: clientes, 104 actividades, analistas, procesos, ANS y pulso del día.
  app.get('/api/catalog', (_req, res) => res.json(catalog));

  // Datos de cada módulo operativo (N1…N9, G1…G6). Un archivo por vista en data/modules.
  app.get('/api/modules/:view', async (req, res, next) => {
    const { view } = req.params;
    if (!/^[a-z0-9-]+$/.test(view)) return res.status(400).json({ error: 'Nombre de módulo no válido' });
    const load = Object.prototype.hasOwnProperty.call(MODULE_DATA, view) ? MODULE_DATA[view] : null;
    if (!load) return res.status(404).json({ error: 'Módulo sin datos: ' + view });
    try {
      const mod = await load();
      res.json(mod.default);
    } catch (err) { next(err); }
  });

  app.use('/api/traza', trazaRouter);
  app.use('/api/coiv1', coiv1Router);
  // Módulos de los analistas (modulos/<id>): /api/m/<id>/..., cada uno con su propia base de datos.
  app.use('/api/m', modulosRouter);

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(err.status || 500).json({ error: err.expose ? err.message : 'Error interno del servidor' });
  });
  return app;
}
