import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { probarModulo, requiereMySQL, USUARIO_PRUEBA } from '#coi/pruebas';

// Base MySQL temporal (COI_TEST_MYSQL_URL); sin ella se omiten las pruebas con datos.
let m;
before(async () => { m = await probarModulo(new URL('..', import.meta.url)); });
after(() => m.cerrar());

const nueva = { turno: 'manana', cliente: 'BBVA', oficina: 'BBVA Salitre', categoria: 'efectivo', prioridad: 'alta', descripcion: 'Exceso de efectivo en bóveda sobre el límite asegurado.' };

test('arranca vacío: contadores en cero y sin listas', { skip: requiereMySQL }, async () => {
  const r = await m.pedir('GET', '/resumen');
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { abiertas: 0, en_gestion: 0, altas: 0, cerradas_hoy: 0, total: 0, minutosCierre: null, categorias: [], clientes: [] });
  assert.deepEqual((await m.pedir('GET', '/novedades')).body, []);
});

test('registra una novedad con su primer seguimiento', { skip: requiereMySQL }, async () => {
  const c = await m.pedir('POST', '/novedades', nueva);
  assert.equal(c.status, 201);
  assert.equal(c.body.estado, 'abierta');
  assert.equal(c.body.creado_por, USUARIO_PRUEBA.nombre);
  const d = await m.pedir('GET', '/novedades/' + c.body.id);
  assert.equal(d.body.seguimiento.length, 1);
  const r = (await m.pedir('GET', '/resumen')).body;
  assert.equal(r.abiertas, 1);
  assert.deepEqual(r.clientes, [{ cliente: 'BBVA', total: 1 }]);
  // La hora de registro es la de ahora (zona del portal y de MySQL coinciden).
  assert.ok(Math.abs(new Date(c.body.creado_en).getTime() - Date.now()) < 120000);
});

test('valida los datos de entrada', { skip: requiereMySQL }, async () => {
  assert.equal((await m.pedir('POST', '/novedades', { ...nueva, turno: 'madrugada' })).status, 400);
  assert.equal((await m.pedir('POST', '/novedades', { ...nueva, descripcion: 'corta' })).status, 400);
  assert.equal((await m.pedir('GET', '/novedades?estado=raro')).status, 400);
  assert.equal((await m.pedir('GET', '/novedades/999999')).status, 404);
  assert.equal((await m.pedir('GET', '/novedades/abc')).status, 404);
});

test('filtra por estado y texto (los comodines se escapan)', { skip: requiereMySQL }, async () => {
  await m.pedir('POST', '/novedades', { ...nueva, cliente: 'Davivienda', oficina: 'Calle 72', descripcion: 'Faltante de formatos de consignación.' });
  const q = await m.pedir('GET', '/novedades?estado=todas&q=salitre');
  assert.ok(q.body.length > 0 && q.body.every((n) => /Salitre/.test(n.oficina + n.descripcion)));
  assert.deepEqual((await m.pedir('GET', '/novedades?estado=todas&q=%25')).body, []);
  assert.deepEqual((await m.pedir('GET', '/novedades?estado=cerrada')).body, []);
});

test('cierra una novedad y solo un líder la reabre', { skip: requiereMySQL }, async () => {
  const { body: n } = await m.pedir('POST', '/novedades', nueva);
  const cierre = await m.pedir('POST', `/novedades/${n.id}/seguimiento`, { estado: 'cerrada', comentario: 'Recogida extraordinaria realizada.' });
  assert.equal(cierre.status, 200);
  assert.equal(cierre.body.cerrado_por, USUARIO_PRUEBA.nombre);
  assert.ok(cierre.body.cerrado_en);
  const reabrir = { estado: 'abierta', comentario: 'Se repite la novedad.' };
  assert.equal((await m.pedir('POST', `/novedades/${n.id}/seguimiento`, reabrir)).status, 403);
  const lider = { ...USUARIO_PRUEBA, nombre: 'Líder de prueba', roles: ['lider'] };
  const ok = await m.pedir('POST', `/novedades/${n.id}/seguimiento`, reabrir, { como: lider });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.estado, 'abierta');
  assert.equal(ok.body.cerrado_en, null);
  assert.equal((await m.pedir('GET', '/novedades/' + n.id)).body.seguimiento.length, 3);
});

test('exige sesión', async () => {
  assert.equal((await m.pedir('GET', '/resumen', undefined, { como: 'anonimo' })).status, 401);
});

test('sin base configurada responde 503 con un mensaje claro', { skip: !requiereMySQL && 'Hay MySQL de pruebas.' }, async () => {
  const r = await m.pedir('GET', '/resumen');
  assert.equal(r.status, 503);
  assert.match(r.body.error, /COI_MYSQL_URL/);
});
