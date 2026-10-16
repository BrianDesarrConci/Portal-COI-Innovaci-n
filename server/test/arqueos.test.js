// Pruebas del port de Control de Arqueos (Código.gs v6.1) sobre la copia real de los Sheets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'coi-arqueos-'));
const { functions: F, _internos } = await import('../src/coiv1/arqueos/controlArqueos.js');
const { SpreadsheetApp } = await import('../src/coiv1/spreadsheet.js');
const { DriveFiles, readOutbox } = await import('../src/coiv1/gas.js');
const { ID_EXCEL_PRINCIPAL } = await import('../src/coiv1/books.js');

const LIDER = 'ADRIANA RIOS';        // llave_arqueos = Lider (22 oficinas en el Directorio)
const ANALISTA = 'JULLY ANDREA';     // llave_arqueos = Analista
const MES = '2026-10';
const ss = () => SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
const idDeUrl = (u) => String(u).split('/').pop();
const PDF_B64 = Buffer.from('%PDF-1.4\n% tirilla de prueba\n%%EOF').toString('base64');
const PNG_B64 = 'data:image/png;base64,' + Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]).toString('base64');

test('validarEmbebido: lider por llave, sin contraseñas en la respuesta', async () => {
  const u = await F.validarEmbebido(LIDER, 'Lider');
  assert.equal(u.success, true);
  assert.equal(u.rol, 'Lider');
  assert.equal(u.idUsuario, LIDER);
  assert.equal(u.nombre, 'LUZ ADRIANA RIOS PARRA');
  assert.deepEqual(Object.keys(u).sort(), ['correo', 'idRegional', 'idUsuario', 'nombre', 'rol', 'success']);
  assert.equal((await F.validarEmbebido(ANALISTA, 'Analista')).rol, 'Analista');
  assert.equal((await F.validarEmbebido(LIDER, 'Analista')).success, false);
  assert.match((await F.validarEmbebido('YAZMIN RUEDA', 'Lider')).message, /inactivo/);
});

test('validarLogin rechaza contraseñas vacías', async () => {
  assert.equal((await F.validarLogin(LIDER, '')).success, false);
  assert.equal((await F.validarLogin(LIDER, 'cualquiera')).success, false);
});

test('helpers del Directorio: ATM, medio de pago y cruce de líderes', async () => {
  const { atmCodigos_, requisitosDeOficina_, coincideLider_, inferirCliente_ } = _internos;
  assert.deepEqual(atmCodigos_('3596'), ['3596']);
  assert.deepEqual(atmCodigos_('3596, 3597 / 3597'), ['3596', '3597']);
  assert.deepEqual(atmCodigos_('2 cajeros'), ['Cajero 1', 'Cajero 2']);
  assert.deepEqual(atmCodigos_('#N/A'), []);
  assert.deepEqual(atmCodigos_('No aplica'), []);
  const r = requisitosDeOficina_('EFECTIVO Y CHEQUE', 'Cajero');
  assert.equal(r.efectivo && r.cheques && r.atm, true);
  assert.equal(requisitosDeOficina_('#N/A', '').sinParametrizar, true);
  const perfil = { id: 'ADRIANA RIOS', claves: ['ADRIANA RIOS', 'LUZ ADRIANA RIOS PARRA'], tokens: [['ADRIANA', 'RIOS'], ['LUZ', 'ADRIANA', 'RIOS', 'PARRA']] };
  assert.equal(coincideLider_('Ríos Adriana', perfil), true);
  assert.equal(coincideLider_('ANGELA BULLA', perfil), false);
  assert.equal(inferirCliente_('BANCO BOGOTA RIOSUCIO'), 'BANCO BOGOTA');
});

