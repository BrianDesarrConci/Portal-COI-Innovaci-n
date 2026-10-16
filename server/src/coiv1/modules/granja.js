/**
 * COI V1 · Granja de Usuarios (sección "novedades" de V1): directorio, bajas (novedades) y
 * asignación de personal backup. Portado de Código.gs con los mismos nombres, parámetros y
 * respuestas:
 *   obtenerDirectorioUsuarios, obtenerListaCajeros, obtenerCajerosBackup, registrarNovedad,
 *   procesarAsignacionBackup, obtenerNovedadesPendientes, obtenerHistorialNovedades,
 *   obtenerHistorialCompletoBackend, asignarBackup, cambiarEstadoNovedad, procesarAccionNovedad,
 *   liberarBackup, cerrarNovedadesAutomaticamente.
 *
 * Hojas: Novedades (libro COI V1) y GRANJA_DE_USUARIOS_JULLY / DATOS MANUALES (libro Granja).
 * Columnas de Novedades: A ID · B FechaReporte · C CajeroNombre · D Oficina · E Descripcion ·
 * F ReportadoPor · G BackupAsignado · H FechaResolucion · I AdminNombre · J Estado ·
 * K FechaInicioAusencia · L DiasAusencia.
 */
import { SpreadsheetApp } from '../spreadsheet.js';
import { ID_EXCEL_PRINCIPAL, ID_EXCEL_DIRECTORIO } from '../books.js';
import { Utilities, Session, Logger } from '../gas.js';
import { fechaDeInput } from './_v1util.js';

const ssP = () => SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
const ssD = () => SpreadsheetApp.openById(ID_EXCEL_DIRECTORIO);
const up = (v) => String(v ?? '').trim().toUpperCase();

/**
 * Lee GRANJA_DE_USUARIOS_JULLY. En el libro real la columna "BACKUP SI/NO" de esa pestaña se
 * alimenta de DATOS MANUALES, que es la que escriben asignarBackup y liberarBackup; la copia local
 * es estática, así que aquí se replica ese vínculo (mismo valor de DATOS MANUALES por NOMBRE).
 */
async function valoresGranja() {
  const hoja = ssD().getSheetByName('GRANJA_DE_USUARIOS_JULLY');
  if (!hoja) return null;
  const valores = await hoja.getDataRange().getValues();
  const manual = ssD().getSheetByName('DATOS MANUALES');
  if (!manual || valores.length < 2) return valores;
  const dm = await manual.getDataRange().getValues();
  const hG = valores[0], hD = dm[0] || [];
  const nG = hG.findIndex((c) => up(c).includes('NOMBRE')), bG = hG.findIndex((c) => up(c).includes('BACKUP'));
  const nD = hD.findIndex((c) => up(c).includes('NOMBRE')), bD = hD.findIndex((c) => up(c).includes('BACKUP'));
  if (nG < 0 || bG < 0 || nD < 0 || bD < 0) return valores;
  const mapa = new Map();
  dm.slice(1).forEach((r) => { const k = up(r[nD]); if (k && !mapa.has(k)) mapa.set(k, r[bD]); });
  return valores.map((r, i) => {
    if (i === 0) return r;
    const k = up(r[nG]);
    if (!mapa.has(k)) return r;
    const c = r.slice(); c[bG] = mapa.get(k); return c;
  });
}

// ==========================================
// --- DIRECTORIO (Excel 2) ---
// ==========================================
export async function obtenerDirectorioUsuarios() {
  try {
    const valores = await valoresGranja();
    if (!valores) throw new Error("No se encontró la hoja GRANJA_DE_USUARIOS_JULLY");
    // Filtramos para evitar filas vacías (V1 usa la columna G, LATITUD)
    return valores.slice(1).filter((f) => f[6] !== '' && f[6] !== undefined);
  } catch (e) {
    return 'Error al cargar directorio: ' + e.toString();
  }
}

