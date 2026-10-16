/**
 * Equivalentes en Node de los servicios de Apps Script que usa COI V1.
 * Mantienen los mismos nombres para portar la lógica casi línea a línea.
 * Las operaciones con E/S (bloqueos, correo, archivos) son asíncronas: use `await`.
 */
import './tz.js';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = () => path.join(path.resolve(process.env.DATA_DIR || path.join(here, '..', '..', 'var')), 'coiv1');
const SCRIPT_TZ = 'America/Bogota';

// ---------- Session ----------
export const Session = {
  getScriptTimeZone: () => SCRIPT_TZ,
  getActiveUser: () => ({ getEmail: () => 'coi@reval.com.co' })
};

// ---------- Utilities ----------
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
function partsIn(date, tz) {
  let zone = tz || SCRIPT_TZ;
  const m = /^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(zone);
  if (m) { // "GMT-5" = desplazamiento fijo
    const off = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
    const d = new Date(date.getTime() + off * 60000);
    return { y: d.getUTCFullYear(), M: d.getUTCMonth() + 1, d: d.getUTCDate(), H: d.getUTCHours(), m: d.getUTCMinutes(), s: d.getUTCSeconds(), w: d.getUTCDay() };
  }
  const f = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', weekday: 'short', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, M: +p.month, d: +p.day, H: +p.hour % 24, m: +p.minute, s: +p.second, w: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
}
const z = (n, l = 2) => String(n).padStart(l, '0');
export const Utilities = {
  /** Patrones de SimpleDateFormat más usados: yyyy yy MMMM MMM MM M dd d EEEE EEE HH H hh h mm ss a, y texto entre comillas. */
  formatDate(date, tz, pattern) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d)) return '';
    const p = partsIn(d, tz);
    const h12 = p.H % 12 || 12;
    const map = { yyyy: p.y, yy: z(p.y % 100), MMMM: MON[p.M - 1], MMM: MON[p.M - 1].slice(0, 3), MM: z(p.M), M: p.M, dd: z(p.d), d: p.d, EEEE: DAY[p.w], EEE: DAY[p.w].slice(0, 3), HH: z(p.H), H: p.H, hh: z(h12), h: h12, mm: z(p.m), ss: z(p.s), a: p.H < 12 ? 'AM' : 'PM' };
    return pattern.replace(/'([^']*)'|yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE|HH|H|hh|h|mm|ss|a/g, (t, lit) => (lit !== undefined ? lit : String(map[t])));
  },
  getUuid: () => crypto.randomUUID(),
  DigestAlgorithm: { MD5: 'md5', SHA_1: 'sha1', SHA_256: 'sha256' },
  Charset: { UTF_8: 'utf8' },
  /** Devuelve bytes con signo (-128..127), como Apps Script. */
  computeDigest(alg, value) { return [...crypto.createHash(alg).update(String(value), 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)); },
  computeHmacSha256Signature(value, key) { return [...crypto.createHmac('sha256', String(key)).update(String(value)).digest()].map((b) => (b > 127 ? b - 256 : b)); },
  base64Encode: (v) => Buffer.from(Array.isArray(v) ? Uint8Array.from(v.map((b) => b & 255)) : String(v)).toString('base64'),
  base64EncodeWebSafe: (v) => Buffer.from(Array.isArray(v) ? Uint8Array.from(v.map((b) => b & 255)) : String(v)).toString('base64url'),
  base64Decode: (s) => [...Buffer.from(String(s), 'base64')],
  base64DecodeWebSafe: (s) => [...Buffer.from(String(s), 'base64url')],
  gzip: (s) => zlib.gzipSync(Buffer.from(String(s))),
  ungzip: (b) => zlib.gunzipSync(b).toString('utf8'),
  newBlob(data, contentType = 'text/plain', name = '') {
    const buf = Buffer.isBuffer(data) ? data : Array.isArray(data) ? Buffer.from(Uint8Array.from(data.map((b) => b & 255))) : Buffer.from(String(data));
    return { getBytes: () => [...buf], getDataAsString: () => buf.toString('utf8'), getContentType: () => contentType, getName: () => name, buffer: buf };
  },
  sleep: (ms) => new Promise((r) => setTimeout(r, ms))
};

// ---------- Logger ----------
export const Logger = { log: (...a) => { if (process.env.COI_DEBUG) console.log('[COI V1]', ...a); } };

// ---------- LockService (un proceso) ----------
let tail = Promise.resolve();
export const LockService = {
  getScriptLock() {
    let release = null;
    return {
      async waitLock(ms = 30000) {
        let r; const mine = new Promise((res) => { r = res; });
        const prev = tail; tail = prev.then(() => mine);
        let timer;
        const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('No se pudo obtener el bloqueo en ' + ms + ' ms')), ms); });
        try { await Promise.race([prev, timeout]); } finally { clearTimeout(timer); }
        release = r; return true;
      },
      async tryLock(ms) { try { return await this.waitLock(ms); } catch { return false; } },
      releaseLock() { if (release) { release(); release = null; } },
      hasLock() { return !!release; }
    };
  }
};
LockService.getDocumentLock = LockService.getScriptLock;
LockService.getUserLock = LockService.getScriptLock;

