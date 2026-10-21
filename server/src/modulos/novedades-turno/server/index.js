/**
 * Servidor del módulo Novedades de turno. Rutas relativas a /api/m/novedades-turno.
 *   GET  /resumen                     indicadores del tablero
 *   GET  /novedades?estado=&q=        listado (estado: activas | abierta | en_gestion | cerrada | todas)
 *   GET  /novedades/:id               detalle con su seguimiento
 *   POST /novedades                   registra una novedad
 *   POST /novedades/:id/seguimiento   agrega seguimiento y cambia el estado (reabrir: líder o admin)
 */
import { DEMO } from './datos-demo.js';

const TURNOS = ['manana', 'tarde', 'noche'];
const CATEGORIAS = ['operativa', 'efectivo', 'seguridad', 'tecnologia', 'personal'];
const PRIORIDADES = ['baja', 'media', 'alta'];
const ESTADOS = ['abierta', 'en_gestion', 'cerrada'];
const COLUMNAS = 'id, fecha, turno, cliente, oficina, categoria, prioridad, descripcion, estado, creado_por, creado_en, cerrado_por, cerrado_en';

const fallo = (status, mensaje) => Object.assign(new Error(mensaje), { status });
const texto = (v, campo, min, max) => {
  const t = String(v === undefined || v === null ? '' : v).trim();
  if (t.length < min) throw fallo(400, `${campo}: escriba al menos ${min} caracteres.`);
  return t.slice(0, max);
};
const opcion = (v, lista, campo) => { if (!lista.includes(v)) throw fallo(400, `${campo} no válido.`); return v; };

async function sembrarDemo(db, log) {
  const { rows } = await db.query('SELECT count(*)::int AS n FROM novedad');
  if (rows[0].n) return;
  await db.transaccion(async (tx) => {
    for (const [turno, cliente, oficina, categoria, prioridad, descripcion, estado, horas] of DEMO) {
      const creado = new Date(Date.now() - horas * 3600e3 - 15 * 60e3);
      const { rows: [n] } = await tx.query(
        `INSERT INTO novedad (turno, cliente, oficina, categoria, prioridad, descripcion, estado, creado_por, creado_en, cerrado_por, cerrado_en)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Jully Andrea Rojas', $8, $9, $10) RETURNING id`,
        [turno, cliente, oficina, categoria, prioridad, descripcion, estado, creado, estado === 'cerrada' ? 'Adriana Ríos' : null, estado === 'cerrada' ? new Date(creado.getTime() + 90 * 60e3) : null]
      );
      await tx.query("INSERT INTO novedad_seguimiento (novedad_id, estado, comentario, autor, creado_en) VALUES ($1, 'abierta', 'Novedad registrada.', 'Jully Andrea Rojas', $2)", [n.id, creado]);
      if (estado !== 'abierta') {
        await tx.query('INSERT INTO novedad_seguimiento (novedad_id, estado, comentario, autor, creado_en) VALUES ($1, $2, $3, $4, $5)',
          [n.id, estado, estado === 'cerrada' ? 'Novedad resuelta y verificada con la oficina.' : 'Caso asignado; en seguimiento con el cliente.', 'Adriana Ríos', new Date(creado.getTime() + 45 * 60e3)]);
      }
    }
  });
  log.info('datos de demostración cargados');
}

