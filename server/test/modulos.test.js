import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import express from 'express';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'coi-modulos-'));
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { escribirZip, leerZip, rutaSegura } = await import('../../scripts/modulos/zip.js');
const { contextoPortal, validarPaquete } = await import('../../scripts/modulos/validar.js');
const { empaquetar, leerPaquete, normalizarRaiz, paqueteDesdePlantilla, paqueteInstalado } = await import('../../scripts/modulos/paquete.js');
const { generarRegistros } = await import('../../scripts/modulos/sincronizar.js');
const { abrirBD, prefijoSugerido, urlDe } = await import('../src/modulos/db.js');
const { migrar, checksum, estadoMigraciones } = await import('../src/modulos/migraciones.js');
const { dividirSQL, tablasDe } = await import('../src/modulos/sql.js');
const { crearRouterModulos } = await import('../src/modulos/router.js');
const { baseTemporal, requiereMySQL } = await import('../src/modulos/pruebas.js');

const ctx = await contextoPortal();
const sinInstalados = { ...ctx, instalados: [] };
const MAN = {
  id: 'control-remesas', nombre: 'Control de remesas', version: '1.0.0', descripcion: 'Prueba', nuevo: true,
  autor: { nombre: 'Ana Analista', correo: 'ana@reval.com.co' },
  menu: { grupo: 'Operación', etiqueta: 'Control de remesas', icono: 'wallet', orden: 20 },
  acceso: { roles: [] }, db: { motor: 'mysql', prefijo: 'cr_' }, dependencias: { server: {}, client: {} },
};
const MIG = 'CREATE TABLE cr_remesa (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, valor DECIMAL(14,2) NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;';
/** Paquete mínimo válido; `cambios` agrega o reemplaza archivos (null elimina). */
function paquete(man = MAN, cambios = {}) {
  const base = {
    'module.json': JSON.stringify(man),
    'README.md': '# Módulo',
    'server/index.js': "export default async function registrar({ router, db }) { router.get('/x', async (_q, r) => r.json((await db.query('SELECT id FROM cr_remesa WHERE id = ?', [1])).rows)); }",
    'server/migraciones/001_inicial.sql': MIG,
    'client/index.jsx': "import { Card } from '@coi/sdk';\nexport default function M() { return <Card title=\"x\" />; }",
  };
  const m = new Map();
  for (const [k, v] of Object.entries({ ...base, ...cambios })) if (v !== null) m.set(k, Buffer.from(v));
  return m;
}
const validar = (pkg, c = sinInstalados, o) => validarPaquete(pkg, c, o);
const errores = (pkg, c, o) => validar(pkg, c, o).errores.join('\n');
const avisos = (pkg, c, o) => validar(pkg, c, o).avisos.join('\n');
const conMig = (sql) => paquete(MAN, { 'server/migraciones/001_inicial.sql': sql });
const conServidor = (js) => paquete(MAN, { 'server/index.js': js });

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

describe('SQL', () => {
  test('divide respetando textos y comentarios', () => {
    const s = dividirSQL("-- a; b\nCREATE TABLE x_a (n VARCHAR(5) DEFAULT 'a;b');\n/* ; */ INSERT INTO x_a VALUES ('c');\n# fin;\n");
    assert.equal(s.length, 2);
    assert.match(s[0], /'a;b'/);
  });
  test('detecta las tablas que toca cada sentencia', () => {
    const t = (sql) => tablasDe(sql).map((x) => x.nombre);
    assert.deepEqual(t('CREATE TABLE IF NOT EXISTS `cr_a` (id INT, FOREIGN KEY (id) REFERENCES otra (id))'), ['cr_a', 'otra']);
    assert.deepEqual(t('ALTER TABLE cr_a RENAME TO otra'), ['cr_a', 'otra']);
    assert.deepEqual(t('DROP TABLE IF EXISTS cr_a, cr_b'), ['cr_a', 'cr_b']);
    assert.deepEqual(t('CREATE INDEX i ON cr_a (c)'), ['cr_a']);
    assert.deepEqual(t('INSERT IGNORE INTO cr_a (n) VALUES (1)'), ['cr_a']);
    assert.deepEqual(t('UPDATE base.t SET a = 1'), ['base.t']);
  });
  test('prefijo sugerido a partir del id', () => {
    assert.equal(prefijoSugerido('validacion'), 'validacion_');
    assert.equal(prefijoSugerido('control-remesas'), 'cr_');
    assert.equal(prefijoSugerido('novedades-turno'), 'nt_');
  });
});

