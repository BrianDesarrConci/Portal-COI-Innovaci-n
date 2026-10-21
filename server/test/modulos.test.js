import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'coi-modulos-'));
const { escribirZip, leerZip, rutaSegura } = await import('../../scripts/modulos/zip.js');
const { contextoPortal, validarPaquete } = await import('../../scripts/modulos/validar.js');
const { normalizarRaiz, paqueteInstalado } = await import('../../scripts/modulos/paquete.js');
const { generarRegistros } = await import('../../scripts/modulos/sincronizar.js');
const { abrirBD } = await import('../src/modulos/db.js');
const { migrar, checksum } = await import('../src/modulos/migraciones.js');
const { crearRouterModulos } = await import('../src/modulos/router.js');

const ctx = await contextoPortal();
const sinInstalados = { ...ctx, instalados: [] };
const MAN = {
  id: 'control-remesas', nombre: 'Control de remesas', version: '1.0.0', descripcion: 'Prueba',
  autor: { nombre: 'Ana Analista', correo: 'ana@reval.com.co' },
  menu: { grupo: 'Operación', etiqueta: 'Control de remesas', icono: 'wallet', orden: 20 },
  acceso: { roles: [] }, db: { motor: 'postgres', variable: 'DB_CONTROL_REMESAS_URL' }, dependencias: { server: {}, client: {} },
};
/** Paquete mínimo válido; `cambios` agrega o reemplaza archivos (null elimina). */
function paquete(man = MAN, cambios = {}) {
  const base = {
    'module.json': JSON.stringify(man),
    'README.md': '# Módulo',
    'server/index.js': "export default async function registrar({ router }) { router.get('/x', (_q, r) => r.json({})); }",
    'server/migraciones/001_inicial.sql': 'CREATE TABLE remesa (id SERIAL PRIMARY KEY);',
    'client/index.jsx': "import { Card } from '@coi/sdk';\nexport default function M() { return <Card title=\"x\" />; }",
  };
  const m = new Map();
  for (const [k, v] of Object.entries({ ...base, ...cambios })) if (v !== null) m.set(k, Buffer.from(v));
  return m;
}
const errores = (pkg, c = sinInstalados, o) => validarPaquete(pkg, c, o).errores.join('\n');

describe('zip', () => {
  test('ida y vuelta conserva contenido, tildes y binarios', () => {
    const entradas = [['mod/a.txt', Buffer.from('Gestión ñandú '.repeat(200))], ['mod/b.bin', Buffer.from([0, 1, 2, 255, 254])], ['mod/vacío.txt', Buffer.alloc(0)]];
    const leido = leerZip(escribirZip(entradas));
    assert.deepEqual([...leido.keys()], entradas.map((e) => e[0]));
    for (const [k, v] of entradas) assert.ok(leido.get(k).equals(v));
  });
  test('rechaza rutas que salen de la carpeta', () => {
    assert.throws(() => rutaSegura('../x.js'));
    assert.throws(() => rutaSegura('/etc/passwd'));
    assert.throws(() => rutaSegura('C:\\x.js'));
    assert.equal(rutaSegura('a\\b\\c.js'), 'a/b/c.js');
  });
  test('rechaza archivos que no son zip y límites excedidos', () => {
    assert.throws(() => leerZip(Buffer.from('no soy un zip')), /zip válido/);
    assert.throws(() => leerZip(escribirZip([['a', Buffer.alloc(2000)]]), { archivo: 1000 }), /demasiado grande/);
  });
  test('quita la carpeta raíz y descarta basura de macOS', () => {
    const m = new Map([['mod/module.json', Buffer.from('{}')], ['mod/server/index.js', Buffer.from('')], ['__MACOSX/mod/._x', Buffer.from('')], ['mod/.DS_Store', Buffer.from('')]]);
    const { archivos, descartados } = normalizarRaiz(m);
    assert.deepEqual([...archivos.keys()], ['module.json', 'server/index.js']);
    assert.equal(descartados, 2);
  });
});

