// Módulos de COI V1: Granja de Usuarios (novedades y backups), PQR e Inicio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'coi-v1-mod-'));
const { SpreadsheetApp, resetDriver } = await import('../src/coiv1/spreadsheet.js');
const { ID_EXCEL_PRINCIPAL, ID_EXCEL_DIRECTORIO } = await import('../src/coiv1/books.js');
const { DriveFiles, readOutbox } = await import('../src/coiv1/gas.js');
const G = await import('../src/coiv1/modules/granja.js');
const P = await import('../src/coiv1/modules/pqr.js');
const I = await import('../src/coiv1/modules/inicio.js');

const novedades = () => SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL).getSheetByName('Novedades');
async function flagBackup(nombre) {
  const d = await SpreadsheetApp.openById(ID_EXCEL_DIRECTORIO).getSheetByName('DATOS MANUALES').getDataRange().getValues();
  const iN = d[0].findIndex((c) => String(c).toUpperCase().includes('NOMBRE')), iB = d[0].findIndex((c) => String(c).toUpperCase().includes('BACKUP'));
  const f = d.find((r) => String(r[iN]).trim().toUpperCase() === nombre.toUpperCase());
  return f ? String(f[iB]).trim().toUpperCase() : null;
}
async function filaNovedad(id) { return (await novedades().getDataRange().getValues()).find((r) => r[0] === id); }

let backupNombre = null;
let idNov = null;

test('directorio y lista de cajeros filtran por la columna G (como V1)', async () => {
  const dir = await G.obtenerDirectorioUsuarios();
  const lista = await G.obtenerListaCajeros();
  assert.ok(Array.isArray(dir) && dir.length > 1000);
  assert.equal(dir.length, lista.length);
  assert.ok(dir.every((f) => f[6] !== '' && f[6] !== undefined));
});

test('obtenerCajerosBackup solo devuelve personas con BACKUP SI/NO = SI', async () => {
  const b = await G.obtenerCajerosBackup();
  assert.ok(b.length > 100);
  assert.ok(b.every((f) => String(f[34]).trim().toUpperCase() === 'SI' && String(f[9]).trim()));
  backupNombre = String(b[0][9]).trim();
  assert.equal(await flagBackup(backupNombre), 'SI');
});

test('registrarNovedad → pendiente visible para su creador y para ADMIN, no para otros', async () => {
  const lista = await G.obtenerListaCajeros();
  const caj = lista.find((f) => String(f[9]).trim() && String(f[9]).trim() !== backupNombre);
  const r = await G.registrarNovedad({ cajeroNombre: caj[9], oficina: caj[1], descripcion: 'Motivos de salud', fechaInicio: '2026-10-14', diasAusencia: '3', reportadoPor: 'LBULLA' });
  assert.equal(r.success, true);
  assert.match(r.msg, /Novedad registrada/);
  idNov = r.id;
  const fila = await filaNovedad(idNov);
  assert.equal(fila[9], 'PENDIENTE');
  assert.ok(fila[10] instanceof Date && fila[10].getDate() === 14);
  assert.equal(fila[11], 3);

  const propias = await G.obtenerNovedadesPendientes('lbulla', 'Usuario');
  assert.ok(propias.some((n) => n.id === idNov && n.cajero === caj[9] && n.estado === 'PENDIENTE'));
  const otro = await G.obtenerNovedadesPendientes('TMONTOYA', 'Visualizador');
  assert.ok(!otro.some((n) => n.id === idNov));
  const admin = await G.obtenerNovedadesPendientes('JMORENO', 'ADMIN');
  assert.ok(admin.some((n) => n.id === idNov));
  assert.ok(admin.length > propias.length);
});

test('asignarBackup deja la novedad CUBIERTA y el backup en NO (DATOS MANUALES)', async () => {
  const r = await G.asignarBackup(idNov, backupNombre, 'JMORENO');
  assert.equal(r.success, true);
  const fila = await filaNovedad(idNov);
  assert.equal(fila[6], backupNombre);
  assert.equal(fila[9], 'CUBIERTA');
  assert.equal(await flagBackup(backupNombre), 'NO');
  // Ya no aparece como backup disponible (GRANJA refleja DATOS MANUALES).
  const b = await G.obtenerCajerosBackup();
  assert.ok(!b.some((f) => String(f[9]).trim().toUpperCase() === backupNombre.toUpperCase()));
  const pend = await G.obtenerNovedadesPendientes('JMORENO', 'ADMIN');
  assert.ok(!pend.some((n) => n.id === idNov));
  assert.equal((await G.asignarBackup('NOV-NO-EXISTE', backupNombre, 'X')).success, false);
});

