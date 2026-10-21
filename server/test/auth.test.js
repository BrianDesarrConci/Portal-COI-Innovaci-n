import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'coi-auth-'));
process.env.AUTH_MAX_INTENTOS = '1000';
const { createApp } = await import('../src/app.js');
const { mapearUsuario } = await import('../src/auth/proveedores/da.js');

// API DA simulado: usuario "jperez"/"clave1" exige código 246810; "admin"/"clave2" entra directo.
let daLlamadas = [];
const da = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    const b = JSON.parse(body || '{}');
    daLlamadas.push({ url: req.url, body: b, key: req.headers['x-api-key'] });
    const json = (st, o) => { res.writeHead(st, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.url === '/auth/login') {
      if (b.usuario === 'jperez' && b.clave === 'clave1') return json(200, { requiereCodigo: true, transaccion: 'TX-1', destino: 'j***@reval.com.co' });
      if (b.usuario === 'admin' && b.clave === 'clave2') return json(200, { token: 'tok-admin', usuario: { id: 7, nombre: 'Ana Gómez', email: 'ana@reval.com.co', perfiles: ['ADMINISTRADOR'] } });
      if (b.usuario === 'caido') return json(503, {});
      return json(401, { mensaje: 'Credenciales inválidas' });
    }
    if (req.url === '/auth/verificar') {
      if (b.transaccion === 'TX-1' && b.codigo === '246810') return json(200, { token: 'tok-j', usuario: { id: 'jperez', nombre: 'Juan Pérez', correo: 'jperez@reval.com.co', cargo: 'Analista', roles: ['ANALISTA'] } });
      return json(401, {});
    }
    json(404, {});
  });
});

