/**
 * Ayudantes internos de los módulos de COI V1 (el prefijo "_" evita que el router los registre
 * como funciones RPC).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SpreadsheetApp, getDriver } from '../spreadsheet.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const overlayDir = () => path.join(path.resolve(process.env.DATA_DIR || path.join(here, '..', '..', '..', 'var')), 'coiv1');

/**
 * Equivale a `ss.getSheetByName(nombre)`, tolerante a hojas creadas con insertSheet.
 *
 * Con la copia local (driver "snapshot") las hojas creadas con insertSheet solo se recuerdan en
 * memoria: tras reiniciar el servidor getSheetByName devuelve null aunque el archivo exista, y un
 * insertSheet nuevo lo vaciaría. Aquí se recuperan esas filas antes de volver a registrar la hoja.
 */
export async function recuperarHoja(bookId, nombre) {
  const ss = SpreadsheetApp.openById(bookId);
  const hoja = ss.getSheetByName(nombre);
  if (hoja || getDriver().name !== 'snapshot') return hoja;
  const file = path.join(overlayDir(), `${ss.book}__${nombre.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}.json`);
  if (!fs.existsSync(file)) return null;
  let previas = [];
  try { previas = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { previas = []; }
  const nueva = ss.insertSheet(nombre); // registra la hoja (y deja el archivo vacío)…
  if (previas.length) await nueva._write((rows) => { previas.forEach((r) => rows.push(r)); }); // …y le devuelve sus filas
  return nueva;
}

export async function hojaConEncabezados(bookId, nombre, encabezados) {
  let hoja = await recuperarHoja(bookId, nombre);
  if (!hoja) hoja = SpreadsheetApp.openById(bookId).insertSheet(nombre);
  if ((await hoja.getLastRow()) === 0) {
    await hoja.appendRow(encabezados);
    hoja.getRange(1, 1, 1, encabezados.length).setFontWeight('bold').setBackground('#002e5b').setFontColor('white');
  }
  return hoja;
}

/** "2026-10-16" → Date local a medianoche (lo que hace Sheets al escribir una fecha del <input type=date>). */
export function fechaDeInput(v) {
  if (v instanceof Date) return v;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || '').trim());
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : v;
}

/** Texto seguro para HTML. */
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
