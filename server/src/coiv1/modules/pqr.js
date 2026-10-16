/**
 * COI V1 · Experiencia de Cliente — Radicación PQR (sección "reportes" de V1).
 *
 * En V1 el formulario existe (experiencia.html, iniciarModuloPQR en js.html) pero el servidor nunca
 * se escribió: registrarPQR, cargarHistorialPQR y filtrarHistorialPQR no existen y el botón
 * "RADICAR PQR Y GENERAR PDF" falla. Aquí se completa con la misma convención de V1:
 *   - hoja "PQR" en el libro COI V1, creada con insertSheet + encabezados si no existe;
 *   - radicado "PQR-<timestamp>" (como "NOV-<timestamp>" de Novedades);
 *   - adjunto (PNG, JPG o PDF, máx. 5 MB) y constancia de radicación guardados con DriveFiles;
 *   - visibilidad del historial igual a Novedades: ADMIN ve todo, los demás solo lo que radicaron.
 */
import { ID_EXCEL_PRINCIPAL } from '../books.js';
import { Utilities, Session, DriveFiles, MailApp } from '../gas.js';
import { SpreadsheetApp } from '../spreadsheet.js';
import { hojaConEncabezados, recuperarHoja, esc } from './_v1util.js';

export const PQR_ENCABEZADOS = ['ID', 'FechaRadicacion', 'CodigoPTR', 'Oficina', 'FechaHoraEvento', 'Tipificacion', 'Descripcion', 'Adjunto', 'UrlAdjunto', 'Confirmacion', 'UrlConfirmacion', 'RadicadoPor', 'Rol', 'Estado'];
export const TIPIFICACIONES = ['Petición', 'Queja', 'Reclamo', 'Sugerencia', 'Felicitación', 'Solicitud de información'];
const MAX_ADJUNTO = 5 * 1024 * 1024;
const TIPOS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf' };
const tz = () => Session.getScriptTimeZone();

