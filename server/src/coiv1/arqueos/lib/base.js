// ============================================================
// MULTIVAL - CONTROL DE ARQUEOS  (Backend GAS v6.1 portado a Node)
// ------------------------------------------------------------
// Secciones 0, 1 y 5 de Código.gs: configuracion, infraestructura de
// rendimiento (cache / memoria / version) y helpers generales.
// Diferencias con Apps Script (solo de plataforma, no de negocio):
//  - Todo lo que toca hojas es asincrono (await).
//  - La "memoria por ejecucion" (_MEMO) vive en un AsyncLocalStorage: cada
//    llamada RPC arranca con memoria vacia, igual que google.script.run.
//  - CacheService guarda el JSON directo (Node no tiene el limite de 100 KB,
//    por eso no se comprime ni se fragmenta). La semantica de version
//    ARQ_VER se conserva tal cual.
//  - Las carpetas de Drive son rutas logicas para DriveFiles.save().
// ============================================================
import { AsyncLocalStorage } from 'node:async_hooks';
import { SpreadsheetApp } from '../../spreadsheet.js';
import { ID_EXCEL_PRINCIPAL, DIRECTORIO_ID as DIR_ID } from '../../books.js';
import { Utilities, CacheService, PropertiesService, Logger } from '../../gas.js';

// ============================================================
// 1. CONFIGURACION
// ============================================================
export const SPREADSHEET_ID = ID_EXCEL_PRINCIPAL;

// --- Directorio Nacional (insumo maestro de oficinas) --------
export const DIRECTORIO_ID   = DIR_ID;
export const DIRECTORIO_HOJA = 'DIRECTORIO NACIONAL';
export const DIR_COL = {
  OFICINA:    4,   // D
  LIDER:     25,   // Y
  MEDIO_PAGO:38,   // AL
  ATM:       54    // BB
};

/**
 * Columnas adicionales del Directorio Nacional que se usan en los dashboards
 * por cliente / regional / zona. Se detectan AUTOMATICAMENTE por el texto del
 * encabezado (fila 1). 0 = detectar.
 */
export const DIR_COL_FIJAS = { CLIENTE: 0, REGIONAL: 0, ZONA: 0, PROPIA: 0, USD: 0 };

/** Patrones de encabezado (ya normalizados en mayusculas sin tildes). */
export const DIR_COL_AUTO = {
  CLIENTE:  [/^CLIENTE$/, /^CLIENTE\b/, /\bCLIENTE\b/, /^BANCO$/, /^ENTIDAD$/, /^MARCA$/],
  REGIONAL: [/^REGIONAL$/, /^REGIONAL\b/, /\bREGIONAL\b/],
  ZONA:     [/^ZONA$/, /^ZONA\b/, /\bZONA\b/],
  PROPIA:   [/^PROPIA$/, /OFICINA PROPIA/, /^TIPO (DE )?OFICINA$/, /^PROPIA\b/],
  USD:      [/MONEDA EXTRANJERA/, /\bDOLAR/, /\bUSD\b/, /\bDIVISA/]
};

/** Clientes cuyas oficinas se consideran PROPIAS de la red. */
export const CLIENTES_PROPIOS = ['MULTIPAGAS', 'REVAL', 'MULTIVAL'];

/** Oficinas que manejan moneda extranjera aunque el Directorio no lo indique. */
export const OFICINAS_USD_PATRON = /\bITAU\b|\bITAÚ\b/i;

export const DIR_CACHE_SEG = 900; // 15 min de cache del directorio

export const FOLDER_NAME  = 'Arqueos_Multival';
export const META_MENSUAL = 30;
export const DIAS_LIMITE  = 2;
export const TZ           = 'GMT-5';

// Codigos oficiales de formato
export const FMT = {
  EFECTIVO: 'FOR-GOR-020-09',
  CHEQUES : 'FOR-GOR-048-01',
  ATM     : 'FOR-GOR-099-02'
};
// Que formatos suman a la meta mensual del lider.
export const FORMATOS_CUENTAN_META = [FMT.EFECTIVO, FMT.ATM];

// Filas minimas que se imprimen en la grilla del formato de cheques.
export const FILAS_MIN_CHEQUES = 15;

/** Tope duro de formatos ATM por oficina (BB trae el CODIGO del cajero, no una cantidad). */
export const MAX_ATM_POR_OFICINA = 6;