describe('validador', () => {
  test('un paquete correcto pasa', () => {
    const r = validarPaquete(paquete(), sinInstalados);
    assert.deepEqual(r.errores, []);
    assert.equal(r.manifiesto.id, 'control-remesas');
  });
  test('id inválido, reservado o que choca con una vista del portal', () => {
    assert.match(errores(paquete({ ...MAN, id: 'Mi_Modulo' })), /"id" inválido/);
    assert.match(errores(paquete({ ...MAN, id: 'pqr' })), /choca con una vista/);
    assert.match(errores(paquete({ ...MAN, id: 'junta' })), /choca con una vista/);
  });
  test('versión, motor y variable de BD', () => {
    assert.match(errores(paquete({ ...MAN, version: '1.0' })), /semver/);
    assert.match(errores(paquete({ ...MAN, db: { motor: 'oracle' } })), /db.motor/);
    assert.match(errores(paquete({ ...MAN, db: { motor: 'postgres', variable: 'URL_BD' } })), /DB_<NOMBRE>_URL/);
    assert.match(errores(paquete({ ...MAN, db: { motor: 'ninguna' } })), /migraciones pero/);
  });
  test('detecta secretos y archivos prohibidos', () => {
    assert.match(errores(paquete(MAN, { 'server/config.js': "export const k = 'AIza" + 'x'.repeat(35) + "';" })), /llave de API de Google/);
    assert.match(errores(paquete(MAN, { 'server/db.js': "const u = 'postgres://coi:Secreta123@db.reval.co/coi';" })), /cadena de conexión/);
    assert.match(errores(paquete(MAN, { '.env': 'DB=1' })), /variables de entorno/);
    assert.match(errores(paquete(MAN, { 'node_modules/(omitido)': '' })), /node_modules/);
    assert.match(errores(paquete(MAN, { 'package.json': '{}' })), /dependencias/);
    assert.match(errores(paquete(MAN, { 'scripts/x.js': '' })), /Carpeta no permitida/);
  });
  test('importaciones: fuera del módulo, internas del portal, no aprobadas o peligrosas', () => {
    assert.match(errores(paquete(MAN, { 'client/index.jsx': "import x from '../../components/ui.jsx';\nexport default x;" })), /@coi\/sdk/);
    assert.match(errores(paquete(MAN, { 'client/index.jsx': "import axios from 'axios';\nexport default axios;" })), /no permitida "axios"/);
    assert.match(errores(paquete({ ...MAN, dependencias: { server: { leftpad: '1' } } })), /no aprobada/);
    assert.match(errores(paquete(MAN, { 'server/index.js': "import { exec } from 'node:child_process';\nexport default async () => exec('ls');" })), /child_process/);
    assert.equal(errores(paquete(MAN, { 'server/index.js': "import crypto from 'node:crypto';\nimport { x } from './util.js';\nexport default async () => {};", 'server/util.js': 'export const x = 1;' })), '');
    assert.equal(errores(paquete(MAN, { 'test/api.test.js': "import { test } from 'node:test';\nimport { probarModulo } from '#coi/pruebas';" })), '');
  });
  test('migraciones con nombre o ubicación incorrectos', () => {
    assert.match(errores(paquete(MAN, { 'server/migraciones/inicial.sql': 'SELECT 1;' })), /Nombre de migración/);
    assert.match(errores(paquete(MAN, { 'client/datos.sql': 'SELECT 1;' })), /solo en server\/migraciones/);
  });
  test('reemplazo de un módulo instalado exige versión mayor', () => {
    const c = { ...ctx, instalados: [{ id: MAN.id, manifiesto: MAN }] };
    assert.match(errores(paquete(), c), /ya está instalado/);
    assert.match(errores(paquete(), c, { reemplazar: true }), /debe ser mayor/);
    assert.equal(errores(paquete({ ...MAN, version: '1.1.0' }), c, { reemplazar: true }), '');
  });
  test('cada módulo tiene su propia BD', () => {
    const c = { ...ctx, instalados: [{ id: 'otro', manifiesto: { ...MAN, id: 'otro' } }] };
    assert.match(errores(paquete(), c), /ya la usa el módulo "otro"/);
  });
  test('los módulos instalados cumplen el contrato', () => {
    for (const { id } of ctx.instalados) {
      const r = validarPaquete(paqueteInstalado(id), { ...ctx, instalados: ctx.instalados.filter((m) => m.id !== id) });
      assert.deepEqual(r.errores, [], id);
    }
  });
});

describe('registro generado', () => {
  test('es determinista y está al día con los módulos instalados', () => {
    const a = generarRegistros(), b = generarRegistros();
    assert.equal(a.server, b.server);
    assert.equal(a.client, b.client);
    assert.deepEqual(a.errores, []);
    const leer = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
    assert.equal(leer('../src/modulos/registro.generado.js'), a.server, 'Ejecute npm run modulos:sync');
    assert.equal(leer('../../client/src/modulos/registro.generado.js'), a.client, 'Ejecute npm run modulos:sync');
  });
});

