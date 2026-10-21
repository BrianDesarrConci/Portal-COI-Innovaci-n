import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { probarModulo, USUARIO_PRUEBA } from '#coi/pruebas';

let m;
before(async () => { m = await probarModulo(new URL('..', import.meta.url)); });
after(() => m.cerrar());

const nueva = { turno: 'manana', cliente: 'BBVA', oficina: 'BBVA Salitre', categoria: 'efectivo', prioridad: 'alta', descripcion: 'Exceso de efectivo en bóveda sobre el límite asegurado.' };

test('la BD embebida trae datos de demostración y el resumen los cuenta', async () => {
  const r = await m.pedir('GET', '/resumen');
  assert.equal(r.status, 200);
  assert.ok(r.body.total >= 8);
  assert.equal(r.body.abiertas + r.body.en_gestion, (await m.pedir('GET', '/novedades')).body.length);
  assert.ok(r.body.categorias.length > 0);
});

test('registra una novedad con su primer seguimiento', async () => {
  const c = await m.pedir('POST', '/novedades', nueva);
  assert.equal(c.status, 201);
  assert.equal(c.body.estado, 'abierta');
  assert.equal(c.body.creado_por, USUARIO_PRUEBA.nombre);
  const d = await m.pedir('GET', '/novedades/' + c.body.id);
  assert.equal(d.body.seguimiento.length, 1);
});

test('valida los datos de entrada', async () => {
  assert.equal((await m.pedir('POST', '/novedades', { ...nueva, turno: 'madrugada' })).status, 400);
  assert.equal((await m.pedir('POST', '/novedades', { ...nueva, descripcion: 'corta' })).status, 400);
  assert.equal((await m.pedir('GET', '/novedades/999999')).status, 404);
});

test('filtra por estado y texto', async () => {
  const cerradas = await m.pedir('GET', '/novedades?estado=cerrada');
  assert.ok(cerradas.body.length > 0 && cerradas.body.every((n) => n.estado === 'cerrada'));
  const q = await m.pedir('GET', '/novedades?estado=todas&q=Salitre');
  assert.ok(q.body.length > 0 && q.body.every((n) => /Salitre/.test(n.oficina + n.descripcion)));
});

test('cierra una novedad y solo un líder la reabre', async () => {
  const { body: n } = await m.pedir('POST', '/novedades', nueva);
  const cierre = await m.pedir('POST', `/novedades/${n.id}/seguimiento`, { estado: 'cerrada', comentario: 'Recogida extraordinaria realizada.' });
  assert.equal(cierre.status, 200);
  assert.equal(cierre.body.cerrado_por, USUARIO_PRUEBA.nombre);
  assert.ok(cierre.body.cerrado_en);
  const reabrir = { estado: 'abierta', comentario: 'Se repite la novedad.' };
  assert.equal((await m.pedir('POST', `/novedades/${n.id}/seguimiento`, reabrir)).status, 403);
  const lider = { ...USUARIO_PRUEBA, nombre: 'Adriana Ríos', roles: ['lider'] };
  const ok = await m.pedir('POST', `/novedades/${n.id}/seguimiento`, reabrir, { como: lider });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.estado, 'abierta');
  assert.equal(ok.body.cerrado_en, null);
  assert.equal((await m.pedir('GET', '/novedades/' + n.id)).body.seguimiento.length, 3);
});

test('exige sesión', async () => {
  assert.equal((await m.pedir('GET', '/resumen', undefined, { como: 'anonimo' })).status, 401);
});