// Retorna todos los cajeros del directorio para el selector del usuario
export async function obtenerListaCajeros() {
  try {
    const valores = await valoresGranja();
    if (!valores) return [];
    return valores.slice(1).filter((f) => f[6] !== '' && f[6] !== undefined);
  } catch (e) {
    return [];
  }
}

export async function obtenerCajerosBackup() {
  try {
    const valores = await valoresGranja();
    if (!valores) { console.error("Error: No se encontró la pestaña 'Directorio de usuarios'"); return []; }
    if (valores.length < 2) return [];
    const cabecera = valores[0];
    // --- BUSCADOR AUTOMÁTICO DE ÍNDICES ---
    const buscarIdx = (texto) => cabecera.findIndex((c) => c.toString().toUpperCase().includes(texto.toUpperCase()));
    const idxNombre = buscarIdx('NOMBRE') !== -1 ? buscarIdx('NOMBRE') : 9; // Columna J
    const idxBackup = buscarIdx('BACKUP');
    const todosLosDatos = valores.slice(1).filter((f) => {
      const tieneNombre = f[idxNombre] && f[idxNombre].toString().trim() !== '';
      const esBackup = idxBackup !== -1 && (f[idxBackup] || '').toString().trim().toUpperCase() === 'SI';
      return tieneNombre && esBackup;
    });
    Logger.log('Total registros válidos: ' + todosLosDatos.length);
    return todosLosDatos;
  } catch (e) {
    console.error('Error en obtenerCajerosBackup: ' + e.toString());
    return [];
  }
}

// ==========================================
// --- MÓDULO NOVEDADES Y BACKUP ---
// ==========================================

// Registra una nueva novedad en la hoja "Novedades" del Excel principal
export async function registrarNovedad(payload) {
  try {
    const ss = ssP();
    let hoja = ss.getSheetByName('Novedades');
    if (!hoja) {
      hoja = ss.insertSheet('Novedades');
      await hoja.appendRow(['ID', 'FechaReporte', 'CajeroNombre', 'Oficina', 'Descripcion', 'ReportadoPor', 'BackupAsignado', 'FechaResolucion', 'AdminNombre', 'Estado', 'FechaInicioAusencia', 'DiasAusencia']);
      hoja.getRange(1, 1, 1, 12).setFontWeight('bold').setBackground('#002e5b').setFontColor('white');
    }
    const id = 'NOV-' + new Date().getTime();
    const fechaReporte = new Date().toLocaleString('es-CO');
    // Sheets convierte "2026-10-16" en fecha y "3" en número al escribir; aquí se hace explícito.
    const dias = payload.diasAusencia === '' || payload.diasAusencia === undefined || isNaN(Number(payload.diasAusencia)) ? payload.diasAusencia : Number(payload.diasAusencia);
    await hoja.appendRow([
      id, fechaReporte, payload.cajeroNombre, payload.oficina, payload.descripcion, payload.reportadoPor,
      '', // BackupAsignado
      '', // FechaResolucion
      '', // AdminNombre
      'PENDIENTE',
      fechaDeInput(payload.fechaInicio), // Columna K (Índice 10)
      dias // Columna L (Índice 11)
    ]);
    return { success: true, msg: '✅ Novedad registrada con sus fechas correspondientes.', id };
  } catch (e) {
    return { success: false, msg: '❌ Error al registrar: ' + e.message };
  }
}

// Cierra la novedad y registra el backup asignado
export async function procesarAsignacionBackup(payload) {
  try {
    const hoja = ssP().getSheetByName('Novedades');
    if (!hoja) return { success: false, msg: '❌ Hoja Novedades no encontrada.' };
    const datos = await hoja.getDataRange().getValues();
    const fechaResolucion = new Date().toLocaleString('es-CO');
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0] === payload.novedadId) {
        await hoja.getRange(i + 1, 7).setValue(payload.backupNombre); // BackupAsignado
        await hoja.getRange(i + 1, 8).setValue(fechaResolucion); // FechaResolucion
        await hoja.getRange(i + 1, 9).setValue(payload.adminNombre); // AdminNombre
        await hoja.getRange(i + 1, 10).setValue('RESUELTA'); // Estado
        hoja.getRange(i + 1, 1, 1, 10).setBackground('#e8f8f0');
        break;
      }
    }
    return { success: true, msg: `✅ ¡Asignación exitosa! ${payload.backupNombre} cubrirá a ${payload.cajeroEnBaja} en ${payload.oficinaBaja}.` };
  } catch (e) {
    return { success: false, msg: '❌ Error al asignar: ' + e.message };
  }
}

