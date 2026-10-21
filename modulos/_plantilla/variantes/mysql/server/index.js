/**
 * Servidor del módulo __NOMBRE__. Rutas relativas a /api/m/__ID__.
 * req.usuario = { id, nombre, correo, roles } del usuario con sesión.
 * db.query(sql, params) → { rows }   (MySQL usa ? para los parámetros)
 * Los errores con `status` < 500 se muestran al usuario tal cual.
 */
const fallo = (status, mensaje) => Object.assign(new Error(mensaje), { status });

export default async function registrar({ router, db }) {
  router.get('/estado', (req, res) => res.json({ ok: true, modulo: '__ID__', usuario: req.usuario.nombre, bd: db ? db.motor : 'ninguna' }));
  if (!db) return;

  router.get('/registros', async (_req, res) => {
    const { rows } = await db.query('SELECT id, titulo, detalle, creado_por, creado_en FROM registro ORDER BY creado_en DESC, id DESC LIMIT 200');
    res.json(rows);
  });

  router.post('/registros', async (req, res) => {
    const titulo = String(req.body.titulo || '').trim();
    if (titulo.length < 3) throw fallo(400, 'El título debe tener al menos 3 caracteres.');
    const { info } = await db.query(
      'INSERT INTO registro (titulo, detalle, creado_por) VALUES (?, ?, ?)',
      [titulo.slice(0, 200), String(req.body.detalle || '').trim() || null, req.usuario.nombre]
    );
    const { rows } = await db.query('SELECT id, titulo, detalle, creado_por, creado_en FROM registro WHERE id = ?', [info.insertId]);
    res.status(201).json(rows[0]);
  });

  router.delete('/registros/:id', async (req, res) => {
    const { info } = await db.query('DELETE FROM registro WHERE id = ?', [Number(req.params.id)]);
    if (!info.affectedRows) throw fallo(404, 'Registro no encontrado.');
    res.json({ ok: true });
  });
}