export default async function registrar({ router, db, log, acceso }) {
  // Solo en la BD embebida (sin DB_NOVEDADES_TURNO_URL): demostración con datos de ejemplo.
  if (db.embebida) await sembrarDemo(db, log);

  router.get('/resumen', async (_req, res) => {
    const { rows: [k] } = await db.query(`SELECT
        count(*) FILTER (WHERE estado = 'abierta')::int AS abiertas,
        count(*) FILTER (WHERE estado = 'en_gestion')::int AS en_gestion,
        count(*) FILTER (WHERE estado <> 'cerrada' AND prioridad = 'alta')::int AS altas,
        count(*) FILTER (WHERE estado = 'cerrada' AND cerrado_en >= date_trunc('day', now()))::int AS cerradas_hoy,
        count(*)::int AS total
      FROM novedad`);
    const { rows: categorias } = await db.query("SELECT categoria, count(*)::int AS total FROM novedad WHERE estado <> 'cerrada' GROUP BY categoria ORDER BY total DESC, categoria");
    const { rows: clientes } = await db.query("SELECT cliente, count(*)::int AS total FROM novedad WHERE estado <> 'cerrada' GROUP BY cliente ORDER BY total DESC, cliente LIMIT 5");
    const { rows: [t] } = await db.query("SELECT round(avg(extract(epoch FROM cerrado_en - creado_en)) / 60)::int AS minutos FROM novedad WHERE estado = 'cerrada'");
    res.json({ ...k, categorias, clientes, minutosCierre: t.minutos });
  });

  router.get('/novedades', async (req, res) => {
    const estado = String(req.query.estado || 'activas');
    const filtros = [], params = [];
    if (estado === 'activas') filtros.push("estado <> 'cerrada'");
    else if (ESTADOS.includes(estado)) { params.push(estado); filtros.push(`estado = $${params.length}`); }
    const q = String(req.query.q || '').trim();
    if (q) { params.push('%' + q + '%'); filtros.push(`(cliente ILIKE $${params.length} OR oficina ILIKE $${params.length} OR descripcion ILIKE $${params.length})`); }
    const { rows } = await db.query(
      `SELECT ${COLUMNAS} FROM novedad ${filtros.length ? 'WHERE ' + filtros.join(' AND ') : ''}
       ORDER BY (estado = 'cerrada'), array_position(ARRAY['alta','media','baja']::varchar[], prioridad), creado_en DESC LIMIT 300`, params);
    res.json(rows);
  });

  router.get('/novedades/:id', async (req, res) => {
    const id = Number(req.params.id);
    const { rows: [n] } = await db.query(`SELECT ${COLUMNAS} FROM novedad WHERE id = $1`, [id]);
    if (!n) throw fallo(404, 'Novedad no encontrada.');
    const { rows: seguimiento } = await db.query('SELECT estado, comentario, autor, creado_en FROM novedad_seguimiento WHERE novedad_id = $1 ORDER BY creado_en, id', [id]);
    res.json({ ...n, seguimiento });
  });

  router.post('/novedades', async (req, res) => {
    const b = req.body || {};
    const datos = [
      opcion(b.turno, TURNOS, 'Turno'), texto(b.cliente, 'Cliente', 2, 80), String(b.oficina || '').trim().slice(0, 120) || null,
      opcion(b.categoria, CATEGORIAS, 'Categoría'), opcion(b.prioridad, PRIORIDADES, 'Prioridad'), texto(b.descripcion, 'Descripción', 10, 2000), req.usuario.nombre,
    ];
    const n = await db.transaccion(async (tx) => {
      const { rows: [nueva] } = await tx.query(
        `INSERT INTO novedad (turno, cliente, oficina, categoria, prioridad, descripcion, creado_por) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING ${COLUMNAS}`, datos);
      await tx.query("INSERT INTO novedad_seguimiento (novedad_id, estado, comentario, autor) VALUES ($1, 'abierta', 'Novedad registrada.', $2)", [nueva.id, req.usuario.nombre]);
      return nueva;
    });
    res.status(201).json(n);
  });

  router.post('/novedades/:id/seguimiento', async (req, res) => {
    const id = Number(req.params.id);
    const estado = opcion(req.body.estado, ESTADOS, 'Estado');
    const comentario = texto(req.body.comentario, 'Comentario', 5, 2000);
    const n = await db.transaccion(async (tx) => {
      const { rows: [actual] } = await tx.query('SELECT estado FROM novedad WHERE id = $1 FOR UPDATE', [id]);
      if (!actual) throw fallo(404, 'Novedad no encontrada.');
      if (actual.estado === 'cerrada' && estado !== 'cerrada' && !acceso.puedeAcceder(req.usuario, ['lider'])) {
        throw fallo(403, 'Solo un líder puede reabrir una novedad cerrada.');
      }
      const cierre = estado === 'cerrada' && actual.estado !== 'cerrada';
      const { rows: [act] } = await tx.query(
        `UPDATE novedad SET estado = $2::varchar,
           cerrado_por = CASE WHEN $2::varchar = 'cerrada' THEN COALESCE(CASE WHEN $3::boolean THEN $4::varchar END, cerrado_por) END,
           cerrado_en = CASE WHEN $2::varchar = 'cerrada' THEN COALESCE(CASE WHEN $3::boolean THEN now() END, cerrado_en) END
         WHERE id = $1 RETURNING ${COLUMNAS}`, [id, estado, cierre, req.usuario.nombre]);
      await tx.query('INSERT INTO novedad_seguimiento (novedad_id, estado, comentario, autor) VALUES ($1, $2, $3, $4)', [id, estado, comentario, req.usuario.nombre]);
      return act;
    });
    res.json(n);
  });
}
