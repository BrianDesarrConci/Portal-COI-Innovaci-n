import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'coi-test-'));
const { createApp } = await import('../src/app.js');

let server, base;
before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
after(() => server.close());

test('health', async () => {
  const r = await fetch(base + '/api/health');
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
});

test('catálogo con 16 clientes y 104 actividades', async () => {
  const c = await (await fetch(base + '/api/catalog')).json();
  assert.equal(Object.keys(c.BASE.clients).length, 16);
  assert.equal(c.BASE.acts.length, 104);
  assert.equal(c.analysts.length, 6);
  assert.equal(c.processes.length, 11);
});

test('módulo inexistente o con nombre inválido', async () => {
  assert.equal((await fetch(base + '/api/modules/no-existe')).status, 404);
  assert.equal((await fetch(base + '/api/modules/..%2Fcatalog')).status, 400);
});

test('la raíz responde (sin build muestra la guía de desarrollo)', async () => {
  const r = await fetch(base + '/');
  assert.equal(r.status, 200);
  assert.match(await r.text(), /COI/);
});
