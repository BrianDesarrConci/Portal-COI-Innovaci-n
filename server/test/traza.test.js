import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'coi-traza-'));
const { createApp } = await import('../src/app.js');

let server, base;
before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
after(() => { server.close(); fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); });

const get = async (url) => { const r = await fetch(base + url); return [r.status, await r.json()]; };
const post = async (url, body) => {
  const r = await fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  return [r.status, await r.json()];
};

test('lista las 21 solicitudes de la semilla con id y título', async () => {
  const [st, list] = await get('/api/traza');
  assert.equal(st, 200);
  assert.equal(list.length, 21);
  assert.ok(list.every((t) => t.id && t.title && t.state && t.owner && t.created && t.target));
  assert.ok(list.some((t) => t.id === 'TRZ-0405'));
});

test('filtros de la lista: estado, aplicativo, responsable y búsqueda', async () => {
  const [, abiertas] = await get('/api/traza?estado=abiertas');
  assert.equal(abiertas.length, 13);
  const [, cerradas] = await get('/api/traza?estado=Cerrada');
  assert.equal(cerradas.length, 6);
  const [, creser] = await get('/api/traza?app=CreSER');
  assert.deepEqual(creser.map((t) => t.id).sort(), ['TRZ-0383', 'TRZ-0405']);
  const [, hernan] = await get('/api/traza?owner=hernan');
  assert.ok(hernan.length > 0 && hernan.every((t) => t.owner === 'hernan'));
  const [, q] = await get('/api/traza?q=' + encodeURIComponent('jully rios'));
  assert.equal(q.length, 3);
});

test('detalle con bitácora ordenada de la más reciente a la más antigua', async () => {
  const [st, t] = await get('/api/traza/TRZ-0405');
  assert.equal(st, 200);
  assert.equal(t.state, 'En desarrollo');
  assert.equal(t.prio, 'Crítica');
  assert.ok(Array.isArray(t.bitacora) && t.bitacora.length >= 3);
  assert.equal(t.bitacora.at(-1).detalle, 'Solicitud radicada por Gustavo Rojas');
  const horas = t.bitacora.filter((b) => b.tipoEntrada === 'HORAS').reduce((s, b) => s + b.horas, 0);
  assert.equal(Math.round(horas * 100) / 100, t.inv);
  for (let i = 1; i < t.bitacora.length; i++) assert.ok(t.bitacora[i - 1].fecha >= t.bitacora[i].fecha);
});

test('404 para radicados inexistentes', async () => {
  assert.equal((await get('/api/traza/TRZ-9999'))[0], 404);
  assert.equal((await post('/api/traza/TRZ-9999/avanzar'))[0], 404);
  const [st, body] = await post('/api/traza/TRZ-9999/bitacora', { tipo: 'NOTA', detalle: 'x' });
  assert.equal(st, 404);
  assert.match(body.error, /No existe/);
});

test('radicar valida los campos obligatorios', async () => {
  const [st, body] = await post('/api/traza', { req: 'Nubia Parrado' });
  assert.equal(st, 400);
  assert.match(body.error, /Complete los campos obligatorios/);
  const [st2, b2] = await post('/api/traza', { req: 'A', area: 'B', email: 'no-es-correo', app: 'COI', type: 'Mejora', title: 'T', desc: 'D' });
  assert.equal(st2, 400);
  assert.match(b2.error, /correo/);
  const [st3] = await post('/api/traza', { req: 'A', area: 'B', email: 'a@b.co', app: 'COI', type: 'Otro', title: 'T', desc: 'D' });
  assert.equal(st3, 400);
});

