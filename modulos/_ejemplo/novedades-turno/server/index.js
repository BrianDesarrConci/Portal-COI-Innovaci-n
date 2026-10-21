/**
 * Servidor del módulo Novedades de turno. Rutas relativas a /api/m/novedades-turno.
 *   GET  /resumen                     indicadores del tablero
 *   GET  /novedades?estado=&q=        listado (estado: activas | abierta | en_gestion | cerrada | todas)
 *   GET  /novedades/:id               detalle con su seguimiento
 *   POST /novedades                   registra una novedad
 *   POST /novedades/:id/seguimiento   agrega seguimiento y cambia el estado (reabrir: líder o admin)
 * Tablas: nt_novedad y nt_seguimiento (MySQL del portal). Todos los valores van como parámetros "?".
 */
const TURNOS = ['manana', 'tarde', 'noche'];
const CATEGORIAS = ['operativa', 'efectivo', 'seguridad', 'tecnologia', 'personal'];
const PRIORIDADES = ['baja', 'media', 'alta'];
const ESTADOS = ['abierta', 'en_gestion', 'cerrada'];
const FILTROS = ['activas', 'todas', ...ESTADOS];

const fallo = (status, mensaje) => Object.assign(new Error(mensaje), { status });
const texto = (v, campo, min, max) => {
  const t = String(v === undefined || v === null ? '' : v).trim();
  if (t.length < min) throw fallo(400, `${campo}: escriba al menos ${min} caracteres.`);
  return t.slice(0, max);
};
const opcion = (v, lista, campo) => { if (!lista.includes(v)) throw fallo(400, `${campo} no válido.`); return v; };
const id = (v) => { const n = Number(v); if (!Number.isInteger(n) || n < 1) throw fallo(404, 'Novedad no encontrada.'); return n; };

