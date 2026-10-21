/**
 * Ayudas para probar un módulo con node:test (se importan como '#coi/pruebas').
 *
 *   import { probarModulo } from '#coi/pruebas';
 *   const m = await probarModulo(new URL('..', import.meta.url));   // carpeta del módulo
 *   const r = await m.pedir('POST', '/registros', { titulo: 'x' });  // → { status, body }
 *   await m.cerrar();
 *
 * La BD es PostgreSQL embebido en memoria (PGlite), nueva en cada probarModulo(), con las migraciones aplicadas.
 * Los módulos MySQL se prueban contra una BD real con la variable DB_<ID>_URL.
 */
import express from 'express';
import { cargarDesdeCarpeta } from './montaje.js';
import { crearRouterModulos } from './router.js';

export const USUARIO_PRUEBA = { id: 'prueba', nombre: 'Usuario de Prueba', correo: 'prueba@reval.com.co', iniciales: 'UP', cargo: 'Analista', roles: ['analista'] };

export async function probarModulo(dir, { usuario = USUARIO_PRUEBA } = {}) {
  const entrada = await cargarDesdeCarpeta(dir);
  const id = entrada.manifiesto.id;
  const router = crearRouterModulos([entrada], { memoria: true });
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  // Cada petición puede simular otro usuario con el encabezado x-prueba-usuario (JSON) o "anonimo".
  app.use((req, _res, next) => {
    const h = req.headers['x-prueba-usuario'];
    req.usuario = h === 'anonimo' ? undefined : h ? JSON.parse(h) : usuario;
    next();
  });
  app.use('/api/m', router);
  const server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api/m/${id}`;
  const { db } = await router.preparar(id);
  return {
    id, base, db,
    /** Petición al módulo. Devuelve { status, body }. `como` = otro usuario o 'anonimo'. */
    async pedir(metodo, ruta, cuerpo, { como } = {}) {
      const headers = {};
      if (cuerpo !== undefined) headers['Content-Type'] = 'application/json';
      if (como) headers['x-prueba-usuario'] = como === 'anonimo' ? 'anonimo' : JSON.stringify(como);
      const r = await fetch(base + ruta, { method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) });
      const txt = await r.text();
      let body; try { body = JSON.parse(txt); } catch { body = txt; }
      return { status: r.status, body };
    },
    async cerrar() { await new Promise((r) => server.close(r)); await router.cerrar(); },
  };
}
