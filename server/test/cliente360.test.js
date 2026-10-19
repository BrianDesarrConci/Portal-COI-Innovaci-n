// Cliente 360: consolidado por cliente sobre la copia real de los Sheets (Directorio, Granja, Arqueos).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'coi-c360-'));
const C = await import('../src/coiv1/modules/cliente360.js');
const { functions: ARQ } = await import('../src/coiv1/arqueos/controlArqueos.js');
const { MODULES } = await import('../src/coiv1/registry.js');

test('el módulo está registrado y expone sus funciones RPC', () => {
  const m = MODULES.find((x) => x[0] === 'modules/cliente360.js');
  assert.ok(m);
  assert.equal(typeof m[1].functions.resumenClientes, 'function');
  assert.equal(typeof m[1].functions.cliente360, 'function');
});

test('coordenadas del Directorio guardadas sin punto decimal', () => {
  assert.equal(C.coordenada(-753345653, 'lon'), -75.334565);
  assert.equal(C.coordenada(64366779, 'lat'), 6.436678);
  assert.equal(C.coordenada(125741061, 'lat'), 12.574106);
  assert.equal(C.coordenada('4,61', 'lat'), 4.61);
  assert.equal(C.coordenada('', 'lat'), null);
  assert.equal(C.coordenada(0, 'lon'), null);
  assert.equal(C.coordenada(999999999, 'lat'), null);
});

test('resumenClientes: una fila por cliente real con oficinas, personas y arqueos', async () => {
  const r = await C.resumenClientes();
  assert.match(r.mes, /^\d{4}-\d{2}$/);
  assert.equal(r.meses.length, 6);
  const nombres = r.clientes.map((c) => c.cliente);
  ['MULTIVAL', 'BBVA', 'BANCO AGRARIO', 'FINCOMERCIO', 'ITAU'].forEach((n) => assert.ok(nombres.includes(n), n));
  ['SUPERNUMERARIO', 'ADMIN'].forEach((n) => assert.ok(!nombres.includes(n), n));
  const bbva = r.clientes.find((c) => c.cliente === 'BBVA');
  assert.ok(bbva.oficinas > 0 && bbva.personas > 0);
  assert.ok(bbva.backups <= bbva.personas);
  assert.equal(bbva.serie.length, 6);
  assert.ok(r.puntos.length > 100 && r.puntos.every((p) => p.lat > -5 && p.lat < 14 && p.lon > -83 && p.lon < -66));
  assert.ok(r.red.porvenir.puntos > 0 && r.red.proteccion.puntos > 0);
  assert.ok(r.departamentos.length > 10);
});

test('cliente360 coincide con obtenerDashboardClientes de Control de Arqueos', async () => {
  const d = await C.cliente360('BBVA', 'bbva');
  const dash = await ARQ.obtenerDashboardClientes('', 'Analista', d.mes, 'BBVA');
  assert.equal(dash.success, true);
  assert.equal(d.arqueos.totalesMes.oficinas, dash.totales.oficinas);
  assert.equal(d.arqueos.totalesMes.cumplen, dash.totales.cumplen);
  assert.equal(d.arqueos.totalesMes.pctCumplimiento, dash.totales.pctCumplimiento);
  assert.equal(d.arqueos.pendientes.length, dash.totales.oficinas - dash.totales.cumplen);
  assert.equal(d.kpis.pctMes, dash.totales.pctCumplimiento);
  assert.equal(d.oficinas.length, d.kpis.oficinas);
  assert.ok(d.oficinas.every((o) => o.cliente === 'BBVA'));
  assert.ok(d.arqueos.listaMes.every((a) => typeof a.oficina === 'string'));
  assert.equal(d.personal.total, d.kpis.personas);
  assert.ok(d.distribucion.regional.reduce((s, x) => s + x.n, 0) === d.oficinas.length);
  assert.ok(d.ans.length > 0 && d.ans.every((a) => a.cliente === 'BBVA'));
});

test('cliente sin red propia (fondo de pensiones) devuelve la red habilitada sin fallar', async () => {
  const d = await C.cliente360(null, 'porvenir');
  assert.equal(d.tieneRed, false);
  assert.equal(d.kpis, null);
  assert.deepEqual(d.oficinas, []);
  assert.ok(d.red.puntos > 0 && d.red.oficinas.length === d.red.puntos);
  const x = await C.cliente360('NO EXISTE');
  assert.equal(x.tieneRed, false);
  assert.equal(x.oficinas.length, 0);
});

test('la caché devuelve el mismo resultado dentro del minuto', async () => {
  const a = await C.cliente360('ITAU', 'itau');
  const b = await C.cliente360('ITAU', 'itau');
  assert.equal(a, b);
  C._limpiarCache();
  const c = await C.cliente360('ITAU', 'itau');
  assert.notEqual(a, c);
  assert.equal(c.kpis.oficinas, a.kpis.oficinas);
});