test('getContextoArqueo devuelve las oficinas del líder desde el Directorio Nacional', async () => {
  const ctx = await F.getContextoArqueo(LIDER, 'Lider');
  assert.equal(ctx.success, true);
  assert.equal(ctx.nombreLider, 'LUZ ADRIANA RIOS PARRA');
  assert.equal(ctx.oficinas.length, 22);
  assert.match(ctx.hoy, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(ctx.formatos, { EFECTIVO: 'FOR-GOR-020-09', CHEQUES: 'FOR-GOR-048-01', ATM: 'FOR-GOR-099-02' });
  const barbosa = ctx.oficinas.find((o) => o.oficina === 'MP - BARBOSA');
  assert.deepEqual(barbosa.requiere.codigosATM, ['2883']);
  assert.equal(barbosa.tieneATM, true);
  assert.equal(barbosa.regional, 'ANTIOQUIA Y SABANA');
  const pb = ctx.oficinas.find((o) => o.oficina === 'MP - PUERTO BOYACA');
  assert.equal(pb.requiere.efectivo && pb.requiere.cheques, true);
  // Un analista ve toda la red
  const red = await F.listarOficinasLider(ANALISTA, 'Analista');
  assert.ok(red.oficinas.length > 600);
});

test('obtenerHistorial / meses / tendencias con datos reales', async () => {
  const hist = await F.obtenerHistorial(LIDER, 'Lider', MES);
  assert.ok(Array.isArray(hist) && hist.length > 0);
  assert.ok(hist.every((h) => h.lider === LIDER));
  for (const k of ['id', 'fechaReal', 'oficina', 'formato', 'cuentaMeta', 'tipoVisita', 'pendienteLider', 'pendienteAnalista', 'gestionOK', 'estadoNorm']) assert.ok(k in hist[0], k);
  const todos = await F.obtenerHistorial(ANALISTA, 'Analista', 'TODOS');
  assert.ok(todos.length > 900);
  // Los históricos AQ-HIST traen montos vacíos: la diferencia queda 'Pendiente N8N'
  const h = todos.find((x) => String(x.id).startsWith('AQ-HIST'));
  assert.equal(h.diferencia, 'Pendiente N8N');
  const meses = await F.obtenerMesesDisponibles(ANALISTA, 'Analista');
  assert.ok(meses.includes('2026-10') && meses.includes('2026-09'));
  const t = await F.obtenerTendencias(ANALISTA, 'Analista', '2026');
  assert.equal(t.anio, '2026');
  assert.equal(t.meses.length, 12);
  assert.ok(t.meses[9].total > 0);
  assert.ok(Array.isArray(t.oficinas) && t.anios.includes('2026'));
});

test('obtenerDashboard: semáforo, hábiles y serie diaria', async () => {
  const d = await F.obtenerDashboard(ANALISTA, 'Analista', MES);
  assert.equal(d.mes, MES);
  assert.equal(d.meta, 30);
  assert.equal(d.habiles.total, 22);
  assert.equal(d.serie.length, 31);
  assert.ok(d.global.totalArqueos > 400);
  assert.ok(d.lideres.length >= 30);
  assert.ok(d.lideres.every((l) => ['verde', 'amarillo', 'rojo'].includes(l.semaforo)));
  const dl = await F.obtenerDashboard(LIDER, 'Lider', MES);
  assert.equal(dl.lideres.length, 1);
  assert.equal(dl.lideres[0].oficinas, 22);
});

test('obtenerDashboardClientes / obtenerResumenRegional / obtenerAnalitica', async () => {
  const c = await F.obtenerDashboardClientes(ANALISTA, 'Analista', MES, '');
  assert.equal(c.success, true);
  assert.ok(c.oficinas.length > 600 && c.clientes.length > 5);
  assert.ok(c.catalogo.regionales.includes('ANTIOQUIA Y SABANA'));
  assert.ok(c.totales.conArqueo > 0);
  const filtro = await F.obtenerDashboardClientes(ANALISTA, 'Analista', MES, 'BANCO AGRARIO');
  assert.ok(filtro.oficinas.every((o) => o.cliente === 'BANCO AGRARIO'));
  const r = await F.obtenerResumenRegional(ANALISTA, 'Analista', MES);
  assert.equal(r.success, true);
  assert.ok(r.zonas.length > 0 && r.regionales.length > 0);
  assert.equal(r.total.oficinas, c.oficinas.length);
  const a = await F.obtenerAnalitica(ANALISTA, 'Analista', MES);
  assert.equal(a.success, true);
  assert.deepEqual(Object.keys(a.graficos).sort(), ['atmArqueo', 'cumplimientoRegional', 'faltantesLider', 'faltantesMenores', 'faltantesRegional',
    'oficinasNovedad', 'recuperadoMayores', 'recuperadoMenores', 'sobrantesMayores', 'sobrantesRegional']);
  for (const g of Object.values(a.graficos)) { assert.ok(g.interpretacion.length > 20); assert.ok(g.tabla.filas.length > 0); }
});

test('calcularDiasHabiles descuenta fines de semana y festivos', async () => {
  assert.equal(await F.calcularDiasHabiles('2026-08-06', '2026-08-11'), 2);  // 7 de agosto festivo
  assert.equal(await F.calcularDiasHabiles('2026-07-17', '2026-07-21'), 1);  // 20 de julio festivo
  assert.equal(await F.calcularDiasHabiles('13/10/2026', '2026-10-16'), 3);
  assert.equal(await F.calcularDiasHabiles('2026-10-16', '2026-10-13'), 0);
});

let arqEF = null;
test('procesarArqueoIntegral: efectivo con faltante escribe Arqueos + Sesiones y genera el soporte', async () => {
  const ctx = await F.getContextoArqueo(LIDER, 'Lider');
  const oficina = 'MP - BCOL INDEGA MEDELLIN';
  const filasAntes = await ss().getSheetByName('Arqueos').getLastRow();
  const sesAntes = await ss().getSheetByName('Sesiones_Arqueo').getLastRow();
  const base = { idUsuario: LIDER, rol: 'Lider', nombreLider: ctx.nombreLider, oficina, fechaArqueo: ctx.hoy, hora: '09:30', modalidad: 'Presencial' };

  assert.match((await F.procesarArqueoIntegral({ ...base, modalidad: '' })).message, /PRESENCIAL o VIRTUAL/);
  assert.match((await F.procesarArqueoIntegral({ ...base, fechaArqueo: '2099-01-01' })).message, /no puede ser futura/);
  assert.match((await F.procesarArqueoIntegral({ ...base, oficina: 'MP - KENNEDY' })).message, /no esta asignada/);

  const res = await F.procesarArqueoIntegral({ ...base,
    efectivo: { elemento: 'Bóveda', tipoArqueo: 'Arqueo de Control', montoBilletes: 900000, montoMonedas: 50000, montoTeorico: 1000000,
      observaciones: 'Faltante de prueba', practico: { nombre: 'Luz Adriana', cargo: 'Líder', firmado: true } } });
  assert.equal(res.success, true, res.message);
  assert.equal(res.extemporaneo, 'NO');
  assert.equal(res.resultados.length, 1);
  const r0 = res.resultados[0];
  assert.equal(r0.formato, 'FOR-GOR-020-09');
  assert.equal(r0.novedad, 'FALTANTE');
  assert.equal(r0.diferencia, -50000);
  assert.equal(res.sumanMeta, 1);
  arqEF = r0.idArqueo;

  // El soporte HTML imprimible queda guardado y su URL resuelve
  const f = DriveFiles.get(idDeUrl(r0.url));
  assert.ok(f, 'archivo del soporte');
  assert.equal(f.mimeType, 'text/html');
  assert.match(f.name, /^FOR-GOR-020-09_MP_BCOL_INDEGA_MEDELLIN_\d{8}_AQ-\d+-EF\.html$/);
  assert.match(f.folder, /^Arqueos_Multival\/\d{4}-\d{2}\/MP - BCOL INDEGA MEDELLIN$/);
  const html = f.buffer.toString('utf8');
  assert.match(html, /REPORTE DE ARQUEO, FALTANTES Y\/O SOBRANTES/);
  assert.match(html, /window\.print\(\)/);
  assert.match(html, /@media print/);

  // Filas escritas
  const arq = await ss().getSheetByName('Arqueos').getDataRange().getValues();
  assert.equal(arq.length, filasAntes + 1);
  const fila = arq[arq.length - 1];
  assert.equal(fila[0], arqEF);
  assert.equal(fila[13], -50000);
  assert.equal(fila[14], 'FALTANTE');
  assert.equal(fila[20], r0.url);
  assert.equal(JSON.parse(fila[16]).totalFisico, 950000);
  const ses = await ss().getSheetByName('Sesiones_Arqueo').getDataRange().getValues();
  assert.equal(ses.length, sesAntes + 1);
  assert.equal(ses[ses.length - 1][0], res.idSesion);
  assert.equal(ses[ses.length - 1][9], arqEF);

  // La caché por versión se invalida: el historial ya lo muestra
  const hist = await F.obtenerHistorial(LIDER, 'Lider', MES);
  assert.equal(hist[0].id, arqEF);
  assert.equal(hist[0].cuentaMeta, true);
  const vis = await F.verificarVisitaMes(LIDER, 'Lider', oficina, ctx.hoy);
  assert.equal(vis.esAdicional, true);
});

test('procesarArqueoIntegral: ATM exige tirillas PDF y las guarda', async () => {
  const ctx = await F.getContextoArqueo(LIDER, 'Lider');
  const base = { idUsuario: LIDER, rol: 'Lider', oficina: 'MP - BARBOSA', fechaArqueo: ctx.hoy, hora: '11:00', modalidad: 'VIRTUAL' };
  const atm = { cajeroNo: '2883', tipoArqueo: 'Arqueo de Control',
    gavetasEfectivo: [{ denominacion: 50000, cantidad: 10 }], gavetaPurga: [{ denominacion: 20000, cantidad: 1 }],
    gavetasDispensado: [{ denominacion: 50000, cantidad: 2 }], aprovisionamiento: [{ denominacion: 50000, cantidad: 12 }] };
  assert.match((await F.procesarArqueoIntegral({ ...base, atms: [{ ...atm, tirillas: [] }] })).message, /tirillas/);
  assert.match((await F.procesarArqueoIntegral({ ...base, atms: [{ ...atm, tirillas: [{ fileName: 'x.png', mimeType: 'image/png', base64: PDF_B64 }] }] })).message, /PDF/);
  const res = await F.procesarArqueoIntegral({ ...base, atms: [{ ...atm, tirillas: [{ fileName: 't.pdf', mimeType: 'application/pdf', base64: PDF_B64 }] }] });
  assert.equal(res.success, true, res.message);
  const r = res.resultados[0];
  assert.equal(r.formato, 'FOR-GOR-099-02');
  assert.equal(r.diferencia, 520000 - 500000);   // fisico (500k+20k) - cajero (600k-100k)
  assert.equal(r.novedad, 'SOBRANTE');
  const arq = await ss().getSheetByName('Arqueos').getDataRange().getValues();
  const fila = arq[arq.length - 1];
  const urlTir = fila[21];
  const tir = DriveFiles.get(idDeUrl(urlTir));
  assert.equal(tir.mimeType, 'application/pdf');
  assert.match(tir.name, /^TIRILLA_MP_-_BARBOSA_ATM2883_\d{8}_1\.pdf$/);
  assert.equal(tir.buffer.toString('utf8').slice(0, 8), '%PDF-1.4');
  assert.match(DriveFiles.get(idDeUrl(r.url)).buffer.toString('utf8'), /REPORTE DE ARQUEO CAJEROS AUTOMATICOS/);
});

test('procesarArqueo (carga manual) guarda el soporte con su mimeType', async () => {
  const ctx = await F.getContextoArqueo(LIDER, 'Lider');
  const res = await F.procesarArqueo({ idUsuario: LIDER, rol: 'Lider', oficina: 'MP - COPACABANA', fechaArqueo: ctx.hoy, modalidad: 'presencial',
    elemento: 'Bóveda', fileName: 'soporte.pdf', mimeType: 'application/pdf', base64: PDF_B64 });
  assert.equal(res.success, true, res.message);
  const a = await F.obtenerArqueo(res.idArqueo, LIDER, 'Lider');
  assert.equal(a.novedad, 'PENDIENTE');
  assert.equal(a.diferencia, 'Pendiente N8N');
  const f = DriveFiles.get(idDeUrl(a.url));
  assert.equal(f.mimeType, 'application/pdf');
  assert.match(f.folder, /Carga_Manual$/);
});

test('gestión de novedades: SOLICITAR_EXPLICACION → responderNovedad → OK', async () => {
  assert.ok(arqEF);
  assert.match((await F.gestionarArqueo(arqEF, 'SOLICITAR_EXPLICACION', { texto: 'x' }, LIDER, 'Lider')).message, /permisos/);
  const g1 = await F.gestionarArqueo(arqEF, 'SOLICITAR_EXPLICACION', { texto: 'Explique el faltante' }, ANALISTA, 'Analista');
  assert.equal(g1.success, true, g1.message);
  assert.equal(g1.estadoDiferencia, 'PENDIENTE EXPLICACION');

  const pl = await F.obtenerPendientes(LIDER, 'Lider');
  const item = pl.items.find((i) => i.id === arqEF);
  assert.deepEqual(item.tipos, ['EXPLICACION']);
  assert.equal(item.quien, 'LIDER');

  assert.match((await F.responderNovedad(arqEF, { explicacion: 'Error de conteo' }, LIDER, 'Lider')).message, /tipología/);
  assert.match((await F.responderNovedad(arqEF, { explicacion: 'x', tipologia: 'Error de conteo' }, 'OTRO', 'Lider')).message, /no pertenece/);
  const rn = await F.responderNovedad(arqEF, { explicacion: 'Se recontó y apareció el billete', tipologia: 'Error de conteo', estadoDiferencia: 'RECUPERADO' }, LIDER, 'Lider');
  assert.equal(rn.success, true, rn.message);
  assert.equal(rn.estadoDiferencia, 'RECUPERADO');

  const pa = await F.obtenerPendientes(ANALISTA, 'Analista');
  assert.deepEqual(pa.items.find((i) => i.id === arqEF).tipos, ['CONFIRMAR OK']);
  assert.ok(pa.pendientesAnalista >= 1);

  const ok = await F.gestionarArqueo(arqEF, 'OK', { texto: 'Subsanado' }, ANALISTA, 'Analista');
  assert.equal(ok.success, true);
  const a = await F.obtenerArqueo(arqEF, ANALISTA, 'Analista');
  assert.equal(a.gestionOK, true);
  assert.equal(a.pendienteAnalista, false);
  assert.deepEqual(a.pendienteLider, []);
  assert.equal(a.tipologia, 'Error de conteo');
  assert.equal(a.explicacionSolicitada, true);

  const bit = await F.obtenerBitacoraArqueo(arqEF);
  assert.deepEqual(bit.map((b) => b.accion), ['SOLICITAR_EXPLICACION', 'RESPUESTA_LIDER', 'OK']);
  assert.equal(bit[0].actor, 'JULLY ANDREA RIOS ARANGO');
});

test('NOVEDAD_SOPORTE notifica por correo (bandeja de salida) y el líder recarga el soporte', async () => {
  // HDIMATE es el único líder con correo en la copia de demostración.
  const hist = await F.obtenerHistorial(ANALISTA, 'Analista', 'TODOS');
  const arq = hist.find((h) => h.lider === 'HDIMATE');
  assert.ok(arq);
  const g = await F.gestionarArqueo(arq.id, 'NOVEDAD_SOPORTE', { texto: 'El soporte está ilegible' }, ANALISTA, 'Analista');
  assert.equal(g.success, true);
  assert.equal(g.notificado, true);
  const mail = readOutbox()[0];
  assert.equal(mail.to, 'hernan.dimate@reval.com.co');
  assert.match(mail.subject, /Novedad en soporte/);
  assert.match(mail.htmlBody, /El soporte está ilegible/);
  assert.match((await F.responderNovedad(arq.id, {}, 'HDIMATE', 'Lider')).message, /Describe la corrección/);
  const r = await F.responderNovedad(arq.id, { respuesta: 'Adjunto soporte legible', archivo: { fileName: 'foto.png', mimeType: 'image/png', base64: PNG_B64 } }, 'HDIMATE', 'Lider');
  assert.equal(r.success, true, r.message);
  assert.equal(r.estadoRevision, 'CORREGIDO');
  const a = await F.obtenerArqueo(arq.id, 'HDIMATE', 'Lider');
  assert.equal(a.respuestaLider, 'Adjunto soporte legible');
  const f = DriveFiles.get(idDeUrl(a.urlCorreccion));
  assert.equal(f.mimeType, 'image/png');
  assert.match(f.folder, /Correcciones$/);
  const rec = await F.enviarRecordatoriosPendientes();
  assert.equal(typeof rec, 'string');
});

test('solicitarNormalizacion + decidirNormalizacion convierten el extemporáneo en NORMALIZADO', async () => {
  const hist = await F.obtenerHistorial(ANALISTA, 'Analista', 'TODOS');
  const ext = hist.find((h) => h.extemporaneo === 'SÍ' && h.formato === 'FOR-GOR-020-09' && !h.estadoNorm);
  assert.ok(ext, 'hay extemporáneos en la copia');
  assert.equal(ext.cuentaMeta, true);
  assert.equal((await F.solicitarNormalizacion(ext.id, ext.lider, '  ')).success, false);
  const s = await F.solicitarNormalizacion(ext.id, ext.lider, 'Sin conectividad en la oficina');
  assert.equal(s.success, true);
  assert.match((await F.solicitarNormalizacion(ext.id, ext.lider, 'otra')).message, /pendiente/);
  const lista = await F.listarNormalizaciones(ANALISTA, 'Analista');
  const sol = lista.find((n) => n.idArqueo === ext.id);
  assert.equal(sol.estado, 'PENDIENTE');
  assert.equal(sol.oficina, ext.oficina);
  assert.match((await F.decidirNormalizacion(sol.idSolicitud, 'APROBAR', '', ext.lider, 'Lider')).message, /permisos/);
  const d = await F.decidirNormalizacion(sol.idSolicitud, 'APROBAR', 'Aprobado', ANALISTA, 'Analista');
  assert.equal(d.success, true);
  assert.match((await F.decidirNormalizacion(sol.idSolicitud, 'APROBAR', '', ANALISTA, 'Analista')).message, /ya fue decidida/);
  const a = await F.obtenerArqueo(ext.id, ANALISTA, 'Analista');
  assert.equal(a.extemporaneo, 'NORMALIZADO');
  assert.equal(a.estadoNorm, 'APROBADA');
  const sol2 = (await F.listarNormalizaciones(ANALISTA, 'Analista')).find((n) => n.idSolicitud === sol.idSolicitud);
  assert.equal(sol2.aprobador, 'JULLY ANDREA RIOS ARANGO');
});

test('mantenimiento: limpiarCache y diagnosticoSistema', async () => {
  assert.match(await F.limpiarCache(), /Cache limpiada/);
  const diag = await F.diagnosticoSistema();
  assert.match(diag, /=== USUARIOS/);
  assert.match(diag, /=== ARQUEOS/);
});

test('RPC por Express: /api/coiv1/rpc/<funcion> y /api/coiv1/files/<id>', async () => {
  const { createApp } = await import('../src/app.js');
  const server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const rpc = async (fn, args) => (await fetch(base + '/api/coiv1/rpc/' + fn, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ args }) })).json();
  try {
    const login = await rpc('validarEmbebido', [LIDER, 'Lider']);
    assert.equal(login.ok, true);
    assert.equal(login.result.rol, 'Lider');
    const dash = await rpc('obtenerDashboard', [ANALISTA, 'Analista', MES]);
    assert.equal(dash.ok, true);
    assert.equal(dash.result.mes, MES);
    const cli = await rpc('obtenerDashboardClientes', [LIDER, 'Lider', MES, '']);
    assert.equal(cli.result.success, true);
    assert.equal(cli.result.oficinas.length, 22);
    const hist = await rpc('obtenerHistorial', [LIDER, 'Lider', MES]);
    const conPdf = hist.result.find((h) => String(h.urlPdf).startsWith('/api/coiv1/files/') && /-EF$/.test(h.id));
    assert.ok(conPdf);
    const f = await fetch(base + conPdf.urlPdf);
    assert.equal(f.status, 200);
    assert.match(f.headers.get('content-type'), /text\/html/);
    assert.match(await f.text(), /Imprimir \/ Guardar PDF/);
    const meta = await (await fetch(base + '/api/coiv1/meta')).json();
    assert.ok(meta.funciones.includes('procesarArqueoIntegral'));
  } finally {
    server.close();
  }
});
