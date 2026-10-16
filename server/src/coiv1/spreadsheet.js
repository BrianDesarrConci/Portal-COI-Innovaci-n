/**
 * SpreadsheetApp para Node: la misma forma de trabajo del código V1 (Apps Script),
 * pero asíncrona. Las filas son arreglos y los índices de fila/columna empiezan en 1,
 * igual que getRange(fila, columna). Las fechas se entregan como objetos Date.
 *
 *   const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
 *   const hoja = ss.getSheetByName('Novedades');
 *   const datos = await hoja.getDataRange().getValues();
 *   await hoja.getRange(fila, 10).setValue('RESUELTA');
 *   await hoja.appendRow([...]);
 *
 * Origen de datos (driver):
 *  - "snapshot" (por defecto): copia de los Sheets en server/src/data/coiv1; las escrituras
 *    se guardan en $DATA_DIR/coiv1 y sobreviven reinicios.
 *  - "sheets": Google Sheets real con cuenta de servicio (GOOGLE_SERVICE_ACCOUNT_JSON).
 */
import './tz.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS, bookById } from './books.js';
import { createSheetsDriver } from './sheetsApi.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SNAP_DIR = path.join(here, '..', 'data', 'coiv1');
const manifest = JSON.parse(fs.readFileSync(path.join(SNAP_DIR, 'manifest.json'), 'utf8'));

// ---------- Serialización de celdas ----------
export const reviveCell = (c) => (c && typeof c === 'object' && '$d' in c ? new Date(c.$d) : c);
const pad = (n) => String(n).padStart(2, '0');
export const storeCell = (c) => {
  if (c instanceof Date) {
    if (isNaN(c)) return '';
    return { $d: `${c.getFullYear()}-${pad(c.getMonth() + 1)}-${pad(c.getDate())}T${pad(c.getHours())}:${pad(c.getMinutes())}:${pad(c.getSeconds())}` };
  }
  return c === undefined || c === null ? '' : c;
};
const revive = (rows) => rows.map((r) => r.map(reviveCell));

// ---------- Driver de copia local ----------
function createSnapshotDriver() {
  const overlayDir = () => path.join(path.resolve(process.env.DATA_DIR || path.join(here, '..', '..', 'var')), 'coiv1');
  const cache = new Map(); // "book/sheet" -> filas almacenadas

  const fileOf = (book, sheet) => `${book}__${sheet.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '')}.json`;
  function load(book, sheet) {
    const key = book + '/' + sheet;
    if (cache.has(key)) return cache.get(key);
    const meta = manifest[book] && manifest[book][sheet];
    const file = meta ? meta.file : fileOf(book, sheet);
    const over = path.join(overlayDir(), file);
    let rows = [];
    if (fs.existsSync(over)) rows = JSON.parse(fs.readFileSync(over, 'utf8'));
    else if (fs.existsSync(path.join(SNAP_DIR, file))) rows = JSON.parse(fs.readFileSync(path.join(SNAP_DIR, file), 'utf8'));
    cache.set(key, rows);
    return rows;
  }
  function save(book, sheet, rows) {
    cache.set(book + '/' + sheet, rows);
    const meta = manifest[book] && manifest[book][sheet];
    const dir = overlayDir();
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, meta ? meta.file : fileOf(book, sheet));
    fs.writeFileSync(file + '.tmp', JSON.stringify(rows));
    fs.renameSync(file + '.tmp', file);
  }
  // Hojas creadas con insertSheet: se recuerdan en $DATA_DIR/coiv1/sheets.json para sobrevivir reinicios.
  const extraFile = () => path.join(overlayDir(), 'sheets.json');
  const readExtra = () => { try { return JSON.parse(fs.readFileSync(extraFile(), 'utf8')); } catch { return {}; } };
  return {
    name: 'snapshot',
    sheetNames: (book) => Object.keys(manifest[book] || {}).concat((readExtra()[book] || []).filter((n) => !(manifest[book] || {})[n])),
    addSheet(book, sheet) {
      const ex = readExtra();
      if (!(ex[book] || []).includes(sheet)) {
        ex[book] = (ex[book] || []).concat(sheet);
        fs.mkdirSync(overlayDir(), { recursive: true });
        fs.writeFileSync(extraFile(), JSON.stringify(ex, null, 1));
      }
      if (!load(book, sheet).length) save(book, sheet, []);
    },
    async read(book, sheet) { return revive(load(book, sheet)); },
    async write(book, sheet, mutate) {
      const rows = load(book, sheet).map((r) => r.slice());
      mutate(rows);
      const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
      save(book, sheet, rows.map((r) => r.concat(Array(w - r.length).fill('')).map(storeCell)));
    }
  };
}

