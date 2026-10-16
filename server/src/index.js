import fs from 'node:fs';
import { createApp } from './app.js';

const hasBuild = fs.existsSync(new URL('../../client/dist/index.html', import.meta.url));

const PORT = Number(process.env.PORT) || 4000;
createApp().listen(PORT, () => {
  console.log('COI API escuchando en http://localhost:' + PORT + '/api');
  if (!hasBuild) console.log('Modo desarrollo: abra la aplicación en http://localhost:5173');
  else console.log('Aplicación disponible en http://localhost:' + PORT);
});