// ---------- CacheService (memoria con vencimiento) ----------
const cacheStore = new Map();
const cacheApi = {
  get(k) { const e = cacheStore.get(k); if (!e) return null; if (Date.now() > e.exp) { cacheStore.delete(k); return null; } return e.v; },
  put(k, v, ttl = 600) { cacheStore.set(k, { v: String(v), exp: Date.now() + Math.min(ttl, 21600) * 1000 }); },
  remove(k) { cacheStore.delete(k); },
  getAll(keys) { const o = {}; keys.forEach((k) => { const v = cacheApi.get(k); if (v !== null) o[k] = v; }); return o; },
  putAll(obj, ttl) { Object.entries(obj).forEach(([k, v]) => cacheApi.put(k, v, ttl)); },
  removeAll(keys) { keys.forEach((k) => cacheStore.delete(k)); }
};
export const CacheService = { getScriptCache: () => cacheApi, getUserCache: () => cacheApi, getDocumentCache: () => cacheApi };

// ---------- PropertiesService (persistido) ----------
function propsFile() { return path.join(dataDir(), 'properties.json'); }
const props = {
  _all() { try { return JSON.parse(fs.readFileSync(propsFile(), 'utf8')); } catch { return {}; } },
  _save(o) { fs.mkdirSync(dataDir(), { recursive: true }); fs.writeFileSync(propsFile(), JSON.stringify(o, null, 1)); },
  getProperty(k) { const v = props._all()[k]; return v === undefined ? null : v; },
  setProperty(k, v) { const o = props._all(); o[k] = String(v); props._save(o); return props; },
  deleteProperty(k) { const o = props._all(); delete o[k]; props._save(o); return props; },
  getProperties() { return props._all(); }
};
export const PropertiesService = { getScriptProperties: () => props, getUserProperties: () => props, getDocumentProperties: () => props };

// ---------- MailApp (bandeja de salida de demostración) ----------
function outboxFile() { return path.join(dataDir(), 'outbox.json'); }
export function readOutbox() { try { return JSON.parse(fs.readFileSync(outboxFile(), 'utf8')); } catch { return []; } }
export const MailApp = {
  /** En la demo no se envía: el correo queda en la bandeja de salida (GET /api/coiv1/outbox). */
  async sendEmail(a, subject, body, opts) {
    const m = typeof a === 'object' ? a : { to: a, subject, body, ...(opts || {}) };
    const list = readOutbox();
    list.unshift({ id: 'MAIL-' + Date.now() + '-' + Math.floor(Math.random() * 1000), fecha: new Date().toISOString(), to: m.to, cc: m.cc || '', subject: m.subject, name: m.name || 'COI', htmlBody: m.htmlBody || '', body: m.body || '' });
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(outboxFile(), JSON.stringify(list.slice(0, 300), null, 1));
    return true;
  },
  getRemainingDailyQuota: () => 100
};
export const GmailApp = { sendEmail: (to, subject, body, opts) => MailApp.sendEmail({ to, subject, body, ...(opts || {}) }) };

// ---------- Drive (archivos de demostración) ----------
function filesDir() { return path.join(dataDir(), 'files'); }
function filesIndex() { try { return JSON.parse(fs.readFileSync(path.join(filesDir(), 'index.json'), 'utf8')); } catch { return {}; } }
export const DriveFiles = {
  /**
   * Guarda un archivo (equivale a carpeta.createFile(blob)). `folder` es la ruta lógica de carpetas
   * de V1, p. ej. "Arqueos_Multival/2026-10/OFICINA". Devuelve { id, name, url }.
   */
  save({ folder = '', name, mimeType = 'application/octet-stream', data }) {
    const id = crypto.randomBytes(12).toString('hex');
    const buf = Buffer.isBuffer(data) ? data : typeof data === 'string' && /;base64,|^[A-Za-z0-9+/=\s]+$/.test(data) && mimeType !== 'text/html' ? Buffer.from(data.replace(/^data:[^,]*,/, ''), 'base64') : Buffer.from(String(data));
    fs.mkdirSync(filesDir(), { recursive: true });
    fs.writeFileSync(path.join(filesDir(), id), buf);
    const idx = filesIndex();
    idx[id] = { id, name, mimeType, folder, size: buf.length, created: new Date().toISOString() };
    fs.writeFileSync(path.join(filesDir(), 'index.json'), JSON.stringify(idx, null, 1));
    return { id, name, url: '/api/coiv1/files/' + id };
  },
  get(id) {
    const meta = filesIndex()[id];
    if (!meta || !/^[a-f0-9]{24}$/.test(id)) return null;
    return { ...meta, buffer: fs.readFileSync(path.join(filesDir(), id)) };
  },
  list() { return Object.values(filesIndex()); }
};