/** Firma real del archivo (no basta con la extensión ni el tipo que declara el navegador). */
function tipoReal(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 4 && buf.slice(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return null;
}

function constanciaHTML(r) {
  const fila = (k, v) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Constancia ${esc(r.id)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: 'Noto Sans', 'Segoe UI', Arial, sans-serif; color: #1B2033; margin: 0; background: #F7F8FC; }
  .doc { max-width: 760px; margin: 24px auto; background: #fff; border: 1px solid #E3E6EF; border-radius: 16px; overflow: hidden; }
  .head { background: linear-gradient(160deg, #242A54, #1C2347); color: #fff; padding: 28px 32px; position: relative; }
  .head::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 4px; background: linear-gradient(90deg, #048C38, #21BBEA); }
  .k { font-size: 12px; letter-spacing: 1.4px; text-transform: uppercase; color: #A9B0D6; }
  h1 { font-family: Ubuntu, 'Segoe UI', Arial, sans-serif; margin: 6px 0 2px; font-size: 26px; }
  .rad { display: inline-block; margin-top: 14px; background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.2); border-radius: 999px; padding: 6px 14px; font-weight: 700; letter-spacing: .5px; }
  .rad b { color: #F6CF46; }
  .body { padding: 26px 32px 30px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; width: 34%; color: #646B80; font-weight: 600; font-size: 13px; padding: 10px 0; border-bottom: 1px solid #EEF0F6; vertical-align: top; }
  td { padding: 10px 0; border-bottom: 1px solid #EEF0F6; font-size: 14px; }
  .desc { white-space: pre-wrap; background: #F7F8FC; border: 1px solid #E3E6EF; border-radius: 10px; padding: 14px; margin-top: 18px; font-size: 14px; line-height: 1.55; }
  .tag { display: inline-block; background: #E4F3EA; color: #037030; border-radius: 999px; padding: 2px 10px; font-size: 12px; font-weight: 700; }
  .foot { margin-top: 22px; font-size: 12px; color: #646B80; display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .print { position: fixed; right: 18px; bottom: 18px; background: #048C38; color: #fff; border: 0; border-radius: 10px; padding: 10px 16px; font-weight: 700; cursor: pointer; box-shadow: 0 8px 20px -8px rgba(4,140,56,.6); }
  @media print { body { background: #fff; } .doc { margin: 0; border: 0; } .print { display: none; } }
</style></head><body>
<div class="doc">
  <div class="head"><div class="k">COI · Experiencia de Cliente</div><h1>Constancia de radicación PQR</h1>
  <div class="rad">Radicado <b>${esc(r.id)}</b></div></div>
  <div class="body">
    <table>
      ${fila('Fecha de radicación', esc(r.fechaRadicacion))}
      ${fila('Código PTR', esc(r.codigoPTR))}
      ${r.oficina ? fila('Oficina', esc(r.oficina)) : ''}
      ${fila('Fecha y hora del evento', esc(r.fechaEvento))}
      ${fila('Tipificación', `<span class="tag">${esc(r.tipificacion)}</span>`)}
      ${fila('Soporte adjunto', r.adjunto ? esc(r.adjunto) : 'Sin adjunto')}
      ${fila('Radicado por', esc(r.usuario) + (r.rol ? ' · ' + esc(r.rol) : ''))}
      ${fila('Estado', 'RADICADA')}
    </table>
    <div class="desc">${esc(r.descripcion)}</div>
    <div class="foot"><span>Documento generado automáticamente por COI. Conserve el número de radicado para su seguimiento.</span><span>Reval · Multipagas</span></div>
  </div>
</div>
<button class="print" onclick="window.print()">Imprimir o guardar en PDF</button>
</body></html>`;
}

/**
 * payload = { codigoPTR, oficina?, fecha ("yyyy-MM-ddTHH:mm"), tipificacion, descripcion,
 *             adjunto?: { name, mimeType, data (base64 o dataURL) }, usuario, rol }
 * → { success, msg, id, urlConfirmacion, urlAdjunto }
 */
// Serializa las radicaciones (equivale a LockService.getScriptLock en un solo proceso, sin dejar
// temporizadores vivos).
let cola = Promise.resolve();
export function guardarPQR(payload) {
  const turno = cola.then(() => radicar(payload));
  cola = turno.catch(() => {});
  return turno;
}

async function radicar(payload) {
  try {
    const p = payload || {};
    const codigo = String(p.codigoPTR || '').trim();
    const tipificacion = String(p.tipificacion || '').trim();
    const descripcion = String(p.descripcion || '').trim();
    const fechaTxt = String(p.fecha || '').trim();
    if (!codigo || !fechaTxt || !tipificacion || !descripcion) return { success: false, msg: '⚠️ Por favor completa todos los campos obligatorios.' };
    if (!TIPIFICACIONES.includes(tipificacion)) return { success: false, msg: '⚠️ Tipificación no válida.' };
    if (descripcion.length > 5000) return { success: false, msg: '⚠️ La descripción supera los 5.000 caracteres.' };
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(fechaTxt);
    const fechaEvento = m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : new Date(fechaTxt);
    if (isNaN(fechaEvento)) return { success: false, msg: '⚠️ Fecha y hora no válidas.' };

    let buf = null, mime = null;
    if (p.adjunto && p.adjunto.data) {
      buf = Buffer.from(String(p.adjunto.data).replace(/^data:[^,]*,/, ''), 'base64');
      if (buf.length > MAX_ADJUNTO) return { success: false, msg: '⚠️ El adjunto supera 5 MB.' };
      mime = tipoReal(buf);
      if (!mime) return { success: false, msg: '⚠️ Solo se permiten archivos PNG, JPG o PDF.' };
    }

    const ahora = new Date();
    const id = 'PQR-' + ahora.getTime();
    const carpeta = 'PQR/' + Utilities.formatDate(ahora, tz(), 'yyyy-MM');
    let adjunto = null;
    if (buf) {
      const base = String(p.adjunto.name || 'soporte').replace(/\.[^.]+$/, '').replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, '').trim().slice(0, 60) || 'soporte';
      adjunto = DriveFiles.save({ folder: carpeta, name: `${id}_${base}.${TIPOS[mime]}`, mimeType: mime, data: buf });
    }
    const r = {
      id, codigoPTR: codigo, oficina: String(p.oficina || '').trim(), tipificacion, descripcion,
      fechaRadicacion: Utilities.formatDate(ahora, tz(), 'dd/MM/yyyy HH:mm'),
      fechaEvento: Utilities.formatDate(fechaEvento, tz(), 'dd/MM/yyyy HH:mm'),
      adjunto: adjunto ? adjunto.name : '', usuario: String(p.usuario || '').trim(), rol: String(p.rol || '').trim()
    };
    const constancia = DriveFiles.save({ folder: carpeta, name: `Constancia_${id}.html`, mimeType: 'text/html', data: constanciaHTML(r) });

    const hoja = await hojaConEncabezados(ID_EXCEL_PRINCIPAL, 'PQR', PQR_ENCABEZADOS);
    await hoja.appendRow([id, ahora, codigo, r.oficina, fechaEvento, tipificacion, descripcion, adjunto ? adjunto.name : '', adjunto ? adjunto.url : '', constancia.name, constancia.url, r.usuario, r.rol, 'RADICADA']);

    // Copia de la constancia al correo del usuario que radica (si tiene correo en la hoja Usuarios).
    try {
      const us = await SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL).getSheetByName('Usuarios').getDataRange().getValues();
      const fila = us.slice(1).find((u) => String(u[0]).trim().toUpperCase() === r.usuario.toUpperCase());
      const correo = fila ? String(fila[3] || '').trim() : '';
      if (correo) {
        await MailApp.sendEmail({
          to: correo, name: 'COI · Experiencia de Cliente', subject: `PQR radicada ${id} · ${tipificacion}`,
          htmlBody: `<div style="font-family:Arial,sans-serif;color:#1B2033"><p>Hola <b>${esc(r.usuario)}</b>,</p><p>Se radicó la ${esc(tipificacion.toLowerCase())} <b>${esc(id)}</b> para el código PTR <b>${esc(codigo)}</b>${r.oficina ? ' (' + esc(r.oficina) + ')' : ''}.</p><p style="color:#646B80">Fecha del evento: ${esc(r.fechaEvento)}</p><p>La constancia quedó guardada en COI.</p></div>`
        });
      }
    } catch { /* el correo es informativo: no impide la radicación */ }

    return { success: true, msg: `✅ PQR radicada con el número ${id}.`, id, urlConfirmacion: constancia.url, urlAdjunto: adjunto ? adjunto.url : '' };
  } catch (e) {
    return { success: false, msg: '❌ Error al radicar: ' + e.message };
  }
}

/** Historial de PQR: ADMIN ve todos; los demás, solo los que radicaron. Más recientes primero. */
export async function obtenerHistorialPQR(usuario, rol) {
  try {
    const hoja = await recuperarHoja(ID_EXCEL_PRINCIPAL, 'PQR');
    if (!hoja) return [];
    const datos = await hoja.getDataRange().getValues();
    if (datos.length <= 1) return [];
    const u = String(usuario || '').trim().toUpperCase();
    const admin = String(rol || '').trim().toUpperCase() === 'ADMIN';
    const f = (v, pat) => (v instanceof Date ? Utilities.formatDate(v, tz(), pat) : String(v || ''));
    return datos.slice(1)
      .filter((r) => String(r[0] || '').trim() && (admin || String(r[11] || '').trim().toUpperCase() === u))
      .map((r) => ({
        id: String(r[0]), fechaRadicacion: f(r[1], 'dd/MM/yyyy HH:mm'), fechaRadicacionISO: f(r[1], "yyyy-MM-dd'T'HH:mm:ss"),
        codigoPTR: String(r[2] || ''), oficina: String(r[3] || ''), fechaEvento: f(r[4], 'dd/MM/yyyy HH:mm'),
        tipificacion: String(r[5] || ''), descripcion: String(r[6] || ''), adjunto: String(r[7] || ''), urlAdjunto: String(r[8] || ''),
        confirmacion: String(r[9] || ''), urlConfirmacion: String(r[10] || ''), radicadoPor: String(r[11] || ''), rol: String(r[12] || ''), estado: String(r[13] || 'RADICADA')
      }))
      .reverse();
  } catch (e) {
    console.error('Error en obtenerHistorialPQR: ' + e);
    return [];
  }
}

export const functions = { guardarPQR, obtenerHistorialPQR };