export async function obtenerNovedadesPendientes(usuario, rol) {
  try {
    const hoja = ssP().getSheetByName('Novedades');
    if (!hoja) return [];
    const datos = await hoja.getDataRange().getValues();
    if (datos.length <= 1) return [];
    const usuarioActual = up(usuario);
    const rolActual = up(rol);
    const pendientes = datos.slice(1).filter((f) => {
      const id = String(f[0] || '').trim();
      const estado = up(f[9]);
      const creador = up(f[5]);
      if (!id) return false;
      if (estado !== 'PENDIENTE') return false; // Solo pendientes
      if (rolActual === 'ADMIN') return true; // ADMIN puede gestionar todas
      return creador === usuarioActual; // Los demás SOLO las que ellos registraron
    });
    return pendientes.map((f) => ({
      id: f[0] ? f[0].toString() : '',
      fecha: f[1] ? f[1].toString() : '',
      cajero: f[2] ? f[2].toString() : 'Sin Nombre',
      oficina: f[3] ? f[3].toString() : 'Sin Oficina',
      descripcion: f[4] ? f[4].toString() : 'No especificado',
      reportadoPor: f[5] ? f[5].toString() : '',
      estado: f[9] ? f[9].toString() : 'PENDIENTE',
      // Campos adicionales para la vista (no existen en V1; no cambian los anteriores).
      fechaInicio: f[10] instanceof Date ? Utilities.formatDate(f[10], Session.getScriptTimeZone(), 'dd/MM/yyyy') : String(f[10] || ''),
      fechaInicioISO: f[10] instanceof Date ? Utilities.formatDate(f[10], Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss") : '',
      diasAusencia: String(f[11] ?? '')
    }));
  } catch (e) {
    console.error('Error en obtenerNovedadesPendientes: ' + e.toString());
    return [];
  }
}

// Función para obtener el historial (Verde)
export async function obtenerHistorialNovedades() {
  try {
    const hoja = ssP().getSheetByName('Novedades');
    if (!hoja) return [];
    const datos = await hoja.getDataRange().getValues();
    if (datos.length <= 1) return [];
    return datos.slice(1).filter((f) => (f[9] ? f[9].toString().toUpperCase().trim() : '') === 'RESUELTA');
  } catch (e) {
    console.error('Error en obtenerHistorialNovedades: ' + e.toString());
    return [];
  }
}

const fmtFecha = (v, patron) => {
  if (!v) return '';
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d) ? String(v) : Utilities.formatDate(d, Session.getScriptTimeZone(), patron);
};

