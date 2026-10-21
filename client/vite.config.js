import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // SDK para los módulos de los analistas (client/src/modulos/<id>): import { Card } from '@coi/sdk'.
    alias: { '@coi/sdk': fileURLToPath(new URL('./src/sdk/index.js', import.meta.url)) }
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:4000' }
  }
});