let server, base;
before(async () => {
  da.listen(0); await new Promise((r) => da.once('listening', r));
  server = createApp().listen(0); await new Promise((r) => server.once('listening', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
after(() => { server.close(); da.close(); });

const ENV = ['AUTH_PROVEEDOR', 'DA_BASE_URL', 'DA_API_KEY', 'DA_MAPA_ROLES', 'COI_SESSION_SECRET', 'AUTH_REQUERIDO'];
beforeEach(() => { ENV.forEach((k) => delete process.env[k]); daLlamadas = []; });

function modoDA() {
  process.env.AUTH_PROVEEDOR = 'da';
  process.env.DA_BASE_URL = 'http://127.0.0.1:' + da.address().port;
  process.env.DA_API_KEY = 'llave-coi';
  process.env.DA_MAPA_ROLES = '{"ADMINISTRADOR":"admin"}';
  process.env.COI_SESSION_SECRET = 'x'.repeat(40);
}
const post = (url, body, cookie) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
const get = (url, cookie) => fetch(base + url, { headers: cookie ? { Cookie: cookie } : {} });
const cookieDe = (r) => (r.headers.get('set-cookie') || '').split(';')[0];

test('demo: config, código inválido y sesión completa', async () => {
  const cfg = await (await get('/api/auth/config')).json();
  assert.equal(cfg.proveedor, 'demo');
  assert.equal(cfg.codigo.longitud, 6);
  assert.equal((await get('/api/auth/me')).status, 401);
  // En la demo el API sigue abierto sin sesión.
  assert.equal((await get('/api/catalog')).status, 200);

  const l = await (await post('/api/auth/login', {})).json();
  assert.ok(l.desafio);
  assert.equal((await post('/api/auth/verificar', { desafio: l.desafio, codigo: '12' })).status, 401);
  const v = await post('/api/auth/verificar', { desafio: l.desafio, codigo: '123456' });
  assert.equal(v.status, 200);
  const cookie = cookieDe(v);
  assert.match(v.headers.get('set-cookie'), /HttpOnly/);
  const me = await (await get('/api/auth/me', cookie)).json();
  assert.equal(me.usuario.nombre, 'Nubia Parrado');
  assert.deepEqual(me.usuario.roles, ['admin']);

  const out = await post('/api/auth/logout', {}, cookie);
  assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
});

test('demo con AUTH_REQUERIDO=1 exige sesión en el API', async () => {
  process.env.AUTH_REQUERIDO = '1';
  assert.equal((await get('/api/catalog')).status, 401);
  assert.equal((await get('/api/health')).status, 200);
});

test('DA: sin sesión el API responde 401 y health sigue abierto', async () => {
  modoDA();
  const r = await get('/api/catalog');
  assert.equal(r.status, 401);
  assert.equal((await r.json()).sesion, false);
  assert.equal((await get('/api/health')).status, 200);
  const cfg = await (await get('/api/auth/config')).json();
  assert.equal(cfg.proveedor, 'da');
  assert.deepEqual(cfg.campos, ['usuario', 'clave']);
});

test('DA: clave incorrecta y servicio caído', async () => {
  modoDA();
  const r = await post('/api/auth/login', { usuario: 'jperez', clave: 'mala' });
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error, 'Credenciales inválidas');
  assert.equal(daLlamadas[0].key, 'llave-coi');
  const c = await post('/api/auth/login', { usuario: 'caido', clave: 'x' });
  assert.equal(c.status, 502);
  assert.match((await c.json()).error, /DA/);
  assert.equal((await post('/api/auth/login', { usuario: 'jperez' })).status, 401);
});

test('DA: ingreso con código de verificación', async () => {
  modoDA();
  const l = await (await post('/api/auth/login', { usuario: 'jperez', clave: 'clave1' })).json();
  assert.ok(l.desafio);
  assert.equal(l.destino, 'j***@reval.com.co');
  assert.equal((await post('/api/auth/verificar', { desafio: l.desafio, codigo: '000000' })).status, 401);
  const v = await post('/api/auth/verificar', { desafio: l.desafio, codigo: '246810' });
  assert.equal(v.status, 200);
  const cookie = cookieDe(v);
  const me = await (await get('/api/auth/me', cookie)).json();
  assert.equal(me.usuario.id, 'jperez');
  assert.equal(me.usuario.iniciales, 'JP');
  assert.deepEqual(me.usuario.roles, ['analista']);
  assert.equal((await get('/api/catalog', cookie)).status, 200);
  // Un analista no ve el registro de accesos.
  assert.equal((await get('/api/admin/accesos', cookie)).status, 403);
});

test('DA: ingreso directo con mapa de roles y registro de accesos', async () => {
  modoDA();
  const r = await post('/api/auth/login', { usuario: 'admin', clave: 'clave2' });
  assert.equal(r.status, 200);
  const { usuario } = await r.json();
  assert.equal(usuario.id, '7');
  assert.equal(usuario.correo, 'ana@reval.com.co');
  assert.deepEqual(usuario.roles, ['admin']);
  const acc = await (await get('/api/admin/accesos', cookieDe(r))).json();
  assert.ok(acc.some((e) => e.evento === 'ingreso' && e.usuario === '7'));
});

test('DA: cookie alterada, desafío de otro proveedor y secreto faltante', async () => {
  modoDA();
  const r = await post('/api/auth/login', { usuario: 'admin', clave: 'clave2' });
  const cookie = cookieDe(r);
  const [nombre, valor] = cookie.split('=');
  const alterada = nombre + '=' + valor.slice(0, -3) + (valor.endsWith('AAA') ? 'BBB' : 'AAA');
  assert.equal((await get('/api/auth/me', alterada)).status, 401);
  assert.equal((await get('/api/catalog', alterada)).status, 401);

  // Una sesión de la demo no sirve con DA.
  delete process.env.AUTH_PROVEEDOR; delete process.env.DA_BASE_URL;
  const l = await (await post('/api/auth/login', {})).json();
  const demoCookie = cookieDe(await post('/api/auth/verificar', { desafio: l.desafio, codigo: '123456' }));
  modoDA();
  assert.equal((await get('/api/auth/me', demoCookie)).status, 401);

  delete process.env.COI_SESSION_SECRET;
  const s = await post('/api/auth/login', { usuario: 'admin', clave: 'clave2' });
  assert.equal(s.status, 500);
  assert.match((await s.json()).error, /COI_SESSION_SECRET/);
});

test('mapearUsuario tolera respuestas planas', () => {
  const m = mapearUsuario({ access_token: 't', name: 'María López', mail: 'm@x.co', groups: [{ name: 'Lider' }] }, 'mlopez');
  assert.equal(m.token, 't');
  assert.equal(m.usuario.nombre, 'María López');
  assert.equal(m.usuario.id, 'mlopez');
  assert.deepEqual(m.usuario.roles, ['lider']);
});