describe('migraciones', () => {
  const man = { id: 'mig-prueba', db: { motor: 'postgres', variable: 'DB_MIG_PRUEBA_URL' } };
  const silencio = { info() {}, warn() {}, error() {} };
  let db;
  before(async () => { db = await abrirBD(man, { memoria: true }); });
  after(() => db.cerrar());
  const v1 = [{ nombre: '001_inicial.sql', sql: 'CREATE TABLE t (id SERIAL PRIMARY KEY, n TEXT);\nINSERT INTO t (n) VALUES (\'a\');' }];

  test('aplica en orden, registra y es idempotente', async () => {
    assert.deepEqual((await migrar(db, man.id, v1, silencio)).aplicadas, ['001_inicial.sql']);
    const v2 = v1.concat({ nombre: '002_columna.sql', sql: 'ALTER TABLE t ADD COLUMN m INT;' });
    assert.deepEqual((await migrar(db, man.id, v2, silencio)).aplicadas, ['002_columna.sql']);
    assert.deepEqual((await migrar(db, man.id, v2, silencio)).aplicadas, []);
    const { rows } = await db.query('SELECT nombre FROM coi_migraciones ORDER BY nombre');
    assert.deepEqual(rows.map((r) => r.nombre), ['001_inicial.sql', '002_columna.sql']);
  });
  test('una migración fallida no deja cambios a medias', async () => {
    const mala = [...v1, { nombre: '002_columna.sql', sql: 'ALTER TABLE t ADD COLUMN m INT;' }, { nombre: '003_mala.sql', sql: "INSERT INTO t (n) VALUES ('b');\nSELECT * FROM no_existe;" }];
    await assert.rejects(migrar(db, man.id, mala, silencio));
    assert.equal((await db.query('SELECT count(*)::int AS n FROM t')).rows[0].n, 1);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM coi_migraciones WHERE nombre = '003_mala.sql'")).rows[0].n, 0);
  });
  test('rechaza una migración aplicada que cambió (sin importar el fin de línea)', async () => {
    assert.equal(checksum('a\r\nb'), checksum('a\nb'));
    const editada = [{ nombre: '001_inicial.sql', sql: v1[0].sql + '\n-- cambio' }];
    await assert.rejects(migrar(db, man.id, editada, silencio), /cambió después de aplicada/);
  });
  test('MySQL sin URL responde 503 con un mensaje claro', async () => {
    const my = await abrirBD({ id: 'sin-url', db: { motor: 'mysql', variable: 'DB_SIN_URL_URL' } }, { log: silencio });
    await assert.rejects(my.query('SELECT 1'), (e) => e.status === 503 && /DB_SIN_URL_URL/.test(e.message));
  });
});

describe('API /api/m', () => {
  const ana = { id: 'ana', nombre: 'Ana', roles: ['analista'] };
  const lider = { id: 'lu', nombre: 'Luz', roles: ['Líder'] };
  const admin = { id: 'ad', nombre: 'Admin', roles: ['admin'] };
  let server, base, router;
  before(async () => {
    const entrada = {
      manifiesto: { ...MAN, id: 'restringido', acceso: { roles: ['lider'] }, db: { motor: 'ninguna' } },
      migraciones: [],
      async registrar({ router: r, config }) {
        r.get('/hola', (req, res) => res.json({ hola: req.usuario.nombre, cfg: config.env('X', 'def') }));
        r.get('/falla', async () => { throw new Error('detalle interno'); });
        r.get('/invalido', async () => { throw Object.assign(new Error('Dato inválido'), { status: 400 }); });
      },
    };
    const abierto = { manifiesto: { ...MAN, id: 'abierto', db: { motor: 'ninguna' } }, migraciones: [], async registrar({ router: r }) { r.get('/x', (_q, res) => res.json({ ok: true })); } };
    router = crearRouterModulos([entrada, abierto], { memoria: true });
    const app = express();
    app.use((req, _res, next) => { const h = req.headers['x-u']; req.usuario = h ? JSON.parse(h) : undefined; next(); });
    app.use('/api/m', router);
    server = app.listen(0);
    await new Promise((r) => server.once('listening', r));
    base = `http://127.0.0.1:${server.address().port}/api/m`;
  });
  after(async () => { server.close(); await router.cerrar(); });
  const get = async (ruta, u) => { const r = await fetch(base + ruta, { headers: u ? { 'x-u': JSON.stringify(u) } : {} }); return { status: r.status, body: await r.json() }; };

  test('401 sin sesión, 403 sin el rol, 200 con el rol (sin tildes ni mayúsculas) o admin', async () => {
    assert.equal((await get('/restringido/hola')).status, 401);
    assert.equal((await get('/restringido/hola', ana)).status, 403);
    const ok = await get('/restringido/hola', lider);
    assert.equal(ok.status, 200);
    assert.deepEqual(ok.body, { hola: 'Luz', cfg: 'def' });
    assert.equal((await get('/restringido/hola', admin)).status, 200);
  });
  test('lista solo los módulos visibles para el usuario', async () => {
    assert.deepEqual((await get('/', ana)).body.map((m) => m.id), ['abierto']);
    const todos = await get('/', admin);
    assert.deepEqual(todos.body.map((m) => m.id), ['restringido', 'abierto']);
    assert.ok(todos.body[0].db);
  });
  test('módulo o ruta inexistente responde 404 en JSON', async () => {
    assert.equal((await get('/no-existe/x', admin)).status, 404);
    assert.match((await get('/abierto/nada', ana)).body.error, /Ruta no encontrada/);
  });
  test('errores async: 500 sin detalles internos, 4xx con su mensaje', async () => {
    const e = await get('/restringido/falla', admin);
    assert.equal(e.status, 500);
    assert.doesNotMatch(e.body.error, /detalle interno/);
    assert.deepEqual(await get('/restringido/invalido', admin), { status: 400, body: { error: 'Dato inválido' } });
  });
  test('_estado solo para administradores', async () => {
    assert.equal((await get('/abierto/_estado', ana)).status, 403);
    const s = await get('/abierto/_estado', admin);
    assert.equal(s.status, 200);
    assert.equal(s.body.db.motor, 'ninguna');
  });
});
