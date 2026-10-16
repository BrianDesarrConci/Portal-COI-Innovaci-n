/**
 * API de COI V1. Equivalente a google.script.run:
 *   POST /api/coiv1/rpc/:funcion   { "args": [ ... ] }   →   { "ok": true, "result": <lo que devuelve la función V1> }
 * Las funciones viven en server/src/coiv1/modules/*.js y server/src/coiv1/arqueos/*.js (listados en
 * registry.js); cada archivo exporta `functions = { nombreFuncionV1: async (...args) => ... }` con el mismo nombre y forma de
 * respuesta que el código de Apps Script.
 */
import { Router } from 'express';
import { getDriver, sheetsManifest } from './spreadsheet.js';
import { DriveFiles, readOutbox } from './gas.js';

import { MODULES } from './registry.js';

let registry = null;
async function loadRegistry() {
  if (registry) return registry;
  const reg = {};
  for (const [origen, mod] of MODULES) {
    for (const [name, fn] of Object.entries(mod.functions || {})) {
      if (reg[name]) console.warn(`[COI V1] función duplicada ${name} (${origen})`);
      reg[name] = fn;
    }
  }
  const drv = getDriver();
  if (drv.init) await drv.init();
  registry = reg;
  return reg;
}

const router = Router();
router.use(async (_req, _res, next) => { try { await loadRegistry(); next(); } catch (e) { next(e); } });

router.get('/meta', (_req, res) => res.json({
  driver: getDriver().name,
  funciones: Object.keys(registry).sort(),
  extraido: sheetsManifest._meta && sheetsManifest._meta.extraido,
  libros: Object.fromEntries(Object.entries(sheetsManifest).filter(([k]) => k !== '_meta').map(([b, s]) => [b, Object.fromEntries(Object.entries(s).map(([n, m]) => [n, m.rows]))]))
}));

router.post('/rpc/:fn', async (req, res) => {
  const fn = registry[req.params.fn];
  if (!fn) return res.status(404).json({ ok: false, error: 'Función no disponible: ' + req.params.fn });
  const args = Array.isArray(req.body && req.body.args) ? req.body.args : [];
  try {
    const result = await fn(...args);
    res.json({ ok: true, result: result === undefined ? null : result });
  } catch (e) {
    console.error('[COI V1]', req.params.fn, e);
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

router.get('/outbox', (_req, res) => res.json(readOutbox()));
router.get('/files', (_req, res) => res.json(DriveFiles.list()));
router.get('/files/:id', (req, res) => {
  const f = DriveFiles.get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Archivo no encontrado' });
  res.setHeader('Content-Type', f.mimeType);
  res.setHeader('Content-Disposition', 'inline; filename="' + encodeURIComponent(f.name) + '"');
  res.send(f.buffer);
});

export default router;