describe('validador', () => {
  test('un paquete correcto pasa sin avisos', () => {
    const r = validar(paquete());
    assert.deepEqual(r.errores, []);
    assert.deepEqual(r.avisos, []);
    assert.equal(r.manifiesto.db.prefijo, 'cr_');
  });
  test('id inválido, reservado o que choca con una vista del portal', () => {
    assert.match(errores(paquete({ ...MAN, id: 'Mi_Modulo' })), /"id" inválido/);
    assert.match(errores(paquete({ ...MAN, id: 'pqr' })), /choca con una vista/);
    assert.match(errores(paquete({ ...MAN, id: 'junta' })), /choca con una vista/);
  });
  test('los ids del plan reemplazan la opción en construcción; otros ids deben declararse "nuevo"', () => {
    const plan = Object.keys(ctx.pendientes);
    assert.ok(plan.includes('validacion'), 'estados.js publica PENDIENTES');
    const deplan = { ...MAN, id: 'validacion', nuevo: undefined, db: { motor: 'mysql', prefijo: 'val_' }, menu: { ...MAN.menu, grupo: ctx.pendientes.validacion.grupo } };
    const migVal = { 'server/migraciones/001_inicial.sql': 'CREATE TABLE val_soporte (id INT PRIMARY KEY) ENGINE=InnoDB;', 'server/index.js': 'export default async function registrar() {}' };
    assert.equal(errores(paquete(deplan, migVal)), '');
    assert.equal(avisos(paquete(deplan, migVal)), '');
    assert.match(avisos(paquete({ ...deplan, menu: { ...deplan.menu, grupo: 'Herramientas' } }, migVal)), /ocupa el lugar/);
    assert.match(avisos(paquete({ ...MAN, nuevo: undefined })), /no es un módulo del plan/);
    assert.match(errores(paquete({ ...MAN, nuevo: 'si' })), /"nuevo" solo puede ser true/);
  });
  test('versión, motor y prefijo de la BD', () => {
    assert.match(errores(paquete({ ...MAN, version: '1.0' })), /semver/);
    assert.match(errores(paquete({ ...MAN, db: { motor: 'postgres' } })), /usan MySQL/);
    assert.match(errores(paquete({ ...MAN, db: { motor: 'oracle' } })), /db.motor/);
    assert.match(errores(paquete({ ...MAN, db: { motor: 'mysql', prefijo: 'CR' } })), /"db.prefijo" inválido/);
    assert.match(errores(paquete({ ...MAN, db: { motor: 'mysql', prefijo: 'cr_', variable: 'URL_BD' } })), /DB_<NOMBRE>_URL/);
    assert.match(errores(paquete({ ...MAN, db: { motor: 'ninguna' } })), /migraciones pero/);
    const sinPrefijo = validar(paquete({ ...MAN, db: { motor: 'mysql' } }));
    assert.match(sinPrefijo.avisos.join('\n'), /falta "db.prefijo"; se usará "cr_"/);
    assert.deepEqual(sinPrefijo.errores, []);
  });
  test('migraciones: solo tablas con el prefijo del módulo', () => {
    assert.match(errores(conMig('CREATE TABLE remesa (id INT PRIMARY KEY);')), /debe empezar por su prefijo "cr_"/);
    assert.match(errores(conMig(MIG + '\nCREATE TABLE cr_b (id INT, FOREIGN KEY (id) REFERENCES clientes (id));')), /REFERENCES clientes/);
    assert.match(errores(conMig(MIG + "\nINSERT INTO usuarios (n) VALUES ('x');")), /INSERT usuarios/);
    assert.match(errores(conMig(MIG + '\nALTER TABLE cr_remesa RENAME TO remesas;')), /RENAME remesas/);
    assert.match(errores(conMig(MIG + '\nUPDATE otra_base.cr_x SET a = 1;')), /apunta a otra base/);
    assert.match(errores(conMig(MIG + '\nDELETE FROM coi_migraciones;')), /coi_migraciones es del portal/);
    assert.match(avisos(conMig('CREATE TABLE cr_Mayus (id INT) ENGINE=InnoDB;')), /minúsculas/);
  });
  test('migraciones: sentencias prohibidas y sintaxis de PostgreSQL', () => {
    for (const [sql, re] of [
      ['CREATE DATABASE otra;', /bases de datos/], ['USE otra;', /USE/], ["GRANT ALL ON *.* TO 'x'@'%';", /GRANT/],
      ["CREATE USER 'x'@'%' IDENTIFIED BY 'y';", /usuarios de MySQL/], ['SET GLOBAL max_connections = 10;', /variables globales/],
      ['CREATE TRIGGER cr_t BEFORE INSERT ON cr_remesa FOR EACH ROW SET NEW.valor = 0;', /triggers/],
      ['DELIMITER $$\nCREATE PROCEDURE cr_p() BEGIN SELECT 1; END $$', /DELIMITER/], ['START TRANSACTION;', /transacciones/],
      ['CREATE TABLE cr_x (id SERIAL PRIMARY KEY, f TIMESTAMPTZ);', /PostgreSQL/], ["SELECT 1 INTO OUTFILE '/tmp/x';", /archivos del servidor/],
      ['', /vacía/],
    ]) assert.match(errores(conMig(sql)), re, sql);
  });
  test('migraciones: avisos de motor, juego de caracteres y DROP TABLE', () => {
    assert.match(avisos(conMig('CREATE TABLE cr_a (id INT) ENGINE=MyISAM;')), /InnoDB/);
    assert.match(avisos(conMig('CREATE TABLE cr_a (id INT) DEFAULT CHARSET=latin1;')), /utf8mb4/);
    assert.match(avisos(conMig(MIG + '\nDROP TABLE cr_remesa;')), /sin IF EXISTS/);
    assert.equal(avisos(conMig(MIG + '\nDROP TABLE IF EXISTS cr_remesa;')), '');
  });
  test('código del servidor: SQL interpolado es error; tablas ajenas y concatenación son aviso', () => {
    assert.match(errores(conServidor('export default async function registrar({ router, db }) { router.get(\'/x\', async (q, r) => r.json(await db.query(`SELECT * FROM cr_remesa WHERE id = ${q.query.id}`))); }')), /inyección/);
    assert.match(avisos(conServidor("export default async function registrar({ db }) { await db.query('SELECT * FROM usuarios u JOIN cr_remesa r ON r.id = u.id'); }")), /sin el prefijo "cr_": usuarios/);
    assert.match(errores(conServidor("export default async function registrar({ db }) { await db.query('SELECT * FROM cr_remesa WHERE id = $1', [1]); }")), /sintaxis de PostgreSQL/);
    assert.match(avisos(conServidor("export default async function registrar({ db }) { const id = 1; await db.query('SELECT * FROM cr_remesa WHERE id = ' + id); }")), /concatenado/);
    assert.equal(avisos(conServidor("export default async function registrar({ db }) { await db.query('INSERT INTO cr_remesa (valor) VALUES (?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)', [1]); await db.query('SELECT EXTRACT(YEAR FROM creado_en) AS a FROM cr_remesa'); }")), '');
  });
  test('línea gráfica: clases con prefijo del módulo, colores y fuentes del portal', () => {
    const css = (txt) => avisos(paquete(MAN, { 'client/estilos.css': txt }));
    assert.equal(css('.control-remesas-tabla .btn { color: var(--navy); }\n@media (max-width: 640px) { .control-remesas-tabla { gap: 8px; } }\n@keyframes control-remesas-in { from { opacity: 0; } to { opacity: 1; } }'), '');
    assert.match(css('.tabla { color: var(--navy); } td { padding: 0; }'), /no empiezan por una clase "control-remesas-…".*\.tabla \| td/);
    assert.match(css('.control-remesas-x { color: #242A54; }'), /colores escritos a mano \(#242A54\)/);
    assert.match(css('.control-remesas-x { font-family: Arial; }'), /fuentes del portal/);
    assert.match(avisos(paquete(MAN, { 'client/index.jsx': "export default function M() { return <b style={{ color: '#21BBEA' }}>x</b>; }" })), /#21BBEA/);
  });
  test('detecta secretos y archivos prohibidos', () => {
    assert.match(errores(paquete(MAN, { 'server/config.js': "export const k = 'AIza" + 'x'.repeat(35) + "';" })), /llave de API de Google/);
    assert.match(errores(paquete(MAN, { 'server/db.js': "const u = 'mysql://coi:Secreta123@db.reval.co/coi';" })), /cadena de conexión/);
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
  test('cada módulo tiene su propio prefijo de tablas', () => {
    const c = { ...ctx, instalados: [{ id: 'otro', manifiesto: { ...MAN, id: 'otro' } }] };
    assert.match(errores(paquete(), c), /prefijo de tablas "cr_" ya lo usa el módulo "otro"/);
    const sinDeclarar = { ...ctx, instalados: [{ id: 'cuentas-remotas', manifiesto: { ...MAN, id: 'cuentas-remotas', db: { motor: 'mysql' } } }] };
    assert.match(errores(paquete(), sinDeclarar), /ya lo usa el módulo "cuentas-remotas"/);
  });
  test('la plantilla y el módulo de ejemplo cumplen el contrato sin avisos', () => {
    const pl = validar(paqueteDesdePlantilla('validacion', { nombre: 'Validación documental', grupo: ctx.pendientes.validacion.grupo, icono: 'filecheck', autor: 'Ana Analista', correo: 'ana@reval.com.co' }));
    assert.deepEqual(pl.errores, []);
    assert.deepEqual(pl.avisos, []);
    assert.equal(pl.manifiesto.db.prefijo, 'validacion_');
    const sinBD = validar(paqueteDesdePlantilla('papeleria', { grupo: ctx.pendientes.papeleria.grupo, motor: 'ninguna' }));
    assert.deepEqual(sinBD.errores, []);
    const ej = validar(leerPaquete(path.join(RAIZ, 'modulos', '_ejemplo', 'novedades-turno')).archivos);
    assert.deepEqual(ej.errores, []);
    assert.deepEqual(ej.avisos, []);
  });
  test('los módulos instalados cumplen el contrato', () => {
    for (const { id } of ctx.instalados) {
      const r = validarPaquete(paqueteInstalado(id), { ...ctx, instalados: ctx.instalados.filter((m) => m.id !== id) });
      assert.deepEqual(r.errores, [], id);
    }
  });
});

describe('importador', () => {
  test('zip del ejemplo → validar → importar en una copia del portal (y --simular no escribe)', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'coi-portal-'));
    for (const f of ['client/src/views/index.js', 'client/src/lib/nav.js', 'client/src/lib/estados.js']) {
      fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true });
      fs.copyFileSync(path.join(RAIZ, f), path.join(tmp, f));
    }
    const { archivos } = leerPaquete(path.join(RAIZ, 'modulos', '_ejemplo', 'novedades-turno'));
    const zip = path.join(tmp, 'novedades-turno-1.1.0.zip');
    fs.writeFileSync(zip, empaquetar('novedades-turno', archivos));
    const cli = (...a) => spawnSync(process.execPath, [path.join(RAIZ, 'scripts', 'modulos', 'cli.js'), ...a], { env: { ...process.env, COI_MODULOS_RAIZ: tmp }, encoding: 'utf8' });

    const v = cli('validar', zip);
    assert.equal(v.status, 0, v.stdout + v.stderr);
    const s = cli('importar', zip, '--simular');
    assert.equal(s.status, 0, s.stdout + s.stderr);
    assert.match(s.stdout, /Simulación/);
    assert.ok(!fs.existsSync(path.join(tmp, 'server', 'src', 'modulos', 'novedades-turno')));

    const i = cli('importar', zip);
    assert.equal(i.status, 0, i.stdout + i.stderr);
    assert.ok(fs.existsSync(path.join(tmp, 'server', 'src', 'modulos', 'novedades-turno', 'server', 'migraciones', '001_inicial.sql')));
    assert.ok(fs.existsSync(path.join(tmp, 'client', 'src', 'modulos', 'novedades-turno', 'index.jsx')));
    assert.match(fs.readFileSync(path.join(tmp, 'server', 'src', 'modulos', 'registro.generado.js'), 'utf8'), /"prefijo": "nt_"/);
    assert.match(fs.readFileSync(path.join(tmp, 'client', 'src', 'modulos', 'registro.generado.js'), 'utf8'), /lazy\(\(\) => import\('\.\/novedades-turno\/index\.jsx'\)\)/);

    const otra = cli('importar', zip);
    assert.notEqual(otra.status, 0);
    assert.match(otra.stdout, /ya está instalado/);
    fs.rmSync(tmp, { recursive: true, force: true });
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

describe('base de datos', () => {
  const silencio = { info() {}, warn() {}, error() {} };
  test('sin URL responde 503 con un mensaje claro', async () => {
    const db = await abrirBD({ id: 'sin-url', db: { motor: 'mysql', prefijo: 'su_' } }, { url: null, log: silencio });
    await assert.rejects(db.query('SELECT 1'), (e) => e.status === 503 && /COI_MYSQL_URL/.test(e.message));
    assert.equal(await abrirBD({ id: 'x', db: { motor: 'ninguna' } }), null);
  });
  test('la variable propia del módulo tiene prioridad sobre la base del portal', () => {
    const antes = { ...process.env };
    try {
      process.env.COI_MYSQL_URL = 'mysql://portal';
      assert.equal(urlDe({ id: 'mi-mod', db: { motor: 'mysql' } }), 'mysql://portal');
      process.env.DB_MI_MOD_URL = 'mysql://propia';
      assert.equal(urlDe({ id: 'mi-mod', db: { motor: 'mysql' } }), 'mysql://propia');
    } finally { delete process.env.COI_MYSQL_URL; delete process.env.DB_MI_MOD_URL; Object.assign(process.env, antes); }
  });
});

describe('migraciones en MySQL', { skip: requiereMySQL }, () => {
  const silencio = { info() {}, warn() {}, error() {} };
  let tmp, db, db2;
  before(async () => {
    tmp = await baseTemporal();
    db = await abrirBD({ id: 'mig-a', db: { motor: 'mysql', prefijo: 'ma_' } }, { url: tmp.url });
    db2 = await abrirBD({ id: 'mig-b', db: { motor: 'mysql', prefijo: 'mb_' } }, { url: tmp.url });
  });
  after(async () => { await db.cerrar(); await db2.cerrar(); await tmp.borrar(); });
  const v1 = [{ nombre: '001_inicial.sql', sql: "CREATE TABLE ma_t (id INT AUTO_INCREMENT PRIMARY KEY, n VARCHAR(20)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\nINSERT INTO ma_t (n) VALUES ('ñandú; ok');" }];

  test('aplica en orden, registra y es idempotente', async () => {
    assert.deepEqual((await migrar(db, 'mig-a', v1, silencio)).aplicadas, ['001_inicial.sql']);
    const v2 = v1.concat({ nombre: '002_columna.sql', sql: 'ALTER TABLE ma_t ADD COLUMN m INT NULL;' });
    assert.deepEqual((await migrar(db, 'mig-a', v2, silencio)).aplicadas, ['002_columna.sql']);
    assert.deepEqual((await migrar(db, 'mig-a', v2, silencio)).aplicadas, []);
    assert.deepEqual((await estadoMigraciones(db, 'mig-a')).map((r) => r.nombre), ['001_inicial.sql', '002_columna.sql']);
    assert.equal((await db.query('SELECT n FROM ma_t')).rows[0].n, 'ñandú; ok');
  });
  test('dos módulos comparten la tabla de control sin pisarse', async () => {
    const b = [{ nombre: '001_inicial.sql', sql: 'CREATE TABLE mb_t (id INT PRIMARY KEY) ENGINE=InnoDB;' }];
    assert.deepEqual((await migrar(db2, 'mig-b', b, silencio)).aplicadas, ['001_inicial.sql']);
    const { rows } = await db.query('SELECT modulo, nombre FROM coi_migraciones ORDER BY modulo, nombre');
    assert.deepEqual(rows.map((r) => r.modulo + '/' + r.nombre), ['mig-a/001_inicial.sql', 'mig-a/002_columna.sql', 'mig-b/001_inicial.sql']);
  });
  test('una migración fallida indica la sentencia, revierte los datos y no queda registrada', async () => {
    const mala = [...v1, { nombre: '002_columna.sql', sql: 'ALTER TABLE ma_t ADD COLUMN m INT NULL;' },
      { nombre: '003_mala.sql', sql: "INSERT INTO ma_t (n) VALUES ('b');\nSELECT * FROM ma_no_existe;" }];
    await assert.rejects(migrar(db, 'mig-a', mala, silencio), /003_mala\.sql del módulo mig-a falló en la sentencia 2 de 2/);
    assert.equal(Number((await db.query('SELECT COUNT(*) AS n FROM ma_t')).rows[0].n), 1);
    assert.equal(Number((await db.query("SELECT COUNT(*) AS n FROM coi_migraciones WHERE nombre = '003_mala.sql'")).rows[0].n), 0);
  });
  test('rechaza una migración aplicada que cambió (sin importar el fin de línea)', async () => {
    assert.equal(checksum('a\r\nb'), checksum('a\nb'));
    const editada = [{ nombre: '001_inicial.sql', sql: v1[0].sql + '\n-- cambio' }];
    await assert.rejects(migrar(db, 'mig-a', editada, silencio), /cambió después de aplicada/);
  });
  test('transacciones: confirma o revierte todo', async () => {
    await db.transaccion(async (tx) => { await tx.query("INSERT INTO ma_t (n) VALUES ('tx')"); });
    await assert.rejects(db.transaccion(async (tx) => { await tx.query("INSERT INTO ma_t (n) VALUES ('no')"); throw new Error('falla'); }));
    const { rows } = await db.query("SELECT n FROM ma_t WHERE n IN ('tx', 'no') ORDER BY n");
    assert.deepEqual(rows.map((r) => r.n), ['tx']);
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
    const abierto = { manifiesto: { ...MAN, id: 'abierto' }, migraciones: [], async registrar({ router: r, db }) { r.get('/x', (_q, res) => res.json({ ok: true })); r.get('/bd', async (_q, res) => res.json((await db.query('SELECT 1')).rows)); } };
    router = crearRouterModulos([entrada, abierto], { url: null });
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
    assert.deepEqual(todos.body[1].db, { motor: 'mysql', prefijo: 'cr_', origen: null });
  });
  test('módulo o ruta inexistente responde 404 en JSON', async () => {
    assert.equal((await get('/no-existe/x', admin)).status, 404);
    assert.match((await get('/abierto/nada', ana)).body.error, /Ruta no encontrada/);
  });
  test('errores async: 500 sin detalles internos, 4xx con su mensaje; sin BD, 503 claro', async () => {
    const e = await get('/restringido/falla', admin);
    assert.equal(e.status, 500);
    assert.doesNotMatch(e.body.error, /detalle interno/);
    assert.deepEqual(await get('/restringido/invalido', admin), { status: 400, body: { error: 'Dato inválido' } });
    const bd = await get('/abierto/bd', ana);
    assert.equal(bd.status, 503);
    assert.match(bd.body.error, /COI_MYSQL_URL/);
  });
  test('_estado solo para administradores', async () => {
    assert.equal((await get('/abierto/_estado', ana)).status, 403);
    const s = await get('/abierto/_estado', admin);
    assert.equal(s.status, 200);
    assert.equal(s.body.db.motor, 'mysql');
    assert.equal(s.body.db.configurada, false);
  });
});
