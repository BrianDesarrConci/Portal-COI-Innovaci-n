import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createApp } from './app.js';

const PORT = Number(process.env.PORT) || 4000;
const here = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(here, '..', '..', 'client');
const dist = path.join(clientDir, 'dist');

// --dev fuerza Vite (recarga en caliente). Sin build de React también se usa Vite,
// así la interfaz y el API quedan siempre en el mismo puerto (local o StackBlitz).
const devMode = process.argv.includes('--dev') || !fs.existsSync(path.join(dist, 'index.html'));

const app = createApp();
const server = http.createServer(app);

if (devMode) {
  const { createServer } = await import('vite');
  const vite = await createServer({
    root: clientDir,
    configFile: path.join(clientDir, 'vite.config.js'),
    appType: 'spa',
    server: { middlewareMode: true, hmr: { server } }
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

server.listen(PORT, () => {
  console.log('COI listo en http://localhost:' + PORT + (devMode ? ' (modo desarrollo con Vite)' : ' (build de producción)'));
});
