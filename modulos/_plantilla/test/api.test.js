import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { probarModulo } from '#coi/pruebas';

let m;
before(async () => { m = await probarModulo(new URL('..', import.meta.url)); });
after(() => m.cerrar());

test('responde el estado del módulo', async () => {
  const r = await m.pedir('GET', '/estado');
  assert.equal(r.status, 200);
  assert.equal(r.body.ok, true);
});

// Sin BD (motor "ninguna" o MySQL sin DB_<ID>_URL) se omiten las pruebas de datos.
const sinBD = () => !m.db || m.db.configurada === false;

test('crea y lista registros', async (t) => {
  if (sinBD()) return t.skip('módulo sin base de datos');
  const c = await m.pedir('POST', '/registros', { titulo: 'Primer registro' });
  assert.equal(c.status, 201);
  const l = await m.pedir('GET', '/registros');
  assert.ok(l.body.some((r) => r.id === c.body.id));
});

test('valida los datos de entrada', async (t) => {
  if (sinBD()) return t.skip('módulo sin base de datos');
  const r = await m.pedir('POST', '/registros', { titulo: 'x' });
  assert.equal(r.status, 400);
});

test('exige sesión', async () => {
  const r = await m.pedir('GET', '/estado', undefined, { como: 'anonimo' });
  assert.equal(r.status, 401);
});
