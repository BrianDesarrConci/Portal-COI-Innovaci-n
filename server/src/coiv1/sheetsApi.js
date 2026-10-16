/**
 * Driver de Google Sheets real (API v4) con cuenta de servicio, sin dependencias externas.
 * Se activa definiendo GOOGLE_SERVICE_ACCOUNT_JSON (contenido del JSON de la cuenta de servicio).
 * Los libros deben estar compartidos con el correo de la cuenta de servicio.
 *
 * Lectura: spreadsheets.get con valores efectivos y tipo de formato, para devolver Date en las
 * celdas de fecha igual que getValues() de Apps Script. Escrituras: values.update/append y
 * batchUpdate (deleteDimension). Las lecturas se guardan 20 s en memoria.
 */
import crypto from 'node:crypto';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const API = 'https://sheets.googleapis.com/v4/spreadsheets/';

export function createSheetsDriver({ BOOKS, storeCell }) {
  const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  let token = null, tokenExp = 0;
  const meta = new Map();   // book -> [{ title, sheetId }]
  const cache = new Map();  // book/sheet -> { at, rows }

  async function auth() {
    if (token && Date.now() < tokenExp - 60000) return token;
    const now = Math.floor(Date.now() / 1000);
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({ iss: sa.client_email, scope: SCOPE, aud: sa.token_uri || 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
    const sig = crypto.createSign('RSA-SHA256').update(unsigned).sign(sa.private_key, 'base64url');
    const res = await fetch(sa.token_uri || 'https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: unsigned + '.' + sig })
    });
    const j = await res.json();
    if (!res.ok) throw new Error('Google OAuth: ' + (j.error_description || j.error));
    token = j.access_token; tokenExp = Date.now() + j.expires_in * 1000;
    return token;
  }
  async function call(book, suffix, init = {}) {
    const res = await fetch(API + BOOKS[book].id + suffix, { ...init, headers: { Authorization: 'Bearer ' + await auth(), 'Content-Type': 'application/json', ...(init.headers || {}) } });
    const j = await res.json();
    if (!res.ok) throw new Error('Sheets API: ' + (j.error && j.error.message));
    return j;
  }
  async function loadMeta(book) {
    const j = await call(book, '?fields=sheets.properties(title,sheetId)');
    meta.set(book, j.sheets.map((s) => s.properties));
    return meta.get(book);
  }
  const q = (s) => "'" + s.replace(/'/g, "''") + "'";
  // Número de serie de Sheets (días desde 1899-12-30, hora local) a Date local.
  const fromSerial = (n) => { const ms = Math.round((n - 25569) * 86400000); const u = new Date(ms); return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate(), u.getUTCHours(), u.getUTCMinutes(), u.getUTCSeconds()); };
  const toCell = (v) => {
    const s = storeCell(v);
    if (s && typeof s === 'object' && s.$d) return s.$d.replace('T', ' ');
    return s;
  };

  return {
    name: 'sheets',
    sheetNames(book) {
      const m = meta.get(book);
      if (!m) throw new Error('Metadatos de Sheets no cargados; llame primero a init()');
      return m.map((s) => s.title);
    },
    async init() { await Promise.all(Object.keys(BOOKS).map(loadMeta)); },
    addSheet(book, title) {
      call(book, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }) }).then(() => loadMeta(book));
    },
    async read(book, sheet) {
      const key = book + '/' + sheet; const hit = cache.get(key);
      if (hit && Date.now() - hit.at < 20000) return hit.rows.map((r) => r.slice());
      const j = await call(book, '?ranges=' + encodeURIComponent(q(sheet)) + '&fields=sheets.data.rowData.values(effectiveValue,effectiveFormat.numberFormat.type)');
      const rowData = (j.sheets[0].data[0].rowData || []);
      const rows = rowData.map((r) => (r.values || []).map((c) => {
        const ev = c.effectiveValue; if (!ev) return '';
        const t = c.effectiveFormat && c.effectiveFormat.numberFormat && c.effectiveFormat.numberFormat.type;
        if ('numberValue' in ev) return /DATE|TIME/.test(t || '') ? fromSerial(ev.numberValue) : ev.numberValue;
        if ('boolValue' in ev) return ev.boolValue;
        return ev.stringValue ?? '';
      }));
      cache.set(key, { at: Date.now(), rows });
      return rows.map((r) => r.slice());
    },
    async write(book, sheet, mutate) {
      // Se aplica la mutación sobre la lectura actual y se escribe el bloque completo (simple y seguro
      // para los volúmenes de COI V1). Las eliminaciones de fila usan deleteDimension.
      const before = await this.read(book, sheet);
      const after = before.map((r) => r.slice());
      mutate(after);
      cache.delete(book + '/' + sheet);
      if (after.length < before.length) {
        const props = (meta.get(book) || await loadMeta(book)).find((s) => s.title === sheet);
        const idx = before.findIndex((r, i) => JSON.stringify(r) !== JSON.stringify(after[i]));
        await call(book, ':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ deleteDimension: { range: { sheetId: props.sheetId, dimension: 'ROWS', startIndex: idx, endIndex: idx + before.length - after.length } } }] }) });
        return;
      }
      const values = after.map((r) => r.map(toCell));
      await call(book, '/values/' + encodeURIComponent(q(sheet) + '!A1') + '?valueInputOption=USER_ENTERED', { method: 'PUT', body: JSON.stringify({ values }) });
    }
  };
}