test('procesarAccionNovedad EXTENDER suma días y CERRAR libera el backup', async () => {
  const e = await G.procesarAccionNovedad({ id: idNov, accion: 'EXTENDER', dias: 2 });
  assert.equal(e.success, true);
  assert.equal((await filaNovedad(idNov))[11], 5);
  let h = await G.obtenerHistorialCompletoBackend('LBULLA', 'Usuario');
  const item = h.find((x) => x.id === idNov);
  assert.equal(item.estado, 'CUBIERTA');
  assert.equal(item.diasAusencia, '5');
  assert.equal(item.backup, backupNombre);
  assert.equal(item.fechaInicio, '14/10/2026 00:00');

  const c = await G.procesarAccionNovedad({ id: idNov, accion: 'CERRAR', adminNombre: 'JMORENO' });
  assert.equal(c.success, true);
  const fila = await filaNovedad(idNov);
  assert.equal(fila[9], 'RESUELTA');
  assert.equal(fila[8], 'JMORENO');
  assert.ok(fila[7] instanceof Date);
  assert.equal(await flagBackup(backupNombre), 'SI');
  assert.equal((await G.procesarAccionNovedad({ id: idNov, accion: 'OTRA' })).success, false);

  h = await G.obtenerHistorialCompletoBackend('LBULLA', 'Usuario');
  assert.ok(h.every((x) => x.estado !== 'PENDIENTE'));
  assert.equal(h.find((x) => x.id === idNov).estado, 'RESUELTA');
  // Usuario normal: solo sus novedades; ADMIN: todas.
  assert.ok(h.every((x) => x.reportadoPor.toUpperCase() === 'LBULLA'));
  const ha = await G.obtenerHistorialCompletoBackend('JMORENO', 'ADMIN');
  assert.ok(ha.length > h.length);
  assert.ok((await G.obtenerHistorialNovedades()).some((r) => r[0] === idNov));
});

test('cerrarNovedadesAutomaticamente cierra coberturas vencidas como SISTEMA AUTOMÁTICO', async () => {
  const lista = await G.obtenerListaCajeros();
  const caj = lista[5];
  const vencida = await G.registrarNovedad({ cajeroNombre: caj[9], oficina: caj[1], descripcion: 'Motivos familiares o personales', fechaInicio: '2026-01-02', diasAusencia: 2, reportadoPor: 'JMORENO' });
  // V1 genera el ID con la hora en milisegundos (NOV-<ms>): se espera para que no coincidan.
  await new Promise((r) => setTimeout(r, 5));
  const vigente = await G.registrarNovedad({ cajeroNombre: caj[9], oficina: caj[1], descripcion: 'Motivos de salud', fechaInicio: '2099-01-02', diasAusencia: 2, reportadoPor: 'JMORENO' });
  await G.asignarBackup(vencida.id, backupNombre, 'JMORENO');
  const otroBackup = String((await G.obtenerCajerosBackup())[0][9]).trim();
  await G.asignarBackup(vigente.id, otroBackup, 'JMORENO');
  assert.equal(await flagBackup(backupNombre), 'NO');

  const r = await G.cerrarNovedadesAutomaticamente();
  assert.equal(r.success, true);
  assert.equal(r.msg, '1 novedades cerradas automáticamente.');
  const f1 = await filaNovedad(vencida.id), f2 = await filaNovedad(vigente.id);
  assert.equal(f1[9], 'RESUELTA');
  assert.equal(f1[8], 'SISTEMA AUTOMÁTICO');
  assert.equal(f2[9], 'CUBIERTA');
  assert.equal(await flagBackup(backupNombre), 'SI');
  assert.equal(await flagBackup(otroBackup), 'NO');
  // Limpia: cierra la vigente.
  await G.procesarAccionNovedad({ id: vigente.id, accion: 'CERRAR', adminNombre: 'JMORENO' });
  assert.equal(await flagBackup(otroBackup), 'SI');
});

test('cambiarEstadoNovedad y procesarAsignacionBackup (variantes V1)', async () => {
  const caj = (await G.obtenerListaCajeros())[9];
  const r = await G.registrarNovedad({ cajeroNombre: caj[9], oficina: caj[1], descripcion: 'x', fechaInicio: '2026-10-16', diasAusencia: 1, reportadoPor: 'JMORENO' });
  assert.equal((await G.cambiarEstadoNovedad(r.id, ' extendida ')).success, true);
  assert.equal((await filaNovedad(r.id))[9], 'EXTENDIDA');
  const a = await G.procesarAsignacionBackup({ novedadId: r.id, backupNombre: 'B', adminNombre: 'A', cajeroEnBaja: caj[9], oficinaBaja: caj[1] });
  assert.equal(a.success, true);
  assert.match(a.msg, /B cubrirá a/);
  assert.equal((await filaNovedad(r.id))[9], 'RESUELTA');
});