export default async function registrar({ router, db, acceso }) {
  router.get('/resumen', async (_req, res) => {
    const { rows: [k] } = await db.query(`SELECT
        COUNT(CASE WHEN estado = 'abierta' THEN 1 END) AS abiertas,
        COUNT(CASE WHEN estado = 'en_gestion' THEN 1 END) AS en_gestion,
        COUNT(CASE WHEN estado <> 'cerrada' AND prioridad = 'alta' THEN 1 END) AS altas,
        COUNT(CASE WHEN estado = 'cerrada' AND cerrado_en >= CURDATE() THEN 1 END) AS cerradas_hoy,
        COUNT(*) AS total,
        CAST(ROUND(AVG(CASE WHEN estado = 'cerrada' THEN TIMESTAMPDIFF(MINUTE, creado_en, cerrado_en) END)) AS SIGNED) AS minutos
      FROM nt_novedad`);
    const { rows: categorias } = await db.query(
      "SELECT categoria, COUNT(*) AS total FROM nt_novedad WHERE estado <> 'cerrada' GROUP BY categoria ORDER BY total DESC, categoria");
    const { rows: clientes } = await db.query(
      "SELECT cliente, COUNT(*) AS total FROM nt_novedad WHERE estado <> 'cerrada' GROUP BY cliente ORDER BY total DESC, cliente LIMIT 5");
    const n = (v) => Number(v || 0);
    res.json({
      abiertas: n(k.abiertas), en_gestion: n(k.en_gestion), altas: n(k.altas), cerradas_hoy: n(k.cerradas_hoy), total: n(k.total),
      minutosCierre: k.minutos === null ? null : n(k.minutos),
      categorias: categorias.map((c) => ({ categoria: c.categoria, total: n(c.total) })),
      clientes: clientes.map((c) => ({ cliente: c.cliente, total: n(c.total) })),
    });
  });

  router.get('/novedades', async (req, res) => {
    const estado = opcion(String(req.query.estado || 'activas'), FILTROS, 'Filtro de estado');
    const q = String(req.query.q || '').trim().slice(0, 80);
    const patron = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
    const { rows } = await db.query(
      `SELECT id, fecha, turno, cliente, oficina, categoria, prioridad, descripcion, estado, creado_por, creado_en, cerrado_por, cerrado_en
         FROM nt_novedad
        WHERE (? = 'todas' OR (? = 'activas' AND estado <> 'cerrada') OR estado = ?)
          AND (? = '' OR cliente LIKE ? OR oficina LIKE ? OR descripcion LIKE ?)
        ORDER BY estado = 'cerrada', FIELD(prioridad, 'alta', 'media', 'baja'), creado_en DESC, id DESC
        LIMIT 300`,
      [estado, estado, estado, q, patron, patron, patron]);
    res.json(rows);
  });

  router.get('/novedades/:id', async (req, res) => {
    const nid = id(req.params.id);
    const { rows: [n] } = await db.query(
      `SELECT id, fecha, turno, cliente, oficina, categoria, prioridad, descripcion, estado, creado_por, creado_en, cerrado_por, cerrado_en
         FROM nt_novedad WHERE id = ?`, [nid]);
    if (!n) throw fallo(404, 'Novedad no encontrada.');
    const { rows: seguimiento } = await db.query(
      'SELECT estado, comentario, autor, creado_en FROM nt_seguimiento WHERE novedad_id = ? ORDER BY creado_en, id', [nid]);
    res.json({ ...n, seguimiento });
  });

  router.post('/novedades', async (req, res) => {
    const b = req.body || {};
    const datos = [
      opcion(b.turno, TURNOS, 'Turno'), texto(b.cliente, 'Cliente', 2, 80), String(b.oficina || '').trim().slice(0, 120) || null,
      opcion(b.categoria, CATEGORIAS, 'Categoría'), opcion(b.prioridad, PRIORIDADES, 'Prioridad'), texto(b.descripcion, 'Descripción', 10, 2000), req.usuario.nombre,
    ];
    const n = await db.transaccion(async (tx) => {
      const { info } = await tx.query(
        'INSERT INTO nt_novedad (fecha, turno, cliente, oficina, categoria, prioridad, descripcion, creado_por) VALUES (CURDATE(), ?, ?, ?, ?, ?, ?, ?)', datos);
      await tx.query("INSERT INTO nt_seguimiento (novedad_id, estado, comentario, autor) VALUES (?, 'abierta', 'Novedad registrada.', ?)", [info.insertId, req.usuario.nombre]);
      const { rows: [nueva] } = await tx.query(
        `SELECT id, fecha, turno, cliente, oficina, categoria, prioridad, descripcion, estado, creado_por, creado_en, cerrado_por, cerrado_en
           FROM nt_novedad WHERE id = ?`, [info.insertId]);
      return nueva;
    });
    res.status(201).json(n);
  });

  router.post('/novedades/:id/seguimiento', async (req, res) => {
    const nid = id(req.params.id);
    const estado = opcion(req.body.estado, ESTADOS, 'Estado');
    const comentario = texto(req.body.comentario, 'Comentario', 5, 2000);
    const n = await db.transaccion(async (tx) => {
      const { rows: [actual] } = await tx.query('SELECT estado FROM nt_novedad WHERE id = ? FOR UPDATE', [nid]);
      if (!actual) throw fallo(404, 'Novedad no encontrada.');
      if (actual.estado === 'cerrada' && estado !== 'cerrada' && !acceso.puedeAcceder(req.usuario, ['lider'])) {
        throw fallo(403, 'Solo un líder puede reabrir una novedad cerrada.');
      }
      if (estado === 'cerrada' && actual.estado !== 'cerrada') {
        await tx.query('UPDATE nt_novedad SET estado = ?, cerrado_por = ?, cerrado_en = NOW() WHERE id = ?', [estado, req.usuario.nombre, nid]);
      } else if (estado !== 'cerrada') {
        await tx.query('UPDATE nt_novedad SET estado = ?, cerrado_por = NULL, cerrado_en = NULL WHERE id = ?', [estado, nid]);
      }
      await tx.query('INSERT INTO nt_seguimiento (novedad_id, estado, comentario, autor) VALUES (?, ?, ?, ?)', [nid, estado, comentario, req.usuario.nombre]);
      const { rows: [act] } = await tx.query(
        `SELECT id, fecha, turno, cliente, oficina, categoria, prioridad, descripcion, estado, creado_por, creado_en, cerrado_por, cerrado_en
           FROM nt_novedad WHERE id = ?`, [nid]);
      return act;
    });
    res.json(n);
  });
}