/** Valores de la columna BB que significan "esta oficina no tiene cajero". */
export const ATM_VALORES_NULOS = ['', '0', '0.0', 'NO', 'NO APLICA', 'N/A', 'NA', 'N/D',
  'NINGUNO', 'SIN CAJERO', 'SIN ATM', 'FALSE', 'FALSO', '-', '--', '.'];

/** Distintivo de visita (columna W). */
export const VISITA = {
  PRIMERA:   'PRIMERA VISITA',
  ADICIONAL: 'VISITA ADICIONAL'
};

/** Mes de corte para el calculo RETROACTIVO del distintivo (ver Código.gs). */
export const CORTE_VISITAS_ADICIONALES = '2026-09';

// Esquema de la hoja Arqueos (v6 = 38 columnas)
export const ARQ_HEADERS = ['ID', 'Timestamp', 'ID_Usuario', 'Oficina', 'Fecha_Arqueo_Real',
  'Elemento', 'Numero_Elem', 'Tipo_Arqueo', 'Extemporaneo', 'Dias_Habiles', 'URL_Archivo',
  'Monto_Teorico', 'Monto_Fisico', 'Diferencia', 'Novedad', 'Observaciones', 'Detalle',
  'Modalidad', 'Formato', 'ID_Sesion', 'URL_PDF', 'URL_Tirillas', 'Tipo_Visita',
  // ---- v6: gestion de novedades del analista ----
  'Obs_Analista', 'Estado_Revision', 'Revisor', 'Fecha_Revision',
  'Respuesta_Lider', 'URL_Correccion', 'Fecha_Correccion',
  'Explicacion_Solicitada', 'Explicacion_Lider', 'Tipologia', 'Estado_Diferencia', 'Fecha_Explicacion',
  // ---- v6: moneda extranjera ----
  'USD_Fisico', 'USD_Sistema', 'USD_Diferencia'];
export const ARQ_NCOL = ARQ_HEADERS.length; // 38

/** Indices 0-based de la hoja Arqueos. */
export const AC = {
  ID: 0, TS: 1, USUARIO: 2, OFICINA: 3, FECHA: 4, ELEMENTO: 5, NUM_ELEM: 6, TIPO_ARQ: 7,
  EXTEMPO: 8, DIAS: 9, URL: 10, TEORICO: 11, FISICO: 12, DIF: 13, NOVEDAD: 14, OBS: 15,
  DETALLE: 16, MODALIDAD: 17, FORMATO: 18, SESION: 19, URL_PDF: 20, URL_TIR: 21, TIPO_VISITA: 22,
  OBS_ANALISTA: 23, ESTADO_REV: 24, REVISOR: 25, FECHA_REV: 26,
  RESP_LIDER: 27, URL_CORR: 28, FECHA_CORR: 29,
  EXPL_SOLIC: 30, EXPL_LIDER: 31, TIPOLOGIA: 32, ESTADO_DIF: 33, FECHA_EXPL: 34,
  USD_FISICO: 35, USD_SISTEMA: 36, USD_DIF: 37
};

/** Estados de revision del soporte (columna Estado_Revision). */
export const REV = {
  SIN_REVISAR: '',
  NOVEDAD:     'NOVEDAD SOPORTE',
  CORREGIDO:   'CORREGIDO',
  OK:          'OK'
};

/** Estados de la gestion de faltantes / sobrantes (columna Estado_Diferencia). */
export const DIFE = {
  PENDIENTE:    'PENDIENTE EXPLICACION',
  RECUPERADO:   'RECUPERADO',
  NO_RECUPERADO:'NO RECUPERADO',
  CRUZADO:      'CRUZADO / COMPENSADO',
  NO_CRUZADO:   'NO COMPENSADO'
};

/** Tipologias por defecto (se pueden ampliar en la hoja Tipologias). */
export const TIPOLOGIAS_DEFECTO = [
  'Error de conteo', 'Error de digitacion / registro en sistema', 'Transaccion sin aplicar en sistema',
  'Consignacion sin registrar', 'Error en entrega de cambio / vueltos', 'Billete falso o deteriorado',
  'Diferencia en tirilla / fallo tecnico ATM', 'Dispensacion fallida ATM', 'Fraude o hurto',
  'Faltante de cliente / tercero', 'Otra'
];