test('radicar crea TRZ-0414 en estado Recibida con su bitácora', async () => {
  const [st, t] = await post('/api/traza', {
    req: 'Nubia Parrado', area: 'Gestión del Negocio', email: 'nubia.parrado@reval.com.co', app: 'COI',
    type: 'Corrección de Fallos', prio: 'Alta', title: 'Prueba de radicación', desc: 'Descripción de prueba.'
  });
  assert.equal(st, 201);
  assert.equal(t.id, 'TRZ-0414');
  assert.equal(t.state, 'Recibida');
  assert.equal(t.type, 'Corrección de falla');
  assert.equal(t.inv, 0);
  assert.equal(t.bitacora.length, 1);
  assert.equal(t.bitacora[0].detalle, 'Solicitud radicada por Nubia Parrado');
  const [, list] = await get('/api/traza');
  assert.equal(list[0].id, 'TRZ-0414');
  const [, again] = await post('/api/traza', { req: 'X Y', area: 'A', email: 'x@y.co', app: 'COI', type: 'Mejora', title: 'Otra', desc: 'D' });
  assert.equal(again.id, 'TRZ-0415');
});

test('avanzar sigue el flujo y cierra al final', async () => {
  const seq = [];
  for (let i = 0; i < 4; i++) {
    const [st, t] = await post('/api/traza/TRZ-0414/avanzar');
    assert.equal(st, 200);
    seq.push(t.state);
  }
  assert.deepEqual(seq, ['En análisis', 'En desarrollo', 'En pruebas', 'Cerrada']);
  const [, t] = await get('/api/traza/TRZ-0414');
  assert.equal(t.bitacora[0].tipoEntrada, 'CIERRE');
  assert.equal(t.bitacora[0].detalle, 'Cambio de estado: En pruebas → Cerrada');
  assert.ok(t.closedAt && t.resolution);
  assert.ok(t.bitacora.some((b) => b.detalle === 'Cambio de estado: Recibida → En análisis'));
  const [st] = await post('/api/traza/TRZ-0414/avanzar');
  assert.equal(st, 400);
});

test('avanzar desde En espera retoma en pruebas', async () => {
  const [, t] = await post('/api/traza/TRZ-0398/avanzar');
  assert.equal(t.state, 'En pruebas');
  assert.equal(t.bitacora[0].detalle, 'Cambio de estado: En espera → En pruebas');
});

test('registrar horas acumula y valida; las notas quedan en la bitácora', async () => {
  const [, before] = await get('/api/traza/TRZ-0405');
  const [st, out] = await post('/api/traza/TRZ-0405/bitacora', { tipo: 'HORAS', horas: 1.5, detalle: 'Conexión a la base de datos y ajuste de filtros.' });
  assert.equal(st, 201);
  assert.equal(out.entrada.tipoEntrada, 'HORAS');
  assert.equal(out.solicitud.inv, before.inv + 1.5);
  assert.equal(out.solicitud.bitacora[0].horas, 1.5);

  assert.equal((await post('/api/traza/TRZ-0405/bitacora', { tipo: 'HORAS', horas: 0, detalle: 'x' }))[0], 400);
  assert.equal((await post('/api/traza/TRZ-0405/bitacora', { tipo: 'HORAS', horas: 2 }))[0], 400);
  assert.equal((await post('/api/traza/TRZ-0405/bitacora', { tipo: 'OTRO', detalle: 'x' }))[0], 400);
  assert.equal((await post('/api/traza/TRZ-0405/bitacora', { tipo: 'NOTA' }))[0], 400);

  const [st2, n] = await post('/api/traza/TRZ-0405/bitacora', { tipo: 'NOTA', detalle: 'Se validó el alcance con el solicitante.' });
  assert.equal(st2, 201);
  assert.equal(n.solicitud.inv, before.inv + 1.5);
  assert.equal(n.solicitud.bitacora[0].tipoEntrada, 'NOTA');
});

test('rechazar exige motivo y cierra la solicitud', async () => {
  assert.equal((await post('/api/traza/TRZ-0394/rechazar', {}))[0], 400);
  const [st, t] = await post('/api/traza/TRZ-0394/rechazar', { motivo: 'Duplicada con TRZ-0413.' });
  assert.equal(st, 200);
  assert.equal(t.state, 'Rechazada');
  assert.equal(t.resolution, 'Duplicada con TRZ-0413.');
});

test('los cambios se guardan en disco', () => {
  const saved = JSON.parse(fs.readFileSync(path.join(process.env.DATA_DIR, 'traza.json'), 'utf8'));
  assert.ok(saved.solicitudes.some((t) => t.id === 'TRZ-0415'));
  assert.ok(saved.bitacora.length > 21);
});
