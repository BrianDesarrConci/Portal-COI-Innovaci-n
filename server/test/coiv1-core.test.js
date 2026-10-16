import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'coi-v1-'));
const { SpreadsheetApp, resetDriver } = await import('../src/coiv1/spreadsheet.js');
const { Utilities, LockService } = await import('../src/coiv1/gas.js');
const { ID_EXCEL_PRINCIPAL, ID_EXCEL_DIRECTORIO } = await import('../src/coiv1/books.js');

test('lee la hoja Novedades con encabezados y fechas como Date', async () => {
  resetDriver();
  const hoja = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL).getSheetByName('Novedades');
  const datos = await hoja.getDataRange().getValues();
  assert.equal(datos[0][0], 'ID');
  assert.ok(datos.length > 1);
});

test('getSheetByName no distingue mayúsculas (PERMISOS / Permisos)', () => {
  const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
  assert.ok(ss.getSheetByName('Permisos'));
  assert.equal(ss.getSheetByName('No existe'), null);
});

test('appendRow y setValue persisten como en Apps Script', async () => {
  const hoja = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL).getSheetByName('Novedades');
  const antes = await hoja.getLastRow();
  await hoja.appendRow(['NOV-TEST', new Date(2026, 9, 16, 8, 30), 'X', 'OFI', 'd', 'r', '', '', '', 'PENDIENTE', '2026-10-16', 2]);
  assert.equal(await hoja.getLastRow(), antes + 1);
  await hoja.getRange(antes + 1, 10).setValue('RESUELTA');
  resetDriver(); // relee desde disco
  const fila = (await hoja.getDataRange().getValues())[antes];
  assert.equal(fila[9], 'RESUELTA');
  assert.ok(fila[1] instanceof Date);
  assert.equal(fila[1].getHours(), 8);
});

test('la copia de demostración no trae contraseñas', async () => {
  const u = await SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL).getSheetByName('Usuarios').getDataRange().getValues();
  assert.ok(u.slice(1).every((r) => String(r[1]).trim() === ''));
  const g = await SpreadsheetApp.openById(ID_EXCEL_DIRECTORIO).getSheetByName('GRANJA_DE_USUARIOS_JULLY').getDataRange().getValues();
  assert.ok(g.slice(1, 50).every((r) => !/^\d{6,}$/.test(String(r[8]))));
});

test('Utilities.formatDate con zona fija y patrones', () => {
  const d = new Date(2026, 0, 5, 7, 4, 9);
  assert.equal(Utilities.formatDate(d, 'America/Bogota', 'yyyy-MM-dd HH:mm:ss'), '2026-01-05 07:04:09');
  assert.equal(Utilities.formatDate(d, 'GMT-5', "dd/MM/yyyy 'a las' H:mm"), '05/01/2026 a las 7:04');
});

test('LockService serializa secciones críticas', async () => {
  const orden = [];
  const tarea = async (n, ms) => { const l = LockService.getScriptLock(); await l.waitLock(5000); orden.push('in' + n); await new Promise((r) => setTimeout(r, ms)); orden.push('out' + n); l.releaseLock(); };
  await Promise.all([tarea(1, 30), tarea(2, 1)]);
  assert.deepEqual(orden, ['in1', 'out1', 'in2', 'out2']);
});