const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex').toString('base64');

test('guardarPQR crea la hoja PQR, guarda adjunto y constancia; obtenerHistorialPQR filtra por usuario', async () => {
  assert.deepEqual(await P.obtenerHistorialPQR('JMORENO', 'ADMIN'), []);
  const malo = await P.guardarPQR({ codigoPTR: '725', fecha: '2026-10-16T09:30', tipificacion: 'Queja', descripcion: '' });
  assert.equal(malo.success, false);
  const tipo = await P.guardarPQR({ codigoPTR: '725', fecha: '2026-10-16T09:30', tipificacion: 'Otra', descripcion: 'x' });
  assert.equal(tipo.success, false);
  const falso = await P.guardarPQR({ codigoPTR: '725', fecha: '2026-10-16T09:30', tipificacion: 'Queja', descripcion: 'x', adjunto: { name: 'a.png', mimeType: 'image/png', data: Buffer.from('<html>').toString('base64') } });
  assert.equal(falso.success, false);

  const r = await P.guardarPQR({ codigoPTR: '725', oficina: 'RM - CADE YOMASA', fecha: '2026-10-16T09:30', tipificacion: 'Queja', descripcion: 'Cliente <b>molesto</b> por la fila.', adjunto: { name: 'soporte.png', mimeType: 'image/png', data: 'data:image/png;base64,' + PNG }, usuario: 'LBULLA', rol: 'Usuario' });
  assert.equal(r.success, true, r.msg);
  assert.match(r.id, /^PQR-\d+$/);
  assert.match(r.urlConfirmacion, /^\/api\/coiv1\/files\/[a-f0-9]{24}$/);
  assert.ok(r.urlAdjunto);
  const doc = DriveFiles.get(r.urlConfirmacion.split('/').pop());
  assert.equal(doc.mimeType, 'text/html');
  assert.ok(doc.buffer.toString().includes(r.id));
  assert.ok(doc.buffer.toString().includes('&lt;b&gt;molesto&lt;/b&gt;'));
  assert.equal(DriveFiles.get(r.urlAdjunto.split('/').pop()).mimeType, 'image/png');

  const r2 = await P.guardarPQR({ codigoPTR: '9026', fecha: '2026-10-15T14:00', tipificacion: 'Felicitación', descripcion: 'Excelente atención', usuario: 'JMORENO', rol: 'ADMIN' });
  assert.equal(r2.success, true);
  assert.equal(r2.urlAdjunto, '');

  const hoja = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL).getSheetByName('PQR');
  const datos = await hoja.getDataRange().getValues();
  assert.deepEqual(datos[0], P.PQR_ENCABEZADOS);
  assert.equal(datos.length, 3);

  const propio = await P.obtenerHistorialPQR('lbulla', 'Usuario');
  assert.equal(propio.length, 1);
  assert.equal(propio[0].tipificacion, 'Queja');
  assert.equal(propio[0].fechaEvento, '16/10/2026 09:30');
  const todos = await P.obtenerHistorialPQR('JMORENO', 'ADMIN');
  assert.equal(todos.length, 2);
  assert.equal(todos[0].id, r2.id); // más reciente primero
  // Constancia enviada al correo del ADMIN (JMORENO tiene correo; LBULLA no).
  assert.ok(readOutbox().some((m) => m.subject.includes(r2.id)));

  // La hoja creada con insertSheet sobrevive a un reinicio del driver.
  resetDriver();
  assert.equal((await P.obtenerHistorialPQR('JMORENO', 'ADMIN')).length, 2); // la hoja se recupera del disco
  const r3 = await P.guardarPQR({ codigoPTR: '1', fecha: '2026-10-16T10:00', tipificacion: 'Petición', descripcion: 'y', usuario: 'JMORENO', rol: 'ADMIN' });
  assert.equal(r3.success, true);
  assert.equal((await P.obtenerHistorialPQR('JMORENO', 'ADMIN')).length, 3); // y sigue recibiendo radicaciones
});

test('resumenInicioV1 entrega los contadores del inicio', async () => {
  const r = await I.resumenInicioV1();
  assert.ok(r.novedades.pendientes > 0 && r.novedades.resueltas > 0);
  assert.equal(r.novedades.total, r.novedades.pendientes + r.novedades.cubiertas + r.novedades.resueltas);
  assert.ok(r.granja.personas > 1000 && r.granja.backupsDisponibles > 100);
  assert.ok(r.arqueos.registrados > 1000);
  assert.equal(r.pqr.radicadas, 3);
  assert.ok(r.usuarios.activos <= r.usuarios.total);
});