/** Umbral para los graficos de "mayores / menores a $1.000.000". */
export const UMBRAL_MILLON = 1000000;

/** Denominaciones disponibles para los cajeros automaticos (incluye $100.000). */
export const DENOMINACIONES_ATM = [2000, 5000, 10000, 20000, 50000, 100000];

/** Correo opcional con copia de las notificaciones (vacio = sin copia). */
export const CORREO_COPIA_NOTIFICACIONES = '';

// ---- Rendimiento ----
export const CACHE_TTL_ARQ      = 600;   // 10 min
export const CACHE_TTL_RES      = 600;   // 10 min
export const CACHE_TTL_USUARIOS = 300;   // 5 min
export const CACHE_TTL_FESTIVOS = 21600; // 6 h
/** true = registra cada consulta (ms, cache) en la hoja "Rendimiento". */
export const MEDIR_RENDIMIENTO  = false;


// ============================================================
// 0. INFRAESTRUCTURA DE RENDIMIENTO (cache, memoria, version)
// ============================================================
/** Memoria de la ejecucion actual (se reinicia en cada llamada RPC). */
const _ALS = new AsyncLocalStorage();
export function _MEMO() { return _ALS.getStore() || {}; }

/** Envuelve una funcion publica: cada llamada tiene su propia memoria (como google.script.run). */
export function ejecucion_(fn) {
  return (...args) => _ALS.run({}, () => fn(...args));
}

/** memo_ guarda el valor (o la promesa) calculado una sola vez por ejecucion. */
export function memo_(clave, fn) {
  const m = _MEMO();
  if (!Object.prototype.hasOwnProperty.call(m, clave)) m[clave] = fn();
  return m[clave];
}

/** Spreadsheet principal abierto una sola vez por ejecucion. */
export function ss_() { return memo_('SS', () => SpreadsheetApp.openById(SPREADSHEET_ID)); }

/**
 * Guarda un objeto JSON en la cache. En Apps Script se comprimia con gzip y se
 * fragmentaba en bloques de 90 KB por el limite de 100 KB por valor; en Node no
 * hay ese limite, asi que se guarda el JSON directo.
 */
export function cachePutJson_(clave, obj, seg) {
  try {
    CacheService.getScriptCache().put(clave, JSON.stringify(obj), Math.min(seg, 21600));
    return true;
  } catch (e) {
    Logger.log('cachePutJson_ ' + clave + ': ' + e);
    return false;
  }
}

/** Lee un objeto guardado con cachePutJson_. null si no existe. */
export function cacheGetJson_(clave) {
  try {
    const v = CacheService.getScriptCache().get(clave);
    return v === null || v === undefined ? null : JSON.parse(v);
  } catch (e) {
    Logger.log('cacheGetJson_ ' + clave + ': ' + e);
    return null;
  }
}

export function cacheRemove_(clave) { try { CacheService.getScriptCache().remove(clave); } catch (e) { /* nada */ } }

/** Hash corto para claves de cache. */
export function hashClave_(txt) {
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, String(txt), Utilities.Charset.UTF_8);
  return d.map(b => ((b + 256) % 256).toString(16).padStart(2, '0')).join('');
}

/** Version de los datos de arqueos. Cambia con cada escritura hecha desde la app. */
export function versionArqueos_() {
  return memo_('VER', () => PropertiesService.getScriptProperties().getProperty('ARQ_VER') || '0');
}

let _ultimaVersion = 0;
/** Invalida toda la cache derivada de la hoja Arqueos (se llama despues de escribir). */
export function invalidarCacheArqueos_() {
  // Version estrictamente creciente (dos escrituras en el mismo milisegundo no deben compartirla).
  _ultimaVersion = Math.max(new Date().getTime(), _ultimaVersion + 1);
  const v = String(_ultimaVersion);
  try { PropertiesService.getScriptProperties().setProperty('ARQ_VER', v); } catch (e) { /* nada */ }
  const m = _MEMO();
  m.VER = v;
  delete m.ARQ_ALL;
  delete m.VIS_ROWS;
  delete m.NORM_MAP;
}

/**
 * Cache de resultados de endpoints. El alcance es el lider (si el rol es Lider)
 * o la red completa (Regional / Analista ven los mismos datos). La clave incluye
 * la version de datos y el dia, porque los dias habiles dependen de la fecha.
 */