let driver = null;
export function getDriver() {
  if (!driver) driver = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? createSheetsDriver({ BOOKS, reviveCell, storeCell }) : createSnapshotDriver();
  return driver;
}
/** Solo para pruebas: reinicia el driver (p. ej. tras cambiar DATA_DIR). */
export function resetDriver() { driver = null; }

// ---------- Rango ----------
class Range {
  constructor(sheet, row, col, numRows, numCols) { Object.assign(this, { sheet, row, col, numRows, numCols }); }
  async getValues() {
    const all = await this.sheet._rows();
    const nr = this.numRows ?? all.length - this.row + 1;
    const width = all.reduce((m, r) => Math.max(m, r.length), 0);
    const nc = this.numCols ?? width - this.col + 1;
    const out = [];
    for (let i = 0; i < nr; i++) {
      const r = all[this.row - 1 + i] || [];
      const line = [];
      for (let j = 0; j < nc; j++) { const v = r[this.col - 1 + j]; line.push(v === undefined ? '' : v); }
      out.push(line);
    }
    return out;
  }
  async getValue() { return (await this.getValues())[0][0]; }
  async setValues(values) { await this.sheet._write((rows) => setBlock(rows, this.row, this.col, values)); return this; }
  async setValue(v) { return this.setValues([[v]]); }
  // Formato visual: en la base de datos no aplica, se acepta para mantener el código V1.
  setBackground() { return this; } setFontWeight() { return this; } setFontColor() { return this; } setNumberFormat() { return this; }
}
function setBlock(rows, row, col, values) {
  values.forEach((line, i) => {
    const r = row - 1 + i;
    while (rows.length <= r) rows.push([]);
    line.forEach((v, j) => {
      const c = col - 1 + j;
      while (rows[r].length < c) rows[r].push('');
      rows[r][c] = v;
    });
  });
}

// ---------- Hoja ----------
class Sheet {
  constructor(book, name) { this.book = book; this.name = name; }
  getName() { return this.name; }
  async _rows() { return getDriver().read(this.book, this.name); }
  async _write(mutate) { return getDriver().write(this.book, this.name, mutate); }
  getDataRange() { return new Range(this, 1, 1); }
  getRange(row, col, numRows = 1, numCols = 1) { return new Range(this, row, col, numRows, numCols); }
  async getLastRow() { return (await this._rows()).length; }
  async getLastColumn() { return (await this._rows()).reduce((m, r) => Math.max(m, r.length), 0); }
  async appendRow(values) { await this._write((rows) => rows.push(values.slice())); return this; }
  async appendRows(list) { await this._write((rows) => list.forEach((v) => rows.push(v.slice()))); return this; }
  async deleteRow(row) { await this._write((rows) => rows.splice(row - 1, 1)); return this; }
  /** Atajo: encabezados + filas como objetos (sin cambiar el orden de columnas). */
  async getObjects() {
    const [h, ...rows] = await this._rows();
    return rows.map((r) => Object.fromEntries((h || []).map((k, i) => [k, r[i] === undefined ? '' : r[i]])));
  }
}

// ---------- Libro ----------
class Spreadsheet {
  constructor(book) { this.book = book; }
  getId() { return BOOKS[this.book].id; }
  getName() { return BOOKS[this.book].title; }
  getSheets() { return getDriver().sheetNames(this.book).map((n) => new Sheet(this.book, n)); }
  /** Como en Apps Script, sin distinguir mayúsculas (V1 usa "PERMISOS" y "Permisos"). */
  getSheetByName(name) {
    const found = getDriver().sheetNames(this.book).find((n) => n.toLowerCase() === String(name).toLowerCase());
    return found ? new Sheet(this.book, found) : null;
  }
  insertSheet(name) { getDriver().addSheet(this.book, name); return new Sheet(this.book, name); }
}

export const SpreadsheetApp = {
  openById(id) {
    const book = bookById(id);
    if (!book) throw new Error('No se encontró el libro de Sheets ' + id);
    return new Spreadsheet(book);
  }
};
export const sheetsManifest = manifest;
