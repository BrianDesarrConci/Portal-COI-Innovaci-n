/**
 * API de los módulos de los analistas: cada módulo instalado responde en /api/m/<id>/...
 * Antes de llegar al módulo se exige sesión (401) y uno de los roles de "acceso.roles" (403).
 * Cada módulo se prepara la primera vez que se usa (BD + migraciones + registrar), así un arranque
 * en frío en Vercel solo paga el costo del módulo que se consulta.
 *
 *   GET /api/m                módulos visibles para el usuario (diagnóstico)
 *   GET /api/m/<id>/_estado   estado del módulo: versión, BD y migraciones (solo admin)
 */
import { Router } from 'express';
import { puedeAcceder, tieneRol, ROL_ADMIN } from '../auth/roles.js';
import { montar, normalizar } from './montaje.js';
import { estadoMigraciones } from './migraciones.js';
import { origenURL } from './db.js';
import { MODULOS } from './registro.generado.js';

/**
 * Crea el router para una lista de módulos (el registro generado o, en pruebas, módulos sueltos).
 * `opciones` pasa a montar(): { url } fuerza la base MySQL (pruebas).
 */
export function crearRouterModulos(modulos, opciones = {}) {
  const porId = new Map(modulos.map((m) => [m.manifiesto.id, { ...m, manifiesto: normalizar(m.manifiesto) }]));
  const listos = new Map();
  const preparar = (ent) => {
    const id = ent.manifiesto.id;
    if (!listos.has(id)) listos.set(id, montar(ent, opciones).catch((e) => { listos.delete(id); throw e; }));
    return listos.get(id);
  };

  const router = Router();
  router.get('/', (req, res) => {
    if (!req.usuario) return res.status(401).json({ error: 'Sesión requerida.' });
    const admin = tieneRol(req.usuario, ROL_ADMIN);
    res.json([...porId.values()].filter((m) => puedeAcceder(req.usuario, m.manifiesto.acceso.roles)).map(({ manifiesto: m }) => ({
      id: m.id, nombre: m.nombre, version: m.version, descripcion: m.descripcion, autor: m.autor, menu: m.menu, acceso: m.acceso,
      ...(admin ? { db: { motor: m.db.motor, prefijo: m.db.prefijo || null, origen: m.db.motor === 'ninguna' ? null : origenURL(m) } } : {}),
    })));
  });

  router.use('/:id', async (req, res, next) => {
    const ent = porId.get(req.params.id);
    if (!ent) return res.status(404).json({ error: 'Módulo no instalado: ' + req.params.id });
    if (!req.usuario) return res.status(401).json({ error: 'Sesión requerida.' });
    if (!puedeAcceder(req.usuario, ent.manifiesto.acceso.roles)) return res.status(403).json({ error: `Su rol no tiene acceso al módulo ${ent.manifiesto.nombre}.` });
    let m;
    try { m = await preparar(ent); } catch (e) {
      console.error(`[módulos] ${ent.manifiesto.id} no pudo iniciar:`, e);
      const detalle = tieneRol(req.usuario, ROL_ADMIN) || e.expose ? ' ' + e.message : '';
      return res.status(e.status || 500).json({ error: `El módulo ${ent.manifiesto.nombre} no está disponible.${detalle}` });
    }
    if (req.path === '/_estado' && req.method === 'GET') {
      if (!tieneRol(req.usuario, ROL_ADMIN)) return res.status(403).json({ error: 'Solo administradores.' });
      const { manifiesto: man, db } = m;
      return res.json({
        id: man.id, version: man.version, autor: man.autor,
        db: { motor: man.db.motor, prefijo: man.db.prefijo || null, origen: man.db.motor === 'ninguna' ? null : origenURL(man), configurada: !!(db && db.configurada !== false) },
        migraciones: await estadoMigraciones(db, man.id),
      });
    }
    m.manejador(req, res, next);
  });

  router.cerrar = async () => {
    for (const p of listos.values()) { try { const m = await p; if (m.db) await m.db.cerrar(); } catch { /* ya reportado */ } }
    listos.clear();
  };
  router.preparar = (id) => preparar(porId.get(id));
  return router;
}

export default crearRouterModulos(MODULOS);
