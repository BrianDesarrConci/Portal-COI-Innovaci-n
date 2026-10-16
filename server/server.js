// Punto de entrada del servicio "server" en Vercel (framework Express).
// Exporta la aplicación sin llamar listen(); en local se sigue usando src/index.js.
import './src/env.js';
import express from 'express';
import { createApp } from './src/app.js';

const app = express();

// El API vive bajo /api. Si la plataforma entrega la ruta sin ese prefijo, se repone.
app.use((req, _res, next) => {
  if (!req.url.startsWith('/api/') && req.url !== '/api') req.url = '/api' + (req.url === '/' ? '' : req.url);
  next();
});
app.use(createApp());

export default app;