export async function conCacheResultado_(nombre, idUsuario, rol, partes, fn) {
  const t0 = new Date().getTime();
  const alcance = norm_(rol) === 'LIDER' ? 'L-' + String(idUsuario || '').trim() : 'RED';
  const clave = 'RES_' + hashClave_([nombre, alcance, (partes || []).join('|'), await versionArqueos_(), hoyCol_()].join('~'));
  const hit = cacheGetJson_(clave);
  if (hit !== null) { registrarRendimiento_(nombre, t0, true); return hit; }
  const res = await fn();
  const valido = res !== null && res !== undefined && !(res && (res.error || res.success === false));
  if (valido) cachePutJson_(clave, res, CACHE_TTL_RES);
  registrarRendimiento_(nombre, t0, false);
  return res;
}

export function registrarRendimiento_(nombre, t0, deCache) {
  const ms = new Date().getTime() - t0;
  Logger.log('[COI] ' + nombre + ' ' + ms + ' ms' + (deCache ? ' (cache)' : ''));
  if (!MEDIR_RENDIMIENTO) return;
  // (La hoja "Rendimiento" no se usa en la version Node.)
}


// ============================================================
// 5. HELPERS
// ============================================================
export function parseFecha_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (v === null || v === undefined || v === '') return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) { const d = new Date(+m[1], +m[2] - 1, +m[3], 12); return isNaN(d) ? null : d; }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) { const d = new Date(+m[3], +m[2] - 1, +m[1], 12); return isNaN(d) ? null : d; }
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) { const d = new Date(+m[3], +m[2] - 1, +m[1], 12); return isNaN(d) ? null : d; }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export function fmtF_(d, patron) { return d ? Utilities.formatDate(d, TZ, patron) : '—'; }

/** Dia de HOY en Colombia como 'yyyy-MM-dd'. */
export function hoyCol_() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}

/**
 * Normaliza cualquier entrada de fecha al dia calendario colombiano 'yyyy-MM-dd'.
 * Para el texto ISO del <input type="date"> se toman los componentes tal cual.
 */
export function diaCol_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  }
  const s = String(v === null || v === undefined ? '' : v).trim();
  const z = n => String(n).padStart(2, '0');

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);          // ISO (input date)
  if (m) return m[1] + '-' + z(m[2]) + '-' + z(m[3]);

  m = s.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})/);      // dd/mm/yyyy o dd.mm.yyyy
  if (m) return m[3] + '-' + z(m[2]) + '-' + z(m[1]);

  const d = parseFecha_(v);
  return d ? Utilities.formatDate(d, TZ, 'yyyy-MM-dd') : '';
}

export function norm_(v) {
  return String(v === null || v === undefined ? '' : v)
    .trim().toUpperCase()
    .replace(/[ÁÀÄÂ]/g, 'A').replace(/[ÉÈËÊ]/g, 'E').replace(/[ÍÌÏÎ]/g, 'I')
    .replace(/[ÓÒÖÔ]/g, 'O').replace(/[ÚÙÜÛ]/g, 'U').replace(/Ñ/g, 'N')
    .replace(/\s+/g, ' ');
}

export function esc_(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function num_(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

export function money_(n) {
  const v = Math.round(num_(n));
  return '$ ' + v.toLocaleString('es-CO');
}

export function ajustarFila_(fila) {
  const f = (fila || []).slice(0, ARQ_NCOL);
  while (f.length < ARQ_NCOL) f.push('');
  return f;
}

/** Numero de columna (1 = A) -> letra de columna. */
export function colLetra_(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

/**
 * Carpeta de Drive por ruta jerarquica: getCarpeta_(['Arqueos_Multival','2026-08','OFICINA']).
 * En Node devuelve la ruta logica que recibe DriveFiles.save({ folder }).
 */
export function getCarpeta_(ruta) {
  return ruta.map(nombre => String(nombre).replace(/[\\/:*?"<>|]/g, '-').trim() || 'SIN_NOMBRE').join('/');
}

/** Bytes de un base64 que llega del navegador (acepta tambien el prefijo data:...;base64,). */
export function bytesBase64_(b64) {
  return Buffer.from(String(b64 || '').replace(/^data:[^,]*,/, ''), 'base64');
}