export async function obtenerHistorialCompletoBackend(usuario, rol) {
  try {
    const hoja = ssP().getSheetByName('Novedades');
    if (!hoja) return [];
    const datos = await hoja.getDataRange().getValues();
    if (datos.length <= 1) return [];
    const usuarioActual = up(usuario);
    const rolActual = up(rol);
    const resultados = datos.slice(1).filter((f) => {
      const id = String(f[0] || '').trim();
      const estado = up(f[9]);
      const creador = up(f[5]);
      if (!id) return false;
      if (estado === 'PENDIENTE') return false; // No mostrar pendientes
      if (rolActual === 'ADMIN') return true; // ADMIN ve todo
      return creador === usuarioActual; // Usuario normal: SOLO sus propias novedades
    });
    return resultados.map((f) => {
      const inicio = f[10] ? (f[10] instanceof Date ? f[10] : new Date(f[10])) : null;
      const dias = Number(f[11]) || 0;
      let fin = null;
      if (inicio && !isNaN(inicio)) { fin = new Date(inicio); fin.setDate(fin.getDate() + dias); }
      return {
        id: String(f[0] || ''),
        fechaReporte: String(f[1] || ''),
        cajero: String(f[2] || 'Sin Nombre'),
        oficina: String(f[3] || 'Sin Oficina'),
        descripcion: String(f[4] || 'Sin Especificar'),
        backup: String(f[6] || 'No asignado'),
        estado: String(f[9] || 'CUBIERTA').trim().toUpperCase(),
        fechaInicio: f[10] ? fmtFecha(f[10], 'dd/MM/yyyy HH:mm') : '',
        diasAusencia: String(f[11] || '0'),
        // Campos adicionales para la línea de tiempo (no existen en V1; no cambian los anteriores).
        reportadoPor: String(f[5] || ''),
        fechaResolucion: f[7] ? fmtFecha(f[7], 'dd/MM/yyyy HH:mm') : '',
        adminNombre: String(f[8] || ''),
        fechaInicioISO: inicio && !isNaN(inicio) ? fmtFecha(inicio, "yyyy-MM-dd'T'HH:mm:ss") : '',
        fechaFin: fin ? fmtFecha(fin, 'dd/MM/yyyy') : '',
        fechaFinISO: fin ? fmtFecha(fin, "yyyy-MM-dd'T'HH:mm:ss") : ''
      };
    }).reverse();
  } catch (e) {
    console.error('Error en obtenerHistorialCompletoBackend: ' + e);
    return [];
  }
}

export async function asignarBackup(idNovedad, nombreBackup, adminNombre) {
  try {
    const hoja = ssP().getSheetByName('Novedades');
    if (!hoja) return { success: false, msg: 'No se encontró la hoja Novedades.' };
    const datos = await hoja.getDataRange().getValues();
    let filaEncontrada = -1;
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0].toString().trim() === idNovedad.toString().trim()) { filaEncontrada = i + 1; break; }
    }
    if (filaEncontrada === -1) return { success: false, msg: 'No se encontró la novedad con ID: ' + idNovedad };

    await hoja.getRange(filaEncontrada, 7).setValue(nombreBackup);
    // Cambiar BACKUP SI/NO a NO en el Directorio
    const hojaDir = ssD().getSheetByName('DATOS MANUALES');
    const datosDir = await hojaDir.getDataRange().getValues();
    const encabezados = datosDir[0];
    const idxNombre = encabezados.findIndex((c) => c.toString().toUpperCase().includes('NOMBRE'));
    const idxBackup = encabezados.findIndex((c) => c.toString().toUpperCase().includes('BACKUP'));
    for (let i = 1; i < datosDir.length; i++) {
      const nombre = (datosDir[i][idxNombre] || '').toString().trim().toUpperCase();
      if (nombre === nombreBackup.toString().trim().toUpperCase()) {
        await hojaDir.getRange(i + 1, idxBackup + 1).setValue('NO');
        break;
      }
    }
    // Columna 10 (J) -> CAMBIAR ESTADO A "CUBIERTA"
    await hoja.getRange(filaEncontrada, 10).setValue('CUBIERTA');
    return { success: true, msg: '✅ Caso asignado exitosamente como CUBIERTA.' };
  } catch (e) {
    return { success: false, msg: 'Error en asignarBackup: ' + e.message };
  }
}

export async function cambiarEstadoNovedad(idNovedad, nuevoEstado) {
  try {
    const hoja = ssP().getSheetByName('Novedades');
    const datos = await hoja.getDataRange().getValues();
    let filaEncontrada = -1;
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0].toString().trim() === idNovedad.toString().trim()) { filaEncontrada = i + 1; break; }
    }
    if (filaEncontrada !== -1) {
      await hoja.getRange(filaEncontrada, 10).setValue(nuevoEstado.toUpperCase().trim());
      return { success: true, msg: 'Estado actualizado a ' + nuevoEstado };
    }
    return { success: false, msg: 'No se encontró el ID' };
  } catch (e) {
    return { success: false, msg: e.message };
  }
}

