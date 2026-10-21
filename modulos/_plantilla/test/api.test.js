import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { probarModulo, requiereMySQL, USUARIO_PRUEBA } from '#coi/pruebas';

// Las pruebas con datos usan una base MySQL temporal (COI_TEST_MYSQL_URL); sin ella se omiten.
let m;
before(async () => { m = await probarModulo(new URL('..', import.meta.url)); });
after(() => m.cerrar());

test('arranca vacío: contadores en cero', { skip: requiereMySQL }, async () => {
  const r = await m.pedir('GET', '/resumen');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { total: 0, hoy: 0 });
});

test('crea y lista registros', { skip: requiereMySQL }, async () => {
  const c = await m.pedir('POST', '/registros', { titulo: 'Primer registro' });
  assert.equal(c.status, 201);
  assert.equal(c.body.creado_por, USUARIO_PRUEBA.nombre);
  const l = await m.pedir('GET', '/registros');
  assert.ok(l.body.some((r) => r.id === c.body.id));
});

test('valida los datos de entrada', { skip: requiereMySQL }, async () => {
  assert.equal((await m.pedir('POST', '/registros', { titulo: 'x' })).status, 400);
  assert.equal((await m.pedir('DELETE', '/registros/999999')).status, 404);
});

test('exige sesión', async () => {
  assert.equal((await m.pedir('GET', '/registros', undefined, { como: 'anonimo' })).status, 401);
});
