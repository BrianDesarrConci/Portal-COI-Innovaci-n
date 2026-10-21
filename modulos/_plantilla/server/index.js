/**
 * Servidor del módulo __NOMBRE__. Rutas relativas a /api/m/__ID__.
 *   req.usuario = { id, nombre, correo, roles } del usuario con sesión.
 *   db.query(sql, [valores]) → { rows, info }   valores siempre con "?" (nunca dentro del texto del SQL).
 *   Un error con `status` < 500 se muestra al usuario tal cual: escríbalo en español y claro.
 */
const fallo = (status, mensaje) => Object.assign(new Error(mensaje), { status });

export default async function registrar({ router, db }) {
  router.get('/resumen', async (_req, res) => {
    const { rows: [r] } = await db.query(
      'SELECT COUNT(*) AS total, COUNT(CASE WHEN creado_en >= CURDATE() THEN 1 END) AS hoy FROM __PREFIJO__registro'
    );
    res.json({ total: Number(r.total), hoy: Number(r.hoy) });
  });

  router.get('/registros', async (_req, res) => {
    const { rows } = await db.query(
      'SELECT id, titulo, detalle, creado_por, creado_en FROM __PREFIJO__registro ORDER BY creado_en DESC, id DESC LIMIT 200'
    );
    res.json(rows);
  });

  router.post('/registros', async (req, res) => {
    const titulo = String(req.body.titulo || '').trim();
    if (titulo.length < 3) throw fallo(400, 'El título debe tener al menos 3 caracteres.');
    const detalle = String(req.body.detalle || '').trim() || null;
    const { info } = await db.query(
      'INSERT INTO __PREFIJO__registro (titulo, detalle, creado_por) VALUES (?, ?, ?)',
      [titulo.slice(0, 200), detalle, req.usuario.nombre]
    );
    const { rows: [nuevo] } = await db.query(
      'SELECT id, titulo, detalle, creado_por, creado_en FROM __PREFIJO__registro WHERE id = ?', [info.insertId]
    );
    res.status(201).json(nuevo);
  });

  router.delete('/registros/:id', async (req, res) => {
    const { info } = await db.query('DELETE FROM __PREFIJO__registro WHERE id = ?', [Number(req.params.id)]);
    if (!info.affectedRows) throw fallo(404, 'Registro no encontrado.');
    res.json({ ok: true });
  });
}