export async function procesarAccionNovedad(datos) {
  try {
    const hoja = ssP().getSheetByName('Novedades');
    const valores = await hoja.getDataRange().getValues();
    let fila = -1;
    for (let i = 1; i < valores.length; i++) {
      if (String(valores[i][0]).trim() === String(datos.id).trim()) { fila = i + 1; break; }
    }
    if (fila === -1) return { success: false, msg: 'No se encontró la novedad.' };

    if (datos.accion === 'EXTENDER') {
      const diasActuales = Number(await hoja.getRange(fila, 12).getValue()) || 0;
      await hoja.getRange(fila, 12).setValue(diasActuales + Number(datos.dias));
      return { success: true, msg: '✅ La novedad fue extendida correctamente.' };
    }
    if (datos.accion === 'CERRAR') {
      const nombreBackup = await hoja.getRange(fila, 7).getValue();
      await liberarBackup(nombreBackup);
      await hoja.getRange(fila, 10).setValue('RESUELTA');
      await hoja.getRange(fila, 8).setValue(new Date());
      await hoja.getRange(fila, 9).setValue(datos.adminNombre);
      return { success: true, msg: '✅ La novedad fue cerrada correctamente.' };
    }
    return { success: false, msg: 'Acción no válida.' };
  } catch (e) {
    return { success: false, msg: e.toString() };
  }
}

export async function liberarBackup(nombreBackup) {
  const hojaDir = ssD().getSheetByName('DATOS MANUALES');
  const datosDir = await hojaDir.getDataRange().getValues();
  const encabezados = datosDir[0];
  const idxNombre = encabezados.findIndex((c) => c.toString().toUpperCase().includes('NOMBRE'));
  const idxBackup = encabezados.findIndex((c) => c.toString().toUpperCase().includes('BACKUP'));
  for (let i = 1; i < datosDir.length; i++) {
    if ((datosDir[i][idxNombre] || '').toString().trim().toUpperCase() === String(nombreBackup ?? '').trim().toUpperCase()) {
      await hojaDir.getRange(i + 1, idxBackup + 1).setValue('SI');
      return true;
    }
  }
  return false;
}

/**
 * En V1 corre con un activador diario de Apps Script. En el portal se ejecuta al abrir el módulo
 * (y puede llamarse desde un cron). Cierra como "SISTEMA AUTOMÁTICO" las coberturas vencidas.
 */
export async function cerrarNovedadesAutomaticamente() {
  const hoja = ssP().getSheetByName('Novedades');
  const datos = await hoja.getDataRange().getValues();
  let cerradas = 0;
  for (let i = 1; i < datos.length; i++) {
    const estado = (datos[i][9] || '').toString().trim().toUpperCase();
    if (estado !== 'CUBIERTA') continue;
    const fechaInicio = new Date(datos[i][10]);
    const dias = Number(datos[i][11]) || 0;
    const fechaFin = new Date(fechaInicio);
    fechaFin.setDate(fechaFin.getDate() + dias);
    if (new Date() >= fechaFin) {
      const nombreBackup = datos[i][6];
      await liberarBackup(nombreBackup);
      await hoja.getRange(i + 1, 10).setValue('RESUELTA');
      await hoja.getRange(i + 1, 8).setValue(new Date()); // Fecha de resolución
      await hoja.getRange(i + 1, 9).setValue('SISTEMA AUTOMÁTICO'); // Quién cerró
      cerradas++;
    }
  }
  return { success: true, msg: `${cerradas} novedades cerradas automáticamente.`, cerradas };
}

export const functions = {
  obtenerDirectorioUsuarios, obtenerListaCajeros, obtenerCajerosBackup, registrarNovedad, procesarAsignacionBackup,
  obtenerNovedadesPendientes, obtenerHistorialNovedades, obtenerHistorialCompletoBackend, asignarBackup,
  cambiarEstadoNovedad, procesarAccionNovedad, cerrarNovedadesAutomaticamente
};
