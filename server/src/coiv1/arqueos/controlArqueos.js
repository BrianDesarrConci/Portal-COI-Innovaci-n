// ============================================================
// MULTIVAL - CONTROL DE ARQUEOS  (Backend GAS v6.1 portado a Node)
// ------------------------------------------------------------
// Port 1:1 de docs/referencia-coi-v1/control-arqueos/Código.gs.
// Mismos nombres de funcion, mismos parametros y mismas formas de respuesta.
// La numeracion de secciones es la de Código.gs para poder compararlos.
//   - Secciones 0, 1 y 5 (configuracion, cache, helpers) -> lib/base.js
//   - Seccion 8 (formatos PDF FOR-GOR-*)                 -> lib/formatos.js
// Roles: Lider / Regional / Analista. Meta: 30 arqueos VALIDOS por lider/mes.
// ============================================================
import { SpreadsheetApp } from '../spreadsheet.js';
import { Utilities, Session, Logger, LockService, MailApp, DriveFiles } from '../gas.js';
import {
  SPREADSHEET_ID, DIRECTORIO_ID, DIRECTORIO_HOJA, DIR_COL, DIR_COL_FIJAS, DIR_COL_AUTO, CLIENTES_PROPIOS,
  OFICINAS_USD_PATRON, DIR_CACHE_SEG, FOLDER_NAME, META_MENSUAL, DIAS_LIMITE, TZ, FMT, MAX_ATM_POR_OFICINA,
  ATM_VALORES_NULOS, VISITA, ARQ_NCOL, AC, REV, DIFE, TIPOLOGIAS_DEFECTO, UMBRAL_MILLON, CORREO_COPIA_NOTIFICACIONES,
  CACHE_TTL_ARQ, CACHE_TTL_USUARIOS, CACHE_TTL_FESTIVOS,
  _MEMO, ejecucion_, memo_, ss_, cachePutJson_, cacheGetJson_, cacheRemove_, invalidarCacheArqueos_, versionArqueos_,
  conCacheResultado_, parseFecha_, fmtF_, hoyCol_, diaCol_, norm_, esc_, num_, ajustarFila_, getCarpeta_, bytesBase64_
} from './lib/base.js';
import { htmlFormatoEfectivo_, htmlFormatoCheques_, htmlFormatoAtm_, nombrePdf_, crearPdf_ } from './lib/formatos.js';

/**
 * Limpia TODA la cache (directorio, usuarios, festivos, arqueos y resultados).
 */
function limpiarCache() {
  ['DIR_NAL_V7', 'DIR_NAL_V6', 'DIR_NAL_V5', 'USR_V7', 'FEST_V7'].forEach(cacheRemove_);
  invalidarCacheArqueos_();
  return 'Cache limpiada: la proxima consulta relee todas las hojas.';
}


// ============================================================
// 4. LOGIN
// ============================================================
// Estructura Usuarios: Usuario(0) Password(1) Rol(2) Correo(3) Estado(4)
//                      llave_arqueos(5) Nombre_Directorio(6, opcional)
// ------------------------------------------------------------
function rolDesdeLlave_(llave) {
  const r = norm_(llave);
  if (r === 'LIDER')    return 'Lider';
  if (r === 'REGIONAL') return 'Regional';
  if (r === 'ANALISTA') return 'Analista';
  return '';
}

function filaAUsuario_(fila) {
  return {
    success: true,
    rol: rolDesdeLlave_(fila[5]),
    idUsuario: String(fila[0]).trim(),
    nombre: String(fila[6] || fila[0] || '').trim(),
    correo: String(fila[3] || '').trim(),
    idRegional: ''
  };
}

async function validarLogin(usuario, password) {
  try {
    // Seguridad (Node): una contrasena vacia nunca autentica (la copia de demostracion no trae claves).
    if (password === null || password === undefined || !String(password).trim()) return { success: false, message: 'Credenciales invalidas' };
    const data = await SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Usuarios').getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(usuario).trim() &&
          String(data[i][1]).trim() !== '' &&
          String(data[i][1]).trim() === String(password).trim()) {

        if (norm_(data[i][4]) === 'INACTIVO') return { success: false, message: 'Usuario inactivo en el sistema.' };
        if (!String(data[i][5] || '').trim())  return { success: false, message: 'No tienes llave de arqueos asignada.' };

        const u = filaAUsuario_(data[i]);
        if (!u.rol) return { success: false, message: 'La llave de arqueos asignada no es valida.' };
        return u;
      }
    }
    return { success: false, message: 'Credenciales invalidas' };
  } catch (e) {
    return { success: false, message: 'Error de conexion con la base de usuarios: ' + e.toString() };
  }
}

async function validarEmbebido(usuario, llaveParam) {
  try {
    const data = await SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Usuarios').getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(usuario).trim() &&
          String(data[i][5]).trim() === String(llaveParam).trim()) {
        if (norm_(data[i][4]) === 'INACTIVO') return { success: false, message: 'Usuario inactivo en el sistema.' };
        const u = filaAUsuario_(data[i]);   // nunca incluye la contrasena
        if (!u.rol) return { success: false, message: 'La llave de arqueos asignada no es valida.' };
        return u;
      }
    }
    return { success: false, message: 'Acceso denegado. Llave de arqueo incorrecta.' };
  } catch (e) {
    return { success: false, message: 'Error de conexion: ' + e.toString() };
  }
}


// ============================================================
// 5. HELPERS (festivos y dias habiles)
// ============================================================
function getFestivos_() {
  return memo_('FEST', async function () {
    const hit = cacheGetJson_('FEST_V7');
    if (hit) return hit;
    const sh = ss_().getSheetByName('Festivos');
    if (!sh) return {};
    const vals = await sh.getDataRange().getValues();
    const set = {};
    for (let i = 1; i < vals.length; i++) {
      const d = parseFecha_(vals[i][0]);
      if (d) set[Utilities.formatDate(d, TZ, 'yyyy-MM-dd')] = true;
    }
    cachePutJson_('FEST_V7', set, CACHE_TTL_FESTIVOS);
    return set;
  });
}

/**
 * Dias habiles entre dos fechas, contados sobre el CALENDARIO COLOMBIANO.
 * Se normaliza cada extremo a 'yyyy-MM-dd' y se itera en UTC.
 * Acepta Date o texto ('yyyy-MM-dd', 'dd/mm/yyyy').
 */
async function calcularDiasHabiles(fechaInicial, fechaFinal) {
  const dIni = diaCol_(fechaInicial);
  const dFin = diaCol_(fechaFinal);
  if (!dIni || !dFin) return 0;
  if (dIni > dFin) return 0;

  const festivos = await getFestivos_();
  const MS_DIA = 86400000;
  let cur = new Date(dIni + 'T00:00:00Z').getTime();
  const fin = new Date(dFin + 'T00:00:00Z').getTime();

  let count = 0;
  while (cur <= fin) {
    const d = new Date(cur);
    const dow = d.getUTCDay();                       // 0 = domingo, 6 = sabado
    const key = d.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !festivos[key]) count++;
    cur += MS_DIA;
  }
  return count > 0 ? count - 1 : 0;
}


// ============================================================
// 6. DIRECTORIO NACIONAL  (insumo maestro de oficinas)
// ============================================================
/** Lee la hoja DIRECTORIO NACIONAL y devuelve las oficinas normalizadas (cache 15 min). */
function getDirectorio_(forzar) {
  const M = _MEMO();
  if (!forzar && M.DIR) return M.DIR;
  M.DIR = (async () => {
    if (!forzar) {
      const hit = cacheGetJson_('DIR_NAL_V7');
      if (hit) return hit;
    }
    const out = await leerDirectorioHoja_();
    cachePutJson_('DIR_NAL_V7', out, DIR_CACHE_SEG);
    return out;
  })();
  return M.DIR;
}

/** Valor "como se ve" en la hoja (V1 lee con getDisplayValues). */
function displayValue_(v) {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : Utilities.formatDate(v, TZ, 'd/MM/yyyy');
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v);
}

/**
 * Devuelve SOLO las columnas que usa el sistema, como texto (equivale a
 * getDisplayValues / Values.batchGet con FORMATTED_VALUE). En Node se toma de
 * una sola lectura de la hoja.
 */
function leerColumnasDisplay_(valores, cols, filas) {
  const res = {};
  if (filas < 1) { cols.forEach(c => res[c] = []); return res; }
  cols.forEach(c => {
    const col = new Array(filas);
    for (let i = 0; i < filas; i++) col[i] = displayValue_((valores[i + 1] || [])[c - 1]);
    res[c] = col;
  });
  return res;
}

async function leerDirectorioHoja_() {
  const ss = SpreadsheetApp.openById(DIRECTORIO_ID);
  const sh = ss.getSheetByName(DIRECTORIO_HOJA);
  if (!sh) throw new Error('No se encontro la hoja "' + DIRECTORIO_HOJA + '" en la BD del Directorio Nacional.');

  const todo = await sh.getDataRange().getValues();
  const ultima = todo.length;
  if (ultima < 2) return [];

  const anchoMin = Math.max(DIR_COL.OFICINA, DIR_COL.LIDER, DIR_COL.MEDIO_PAGO, DIR_COL.ATM);
  const ancho = Math.max(todo.reduce((m, r) => Math.max(m, r.length), 0), anchoMin);
  const encabezado = [];
  for (let c = 0; c < ancho; c++) encabezado.push(displayValue_((todo[0] || [])[c]));
  const extra = detectarColumnasDirectorio_(encabezado);

  // Solo las columnas necesarias.
  const cols = [DIR_COL.OFICINA, DIR_COL.LIDER, DIR_COL.MEDIO_PAGO, DIR_COL.ATM];
  Object.keys(extra).forEach(k => { const c = extra[k]; if (c > 0 && c <= ancho && cols.indexOf(c) < 0) cols.push(c); });
  const datosCol = leerColumnasDisplay_(todo, cols, ultima - 1);
  const valores = [];
  for (let i = 0; i < ultima - 1; i++) {
    const fila = new Array(ancho);
    for (let k = 0; k < cols.length; k++) {
      const v = datosCol[cols[k]][i];
      fila[cols[k] - 1] = (v === undefined || v === null) ? '' : v;
    }
    valores.push(fila);
  }

  const out = [];
  const vistos = {};
  for (let i = 0; i < valores.length; i++) {
    const fila = valores[i];
    const oficina = String(fila[DIR_COL.OFICINA - 1] || '').trim();
    if (!oficina) continue;

    const lider      = String(fila[DIR_COL.LIDER - 1] || '').trim();
    const medioPago  = String(fila[DIR_COL.MEDIO_PAGO - 1] || '').trim();
    const atmRaw     = String(fila[DIR_COL.ATM - 1] || '').trim();
    const celda = c => (c > 0 && c <= fila.length) ? String(fila[c - 1] || '').trim() : '';

    const clienteRaw  = celda(extra.CLIENTE);
    const cliente     = clienteRaw || inferirCliente_(oficina);
    const regional    = celda(extra.REGIONAL) || 'SIN REGIONAL';
    const zona        = celda(extra.ZONA) || 'SIN ZONA';
    const propiaRaw   = celda(extra.PROPIA);
    const propia      = propiaRaw ? esAfirmativo_(propiaRaw) || /PROPIA/.test(norm_(propiaRaw))
                                  : CLIENTES_PROPIOS.indexOf(norm_(cliente).split(' ')[0]) >= 0;
    const usdRaw      = celda(extra.USD);
    const usd         = usdRaw ? esAfirmativo_(usdRaw) : OFICINAS_USD_PATRON.test(oficina);

    // Si la misma oficina aparece varias veces, se consolida.
    const clave = norm_(oficina);
    const req = requisitosDeOficina_(medioPago, atmRaw);

    if (vistos[clave] !== undefined) {
      const prev = out[vistos[clave]];
      if (!prev.lider && lider) prev.lider = lider;
      prev.requiere.efectivo = prev.requiere.efectivo || req.efectivo;
      prev.requiere.cheques  = prev.requiere.cheques  || req.cheques;
      prev.requiere.atm      = prev.requiere.atm      || req.atm;
      prev.requiere.sinParametrizar = prev.requiere.sinParametrizar && req.sinParametrizar;
      // Se unen los codigos de cajero de todas las filas de la misma oficina, sin duplicar.
      const yaTiene = {};
      prev.requiere.codigosATM.forEach(function (c) { yaTiene[norm_(c)] = true; });
      req.codigosATM.forEach(function (c) {
        if (!yaTiene[norm_(c)] && prev.requiere.codigosATM.length < MAX_ATM_POR_OFICINA) {
          yaTiene[norm_(c)] = true;
          prev.requiere.codigosATM.push(c);
        }
      });
      prev.requiere.numATM = prev.requiere.codigosATM.length;
      if (!prev.medioPago && medioPago) prev.medioPago = medioPago;
      if (!prev.atmValor && atmRaw)     prev.atmValor  = atmRaw;
      else if (atmRaw && prev.atmValor.indexOf(atmRaw) < 0) prev.atmValor += ' / ' + atmRaw;
      if (prev.regional === 'SIN REGIONAL' && regional !== 'SIN REGIONAL') prev.regional = regional;
      if (prev.zona === 'SIN ZONA' && zona !== 'SIN ZONA') prev.zona = zona;
      prev.usd = prev.usd || usd;
      continue;
    }

    vistos[clave] = out.length;
    out.push({
      fila: i + 2,
      oficina: oficina,
      lider: lider,
      medioPago: medioPago,
      atmValor: atmRaw,
      cliente: cliente,
      regional: regional,
      zona: zona,
      propia: !!propia,
      usd: !!usd,
      requiere: req
    });
  }

  return out;
}

/** Localiza en la fila de encabezados las columnas CLIENTE / REGIONAL / ZONA / PROPIA / USD. */
function detectarColumnasDirectorio_(encabezado) {
  const res = {};
  const heads = (encabezado || []).map(h => norm_(h));
  Object.keys(DIR_COL_AUTO).forEach(function (k) {
    if (DIR_COL_FIJAS[k] > 0) { res[k] = DIR_COL_FIJAS[k]; return; }
    let col = 0;
    const patrones = DIR_COL_AUTO[k];
    for (let p = 0; p < patrones.length && !col; p++) {
      for (let i = 0; i < heads.length; i++) {
        if (heads[i] && patrones[p].test(heads[i])) { col = i + 1; break; }
      }
    }
    res[k] = col;
  });
  return res;
}

/** Deduce el cliente a partir del nombre de la oficina ("BANCO BOGOTA RIOSUCIO" -> "BANCO BOGOTA"). */
function inferirCliente_(oficina) {
  const tk = norm_(oficina).replace(/[^A-Z0-9 ]/g, ' ').split(' ').filter(Boolean);
  if (!tk.length) return 'SIN CLIENTE';
  if ((tk[0] === 'BANCO' || tk[0] === 'BCO' || tk[0] === 'BANCA') && tk.length > 1) return tk[0] + ' ' + tk[1];
  return tk[0];
}

function esAfirmativo_(v) {
  const n = norm_(v);
  return n === 'SI' || n === 'S' || n === 'X' || n === 'TRUE' || n === 'VERDADERO' || n === '1' || n === 'APLICA';
}

/** Informacion de contexto de los dashboards: clientes, regionales y zonas disponibles. */
function catalogoDirectorio_(dir) {
  const c = {}, r = {}, z = {};
  dir.forEach(o => { c[o.cliente] = true; r[o.regional] = true; z[o.zona] = true; });
  const ord = obj => Object.keys(obj).sort((a, b) => a.localeCompare(b, 'es'));
  return { clientes: ord(c), regionales: ord(r), zonas: ord(z) };
}

function limpiarCacheDirectorio() {
  ['DIR_NAL_V7', 'DIR_NAL_V6', 'DIR_NAL_V5'].forEach(cacheRemove_);
  delete _MEMO().DIR;
  invalidarCacheArqueos_();
  return 'Cache del Directorio Nacional limpiado. La proxima consulta releera la BD.';
}

/**
 * Traduce MEDIO DE PAGO (col AL) y ATM (col BB) a los formatos exigidos.
 *  - "EFECTIVO"           -> FOR-GOR-020-09
 *  - "EFECTIVO Y CHEQUE"  -> FOR-GOR-020-09 + FOR-GOR-048-01 (ambos obligatorios)
 *  - vacio / #N/A         -> sin exigencia de efectivo (se marca sinParametrizar)
 *  - ATM = "Cajero" o codigo -> FOR-GOR-099-02 obligatorio (con tirillas PDF)
 */
function requisitosDeOficina_(medioPago, atmRaw) {
  const mp = norm_(medioPago);
  const req = { efectivo: false, cheques: false, atm: false, numATM: 0, sinParametrizar: false };

  const mpValido = mp && mp.indexOf('#N/A') < 0 && mp !== 'N/A';
  if (mpValido && mp.indexOf('EFECTIVO') >= 0 && mp.indexOf('CHEQUE') >= 0) {
    req.efectivo = true; req.cheques = true;
  } else if (mpValido && mp.indexOf('EFECTIVO') >= 0) {
    req.efectivo = true;
  } else {
    req.sinParametrizar = true;
  }

  const codigos = atmCodigos_(atmRaw);
  req.atm       = codigos.length > 0;
  req.codigosATM = codigos;
  req.numATM    = codigos.length;

  return req;
}

/**
 * Interpreta la columna BB "ATM" y devuelve la lista de cajeros de la oficina.
 * IMPORTANTE: el contenido de BB es el IDENTIFICADOR del cajero, no una cantidad.
 */
function atmCodigos_(atmRaw) {
  const txt = String(atmRaw == null ? '' : atmRaw).trim();
  if (!txt) return [];

  const plano = norm_(txt);
  if (ATM_VALORES_NULOS.indexOf(plano) >= 0) return [];
  if (plano.indexOf('#N/') === 0 || plano.indexOf('#REF') === 0 ||
      plano.indexOf('#VALUE') === 0 || plano.indexOf('#VALOR') === 0) return [];

  // Caso "N cajeros" / "N ATM": aqui el numero SI es una cantidad.
  const mCant = plano.match(/^(\d{1,2})\s*(CAJEROS?|ATMS?)$/);
  if (mCant) {
    const n = Math.min(Math.max(parseInt(mCant[1], 10), 0), MAX_ATM_POR_OFICINA);
    const lista = [];
    for (let k = 1; k <= n; k++) lista.push('Cajero ' + k);
    return lista;
  }

  // Caso general: uno o varios codigos separados por , ; / | o salto de linea.
  const partes = txt.split(/[,;|\/\n\r]+|\s+Y\s+|\s+y\s+/);
  const out = [];
  const vistos = {};
  for (let i = 0; i < partes.length; i++) {
    const p = String(partes[i]).trim();
    if (!p) continue;
    const clave = norm_(p);
    if (ATM_VALORES_NULOS.indexOf(clave) >= 0) continue;
    if (vistos[clave]) continue;
    vistos[clave] = true;
    out.push(p);
    if (out.length >= MAX_ATM_POR_OFICINA) break;
  }
  return out;
}

/**
 * Usuarios y alias leidos UNA vez por ejecucion y cacheados unos minutos.
 * Nunca se cachea la contrasena.
 * Devuelve { usuarios: [{id, correo, estado, llave, nombreDir}], alias: {id: [nombres]} }
 */
function datosUsuarios_() {
  return memo_('USR', async function () {
    const hit = cacheGetJson_('USR_V7');
    if (hit) return hit;
    const ss = ss_();
    const data = await ss.getSheetByName('Usuarios').getDataRange().getValues();
    const usuarios = [];
    for (let i = 1; i < data.length; i++) {
      if (!String(data[i][0] || '').trim()) continue;
      usuarios.push({ id: String(data[i][0]).trim(), correo: String(data[i][3] || '').trim(),
        estado: String(data[i][4] || '').trim(), llave: String(data[i][5] || '').trim(),
        nombreDir: String(data[i][6] || '').trim() });
    }
    const alias = {};
    try {
      const alSh = ss.getSheetByName('Alias_Lideres');
      const ult = alSh ? await alSh.getLastRow() : 0;
      if (alSh && ult >= 2) {
        const al = await alSh.getRange(2, 1, ult - 1, 2).getValues();
        for (let i = 0; i < al.length; i++) {
          const id = String(al[i][0] || '').trim(), nom = String(al[i][1] || '').trim();
          if (id && nom) { if (!alias[id]) alias[id] = []; alias[id].push(nom); }
        }
      }
    } catch (e) { /* la hoja de alias es opcional */ }
    const res = { usuarios: usuarios, alias: alias };
    cachePutJson_('USR_V7', res, CACHE_TTL_USUARIOS);
    return res;
  });
}

/** Perfil de cruce del usuario contra la columna LIDER DE EXCELENCIA. */
function perfilCruce_(idUsuario) {
  const id = String(idUsuario || '').trim();
  return memo_('PERFIL_' + id, function () { return construirPerfil_(id); });
}

async function construirPerfil_(id) {
  const datos = await datosUsuarios_();
  const perfil = { id: id, nombre: '', correo: '', claves: [], tokens: [] };

  for (let i = 0; i < datos.usuarios.length; i++) {
    if (datos.usuarios[i].id === perfil.id) {
      perfil.nombre = datos.usuarios[i].nombreDir;
      perfil.correo = datos.usuarios[i].correo;
      break;
    }
  }

  const candidatos = [perfil.id, perfil.nombre];
  if (perfil.correo && perfil.correo.indexOf('@') > 0) {
    candidatos.push(perfil.correo.split('@')[0].replace(/[._-]+/g, ' '));
  }

  // Alias explicitos configurados por el analista
  (datos.alias[perfil.id] || []).forEach(n => candidatos.push(n));

  candidatos.forEach(c => {
    const n = norm_(c);
    if (!n) return;
    if (perfil.claves.indexOf(n) < 0) perfil.claves.push(n);
    const tk = n.split(' ').filter(t => t.length >= 3);
    if (tk.length >= 2) perfil.tokens.push(tk);
  });

  return perfil;
}

/** Decide si el valor de la columna Y corresponde al usuario logueado. */
function coincideLider_(valorDirectorio, perfil) {
  const v = norm_(valorDirectorio);
  if (!v) return false;

  // 1. Coincidencia exacta con alguno de los nombres/alias del usuario
  if (perfil.claves.indexOf(v) >= 0) return true;

  // 2. El directorio trae el login del usuario dentro del texto
  const vTokens = v.split(' ');
  if (perfil.id && vTokens.indexOf(norm_(perfil.id)) >= 0) return true;

  // 3. Coincidencia por tokens: todos los nombres/apellidos del usuario aparecen
  for (let i = 0; i < perfil.tokens.length; i++) {
    const tk = perfil.tokens[i];
    let todos = true;
    for (let j = 0; j < tk.length; j++) {
      if (vTokens.indexOf(tk[j]) < 0) { todos = false; break; }
    }
    if (todos) return true;
  }
  return false;
}

/**
 * Oficinas visibles segun rol:
 *  - Lider    -> solo donde su nombre esta en LIDER DE EXCELENCIA
 *  - Regional y Analista -> toda la red
 */
async function getOficinasDirectorio_(idUsuario, rol) {
  const dir = await getDirectorio_(false);
  const r = norm_(rol);

  if (r === 'REGIONAL' || r === 'ANALISTA') {
    return dir.map(o => Object.assign({}, o, { esPropia: false }));
  }

  const perfil = await perfilCruce_(idUsuario);
  return dir.filter(o => coincideLider_(o.lider, perfil))
            .map(o => Object.assign({}, o, { esPropia: true }));
}

/** Endpoint del frontend: oficinas + requisitos exigidos. */
async function listarOficinasLider(idUsuario, rol) {
  try {
    const lista = (await getOficinasDirectorio_(idUsuario, rol)).map(o => ({
      oficina: o.oficina,
      lider: o.lider,
      medioPago: o.medioPago || '(sin dato)',
      atmValor: o.atmValor || '',
      cliente: o.cliente || '',
      regional: o.regional || '',
      zona: o.zona || '',
      propia: !!o.propia,
      usd: !!o.usd,
      requiere: o.requiere,
      tieneATM: o.requiere.atm
    }));
    lista.sort((a, b) => a.oficina.localeCompare(b.oficina, 'es'));
    return { success: true, oficinas: lista };
  } catch (e) {
    return { success: false, message: e.message || String(e), oficinas: [] };
  }
}

/** Contexto inicial del formulario (usuario + oficinas). */
async function getContextoArqueo(idUsuario, rol) {
  const res = await listarOficinasLider(idUsuario, rol);
  const perfil = await perfilCruce_(idUsuario);
  return {
    success: res.success,
    message: res.message || '',
    nombreLider: perfil.nombre || perfil.id,
    correo: perfil.correo,
    oficinas: res.oficinas,
    formatos: FMT,
    // La fecha valida para el formulario la manda el servidor.
    hoy: hoyCol_(),
    horaServidor: Utilities.formatDate(new Date(), TZ, 'HH:mm'),
    zonaProyecto: Session.getScriptTimeZone()
  };
}

/**
 * Lectura FRESCA y liviana (sin cache) de las columnas que deciden el tipo de
 * visita y los ATM ya arqueados: A..I (ID..Extemporaneo) y S..T (Formato, Sesion).
 */
function filasVisita_(ss) {
  return memo_('VIS_ROWS', async function () {
    const sh = ss.getSheetByName('Arqueos');
    if (!sh) return [];
    const todo = await sh.getDataRange().getValues();
    const n = todo.length - 1;
    if (n < 1) return [];
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      const r = todo[i + 1] || [];
      const f = new Array(ARQ_NCOL).fill('');
      for (let c = 0; c <= AC.EXTEMPO; c++) f[c] = r[c] === undefined ? '' : r[c];   // A:I
      f[AC.FORMATO] = r[AC.FORMATO] === undefined ? '' : r[AC.FORMATO];             // S
      f[AC.SESION] = r[AC.SESION] === undefined ? '' : r[AC.SESION];                // T
      out[i] = f;
    }
    return out;
  });
}

/**
 * Determina si un arqueo a una oficina, en el mes de la fecha indicada, es la
 * PRIMERA visita o una VISITA ADICIONAL (regla de negocio v6).
 */
async function estadoVisitaMes_(ss, oficina, fecha, idSesionActual) {
  const out = { esAdicional: false, visitasPrevias: 0, primeraFecha: null,
                primeraSesion: '', formatosPrevios: [], mes: '' };
  if (!fecha) return out;

  out.mes = Utilities.formatDate(fecha, TZ, 'yyyy-MM');
  const data = await filasVisita_(ss);
  if (!data.length) return out;

  const claveOfi = norm_(oficina);

  const sesiones = {};
  const formatos = {};

  for (let i = 0; i < data.length; i++) {
    if (norm_(data[i][3]) !== claveOfi) continue;

    const f = parseFecha_(data[i][4]);
    if (!f || Utilities.formatDate(f, TZ, 'yyyy-MM') !== out.mes) continue;

    // Se agrupa por sesion: una visita puede haber generado 1, 2 o 3 filas.
    const ses = String(data[i][19] || '').trim() || ('FILA-' + String(data[i][0] || i));
    if (idSesionActual && ses === idSesionActual) continue;

    if (!sesiones[ses]) sesiones[ses] = { fecha: f };
    else if (f < sesiones[ses].fecha) sesiones[ses].fecha = f;

    const fmt = String(data[i][18] || '').trim();
    if (fmt) formatos[fmt] = true;
  }

  const claves = Object.keys(sesiones);
  out.visitasPrevias  = claves.length;
  out.formatosPrevios = Object.keys(formatos);
  if (!claves.length) return out;

  // La visita mas antigua del mes es la que cuenta como primera.
  claves.sort(function (a, b) { return sesiones[a].fecha - sesiones[b].fecha; });
  out.primeraSesion = claves[0];
  out.primeraFecha  = sesiones[claves[0]].fecha;
  out.esAdicional   = true;
  return out;
}

/**
 * Endpoint para el frontend: dado oficina + fecha, informa si el arqueo sera
 * primera visita del mes (formatos obligatorios) o visita adicional (opcionales).
 */
async function verificarVisitaMes(idUsuario, rol, oficina, fechaArqueo) {
  try {
    const ofi = await oficinaAutorizada_(oficina, idUsuario, rol);
    if (!ofi) return { success: false, message: 'La oficina no esta asignada a tu usuario en el Directorio Nacional.' };

    const fecha = parseFecha_(fechaArqueo);
    if (!fecha) return { success: false, message: 'Fecha de arqueo invalida.' };

    const ss  = SpreadsheetApp.openById(SPREADSHEET_ID);
    const est = await estadoVisitaMes_(ss, ofi.oficina, fecha, null);
    const atmYa = await atmArqueadosMes_(ss, ofi.oficina, fecha);

    return {
      success: true,
      oficina: ofi.oficina,
      mes: est.mes,
      esAdicional: est.esAdicional,
      tipoVisita: est.esAdicional ? VISITA.ADICIONAL : VISITA.PRIMERA,
      visitasPrevias: est.visitasPrevias,
      primeraFecha: est.primeraFecha ? Utilities.formatDate(est.primeraFecha, TZ, 'dd/MM/yyyy') : '',
      formatosPrevios: est.formatosPrevios,
      // v6: el arqueo de efectivo SIEMPRE suma a la meta; el ATM solo si el
      // cajero aun no tiene arqueo valido en el mes.
      cuentaMeta: true,
      cuentaMetaEfectivo: true,
      atmArqueadosMes: atmYa,
      requiere: ofi.requiere,
      usd: !!ofi.usd
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Cajeros de la oficina que YA tienen un arqueo ATM valido (no extemporaneo
 * pendiente) en el mes. Devuelve { codigoNormalizado: 'dd/MM/yyyy' }.
 */
async function atmArqueadosMes_(ss, oficina, fecha) {
  const out = {};
  if (!fecha) return out;
  const mes = Utilities.formatDate(fecha, TZ, 'yyyy-MM');
  const data = await filasVisita_(ss);
  if (!data.length) return out;
  const claveOfi = norm_(oficina);
  for (let i = 0; i < data.length; i++) {
    if (norm_(data[i][AC.OFICINA]) !== claveOfi) continue;
    if (String(data[i][AC.FORMATO] || '').trim() !== FMT.ATM) continue;
    if (norm_(data[i][AC.EXTEMPO]) === 'SI') continue;      // extemporaneo sin normalizar no cuenta
    const f = parseFecha_(data[i][AC.FECHA]);
    if (!f || Utilities.formatDate(f, TZ, 'yyyy-MM') !== mes) continue;
    const caj = claveCajero_(data[i][AC.NUM_ELEM]);
    const txt = Utilities.formatDate(f, TZ, 'dd/MM/yyyy');
    if (!out[caj] || f < out[caj].fecha) out[caj] = { fecha: f, texto: txt };
  }
  const plano = {};
  Object.keys(out).forEach(k => plano[k] = out[k].texto);
  return plano;
}

/** Clave normalizada de un cajero (por su codigo / numero). */
function claveCajero_(v) {
  const n = norm_(v).replace(/^CAJERO\s*/, '').replace(/^ATM\s*/, '').trim();
  return n || '1';
}

/** Busca la oficina exacta y valida que el usuario tenga permiso sobre ella. */
async function oficinaAutorizada_(nombreOficina, idUsuario, rol) {
  const lista = await getOficinasDirectorio_(idUsuario, rol);
  const clave = norm_(nombreOficina);
  for (let i = 0; i < lista.length; i++) {
    if (norm_(lista[i].oficina) === clave) return lista[i];
  }
  return null;
}


// ============================================================
// 7. PROCESAMIENTO DE ARQUEOS
// ============================================================
/**
 * Motor principal. Recibe la sesion completa de arqueo de una oficina y
 * escribe una fila por formato diligenciado, generando el soporte de cada uno.
 *
 * payload = {
 *   idUsuario, rol, oficina, fechaArqueo:'yyyy-MM-dd', hora:'HH:mm',
 *   modalidad:'PRESENCIAL'|'VIRTUAL',
 *   efectivo: {...} | null,
 *   cheques : {...} | null,
 *   atms    : [ {..., tirillas:[{fileName,mimeType,base64}]} ]
 * }
 */
async function procesarArqueoIntegral(payload) {
  const lock = LockService.getScriptLock();
  try {
    await lock.waitLock(30000);
  } catch (e) {
    return { success: false, message: 'El sistema esta procesando otro arqueo. Intenta de nuevo en unos segundos.' };
  }

  try {
    payload = payload || {};

    // ---------- Validaciones de contexto ----------
    if (!payload.idUsuario) return { success: false, message: 'Sesion no valida. Vuelve a iniciar sesion.' };

    const modalidad = norm_(payload.modalidad);
    if (modalidad !== 'PRESENCIAL' && modalidad !== 'VIRTUAL') {
      return { success: false, message: 'Debes indicar si el arqueo fue PRESENCIAL o VIRTUAL.' };
    }

    const ofi = await oficinaAutorizada_(payload.oficina, payload.idUsuario, payload.rol);
    if (!ofi) {
      return { success: false, message: 'La oficina "' + payload.oficina + '" no esta asignada a tu usuario en el Directorio Nacional.' };
    }

    const fechaReal = parseFecha_(payload.fechaArqueo);
    if (!fechaReal) return { success: false, message: 'Fecha de arqueo invalida.' };

    // Comparacion por DIA CALENDARIO en Colombia, no por instante.
    const diaArqueo = diaCol_(payload.fechaArqueo);
    const diaHoy    = hoyCol_();
    if (diaArqueo > diaHoy) {
      return { success: false, message: 'La fecha del arqueo no puede ser futura. ' +
        'Hoy en Colombia es ' + diaHoy + ' y estas reportando ' + diaArqueo + '.' };
    }

    const hora = String(payload.hora || '').trim();
    if (!hora) return { success: false, message: 'Indica la hora en que se realizo el arqueo.' };

    // ---------- Tipo de visita del mes ----------
    const ssVis      = SpreadsheetApp.openById(SPREADSHEET_ID);
    const visita     = await estadoVisitaMes_(ssVis, ofi.oficina, fechaReal, null);
    const tipoVisita = visita.esAdicional ? VISITA.ADICIONAL : VISITA.PRIMERA;
    const atmYa      = await atmArqueadosMes_(ssVis, ofi.oficina, fechaReal);

    // ---------- Validacion de formatos ----------
    const req = ofi.requiere;
    const faltantes = [];

    let atms = Array.isArray(payload.atms) ? payload.atms : [];
    if (!req.atm) {
      atms = []; // La oficina no tiene cajero en el Directorio: se ignora lo que llegue.
    } else if (atms.length > req.numATM) {
      // Blindaje: nunca se registran mas formatos ATM que cajeros parametrizados.
      atms = atms.slice(0, req.numATM);
    }

    if (visita.esAdicional) {
      // Visita de seguimiento: ningun formato es obligatorio, pero debe venir uno.
      if (!payload.efectivo && !payload.cheques && !atms.length) {
        return { success: false, message: 'Esta oficina ya tuvo su visita del mes' +
          (visita.primeraFecha ? ' (' + Utilities.formatDate(visita.primeraFecha, TZ, 'dd/MM/yyyy') + ')' : '') +
          ', por lo que los formatos son opcionales. Aun asi debes diligenciar al menos uno para registrar el arqueo.' };
      }
    } else {
      if (req.efectivo && !payload.efectivo) faltantes.push('Arqueo de efectivo (' + FMT.EFECTIVO + ')');
      if (req.cheques  && !payload.cheques)  faltantes.push('Arqueo de titulos valor (' + FMT.CHEQUES + ')');
      if (req.atm && atms.length < req.numATM) {
        faltantes.push('Arqueo de cajeros automaticos (' + FMT.ATM + '): se esperan ' + req.numATM + ' y llegaron ' + atms.length);
      }
      if (faltantes.length) {
        return { success: false, message: 'Esta es la primera visita del mes a ' + ofi.oficina +
          ', por lo que todos los formatos parametrizados son obligatorios. Faltan:\n• ' + faltantes.join('\n• ') };
      }
    }

    // Tirillas obligatorias en cada ATM
    for (let i = 0; i < atms.length; i++) {
      const tir = atms[i].tirillas || [];
      if (!tir.length) {
        return { success: false, message: 'El cajero ' + (atms[i].cajeroNo || (i + 1)) + ' no tiene tirillas cargadas. Es obligatorio adjuntarlas en PDF.' };
      }
      for (let j = 0; j < tir.length; j++) {
        const mt = String(tir[j].mimeType || '').toLowerCase();
        const nm = String(tir[j].fileName || '').toLowerCase();
        if (mt.indexOf('pdf') < 0 && nm.slice(-4) !== '.pdf') {
          return { success: false, message: 'Las tirillas deben cargarse en PDF. Archivo no valido: ' + tir[j].fileName };
        }
      }
    }

    // ---------- Datos comunes ----------
    const ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Arqueos');
    if (!sheet) return { success: false, message: 'No existe la hoja Arqueos. Ejecuta inicializarBaseDeDatos().' };

    const ahora     = new Date();
    const dias      = await calcularDiasHabiles(fechaReal, ahora);
    const extempo   = dias > DIAS_LIMITE ? 'SÍ' : 'NO';
    const idSesion  = 'SES-' + ahora.getTime();
    const mesCarpeta = Utilities.formatDate(fechaReal, TZ, 'yyyy-MM');
    const carpeta   = getCarpeta_([FOLDER_NAME, mesCarpeta, ofi.oficina]);

    const comun = {
      idSesion: idSesion,
      oficina: ofi.oficina,
      lider: payload.nombreLider || payload.idUsuario,
      idUsuario: payload.idUsuario,
      fechaTexto: Utilities.formatDate(fechaReal, TZ, 'dd/MM/yyyy'),
      hora: hora,
      modalidad: modalidad,
      extemporaneo: extempo,
      diasHabiles: dias,
      generado: Utilities.formatDate(ahora, TZ, 'dd/MM/yyyy HH:mm'),
      tipoVisita: tipoVisita,
      cuentaMeta: true,
      visitaPrevia: visita.primeraFecha ? Utilities.formatDate(visita.primeraFecha, TZ, 'dd/MM/yyyy') : ''
    };

    const resultados = [];
    const filas = [];
    let sumanMeta = 0;

    // ---------- A. FOR-GOR-020-09  Efectivo ----------
    if (payload.efectivo) {
      const d = payload.efectivo;
      const billete = num_(d.montoBilletes);
      const moneda  = num_(d.montoMonedas);
      const fisico  = billete + moneda;
      const teorico = num_(d.montoTeorico);
      const dif     = fisico - teorico;
      const novedad = dif < 0 ? 'FALTANTE' : (dif > 0 ? 'SOBRANTE' : 'SIN NOVEDAD');

      // Moneda extranjera (USD): opcional, solo si el lider la diligencio.
      const usd = d.usd && (String(d.usd.fisico).trim() !== '' || String(d.usd.sistema).trim() !== '')
        ? { fisico: num_(d.usd.fisico), sistema: num_(d.usd.sistema), tasa: num_(d.usd.tasa), observaciones: String(d.usd.observaciones || '') }
        : null;
      if (usd) {
        usd.diferencia = usd.fisico - usd.sistema;
        usd.novedad = usd.diferencia < 0 ? 'FALTANTE' : (usd.diferencia > 0 ? 'SOBRANTE' : 'SIN NOVEDAD');
      }

      const detalle = Object.assign({}, d, {
        formato: FMT.EFECTIVO, modalidad: modalidad, hora: hora,
        montoBilletes: billete, montoMonedas: moneda, totalFisico: fisico,
        saldoSistema: teorico, diferencia: dif, usd: usd, cuentaMeta: true
      });

      const id  = 'AQ-' + ahora.getTime() + '-EF';
      const pdf = crearPdf_(carpeta, nombrePdf_(comun, FMT.EFECTIVO, id),
        htmlFormatoEfectivo_(Object.assign({}, comun, { cuentaMeta: true, nota: 'suma a la meta del mes' }), detalle));

      let obs = d.observaciones || 'SIN NOVEDAD';
      if (usd && usd.diferencia !== 0) obs += ' | USD: ' + usd.novedad + ' ' + usd.diferencia.toFixed(2);

      const fila = ajustarFila_([
        id, ahora, payload.idUsuario, ofi.oficina, fechaReal,
        d.elemento || 'Bóveda', d.numeroElem || '', d.tipoArqueo || 'Arqueo de Control',
        extempo, dias, pdf.url, teorico, fisico, dif, novedad,
        obs, JSON.stringify(detalle),
        modalidad, FMT.EFECTIVO, idSesion, pdf.url, '', tipoVisita
      ]);
      if (usd) { fila[AC.USD_FISICO] = usd.fisico; fila[AC.USD_SISTEMA] = usd.sistema; fila[AC.USD_DIF] = usd.diferencia; }
      filas.push(fila);
      sumanMeta++;
      resultados.push({ formato: FMT.EFECTIVO, nombre: 'Arqueo de efectivo', idArqueo: id, url: pdf.url,
        diferencia: dif, novedad: novedad, cuentaMeta: true,
        usd: usd ? { diferencia: usd.diferencia, novedad: usd.novedad } : null });
    }

    // ---------- B. FOR-GOR-048-01  Titulos valor / cheques ----------
    if (payload.cheques) {
      const d = payload.cheques;
      const items = (d.items || []).filter(x => String(x.tipoTitulo || '').trim() !== '' ||
                                                 num_(x.cant) !== 0 || num_(x.invCont) !== 0);
      let totCant = 0, totInv = 0;
      items.forEach(x => { totCant += num_(x.cant); totInv += num_(x.invCont); });
      const dif = totInv - totCant;
      const novedad = dif < 0 ? 'FALTANTE' : (dif > 0 ? 'SOBRANTE' : 'SIN NOVEDAD');

      if (!items.length) return { success: false, message: 'El arqueo de titulos valor no tiene ningun registro diligenciado.' };

      const detalle = Object.assign({}, d, {
        formato: FMT.CHEQUES, modalidad: modalidad, hora: hora,
        items: items, totalCant: totCant, totalInvCont: totInv, diferencia: dif
      });

      const id  = 'AQ-' + ahora.getTime() + '-CH';
      const pdf = crearPdf_(carpeta, nombrePdf_(comun, FMT.CHEQUES, id),
        htmlFormatoCheques_(Object.assign({}, comun, { cuentaMeta: false, nota: 'complementario del arqueo de efectivo; no consume cupo de meta' }), detalle));

      filas.push(ajustarFila_([
        id, ahora, payload.idUsuario, ofi.oficina, fechaReal,
        'Títulos Valor', d.actaNo || '', d.tipoArqueo || 'Arqueo de Control',
        extempo, dias, pdf.url, totCant, totInv, dif, novedad,
        d.anexos || 'SIN NOVEDAD', JSON.stringify(detalle),
        modalidad, FMT.CHEQUES, idSesion, pdf.url, '', tipoVisita
      ]));
      resultados.push({ formato: FMT.CHEQUES, nombre: 'Arqueo de títulos valor', idArqueo: id, url: pdf.url, diferencia: dif, novedad: novedad, cuentaMeta: false });
    }

    // ---------- C. FOR-GOR-099-02  Cajeros automaticos ----------
    for (let i = 0; i < atms.length; i++) {
      const d = atms[i];
      const calc = calcularAtm_(d);

      // Tirillas a Drive
      const carpetaTir = getCarpeta_([FOLDER_NAME, mesCarpeta, ofi.oficina, 'Tirillas']);
      const urlsTir = [];
      (d.tirillas || []).forEach((t, k) => {
        const nombre = 'TIRILLA_' + norm_(ofi.oficina).replace(/\s+/g, '_') + '_ATM' + (d.cajeroNo || (i + 1)) +
          '_' + Utilities.formatDate(fechaReal, TZ, 'yyyyMMdd') + '_' + (k + 1) + '.pdf';
        urlsTir.push(DriveFiles.save({ folder: carpetaTir, name: nombre, mimeType: 'application/pdf', data: bytesBase64_(t.base64) }).url);
      });

      // Un cajero suma a la meta UNA sola vez al mes.
      const claveCaj = claveCajero_(d.cajeroNo || String(i + 1));
      const yaArqueado = atmYa[claveCaj] || '';
      const cuentaAtm = !yaArqueado;
      if (cuentaAtm) atmYa[claveCaj] = Utilities.formatDate(fechaReal, TZ, 'dd/MM/yyyy');

      const detalle = Object.assign({}, d, {
        formato: FMT.ATM, modalidad: modalidad, hora: hora,
        totales: calc, tirillas: urlsTir, cuentaMeta: cuentaAtm, arqueoPrevioMes: yaArqueado
      });
      delete detalle.base64;

      const id  = 'AQ-' + ahora.getTime() + '-ATM' + (i + 1);
      const pdf = crearPdf_(carpeta, nombrePdf_(comun, FMT.ATM, id),
        htmlFormatoAtm_(Object.assign({}, comun, { cuentaMeta: cuentaAtm,
          nota: cuentaAtm ? 'primer arqueo del cajero en el mes; suma a la meta'
                          : 'el cajero ya tuvo arqueo valido el ' + yaArqueado + '; no suma de nuevo a la meta' }), detalle, calc, urlsTir));

      filas.push(ajustarFila_([
        id, ahora, payload.idUsuario, ofi.oficina, fechaReal,
        'ATM', d.cajeroNo || String(i + 1), d.tipoArqueo || 'Arqueo de Control',
        extempo, dias, pdf.url, calc.totalCajero, calc.totalFisico, calc.diferencia, calc.novedad,
        d.observaciones || 'SIN NOVEDAD', JSON.stringify(detalle),
        modalidad, FMT.ATM, idSesion, pdf.url, urlsTir.join(' | '), tipoVisita
      ]));
      if (cuentaAtm) sumanMeta++;
      resultados.push({ formato: FMT.ATM, nombre: 'Arqueo ATM No. ' + (d.cajeroNo || (i + 1)), idArqueo: id, url: pdf.url,
        diferencia: calc.diferencia, novedad: calc.novedad, cuentaMeta: cuentaAtm, arqueoPrevioMes: yaArqueado });
    }

    if (!filas.length) {
      return { success: false, message: 'No se diligencio ningun formato. Verifica los requisitos de la oficina.' };
    }

    // ---------- Escritura ----------
    await sheet.getRange((await sheet.getLastRow()) + 1, 1, filas.length, ARQ_NCOL).setValues(filas);
    invalidarCacheArqueos_();
    await registrarSesion_(ss, idSesion, ahora, payload.idUsuario, ofi, fechaReal, hora, modalidad, req, resultados, tipoVisita, visita, sumanMeta);

    const atmRepetidos = resultados.filter(r => r.formato === FMT.ATM && !r.cuentaMeta).length;
    return {
      success: true,
      idSesion: idSesion,
      extemporaneo: extempo,
      diasHabiles: dias,
      resultados: resultados,
      tipoVisita: tipoVisita,
      cuentaMeta: extempo !== 'SÍ' && sumanMeta > 0,
      sumanMeta: extempo !== 'SÍ' ? sumanMeta : 0,
      atmRepetidos: atmRepetidos,
      visitaNroMes: (visita.visitasPrevias || 0) + 1,
      primeraVisitaMes: visita.primeraFecha ? Utilities.formatDate(visita.primeraFecha, TZ, 'dd/MM/yyyy') : '',
      message: (extempo === 'SÍ'
        ? 'Arqueo guardado como EXTEMPORÁNEO (' + dias + ' días hábiles). Se generaron ' + resultados.length + ' PDF de soporte. Puedes solicitar normalización a tu Regional.'
        : 'Arqueo registrado correctamente. Se generaron ' + resultados.length + ' PDF de soporte para el analista.' +
          (sumanMeta > 0 ? ' Suma ' + sumanMeta + ' arqueo(s) a tu meta del mes.' : ' Ningún formato de este registro consume cupo de meta.')) +
        (tipoVisita === VISITA.ADICIONAL
          ? ' Quedó marcado como VISITA ADICIONAL N.° ' + ((visita.visitasPrevias || 0) + 1) + ' del mes a esta oficina.'
          : '') +
        (atmRepetidos > 0
          ? ' ' + atmRepetidos + ' arqueo(s) ATM no suma(n) porque el cajero ya tuvo su arqueo válido del mes.'
          : '')
    };

  } catch (error) {
    return { success: false, message: 'Error al procesar el arqueo: ' + error.toString() };
  } finally {
    try { lock.releaseLock(); } catch (e) { /* nada */ }
  }
}

/** Totales del formato ATM segun las formulas del FOR-GOR-099-02. */
function calcularAtm_(d) {
  const suma = arr => (arr || []).reduce((s, g) => s + (num_(g.denominacion) * num_(g.cantidad)), 0);

  const efectivo = suma(d.gavetasEfectivo);
  const purga    = suma(d.gavetaPurga);
  const dispensado = suma(d.gavetasDispensado);
  const aprovisionamiento = suma(d.aprovisionamiento);

  const totalFisico = efectivo + purga;                        // G55
  const totalCajero = aprovisionamiento - dispensado;          // G57
  const diferencia  = totalFisico - totalCajero;               // G59

  return {
    efectivo: efectivo, purga: purga, dispensado: dispensado,
    aprovisionamiento: aprovisionamiento,
    totalFisico: totalFisico, totalCajero: totalCajero, diferencia: diferencia,
    novedad: diferencia < 0 ? 'FALTANTE' : (diferencia > 0 ? 'SOBRANTE' : 'SIN NOVEDAD')
  };
}

async function registrarSesion_(ss, idSesion, ahora, idUsuario, ofi, fechaReal, hora, modalidad, req, resultados, tipoVisita, visita, sumanMeta) {
  const sh = ss.getSheetByName('Sesiones_Arqueo');
  if (!sh) return;
  const exigidos = [];
  if (req.efectivo) exigidos.push(FMT.EFECTIVO);
  if (req.cheques)  exigidos.push(FMT.CHEQUES);
  if (req.atm)      exigidos.push(FMT.ATM + (req.numATM > 1 ? ' x' + req.numATM : '') +
    ' [' + (req.codigosATM || []).join(', ') + ']');

  const v = visita || {};
  await sh.appendRow([idSesion, ahora, idUsuario, ofi.oficina, fechaReal, hora, modalidad,
    exigidos.join(' + ') || 'SIN PARAMETRIZAR',
    resultados.map(r => r.formato).join(' + '),
    resultados.map(r => r.idArqueo).join(' | '),
    resultados.map(r => r.url).join(' | '),
    tipoVisita || VISITA.PRIMERA,
    (v.visitasPrevias || 0) + 1,
    (sumanMeta || 0) > 0 ? 'SI (' + sumanMeta + ')' : 'NO']);
}

// ------------------------------------------------------------
// Compatibilidad: carga manual de soporte (sin diligenciamiento)
// ------------------------------------------------------------
async function procesarArqueo(dataForm) {
  try {
    dataForm = dataForm || {};
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Arqueos');
    const modalidad = norm_(dataForm.modalidad) || 'NO REGISTRADA';

    const ofi = await oficinaAutorizada_(dataForm.oficina, dataForm.idUsuario, dataForm.rol || 'Lider');
    if (!ofi) return { success: false, message: 'La oficina no esta asignada a tu usuario en el Directorio Nacional.' };

    const fechaReal = parseFecha_(dataForm.fechaArqueo);
    if (!fechaReal) return { success: false, message: 'Fecha de arqueo invalida.' };
    if (diaCol_(dataForm.fechaArqueo) > hoyCol_()) {
      return { success: false, message: 'La fecha del arqueo no puede ser futura. Hoy en Colombia es ' + hoyCol_() + '.' };
    }

    let fileUrl = 'Arqueo Digital', diferencia = '', novedad = 'SIN NOVEDAD';
    const montoTeorico = dataForm.montoTeorico || '', montoFisico = dataForm.montoFisico || '';

    if (dataForm.base64) {
      const carpeta = getCarpeta_([FOLDER_NAME, Utilities.formatDate(fechaReal, TZ, 'yyyy-MM'), ofi.oficina, 'Carga_Manual']);
      fileUrl = DriveFiles.save({ folder: carpeta, name: dataForm.fileName || 'soporte',
        mimeType: dataForm.mimeType || 'application/octet-stream', data: bytesBase64_(dataForm.base64) }).url;
      diferencia = 'Pendiente N8N'; novedad = 'PENDIENTE';
    } else {
      const t = parseFloat(montoTeorico), f = parseFloat(montoFisico);
      if (!isNaN(t) && !isNaN(f)) {
        diferencia = f - t;
        novedad = diferencia < 0 ? 'FALTANTE' : (diferencia > 0 ? 'SOBRANTE' : 'SIN NOVEDAD');
      }
    }

    const fechaCarga = new Date();
    const dias = await calcularDiasHabiles(fechaReal, fechaCarga);
    const extemporaneo = dias > DIAS_LIMITE ? 'SÍ' : 'NO';
    const id = 'AQ-' + fechaCarga.getTime() + '-MAN';

    // Mismo distintivo de visita que en el diligenciamiento digital.
    const visitaMan = await estadoVisitaMes_(SpreadsheetApp.openById(SPREADSHEET_ID), ofi.oficina, fechaReal, null);
    const tipoVisitaMan = visitaMan.esAdicional ? VISITA.ADICIONAL : VISITA.PRIMERA;

    await sheet.appendRow(ajustarFila_([
      id, fechaCarga, dataForm.idUsuario, ofi.oficina, fechaReal,
      dataForm.elemento || '', dataForm.numeroElem || '', dataForm.tipoArqueo || '',
      extemporaneo, dias, fileUrl, montoTeorico, montoFisico, diferencia, novedad,
      dataForm.observaciones || '', dataForm.detalle ? JSON.stringify(dataForm.detalle) : '',
      modalidad, dataForm.formato || FMT.EFECTIVO, '', fileUrl, '', tipoVisitaMan
    ]));
    invalidarCacheArqueos_();

    return {
      success: true, extemporaneo: extemporaneo, idArqueo: id,
      message: extemporaneo === 'SÍ'
        ? 'Guardado como EXTEMPORÁNEO (' + dias + ' días hábiles). Puedes solicitar normalización a tu Regional.'
        : 'Soporte cargado exitosamente. Suma a la meta según el formato (el ATM solo cuenta una vez al mes por cajero).'
    };
  } catch (error) {
    return { success: false, message: 'Error al cargar: ' + error.toString() };
  }
}


// ============================================================
// 9. JERARQUIA Y LECTURA
// ============================================================
async function getUsuarios_() {
  const lista = await memo_('USR_LISTA', async function () {
    const out = [];
    (await datosUsuarios_()).usuarios.forEach(function (u) {
      const rol = rolDesdeLlave_(u.llave);
      if (!rol) return;
      out.push({ id: u.id, rol: rol, nombre: u.nombreDir || u.id, regional: '' });
    });
    return out;
  });
  return lista.map(u => Object.assign({}, u));
}

async function getLideresPermitidos_(idUsuario, rol) {
  const usuarios = await getUsuarios_();
  const r = norm_(rol);
  if (r === 'ANALISTA' || r === 'REGIONAL') return usuarios.filter(u => u.rol === 'Lider');
  return usuarios.filter(u => u.id === String(idUsuario).trim());
}

/** Mapa id -> nombre de los usuarios con llave de arqueos. */
async function nombresUsuarios_() {
  const nombreDe = {}; (await getUsuarios_()).forEach(u => nombreDe[u.id] = u.nombre);
  return nombreDe;
}

/** Oficinas por lider, tomadas del Directorio Nacional. */
async function getOficinas_(idUsuario, rol) {
  try {
    const perfiles = {};
    for (const u of await getLideresPermitidos_(idUsuario, rol)) perfiles[u.id] = await perfilCruce_(u.id);

    const dir = await getDirectorio_(false);
    const res = [];
    const uids = Object.keys(perfiles);
    dir.forEach(o => {
      uids.forEach(uid => {
        if (coincideLider_(o.lider, perfiles[uid])) {
          res.push({ oficina: o.oficina, lider: uid, tieneATM: o.requiere.atm, numATM: o.requiere.numATM, codigosATM: o.requiere.codigosATM || [],
            cliente: o.cliente, regional: o.regional, zona: o.zona, propia: !!o.propia, usd: !!o.usd, requiere: o.requiere });
        }
      });
    });
    return res;
  } catch (e) {
    return [];
  }
}

async function leerArqueos_(idUsuario, rol) {
  const permitidos = {};
  (await getLideresPermitidos_(idUsuario, rol)).forEach(u => permitidos[u.id] = true);
  // Copia superficial: aplicarReglaMeta_ marca campos y la proyeccion es compartida.
  const out = (await leerTodosArqueos_()).filter(a => permitidos[a.idUsuario]).map(a => Object.assign({}, a));
  aplicarReglaMeta_(out);
  return out;
}

/**
 * Proyeccion liviana de TODA la hoja Arqueos (todos los lideres), sin la
 * columna Detalle. Se guarda en cache por version de datos.
 */
function leerTodosArqueos_() {
  return memo_('ARQ_ALL', async function () {
    const clave = 'ARQ_ALL_' + (await versionArqueos_());
    const hit = cacheGetJson_(clave);
    if (hit) return hit;
    const out = await leerArqueosHoja_();
    cachePutJson_(clave, out, CACHE_TTL_ARQ);
    return out;
  });
}

/** Lee la hoja Arqueos sin la columna Q Detalle (JSON pesado). */
async function leerFilasArqueosSinDetalle_(sh) {
  const todo = await sh.getDataRange().getValues();
  const n = todo.length - 1;
  if (n < 1) return [];
  const filas = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = todo[i + 1] || [];
    const f = new Array(ARQ_NCOL);
    for (let c = 0; c < ARQ_NCOL; c++) f[c] = r[c] === undefined || r[c] === null ? '' : r[c];
    f[AC.DETALLE] = '';
    filas[i] = f;
  }
  return filas;
}

async function leerArqueosHoja_() {
  const sheet = ss_().getSheetByName('Arqueos');
  if (!sheet || (await sheet.getLastRow()) < 2) return [];
  const data = await leerFilasArqueosSinDetalle_(sheet);
  const out = [];

  for (let j = 0; j < data.length; j++) {
    const row = data[j];
    if (!row[0] && !row[1]) continue;
    const uid = String(row[AC.USUARIO] || '').trim();

    const tsCarga = parseFecha_(row[AC.TS]);
    const tsReal  = parseFecha_(row[AC.FECHA]) || tsCarga;
    if (!tsReal) continue;

    const formato = String(row[AC.FORMATO] || '').trim() || FMT.EFECTIVO;
    const extempo = (function (v) { v = norm_(v); if (v === 'SI') return 'SÍ'; if (v === 'NORMALIZADO') return 'NORMALIZADO'; return 'NO'; })(row[AC.EXTEMPO]);
    const g = v => (v === undefined || v === null) ? '' : v;
    const usdDif = row[AC.USD_DIF];
    const tieneUsd = usdDif !== '' && usdDif !== null && usdDif !== undefined;
    const numero = v => (v instanceof Date) ? fmtF_(v, 'dd/MM/yyyy') : v;

    out.push({
      id: row[AC.ID] || ('ROW-' + (j + 2)),
      fila: j + 2,
      ts: tsCarga ? tsCarga.getTime() : 0,
      fechaCarga: fmtF_(tsCarga, 'dd/MM/yyyy HH:mm'),
      fechaReal: fmtF_(tsReal, 'dd/MM/yyyy'),
      fechaISO: Utilities.formatDate(tsReal, TZ, 'yyyy-MM-dd'),
      mes: Utilities.formatDate(tsReal, TZ, 'yyyy-MM'),
      anio: Utilities.formatDate(tsReal, TZ, 'yyyy'),
      dia: parseInt(Utilities.formatDate(tsReal, TZ, 'd'), 10),
      idUsuario: uid,
      oficina: row[AC.OFICINA] || '—',
      elemento: row[AC.ELEMENTO] || '',
      numeroElem: numero(row[AC.NUM_ELEM]) || '',
      tipoArqueo: row[AC.TIPO_ARQ] || '',
      extemporaneo: extempo,
      diasHabiles: numero(row[AC.DIAS]),
      url: row[AC.URL] || '',
      montoTeorico: numero(row[AC.TEORICO]),
      montoFisico: numero(row[AC.FISICO]),
      diferencia: (row[AC.DIF] === '' || row[AC.DIF] === null || row[AC.DIF] === undefined) ? 'Pendiente N8N' : numero(row[AC.DIF]),
      novedad: row[AC.NOVEDAD] || '',
      observaciones: row[AC.OBS] || '',
      modalidad: row[AC.MODALIDAD] || 'NO REGISTRADA',
      formato: formato,
      idSesion: row[AC.SESION] || '',
      urlPdf: row[AC.URL_PDF] || '',
      urlTirillas: row[AC.URL_TIR] || '',
      tipoVisita: String(row[AC.TIPO_VISITA] || '').trim() || VISITA.PRIMERA,
      // ---- gestion de novedades (v6) ----
      obsAnalista: String(g(row[AC.OBS_ANALISTA])),
      estadoRevision: String(g(row[AC.ESTADO_REV])).trim(),
      revisor: String(g(row[AC.REVISOR])),
      fechaRevision: fmtF_(parseFecha_(row[AC.FECHA_REV]), 'dd/MM/yyyy HH:mm').replace('—', ''),
      respuestaLider: String(g(row[AC.RESP_LIDER])),
      urlCorreccion: String(g(row[AC.URL_CORR])),
      fechaCorreccion: fmtF_(parseFecha_(row[AC.FECHA_CORR]), 'dd/MM/yyyy HH:mm').replace('—', ''),
      explicacionSolicitada: norm_(row[AC.EXPL_SOLIC]) === 'SI',
      explicacionLider: String(g(row[AC.EXPL_LIDER])),
      tipologia: String(g(row[AC.TIPOLOGIA])),
      estadoDiferencia: String(g(row[AC.ESTADO_DIF])).trim(),
      fechaExplicacion: fmtF_(parseFecha_(row[AC.FECHA_EXPL]), 'dd/MM/yyyy HH:mm').replace('—', ''),
      // ---- moneda extranjera ----
      usdFisico: tieneUsd ? num_(row[AC.USD_FISICO]) : null,
      usdSistema: tieneUsd ? num_(row[AC.USD_SISTEMA]) : null,
      usdDiferencia: tieneUsd ? num_(usdDif) : null,
      cuentaMeta: false   // se calcula con la regla v6 en leerArqueos_
    });
  }
  return out;
}

/**
 * REGLA DE META v6 (se aplica al leer):
 *  - FOR-GOR-020-09 (efectivo): SIEMPRE consume cupo, salvo extemporaneo sin normalizar.
 *  - FOR-GOR-099-02 (ATM): solo el PRIMER arqueo valido de cada cajero en el mes.
 *  - FOR-GOR-048-01 (cheques): complementario, nunca consume cupo.
 *  - Formato vacio (registros antiguos): se trata como efectivo.
 */
function aplicarReglaMeta_(arqueos) {
  const primerosAtm = {};   // oficina|cajero|mes -> arqueo que cuenta
  const ordenados = arqueos.slice().sort((a, b) => (a.fechaISO < b.fechaISO ? -1 : (a.fechaISO > b.fechaISO ? 1 : a.ts - b.ts)));
  ordenados.forEach(a => {
    a.atmRepetido = false;
    if (a.formato === FMT.CHEQUES) { a.cuentaMeta = false; return; }
    if (a.formato === FMT.ATM) {
      const k = norm_(a.oficina) + '|' + claveCajero_(a.numeroElem) + '|' + a.mes;
      if (a.extemporaneo === 'SÍ') { a.cuentaMeta = false; return; }   // no bloquea al siguiente
      if (primerosAtm[k]) { a.cuentaMeta = false; a.atmRepetido = true; a.atmPrimero = primerosAtm[k].fechaReal; return; }
      primerosAtm[k] = a;
      a.cuentaMeta = true;
      return;
    }
    a.cuentaMeta = true;   // efectivo (o formato no registrado)
  });
}

/** Resume el estado de gestion de un arqueo para la interfaz. */
function estadoGestion_(r) {
  const pendLider = [];
  if (r.estadoRevision === REV.NOVEDAD) pendLider.push('SOPORTE');
  if (r.explicacionSolicitada && (!r.estadoDiferencia || r.estadoDiferencia === DIFE.PENDIENTE)) pendLider.push('EXPLICACION');
  const pendAnalista = r.estadoRevision === REV.CORREGIDO ||
    (r.explicacionSolicitada && r.estadoDiferencia && r.estadoDiferencia !== DIFE.PENDIENTE && r.estadoRevision !== REV.OK);
  return { pendienteLider: pendLider, pendienteAnalista: !!pendAnalista, ok: r.estadoRevision === REV.OK };
}

/** Estado de la ultima solicitud de normalizacion por arqueo (hoja pequena). */
function mapaNormalizaciones_() {
  return memo_('NORM_MAP', async function () {
    const norm = {};
    const nsh = ss_().getSheetByName('Normalizaciones');
    const ult = nsh ? await nsh.getLastRow() : 0;
    if (nsh && ult >= 2) {
      const nd = await nsh.getRange(2, 1, ult - 1, 6).getValues();
      for (let i = 0; i < nd.length; i++) if (nd[i][1]) norm[String(nd[i][1])] = String(nd[i][5]);
    }
    return norm;
  });
}

function mapearHistorial_(r, norm, nombreDe) {
  const ges = estadoGestion_(r);
  return {
    id: r.id, fechaCarga: r.fechaCarga, oficina: r.oficina, fechaReal: r.fechaReal, mes: r.mes,
    lider: r.idUsuario, nombreLider: nombreDe[r.idUsuario] || r.idUsuario,
    elemento: r.elemento, numeroElem: r.numeroElem, tipoArqueo: r.tipoArqueo,
    extemporaneo: r.extemporaneo, url: r.url, novedad: r.novedad, diferencia: r.diferencia,
    observaciones: r.observaciones,
    modalidad: r.modalidad, formato: r.formato, urlPdf: r.urlPdf, urlTirillas: r.urlTirillas,
    cuentaMeta: r.cuentaMeta, atmRepetido: !!r.atmRepetido, atmPrimero: r.atmPrimero || '',
    tipoVisita: r.tipoVisita, estadoNorm: norm[String(r.id)] || '',
    obsAnalista: r.obsAnalista, estadoRevision: r.estadoRevision, revisor: r.revisor, fechaRevision: r.fechaRevision,
    respuestaLider: r.respuestaLider, urlCorreccion: r.urlCorreccion, fechaCorreccion: r.fechaCorreccion,
    explicacionSolicitada: r.explicacionSolicitada, explicacionLider: r.explicacionLider,
    tipologia: r.tipologia, estadoDiferencia: r.estadoDiferencia, fechaExplicacion: r.fechaExplicacion,
    usdFisico: r.usdFisico, usdSistema: r.usdSistema, usdDiferencia: r.usdDiferencia,
    pendienteLider: ges.pendienteLider, pendienteAnalista: ges.pendienteAnalista, gestionOK: ges.ok
  };
}

/**
 * Historial / Matriz de arqueos.
 * @param {string} mes  'yyyy-MM' devuelve ese mes MAS cualquier registro con
 *                      gestion pendiente de otros meses. '' o 'TODOS' = historico completo.
 */
async function obtenerHistorial(idUsuario, rol, mes) {
  const m = String(mes || '').trim().toUpperCase() === 'TODOS' ? '' : String(mes || '').trim();
  return conCacheResultado_('obtenerHistorial', idUsuario, rol, [m || 'TODOS'], async function () {
    const norm = await mapaNormalizaciones_();
    const nombreDe = await nombresUsuarios_();
    let lista = await leerArqueos_(idUsuario, rol);
    if (m) {
      lista = lista.filter(r => {
        if (r.mes === m) return true;
        const g = estadoGestion_(r);
        return g.pendienteLider.length > 0 || g.pendienteAnalista;
      });
    }
    return lista.map(r => mapearHistorial_(r, norm, nombreDe)).reverse();
  });
}

/** Un solo arqueo (para abrir los modales de gestion sin cargar todo el historial). */
async function obtenerArqueo(idArqueo, idUsuario, rol) {
  try {
    const id = String(idArqueo || '').trim();
    const r = (await leerArqueos_(idUsuario, rol)).find(x => String(x.id) === id);
    if (!r) return null;
    const nombreDe = await nombresUsuarios_();
    return mapearHistorial_(r, await mapaNormalizaciones_(), nombreDe);
  } catch (e) { return null; }
}


// ============================================================
// 10. DASHBOARD
// ============================================================
function esValido_(a) { return a.extemporaneo !== 'SÍ' && a.cuentaMeta; }

async function obtenerDashboard(idUsuario, rol, mesFiltro) {
  return conCacheResultado_('obtenerDashboard', idUsuario, rol, [mesFiltro || Utilities.formatDate(new Date(), TZ, 'yyyy-MM')], function () { return obtenerDashboardCalc_(idUsuario, rol, mesFiltro); });
}

async function obtenerDashboardCalc_(idUsuario, rol, mesFiltro) {
  try {
    const mes = mesFiltro || Utilities.formatDate(new Date(), TZ, 'yyyy-MM');
    const arqueos = (await leerArqueos_(idUsuario, rol)).filter(a => a.mes === mes);

    const [yy, mm] = mes.split('-').map(Number);
    const ultimoDia = new Date(yy, mm, 0);
    const festivos = await getFestivos_();
    let habilesTotal = 0, habilesTranscurridos = 0;
    let cur = new Date(yy, mm - 1, 1);
    const hoy = new Date();
    while (cur <= ultimoDia) {
      const dow = cur.getDay();
      const key = Utilities.formatDate(cur, TZ, 'yyyy-MM-dd');
      if (dow !== 0 && dow !== 6 && !festivos[key]) { habilesTotal++; if (cur <= hoy) habilesTranscurridos++; }
      cur.setDate(cur.getDate() + 1);
    }
    const habilesRestantes = Math.max(habilesTotal - habilesTranscurridos, 0);
    const mesEsFuturo = habilesTranscurridos === 0;

    const oficinas = await getOficinas_(idUsuario, rol);
    const lideres  = await getLideresPermitidos_(idUsuario, rol);

    const porLider = {};
    lideres.forEach(u => {
      porLider[u.id] = {
        idLider: u.id, nombre: u.nombre,
        validos: 0, extemporaneos: 0, normalizados: 0, complementarios: 0, atmRepetidos: 0, visitasAdicionales: 0, total: 0,
        faltantes: 0, sobrantes: 0, sinNovedad: 0, pendientes: 0,
        virtuales: 0, presenciales: 0,
        montoFaltante: 0, montoSobrante: 0,
        pendientesGestion: 0,
        oficinas: oficinas.filter(o => o.lider === u.id).length,
        oficinasATM: oficinas.filter(o => o.lider === u.id && o.tieneATM).length,
        oficinasCheques: oficinas.filter(o => o.lider === u.id && o.requiere && o.requiere.cheques).length,
        _ofiVisitadas: {}
      };
    });

    let totFaltMonto = 0, totSobMonto = 0, totFalt = 0, totSob = 0;
    let totValidos = 0, totExt = 0, totPend = 0, totNorm = 0, totComp = 0, totAdic = 0, totAtmRep = 0, totPendGestion = 0;

    arqueos.forEach(a => {
      const L = porLider[a.idUsuario]; if (!L) return;
      L.total++;
      if (norm_(a.modalidad) === 'VIRTUAL') L.virtuales++;
      else if (norm_(a.modalidad) === 'PRESENCIAL') L.presenciales++;
      if (a.tipoVisita === VISITA.ADICIONAL) { L.visitasAdicionales++; totAdic++; }
      if (estadoGestion_(a).pendienteLider.length) { L.pendientesGestion++; totPendGestion++; }

      if (a.extemporaneo === 'SÍ') { L.extemporaneos++; totExt++; }
      else if (a.cuentaMeta) {
        L.validos++; totValidos++;
        L._ofiVisitadas[norm_(a.oficina)] = true;
        if (a.extemporaneo === 'NORMALIZADO') { L.normalizados++; totNorm++; }
      } else if (a.atmRepetido) { L.atmRepetidos++; totAtmRep++; }
      else { L.complementarios++; totComp++; }

      const dif = parseFloat(a.diferencia);
      if (a.novedad === 'FALTANTE' || dif < 0) { L.faltantes++; totFalt++; const m = Math.abs(dif) || 0; L.montoFaltante += m; totFaltMonto += m; }
      else if (a.novedad === 'SOBRANTE' || dif > 0) { L.sobrantes++; totSob++; const m = Math.abs(dif) || 0; L.montoSobrante += m; totSobMonto += m; }
      else if (a.novedad === 'PENDIENTE' || a.diferencia === 'Pendiente N8N') { L.pendientes++; totPend++; }
      else L.sinNovedad++;
    });

    const lideresArr = Object.keys(porLider).map(lid => {
      const L = porLider[lid];
      const pct = Math.round((L.validos / META_MENSUAL) * 100);
      const faltanParaMeta = Math.max(META_MENSUAL - L.validos, 0);
      const ritmo = habilesTranscurridos > 0 ? L.validos / habilesTranscurridos : 0;
      const proyeccion = Math.round(ritmo * habilesTotal);
      const requeridoPorDia = habilesRestantes > 0 ? +(faltanParaMeta / habilesRestantes).toFixed(1) : (faltanParaMeta > 0 ? 999 : 0);
      let estado, semaforo;
      if (L.validos >= META_MENSUAL) { estado = 'META CUMPLIDA'; semaforo = 'verde'; }
      else if (mesEsFuturo) { estado = 'SIN INICIAR'; semaforo = 'amarillo'; }
      else if (proyeccion >= META_MENSUAL) { estado = 'EN RUTA'; semaforo = 'verde'; }
      else if (proyeccion >= META_MENSUAL * 0.8 || requeridoPorDia <= 3) { estado = 'EN RIESGO'; semaforo = 'amarillo'; }
      else { estado = 'CRÍTICO'; semaforo = 'rojo'; }
      if (habilesRestantes === 0 && !mesEsFuturo && L.validos < META_MENSUAL) { estado = 'NO CUMPLIDA'; semaforo = 'rojo'; }
      const ofiVis = Object.keys(L._ofiVisitadas).length;
      delete L._ofiVisitadas;
      return Object.assign(L, { pct: Math.min(pct, 100), pctReal: pct, faltanParaMeta, proyeccion, requeridoPorDia, estado, semaforo, meta: META_MENSUAL,
        oficinasVisitadas: ofiVis, oficinasPendientes: Math.max(L.oficinas - ofiVis, 0) });
    }).sort((a, b) => b.validos - a.validos);

    const serieMap = {};
    arqueos.forEach(a => { if (esValido_(a)) serieMap[a.dia] = (serieMap[a.dia] || 0) + 1; });
    const serie = []; let acum = 0;
    for (let dd = 1; dd <= ultimoDia.getDate(); dd++) { acum += (serieMap[dd] || 0); serie.push({ dia: dd, valor: serieMap[dd] || 0, acumulado: acum }); }

    const nombreDe = await nombresUsuarios_();
    const novedades = arqueos
      .filter(a => a.novedad === 'FALTANTE' || a.novedad === 'SOBRANTE')
      .map(a => ({
        fecha: a.fechaReal, oficina: a.oficina, lider: nombreDe[a.idUsuario] || a.idUsuario,
        elemento: a.elemento, formato: a.formato, novedad: a.novedad,
        diferencia: parseFloat(a.diferencia) || 0, url: a.urlPdf || a.url,
        id: a.id, estadoDiferencia: a.estadoDiferencia, tipologia: a.tipologia, explicacionSolicitada: a.explicacionSolicitada,
        estadoRevision: a.estadoRevision
      }))
      .sort((x, y) => Math.abs(y.diferencia) - Math.abs(x.diferencia));

    const totalLideres = lideresArr.length;
    const metaGlobal = totalLideres * META_MENSUAL;

    return {
      mes, meta: META_MENSUAL,
      habiles: { total: habilesTotal, transcurridos: habilesTranscurridos, restantes: habilesRestantes },
      lideres: lideresArr, serie, novedades,
      global: {
        totalArqueos: arqueos.length, validos: totValidos, extemporaneos: totExt,
        normalizados: totNorm, complementarios: totComp, atmRepetidos: totAtmRep, visitasAdicionales: totAdic, pendientes: totPend,
        pendientesGestion: totPendGestion,
        faltantes: totFalt, sobrantes: totSob,
        montoFaltante: totFaltMonto, montoSobrante: totSobMonto, montoNeto: totSobMonto - totFaltMonto,
        totalLideres, cumplenMeta: lideresArr.filter(l => l.validos >= META_MENSUAL).length,
        enRiesgo: lideresArr.filter(l => l.semaforo === 'amarillo').length,
        criticos: lideresArr.filter(l => l.semaforo === 'rojo').length,
        metaGlobal, pctGlobal: metaGlobal > 0 ? Math.round((totValidos / metaGlobal) * 100) : 0
      }
    };
  } catch (err) {
    return { error: err.toString() };
  }
}

async function obtenerMesesDisponibles(idUsuario, rol) {
  return conCacheResultado_('obtenerMesesDisponibles', idUsuario, rol, [], function () { return obtenerMesesDisponiblesCalc_(idUsuario, rol); });
}

async function obtenerMesesDisponiblesCalc_(idUsuario, rol) {
  const set = {};
  (await leerArqueos_(idUsuario, rol)).forEach(a => set[a.mes] = true);
  set[Utilities.formatDate(new Date(), TZ, 'yyyy-MM')] = true;
  return Object.keys(set).sort().reverse();
}


// ============================================================
// 11. NORMALIZACION DE EXTEMPORANEOS
// ============================================================
async function solicitarNormalizacion(idArqueo, idLider, justificacion) {
  try {
    if (!justificacion || !String(justificacion).trim()) return { success: false, message: 'La justificación es obligatoria.' };
    const nsh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Normalizaciones');
    const nd = await nsh.getDataRange().getValues();
    for (let i = 1; i < nd.length; i++) {
      if (String(nd[i][1]) === String(idArqueo) && String(nd[i][5]) === 'PENDIENTE')
        return { success: false, message: 'Ya existe una solicitud pendiente para este arqueo.' };
    }
    const id = 'NR-' + new Date().getTime();
    await nsh.appendRow([id, idArqueo, idLider, new Date(), String(justificacion).trim(), 'PENDIENTE', '', '', '']);
    invalidarCacheArqueos_();
    return { success: true, message: 'Solicitud enviada a tu Regional para aprobación.' };
  } catch (e) { return { success: false, message: 'Error: ' + e.toString() }; }
}

async function listarNormalizaciones(idUsuario, rol) {
  const permitidos = {};
  (await getLideresPermitidos_(idUsuario, rol)).forEach(u => permitidos[u.id] = true);
  const nombreDe = await nombresUsuarios_();

  const info = {};
  (await leerArqueos_(idUsuario, rol)).forEach(a => info[String(a.id)] = a);

  const nsh = ss_().getSheetByName('Normalizaciones');
  const nd = nsh ? await nsh.getDataRange().getValues() : [];
  const out = [];
  for (let i = 1; i < nd.length; i++) {
    if (!nd[i][0]) continue;
    const lid = String(nd[i][2]).trim();
    if (!permitidos[lid]) continue;
    const arq = info[String(nd[i][1])] || {};
    out.push({
      idSolicitud: nd[i][0], idArqueo: nd[i][1], idLider: lid, lider: nombreDe[lid] || lid,
      fechaSolicitud: fmtF_(parseFecha_(nd[i][3]), 'dd/MM/yyyy HH:mm'),
      justificacion: nd[i][4], estado: nd[i][5],
      aprobador: nd[i][6] ? (nombreDe[String(nd[i][6]).trim()] || nd[i][6]) : '',
      fechaDecision: nd[i][7] ? fmtF_(parseFecha_(nd[i][7]), 'dd/MM/yyyy HH:mm') : '',
      comentario: nd[i][8] || '',
      oficina: arq.oficina || '—', fechaReal: arq.fechaReal || '—',
      diasHabiles: arq.diasHabiles || '—', formato: arq.formato || '—', urlPdf: arq.urlPdf || ''
    });
  }
  return out.reverse();
}

async function decidirNormalizacion(idSolicitud, decision, comentario, idAprobador, rolAprobador) {
  try {
    if (rolAprobador !== 'Regional' && rolAprobador !== 'Analista')
      return { success: false, message: 'No tienes permisos para decidir normalizaciones.' };
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const nsh = ss.getSheetByName('Normalizaciones');
    const nd = await nsh.getDataRange().getValues();
    for (let i = 1; i < nd.length; i++) {
      if (String(nd[i][0]) === String(idSolicitud)) {
        if (String(nd[i][5]) !== 'PENDIENTE') return { success: false, message: 'La solicitud ya fue decidida.' };
        const estado = decision === 'APROBAR' ? 'APROBADA' : 'RECHAZADA';
        // Columnas F..I (Estado, ID_Aprobador, Fecha_Decision, Comentario_Decision) en una sola escritura.
        await nsh.getRange(i + 1, 6, 1, 4).setValues([[estado, idAprobador, new Date(), comentario || '']]);
        if (estado === 'APROBADA') {
          const ash = ss.getSheetByName('Arqueos');
          const reg = await buscarFilaArqueo_(ash, nd[i][1]);
          if (reg) await ash.getRange(reg.fila, AC.EXTEMPO + 1).setValue('NORMALIZADO');
        }
        invalidarCacheArqueos_();
        return { success: true, message: 'Solicitud ' + estado.toLowerCase() + ' correctamente.' };
      }
    }
    return { success: false, message: 'Solicitud no encontrada.' };
  } catch (e) { return { success: false, message: 'Error: ' + e.toString() }; }
}


// ============================================================
// 12. TENDENCIAS ANUALES
// ============================================================
async function obtenerTendencias(idUsuario, rol, anio) {
  return conCacheResultado_('obtenerTendencias', idUsuario, rol, [anio || Utilities.formatDate(new Date(), TZ, 'yyyy')], function () { return obtenerTendenciasCalc_(idUsuario, rol, anio); });
}

async function obtenerTendenciasCalc_(idUsuario, rol, anio) {
  try {
    const y = anio || Utilities.formatDate(new Date(), TZ, 'yyyy');
    const todos = await leerArqueos_(idUsuario, rol);
    const arqueos = todos.filter(a => a.anio === String(y));

    const meses = [];
    for (let m = 1; m <= 12; m++) {
      meses.push({
        mes: String(y) + '-' + String(m).padStart(2, '0'),
        faltCasos: 0, faltMonto: 0, sobCasos: 0, sobMonto: 0, total: 0, validos: 0, ext: 0
      });
    }
    const ofi = {};

    arqueos.forEach(a => {
      const idx = parseInt(a.mes.split('-')[1], 10) - 1;
      if (idx < 0 || idx > 11) return;
      const M = meses[idx];
      M.total++;
      if (esValido_(a)) M.validos++; else if (a.extemporaneo === 'SÍ') M.ext++;

      const dif = parseFloat(a.diferencia);
      const esF = a.novedad === 'FALTANTE' || dif < 0;
      const esS = a.novedad === 'SOBRANTE' || dif > 0;
      if (!esF && !esS) return;
      const monto = Math.abs(dif) || 0;

      if (!ofi[a.oficina]) ofi[a.oficina] = { oficina: a.oficina, casos: 0, faltCasos: 0, sobCasos: 0, faltMonto: 0, sobMonto: 0, arqueos: 0, porMes: new Array(12).fill(0) };
      const O = ofi[a.oficina];
      O.casos++; O.porMes[idx]++;
      if (esF) { M.faltCasos++; M.faltMonto += monto; O.faltCasos++; O.faltMonto += monto; }
      else { M.sobCasos++; M.sobMonto += monto; O.sobCasos++; O.sobMonto += monto; }
    });

    arqueos.forEach(a => { if (ofi[a.oficina]) ofi[a.oficina].arqueos++; });

    const oficinas = Object.keys(ofi).map(k => {
      const O = ofi[k];
      O.indice = O.arqueos > 0 ? Math.round((O.casos / O.arqueos) * 100) : 0;
      O.montoTotal = O.faltMonto + O.sobMonto;
      return O;
    }).sort((a, b) => b.casos - a.casos);

    const aniosSet = {}; todos.forEach(a => aniosSet[a.anio] = true);
    aniosSet[Utilities.formatDate(new Date(), TZ, 'yyyy')] = true;

    return { anio: String(y), meses, oficinas, anios: Object.keys(aniosSet).sort().reverse() };
  } catch (err) { return { error: err.toString() }; }
}


// ============================================================
// 13. DIAGNOSTICOS (de solo lectura)
// ============================================================
/** Verifica el manejo de fechas y zonas horarias. */
async function diagnosticoFechaHora() {
  const L = [];
  const ahora = new Date();
  const zonaProyecto = Session.getScriptTimeZone();

  L.push('=== DIAGNOSTICO DE FECHA Y ZONA HORARIA ===');
  L.push('');
  L.push('Zona horaria del proyecto            : ' + zonaProyecto);
  L.push('Zona usada por el sistema (constante TZ): ' + TZ + '  (hora de Colombia)');
  L.push('');
  L.push('Instante del servidor (UTC)      : ' + ahora.toISOString());
  L.push('Formateado en la zona del proyecto: ' + Utilities.formatDate(ahora, zonaProyecto, 'yyyy-MM-dd HH:mm:ss'));
  L.push('Formateado en Colombia (TZ)       : ' + Utilities.formatDate(ahora, TZ, 'yyyy-MM-dd HH:mm:ss'));
  L.push('');
  L.push('HOY en Colombia, hoyCol_()       : ' + hoyCol_());

  L.push('');
  L.push('--- Interpretacion de fechas de entrada (diaCol_) ---');
  const muestras = [hoyCol_(), '2026-09-01', '01/09/2026', '2026-08-31', '31.08.2026'];
  muestras.forEach(function (v) {
    const dia = diaCol_(v);
    const futura = dia > hoyCol_();
    L.push('  "' + v + '"  =>  ' + dia + (futura ? '   RECHAZADA (futura)' : '   ACEPTADA'));
  });

  L.push('');
  L.push('--- Dias habiles desde cada dia hasta hoy ---');
  for (const atras of [0, 1, 2, 3, 5]) {
    const d = new Date(ahora.getTime() - atras * 86400000);
    const dia = Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
    const h = await calcularDiasHabiles(dia, hoyCol_());
    L.push('  ' + dia + '  =>  ' + h + ' dia(s) habil(es)  ' + (h > DIAS_LIMITE ? 'EXTEMPORANEO' : 'OPORTUNO'));
  }

  const txt = L.join('\n');
  Logger.log(txt);
  return txt;
}

/** Audita la columna BB "ATM" del Directorio Nacional. */
async function diagnosticoATM() {
  const L = [];
  L.push('=== AUDITORIA COLUMNA BB "ATM" — Directorio Nacional ===');
  try {
    const dir = await getDirectorio_(true);
    const valores = {};
    const multiples = [];
    let conAtm = 0;

    dir.forEach(function (o) {
      const r = o.requiere;
      const clave = String(o.atmValor || '(vacio)');
      if (!valores[clave]) valores[clave] = { n: 0, codigos: r.codigosATM || [] };
      valores[clave].n++;
      if (r.atm) {
        conAtm++;
        if (r.numATM > 1) multiples.push(o);
      }
    });

    L.push('Oficinas totales: ' + dir.length);
    L.push('Oficinas con al menos un cajero: ' + conAtm);
    L.push('Oficinas que exigen MAS DE UN formato ATM: ' + multiples.length);
    L.push('');
    L.push('--- Valores distintos en BB y su interpretacion ---');
    Object.keys(valores).sort().forEach(function (k) {
      const v = valores[k];
      L.push('  "' + k + '"  (' + v.n + ' oficina(s))  =>  ' +
             (v.codigos.length ? v.codigos.length + ' formato(s) ATM [' + v.codigos.join(', ') + ']'
                               : 'SIN formato ATM'));
    });

    if (multiples.length) {
      L.push('');
      L.push('--- REVISAR: oficinas con mas de un formato ATM ---');
      multiples.forEach(function (o) {
        L.push('  Fila ' + o.fila + ' | ' + o.oficina + ' | BB="' + o.atmValor + '" => ' +
               o.requiere.numATM + ' formatos [' + o.requiere.codigosATM.join(', ') + ']');
      });
      L.push('Si alguna de estas oficinas en realidad tiene un solo cajero,');
      L.push('el valor de BB trae varios codigos separados; corrijalo en la BD.');
    } else {
      L.push('');
      L.push('OK: ninguna oficina genera formatos ATM duplicados.');
    }
    L.push('');
    L.push('Tope de seguridad vigente: MAX_ATM_POR_OFICINA = ' + MAX_ATM_POR_OFICINA);
  } catch (e) {
    L.push('ERROR: ' + e.message);
  }
  const txt = L.join('\n');
  Logger.log(txt);
  return txt;
}

async function diagnosticoDirectorio() {
  const L = [];
  try {
    const dir = await getDirectorio_(true);
    L.push('=== DIRECTORIO NACIONAL ===');
    L.push('BD: ' + DIRECTORIO_ID + ' | Hoja: ' + DIRECTORIO_HOJA);
    L.push('Oficinas leidas: ' + dir.length);

    let conEf = 0, conCh = 0, conAtm = 0, sinParam = 0;
    dir.forEach(o => {
      if (o.requiere.efectivo) conEf++;
      if (o.requiere.cheques) conCh++;
      if (o.requiere.atm) conAtm++;
      if (o.requiere.sinParametrizar) sinParam++;
    });
    L.push('Exigen FOR-GOR-020-09 (efectivo): ' + conEf);
    L.push('Exigen FOR-GOR-048-01 (cheques): ' + conCh);
    L.push('Exigen FOR-GOR-099-02 (ATM): ' + conAtm);
    L.push('Sin MEDIO DE PAGO parametrizado (vacio o #N/A): ' + sinParam);

    L.push('');
    L.push('--- Muestra de las primeras 25 oficinas ---');
    dir.slice(0, 25).forEach(o => {
      const req = [];
      if (o.requiere.efectivo) req.push('EFECTIVO');
      if (o.requiere.cheques) req.push('CHEQUES');
      if (o.requiere.atm) req.push('ATM x' + o.requiere.numATM + ' (' + (o.requiere.codigosATM || []).join(', ') + ')');
      L.push('  Fila ' + o.fila + ' | ' + o.oficina + ' | Lider: ' + (o.lider || '(vacio)') +
             ' | MP: "' + o.medioPago + '" | ATM: "' + o.atmValor + '" => ' + (req.join(' + ') || 'SIN REQUISITOS'));
    });

    L.push('');
    L.push('--- Lideres distintos en la columna Y ---');
    const set = {};
    dir.forEach(o => { if (o.lider) set[o.lider] = (set[o.lider] || 0) + 1; });
    Object.keys(set).sort().forEach(k => L.push('  ' + k + ' -> ' + set[k] + ' oficina(s)'));

  } catch (e) {
    L.push('ERROR: ' + e.toString());
    L.push('Verifica que la cuenta que ejecuta el script tenga acceso a la BD ' + DIRECTORIO_ID);
  }
  const log = L.join('\n');
  Logger.log(log);
  return log;
}

/** Muestra que oficinas ve cada usuario Lider (detecta nombres que no cruzan). */
async function diagnosticoCruceLideres() {
  const L = [];
  const usuarios = (await getUsuarios_()).filter(u => u.rol === 'Lider');
  L.push('=== CRUCE LIDERES <-> DIRECTORIO NACIONAL ===');
  L.push('Lideres en la hoja Usuarios: ' + usuarios.length);

  const dir = await getDirectorio_(false);
  const asignadas = {};

  for (const u of usuarios) {
    const perfil = await perfilCruce_(u.id);
    const mias = dir.filter(o => coincideLider_(o.lider, perfil));
    mias.forEach(o => asignadas[norm_(o.oficina)] = true);
    L.push('  ' + u.id + ' (nombre directorio: "' + (perfil.nombre || '—') + '") -> ' + mias.length + ' oficina(s)' +
           (mias.length ? ': ' + mias.slice(0, 6).map(o => o.oficina).join(', ') + (mias.length > 6 ? '...' : '') : '  <<< SIN CRUCE'));
  }

  const huerfanas = dir.filter(o => !asignadas[norm_(o.oficina)] && o.lider);
  L.push('');
  L.push('Oficinas con lider en el directorio pero sin usuario que cruce: ' + huerfanas.length);
  huerfanas.slice(0, 30).forEach(o => L.push('  ' + o.oficina + ' -> "' + o.lider + '"'));
  if (huerfanas.length) {
    L.push('');
    L.push('ACCION: registra el puente en la hoja Alias_Lideres (ID_Usuario | Nombre_En_Directorio)');
    L.push('        o completa la columna G "Nombre_Directorio" en la hoja Usuarios.');
  }

  const log = L.join('\n');
  Logger.log(log);
  return log;
}

/**
 * Diagnostico general (version liviana): usuarios con llave y, en vez de una
 * linea por cada fila de Arqueos (mas de mil), el conteo por estado de las filas
 * del mes actual y el detalle de las primeras 100.
 */
async function diagnosticoSistema() {
  const L = [];
  const usuarios = await getUsuarios_();
  L.push('=== USUARIOS (' + usuarios.length + ') ===');
  usuarios.forEach(u => L.push('  ' + u.id + ' | rol=' + u.rol + ' | nombre=' + u.nombre));
  const lideres = usuarios.filter(u => u.rol === 'Lider');
  L.push('Lideres detectados: ' + lideres.length + (lideres.length ? '' : '  <<< PROBLEMA: sin lideres, nada contara'));

  const mesActual = Utilities.formatDate(new Date(), TZ, 'yyyy-MM');
  const arqs = await leerArqueos_('', 'Analista');
  L.push('=== ARQUEOS (filas: ' + arqs.length + ') | mes actual: ' + mesActual + ' | regla de meta v6 ===');
  const estadoDe = a => {
    if (a.mes !== mesActual) return 'OK pero de otro mes';
    if (a.extemporaneo === 'SÍ') return 'EXTEMPORANEO (no suma hasta normalizar)';
    if (a.formato === FMT.CHEQUES) return 'COMPLEMENTARIO (cheques): no consume cupo de meta';
    if (a.atmRepetido) return 'ATM REPETIDO: no suma de nuevo';
    return 'CUENTA como VALIDO' + (a.tipoVisita === VISITA.ADICIONAL ? ' (visita adicional: tambien suma)' : '');
  };
  const conteo = {};
  arqs.forEach(a => { const e = estadoDe(a); conteo[e] = (conteo[e] || 0) + 1; });
  Object.keys(conteo).sort().forEach(k => L.push('  ' + k + ': ' + conteo[k]));
  const delMes = arqs.filter(a => a.mes === mesActual);
  L.push('--- Detalle del mes actual (' + Math.min(delMes.length, 100) + ' de ' + delMes.length + ') ---');
  delMes.slice(0, 100).forEach(a => {
    let estado = estadoDe(a);
    if (a.atmRepetido) estado = 'ATM REPETIDO: el cajero ya conto el ' + a.atmPrimero + '; no suma de nuevo';
    L.push('  Fila ' + a.fila + ' [' + a.id + ' | ' + a.idUsuario + ' | ' + a.oficina + ' | ' + (a.formato || 'sin formato') + ']: ' + estado);
  });
  const log = L.join('\n');
  Logger.log(log);
  return log;
}

// ============================================================
// 14. GESTION DE NOVEDADES (observaciones, soportes, explicaciones, OK)
// ============================================================
/** Catalogo de tipologias (hoja Tipologias; si no existe, las de defecto). */
async function getTipologias() {
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Tipologias');
    const ult = sh ? await sh.getLastRow() : 0;
    if (!sh || ult < 2) return TIPOLOGIAS_DEFECTO.slice();
    const v = await sh.getRange(2, 1, ult - 1, 2).getValues();
    const out = v.filter(r => String(r[0] || '').trim() && norm_(r[1]) !== 'NO').map(r => String(r[0]).trim());
    return out.length ? out : TIPOLOGIAS_DEFECTO.slice();
  } catch (e) { return TIPOLOGIAS_DEFECTO.slice(); }
}

/** Devuelve { fila (1-based), valores } del arqueo o null. */
async function buscarFilaArqueo_(sh, idArqueo) {
  const id = String(idArqueo || '').trim();
  const todo = await sh.getDataRange().getValues();
  const n = todo.length;
  if (n < 2 || !id) return null;
  // Recorrido de la columna A (equivale al TextFinder con matchEntireCell).
  let fila = 0;
  for (let i = 1; i < n; i++) if (String(todo[i][0]).trim() === id) { fila = i + 1; break; }
  if (!fila) return null;
  const valores = todo[fila - 1].slice(0, ARQ_NCOL).map(v => (v === undefined || v === null ? '' : v));
  while (valores.length < ARQ_NCOL) valores.push('');
  return { fila: fila, valores: valores };
}

async function registrarEventoGestion_(ss, idArqueo, oficina, idLider, accion, actor, rolActor, detalle, estadoRev, estadoDif, notificado) {
  try {
    const sh = ss.getSheetByName('Gestion_Novedades');
    if (!sh) return;
    await sh.appendRow(['EV-' + new Date().getTime(), new Date(), idArqueo, oficina, idLider, accion, actor, rolActor,
      String(detalle || ''), estadoRev || '', estadoDif || '', notificado ? 'SI' : 'NO']);
  } catch (e) { /* la bitacora no debe bloquear la operacion */ }
}

/**
 * Acciones del ANALISTA / REGIONAL sobre un arqueo.
 *   accion = 'OBSERVACION'           datos.texto  -> observacion general (no genera pendiente)
 *   accion = 'NOVEDAD_SOPORTE'       datos.texto  -> inconsistencia en el soporte: el lider debe corregir y recargar
 *   accion = 'SOLICITAR_EXPLICACION' datos.texto  -> pide explicacion del faltante / sobrante
 *   accion = 'OK'                    datos.texto  -> novedad subsanada, listo para consolidacion
 *   accion = 'REABRIR'               datos.texto  -> quita el OK
 */
async function gestionarArqueo(idArqueo, accion, datos, idUsuario, rol) {
  const r = norm_(rol);
  if (r !== 'ANALISTA' && r !== 'REGIONAL') return { success: false, message: 'No tienes permisos para gestionar arqueos.' };
  datos = datos || {};
  const texto = String(datos.texto || '').trim();
  const acc = norm_(accion);

  const lock = LockService.getScriptLock();
  try { await lock.waitLock(20000); } catch (e) { return { success: false, message: 'El sistema esta ocupado. Intenta de nuevo.' }; }
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('Arqueos');
    const reg = await buscarFilaArqueo_(sh, idArqueo);
    if (!reg) return { success: false, message: 'Arqueo no encontrado: ' + idArqueo };
    const v = reg.valores;
    const oficina = String(v[AC.OFICINA] || '');
    const idLider = String(v[AC.USUARIO] || '').trim();
    const ahora = new Date();
    const setCol = (col, val) => sh.getRange(reg.fila, col + 1).setValue(val);

    let notificado = false, mensaje = '', estadoRev = String(v[AC.ESTADO_REV] || ''), estadoDif = String(v[AC.ESTADO_DIF] || '');

    if (acc === 'OBSERVACION') {
      if (!texto) return { success: false, message: 'Escribe la observación.' };
      await setCol(AC.OBS_ANALISTA, texto);
      await setCol(AC.REVISOR, idUsuario); await setCol(AC.FECHA_REV, ahora);
      mensaje = 'Observación registrada.';

    } else if (acc === 'NOVEDAD_SOPORTE') {
      if (!texto) return { success: false, message: 'Describe la inconsistencia del soporte para que el líder pueda corregirla.' };
      estadoRev = REV.NOVEDAD;
      await setCol(AC.OBS_ANALISTA, texto);
      await setCol(AC.ESTADO_REV, estadoRev);
      await setCol(AC.REVISOR, idUsuario); await setCol(AC.FECHA_REV, ahora);
      notificado = await notificarLider_(idLider, 'COI · Novedad en soporte de arqueo ' + oficina,
        cuerpoNotificacion_('Novedad en el soporte del arqueo', idArqueo, oficina, v, texto,
          'Ingresa a COI > Control de Arqueos > Mis Arqueos, abre el registro marcado en rojo, responde la novedad y vuelve a cargar el soporte corregido.'));
      mensaje = 'Novedad registrada. El líder quedó notificado y verá la alerta hasta que corrija el soporte.';

    } else if (acc === 'SOLICITAR_EXPLICACION') {
      const nov = norm_(v[AC.NOVEDAD]);
      const usdDif = num_(v[AC.USD_DIF]);
      if (nov !== 'FALTANTE' && nov !== 'SOBRANTE' && usdDif === 0) {
        return { success: false, message: 'Este arqueo no registra faltante ni sobrante.' };
      }
      estadoDif = DIFE.PENDIENTE;
      await setCol(AC.EXPL_SOLIC, 'SI');
      await setCol(AC.ESTADO_DIF, estadoDif);
      if (texto) await setCol(AC.OBS_ANALISTA, texto);
      await setCol(AC.REVISOR, idUsuario); await setCol(AC.FECHA_REV, ahora);
      notificado = await notificarLider_(idLider, 'COI · Explicación requerida: ' + (nov || 'DIFERENCIA USD') + ' en ' + oficina,
        cuerpoNotificacion_('Explicación requerida por ' + (nov || 'diferencia en USD').toLowerCase(), idArqueo, oficina, v,
          texto || 'Por favor explica el origen de la diferencia, indica la tipología y si fue recuperada / cruzada.',
          'Ingresa a COI > Control de Arqueos > Mis Arqueos y responde la solicitud. La alerta permanecerá activa hasta que registres la explicación.'));
      mensaje = 'Solicitud de explicación enviada. Quedará activa hasta que el líder responda.';

    } else if (acc === 'OK') {
      estadoRev = REV.OK;
      await setCol(AC.ESTADO_REV, estadoRev);
      if (texto) await setCol(AC.OBS_ANALISTA, texto);
      await setCol(AC.REVISOR, idUsuario); await setCol(AC.FECHA_REV, ahora);
      // Si habia explicacion pendiente, el OK la cierra como revisada.
      if (norm_(v[AC.EXPL_SOLIC]) === 'SI' && (!estadoDif || estadoDif === DIFE.PENDIENTE)) {
        estadoDif = String(datos.estadoDiferencia || '').trim() || estadoDif;
        if (estadoDif) await setCol(AC.ESTADO_DIF, estadoDif);
      }
      mensaje = 'Registro confirmado como OK: listo para consolidación.';

    } else if (acc === 'REABRIR') {
      estadoRev = REV.SIN_REVISAR;
      await setCol(AC.ESTADO_REV, '');
      if (texto) await setCol(AC.OBS_ANALISTA, texto);
      await setCol(AC.REVISOR, idUsuario); await setCol(AC.FECHA_REV, ahora);
      mensaje = 'Registro reabierto.';
    } else {
      return { success: false, message: 'Acción no reconocida: ' + accion };
    }

    invalidarCacheArqueos_();
    await registrarEventoGestion_(ss, idArqueo, oficina, idLider, acc, idUsuario, rol, texto, estadoRev, estadoDif, notificado);
    return { success: true, message: mensaje, estadoRevision: estadoRev, estadoDiferencia: estadoDif, notificado: notificado };
  } catch (e) {
    return { success: false, message: 'Error al gestionar el arqueo: ' + e.toString() };
  } finally {
    try { lock.releaseLock(); } catch (e) { /* nada */ }
  }
}

/**
 * Respuesta del LIDER a las novedades pendientes de un arqueo.
 * datos = {
 *   respuesta: '',                         // texto de correccion del soporte
 *   archivo: {fileName, mimeType, base64}, // soporte corregido (PDF o imagen), opcional si hay respuesta
 *   explicacion: '', tipologia: '', estadoDiferencia: ''   // para faltantes / sobrantes
 * }
 */
async function responderNovedad(idArqueo, datos, idUsuario, rol) {
  datos = datos || {};
  const lock = LockService.getScriptLock();
  try { await lock.waitLock(20000); } catch (e) { return { success: false, message: 'El sistema esta ocupado. Intenta de nuevo.' }; }
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sh = ss.getSheetByName('Arqueos');
    const reg = await buscarFilaArqueo_(sh, idArqueo);
    if (!reg) return { success: false, message: 'Arqueo no encontrado: ' + idArqueo };
    const v = reg.valores;
    const idLider = String(v[AC.USUARIO] || '').trim();
    if (norm_(rol) === 'LIDER' && idLider !== String(idUsuario).trim()) {
      return { success: false, message: 'Este arqueo no pertenece a tu usuario.' };
    }
    const oficina = String(v[AC.OFICINA] || '');
    const ahora = new Date();
    const setCol = (col, val) => sh.getRange(reg.fila, col + 1).setValue(val);
    const hechos = [];
    let estadoRev = String(v[AC.ESTADO_REV] || ''), estadoDif = String(v[AC.ESTADO_DIF] || '');

    // ---- 1. Correccion del soporte ----
    const respuesta = String(datos.respuesta || '').trim();
    const archivo = datos.archivo && datos.archivo.base64 ? datos.archivo : null;
    if (estadoRev === REV.NOVEDAD || respuesta || archivo) {
      if (estadoRev === REV.NOVEDAD && !respuesta && !archivo) {
        return { success: false, message: 'Describe la corrección realizada y/o adjunta el soporte corregido.' };
      }
      if (archivo) {
        const mt = String(archivo.mimeType || '').toLowerCase();
        const nm = String(archivo.fileName || 'soporte').toLowerCase();
        const esPdf = mt.indexOf('pdf') >= 0 || nm.slice(-4) === '.pdf';
        const esImg = mt.indexOf('image') === 0 || /\.(jpe?g|png|webp)$/.test(nm);
        if (!esPdf && !esImg) return { success: false, message: 'El soporte corregido debe ser PDF o imagen (JPG/PNG).' };
        const fReal = parseFecha_(v[AC.FECHA]) || ahora;
        const carpeta = getCarpeta_([FOLDER_NAME, Utilities.formatDate(fReal, TZ, 'yyyy-MM'), oficina, 'Correcciones']);
        const nombre = 'CORRECCION_' + String(idArqueo).replace(/[^A-Za-z0-9\-]/g, '') + '_' + Utilities.formatDate(ahora, TZ, 'yyyyMMdd_HHmm') + '_' + archivo.fileName;
        const url = DriveFiles.save({ folder: carpeta, name: nombre, mimeType: archivo.mimeType || 'application/pdf', data: bytesBase64_(archivo.base64) }).url;
        const prev = String(v[AC.URL_CORR] || '').trim();
        await setCol(AC.URL_CORR, prev ? prev + ' | ' + url : url);
        hechos.push('Soporte corregido cargado');
      }
      if (respuesta) { await setCol(AC.RESP_LIDER, respuesta); hechos.push('Respuesta registrada'); }
      await setCol(AC.FECHA_CORR, ahora);
      if (estadoRev === REV.NOVEDAD) { estadoRev = REV.CORREGIDO; await setCol(AC.ESTADO_REV, estadoRev); }
    }

    // ---- 2. Explicacion del faltante / sobrante ----
    const explicacion = String(datos.explicacion || '').trim();
    const tipologia = String(datos.tipologia || '').trim();
    const estadoDifNuevo = String(datos.estadoDiferencia || '').trim();
    const solicitada = norm_(v[AC.EXPL_SOLIC]) === 'SI';
    if (explicacion || tipologia || estadoDifNuevo) {
      if (!explicacion) return { success: false, message: 'Escribe la explicación de la diferencia.' };
      if (!tipologia) return { success: false, message: 'Selecciona la tipología de la diferencia.' };
      const validos = [DIFE.RECUPERADO, DIFE.NO_RECUPERADO, DIFE.CRUZADO, DIFE.NO_CRUZADO];
      if (validos.indexOf(estadoDifNuevo) < 0) return { success: false, message: 'Indica si el faltante fue recuperado o si el sobrante fue cruzado / compensado.' };
      await setCol(AC.EXPL_LIDER, explicacion);
      await setCol(AC.TIPOLOGIA, tipologia);
      await setCol(AC.ESTADO_DIF, estadoDifNuevo);
      await setCol(AC.FECHA_EXPL, ahora);
      if (!solicitada) await setCol(AC.EXPL_SOLIC, 'SI');
      estadoDif = estadoDifNuevo;
      hechos.push('Explicación registrada (' + estadoDifNuevo + ')');
    } else if (solicitada && (!estadoDif || estadoDif === DIFE.PENDIENTE) && !hechos.length) {
      return { success: false, message: 'Esta novedad requiere la explicación de la diferencia, la tipología y su estado.' };
    }

    if (!hechos.length) return { success: false, message: 'No se recibió ninguna respuesta para registrar.' };

    invalidarCacheArqueos_();
    const detalle = hechos.join(' · ') + (respuesta ? ' | ' + respuesta : '') + (explicacion ? ' | ' + explicacion : '');
    await registrarEventoGestion_(ss, idArqueo, oficina, idLider, 'RESPUESTA_LIDER', idUsuario, rol, detalle, estadoRev, estadoDif, false);

    // Aviso al revisor (si tiene correo) para que confirme el OK.
    const revisor = String(v[AC.REVISOR] || '').trim();
    if (revisor) {
      await notificarUsuario_(revisor, 'COI · El líder respondió la novedad de ' + oficina,
        '<p>El líder <b>' + esc_(idUsuario) + '</b> respondió la novedad del arqueo <b>' + esc_(idArqueo) + '</b> (' + esc_(oficina) + ').</p>' +
        '<p>' + esc_(hechos.join(' · ')) + '</p><p>Ingresa a COI &gt; Control de Arqueos &gt; Matriz de Arqueos para revisar y marcar OK.</p>');
    }

    return { success: true, message: 'Respuesta enviada: ' + hechos.join(' · ') + '. El analista confirmará el OK.',
      estadoRevision: estadoRev, estadoDiferencia: estadoDif };
  } catch (e) {
    return { success: false, message: 'Error al registrar la respuesta: ' + e.toString() };
  } finally {
    try { lock.releaseLock(); } catch (e) { /* nada */ }
  }
}

/** Bitacora de gestion de un arqueo (para el modal de detalle). */
async function obtenerBitacoraArqueo(idArqueo) {
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Gestion_Novedades');
    if (!sh || (await sh.getLastRow()) < 2) return [];
    const v = await sh.getDataRange().getValues();
    const nombreDe = await nombresUsuarios_();
    const out = [];
    for (let i = 1; i < v.length; i++) {
      if (String(v[i][2]).trim() !== String(idArqueo).trim()) continue;
      out.push({ fecha: fmtF_(parseFecha_(v[i][1]), 'dd/MM/yyyy HH:mm'), accion: v[i][5], actor: nombreDe[String(v[i][6]).trim()] || v[i][6],
        rol: v[i][7], detalle: v[i][8], estadoRevision: v[i][9], estadoDiferencia: v[i][10], notificado: v[i][11] });
    }
    return out;
  } catch (e) { return []; }
}

/**
 * Pendientes de gestion segun el rol:
 *  - Lider: novedades que debe responder (soporte / explicacion). Son las
 *    alertas PERSISTENTES: se muestran en cada pantalla hasta que responda.
 *  - Analista / Regional: respuestas de lideres pendientes de confirmar OK y
 *    novedades abiertas sin respuesta.
 */
async function obtenerPendientes(idUsuario, rol) {
  return conCacheResultado_('obtenerPendientes', idUsuario, rol, [], function () { return obtenerPendientesCalc_(idUsuario, rol); });
}

async function obtenerPendientesCalc_(idUsuario, rol) {
  try {
    const nombreDe = await nombresUsuarios_();
    const r = norm_(rol);
    const items = [];
    (await leerArqueos_(idUsuario, rol)).forEach(a => {
      const g = estadoGestion_(a);
      const base = { id: a.id, oficina: a.oficina, fechaReal: a.fechaReal, formato: a.formato, lider: a.idUsuario,
        nombreLider: nombreDe[a.idUsuario] || a.idUsuario, novedad: a.novedad, diferencia: a.diferencia,
        usdDiferencia: a.usdDiferencia, obsAnalista: a.obsAnalista, fechaRevision: a.fechaRevision,
        estadoRevision: a.estadoRevision, estadoDiferencia: a.estadoDiferencia, urlPdf: a.urlPdf || a.url };
      if (r === 'LIDER') {
        if (g.pendienteLider.length) items.push(Object.assign(base, { tipos: g.pendienteLider, quien: 'LIDER' }));
      } else {
        if (g.pendienteAnalista) items.push(Object.assign(base, { tipos: ['CONFIRMAR OK'], quien: 'ANALISTA' }));
        else if (g.pendienteLider.length) items.push(Object.assign(base, { tipos: g.pendienteLider, quien: 'LIDER' }));
      }
    });
    return { success: true, total: items.length, items: items.reverse(),
      pendientesLider: items.filter(i => i.quien === 'LIDER').length,
      pendientesAnalista: items.filter(i => i.quien === 'ANALISTA').length };
  } catch (e) {
    return { success: false, message: e.toString(), total: 0, items: [] };
  }
}


// ============================================================
// 15. NOTIFICACIONES (correo + recordatorio diario persistente)
// ============================================================
async function correoDeUsuario_(idUsuario) {
  const id = String(idUsuario).trim();
  const u = (await datosUsuarios_()).usuarios.find(x => x.id === id);
  return u && u.correo.indexOf('@') > 0 ? u.correo : '';
}

async function notificarUsuario_(idUsuario, asunto, html) {
  try {
    const correo = await correoDeUsuario_(idUsuario);
    if (!correo) return false;
    if (MailApp.getRemainingDailyQuota() <= 0) return false;
    const opts = { htmlBody: plantillaCorreo_(asunto, html), name: 'COI · Control de Arqueos' };
    if (CORREO_COPIA_NOTIFICACIONES) opts.cc = CORREO_COPIA_NOTIFICACIONES;
    await MailApp.sendEmail(correo, asunto, 'Abre este correo en un cliente compatible con HTML.', opts);
    return true;
  } catch (e) { return false; }
}

function notificarLider_(idLider, asunto, html) { return notificarUsuario_(idLider, asunto, html); }

function cuerpoNotificacion_(titulo, idArqueo, oficina, v, texto, instruccion) {
  const f = parseFecha_(v[AC.FECHA]);
  return '<h3 style="margin:0 0 8px">' + esc_(titulo) + '</h3>' +
    '<table style="font-size:13px;border-collapse:collapse">' +
    '<tr><td style="padding:3px 10px 3px 0"><b>Arqueo</b></td><td>' + esc_(idArqueo) + '</td></tr>' +
    '<tr><td style="padding:3px 10px 3px 0"><b>Oficina</b></td><td>' + esc_(oficina) + '</td></tr>' +
    '<tr><td style="padding:3px 10px 3px 0"><b>Fecha del arqueo</b></td><td>' + (f ? Utilities.formatDate(f, TZ, 'dd/MM/yyyy') : '—') + '</td></tr>' +
    '<tr><td style="padding:3px 10px 3px 0"><b>Formato</b></td><td>' + esc_(v[AC.FORMATO]) + '</td></tr>' +
    '<tr><td style="padding:3px 10px 3px 0"><b>Novedad</b></td><td>' + esc_(v[AC.NOVEDAD]) + (v[AC.DIF] !== '' ? ' (' + esc_(v[AC.DIF]) + ')' : '') + '</td></tr>' +
    '</table>' +
    '<p style="background:#FFF8DC;border-left:4px solid #F6CF46;padding:8px 10px;margin:12px 0"><b>Mensaje del analista:</b><br>' + esc_(texto).replace(/\n/g, '<br>') + '</p>' +
    '<p>' + esc_(instruccion) + '</p>' +
    '<p style="color:#b91c1c"><b>Esta alerta permanecerá activa en la plataforma y se recordará diariamente hasta que respondas.</b></p>';
}

function plantillaCorreo_(asunto, html) {
  return '<div style="font-family:Arial,Helvetica,sans-serif;color:#25294F;max-width:640px">' +
    '<div style="background:#25294F;color:#F6CF46;padding:14px 18px;border-radius:10px 10px 0 0;font-weight:bold">MULTIVAL · COI · Control de Arqueos</div>' +
    '<div style="border:1px solid #e2e8f0;border-top:0;padding:18px;border-radius:0 0 10px 10px">' + html +
    '<hr style="border:0;border-top:1px solid #e2e8f0;margin:16px 0"><p style="font-size:11px;color:#64748b">Mensaje automático generado por COI. No respondas a este correo.</p></div></div>';
}

/**
 * Recordatorio DIARIO a cada lider con novedades sin responder y al equipo
 * analista con respuestas pendientes de OK. Puede ejecutarse a mano o desde un
 * programador externo (en la demo los correos quedan en la bandeja de salida).
 */
async function enviarRecordatoriosPendientes() {
  const usuarios = await getUsuarios_();
  const log = [];
  const todos = await leerArqueos_('', 'Analista');
  const porLider = {};
  const paraAnalista = [];
  todos.forEach(a => {
    const g = estadoGestion_(a);
    if (g.pendienteLider.length) {
      if (!porLider[a.idUsuario]) porLider[a.idUsuario] = [];
      porLider[a.idUsuario].push({ a: a, tipos: g.pendienteLider });
    }
    if (g.pendienteAnalista) paraAnalista.push(a);
  });

  for (const lid of Object.keys(porLider)) {
    const items = porLider[lid];
    const filas = items.map(it => '<tr><td style="padding:4px 8px;border:1px solid #e2e8f0">' + esc_(it.a.oficina) + '</td>' +
      '<td style="padding:4px 8px;border:1px solid #e2e8f0">' + esc_(it.a.fechaReal) + '</td>' +
      '<td style="padding:4px 8px;border:1px solid #e2e8f0">' + esc_(it.a.formato) + '</td>' +
      '<td style="padding:4px 8px;border:1px solid #e2e8f0">' + esc_(it.tipos.join(' + ')) + '</td>' +
      '<td style="padding:4px 8px;border:1px solid #e2e8f0">' + esc_(it.a.obsAnalista || '') + '</td></tr>').join('');
    const html = '<h3 style="margin:0 0 8px">Tienes ' + items.length + ' novedad(es) de arqueo pendiente(s) por responder</h3>' +
      '<table style="font-size:12px;border-collapse:collapse"><tr style="background:#f1f5f9"><th style="padding:4px 8px;border:1px solid #e2e8f0">Oficina</th><th style="padding:4px 8px;border:1px solid #e2e8f0">Fecha</th><th style="padding:4px 8px;border:1px solid #e2e8f0">Formato</th><th style="padding:4px 8px;border:1px solid #e2e8f0">Pendiente</th><th style="padding:4px 8px;border:1px solid #e2e8f0">Mensaje del analista</th></tr>' + filas + '</table>' +
      '<p>Ingresa a COI &gt; Control de Arqueos &gt; <b>Mis Arqueos</b> y responde cada novedad. Este recordatorio se enviará todos los días hasta que no queden pendientes.</p>';
    const ok = await notificarUsuario_(lid, 'COI · Recordatorio: ' + items.length + ' novedad(es) de arqueo pendiente(s)', html);
    log.push(lid + ': ' + items.length + ' pendiente(s) -> ' + (ok ? 'correo enviado' : 'sin correo / no enviado'));
  }

  if (paraAnalista.length) {
    for (const u of usuarios.filter(x => x.rol === 'Analista')) {
      const html = '<h3 style="margin:0 0 8px">' + paraAnalista.length + ' respuesta(s) de líderes pendientes de confirmar OK</h3><ul>' +
        paraAnalista.slice(0, 40).map(a => '<li>' + esc_(a.oficina) + ' · ' + esc_(a.fechaReal) + ' · ' + esc_(a.formato) + ' · líder ' + esc_(a.idUsuario) + '</li>').join('') +
        (paraAnalista.length > 40 ? '<li>…</li>' : '') + '</ul><p>Revisa la Matriz de Arqueos en COI y marca OK los registros subsanados.</p>';
      const ok = await notificarUsuario_(u.id, 'COI · ' + paraAnalista.length + ' respuesta(s) pendientes de OK', html);
      log.push('Analista ' + u.id + ' -> ' + (ok ? 'correo enviado' : 'sin correo / no enviado'));
    }
  }
  const salida = log.length ? log.join('\n') : 'Sin novedades pendientes: no se envio ningun recordatorio.';
  Logger.log(salida);
  return salida;
}


// ============================================================
// 16. ESTADO DE OFICINAS DEL MES (base de dashboards por cliente / regional)
// ============================================================
/**
 * Calcula, para cada oficina visible segun el rol, el estado de cumplimiento
 * del mes: arqueo de oficina (efectivo), cheques Porvenir, cajeros ATM (cada
 * cajero cuenta una vez al mes), oportunidad (a tiempo / extemporaneo),
 * visitas, novedades y pendientes de gestion.
 */
async function calcularEstadoOficinas_(idUsuario, rol, mes) {
  const r = norm_(rol);
  const dir = await getDirectorio_(false);
  const nombreDe = await nombresUsuarios_();

  // Oficina -> id de usuario lider (cruce por nombre)
  const liderDe = {};
  (await getOficinas_(idUsuario, 'Analista')).forEach(o => { if (!liderDe[norm_(o.oficina)]) liderDe[norm_(o.oficina)] = o.lider; });

  let oficinas = dir;
  if (r === 'LIDER') {
    const perfil = await perfilCruce_(idUsuario);
    oficinas = dir.filter(o => coincideLider_(o.lider, perfil));
  }

  const arqueos = (await leerArqueos_(idUsuario, rol)).filter(a => a.mes === mes);
  const porOfi = {};
  arqueos.forEach(a => {
    const k = norm_(a.oficina);
    if (!porOfi[k]) porOfi[k] = [];
    porOfi[k].push(a);
  });

  const estadoFormato = (lista) => {
    // lista: arqueos de un formato. OK si existe al menos uno valido (no extemporaneo pendiente).
    if (!lista.length) return { estado: 'PENDIENTE', n: 0, fecha: '', aTiempo: false };
    const validos = lista.filter(x => x.extemporaneo !== 'SÍ');
    const ord = (validos.length ? validos : lista).slice().sort((x, y) => x.fechaISO < y.fechaISO ? -1 : 1);
    return { estado: validos.length ? 'OK' : 'EXTEMPORANEO', n: lista.length, fecha: ord[0].fechaReal, aTiempo: validos.length > 0 };
  };

  const out = oficinas.map(o => {
    const k = norm_(o.oficina);
    const lista = porOfi[k] || [];
    const ef = lista.filter(a => a.formato === FMT.EFECTIVO);
    const ch = lista.filter(a => a.formato === FMT.CHEQUES);
    const at = lista.filter(a => a.formato === FMT.ATM);
    const req = o.requiere || {};

    const eEf = estadoFormato(ef);
    const eCh = estadoFormato(ch);

    // ATM: cajeros distintos con arqueo valido en el mes.
    const cajerosOK = {};
    at.forEach(a => { if (a.extemporaneo !== 'SÍ') cajerosOK[claveCajero_(a.numeroElem)] = a.fechaReal; });
    const numATM = req.atm ? Math.max(req.numATM || 1, 1) : 0;
    const atmHechos = Math.min(Object.keys(cajerosOK).length, numATM);
    const eAt = { estado: !req.atm ? 'N/A' : (atmHechos >= numATM ? 'OK' : (at.length ? (atmHechos > 0 ? 'PARCIAL' : 'EXTEMPORANEO') : 'PENDIENTE')),
                  n: at.length, hechos: atmHechos, total: numATM, aTiempo: req.atm && atmHechos >= numATM };

    const sesiones = {};
    lista.forEach(a => sesiones[a.idSesion || a.id] = true);
    const visitas = Object.keys(sesiones).length;

    const exigeEf = !!(req.efectivo || req.sinParametrizar);
    const exigeCh = !!req.cheques;
    const exigeAt = !!req.atm;
    const faltantes = lista.filter(a => a.novedad === 'FALTANTE').length;
    const sobrantes = lista.filter(a => a.novedad === 'SOBRANTE').length;
    const pendGestion = lista.filter(a => estadoGestion_(a).pendienteLider.length).length;
    const validosCuentan = lista.filter(a => a.cuentaMeta && a.extemporaneo !== 'SÍ').length;
    const extemporaneos = lista.filter(a => a.extemporaneo === 'SÍ').length;

    const pendientes = [];
    if (exigeEf && eEf.estado !== 'OK') pendientes.push('Oficina');
    if (exigeCh && eCh.estado !== 'OK') pendientes.push('Cheques');
    if (exigeAt && eAt.estado !== 'OK') pendientes.push('ATM');

    const conArqueo = ef.length > 0 || at.length > 0 || ch.length > 0;
    const cumple = pendientes.length === 0 && (exigeEf || exigeCh || exigeAt);
    const aTiempo = cumple && !extemporaneos;

    return {
      oficina: o.oficina, cliente: o.cliente, regional: o.regional, zona: o.zona, propia: !!o.propia, usd: !!o.usd,
      liderDirectorio: o.lider, idLider: liderDe[k] || '', lider: nombreDe[liderDe[k]] || o.lider || '—',
      exige: { oficina: exigeEf, cheques: exigeCh, atm: exigeAt, numATM: numATM, codigosATM: req.codigosATM || [] },
      estadoOficina: exigeEf ? eEf.estado : (ef.length ? 'OK' : 'N/A'), fechaOficina: eEf.fecha, arqueosOficina: ef.length,
      estadoCheques: exigeCh ? eCh.estado : (ch.length ? 'OK' : 'N/A'), fechaCheques: eCh.fecha, arqueosCheques: ch.length,
      estadoATM: eAt.estado, atmHechos: atmHechos, atmTotal: numATM, arqueosATM: at.length,
      visitas: visitas, arqueosValidos: validosCuentan, extemporaneos: extemporaneos,
      faltantes: faltantes, sobrantes: sobrantes, pendientesGestion: pendGestion,
      conArqueo: conArqueo, cumple: cumple, aTiempo: aTiempo, pendientes: pendientes,
      estadoGeneral: cumple ? (aTiempo ? 'AL DIA' : 'CUMPLE CON EXTEMPORANEO') : (conArqueo ? 'PARCIAL' : 'SIN ARQUEO')
    };
  });

  out.sort((a, b) => a.oficina.localeCompare(b.oficina, 'es'));
  return { oficinas: out, arqueos: arqueos, catalogo: catalogoDirectorio_(oficinas), mes: mes };
}

/**
 * DASHBOARD POR CLIENTE. cliente = '' muestra todos.
 */
async function obtenerDashboardClientes(idUsuario, rol, mesFiltro, cliente) {
  return conCacheResultado_('obtenerDashboardClientes', idUsuario, rol, [mesFiltro || Utilities.formatDate(new Date(), TZ, 'yyyy-MM'), norm_(cliente || '')], function () { return obtenerDashboardClientesCalc_(idUsuario, rol, mesFiltro, cliente); });
}

async function obtenerDashboardClientesCalc_(idUsuario, rol, mesFiltro, cliente) {
  try {
    const mes = mesFiltro || Utilities.formatDate(new Date(), TZ, 'yyyy-MM');
    const base = await calcularEstadoOficinas_(idUsuario, rol, mes);
    const cli = norm_(cliente || '');
    const lista = cli ? base.oficinas.filter(o => norm_(o.cliente) === cli) : base.oficinas;

    const tot = { oficinas: lista.length, conArqueo: 0, sinArqueo: 0, cumplen: 0, alDia: 0, parciales: 0,
      conATM: 0, atmTotal: 0, atmHechos: 0, atmOK: 0, atmPend: 0,
      conCheques: 0, chequesOK: 0, chequesPend: 0, oficinaOK: 0, oficinaPend: 0,
      extemporaneas: 0, faltantes: 0, sobrantes: 0, pendientesGestion: 0, visitas: 0, propias: 0 };
    lista.forEach(o => {
      if (o.conArqueo) tot.conArqueo++; else tot.sinArqueo++;
      if (o.cumple) tot.cumplen++;
      if (o.aTiempo) tot.alDia++;
      if (o.estadoGeneral === 'PARCIAL') tot.parciales++;
      if (o.exige.atm) { tot.conATM++; tot.atmTotal += o.atmTotal; tot.atmHechos += o.atmHechos; if (o.estadoATM === 'OK') tot.atmOK++; else tot.atmPend++; }
      if (o.exige.cheques) { tot.conCheques++; if (o.estadoCheques === 'OK') tot.chequesOK++; else tot.chequesPend++; }
      if (o.exige.oficina) { if (o.estadoOficina === 'OK') tot.oficinaOK++; else tot.oficinaPend++; }
      if (o.extemporaneos) tot.extemporaneas++;
      tot.faltantes += o.faltantes; tot.sobrantes += o.sobrantes; tot.pendientesGestion += o.pendientesGestion;
      tot.visitas += o.visitas;
      if (o.propia) tot.propias++;
    });
    tot.pctCumplimiento = tot.oficinas ? Math.round((tot.cumplen / tot.oficinas) * 100) : 0;
    tot.pctAlDia = tot.oficinas ? Math.round((tot.alDia / tot.oficinas) * 100) : 0;
    tot.pctATM = tot.atmTotal ? Math.round((tot.atmHechos / tot.atmTotal) * 100) : 0;
    tot.pctCheques = tot.conCheques ? Math.round((tot.chequesOK / tot.conCheques) * 100) : 0;

    // Resumen por cliente (para las tarjetas del filtro)
    const porCliente = {};
    base.oficinas.forEach(o => {
      const c = o.cliente || 'SIN CLIENTE';
      if (!porCliente[c]) porCliente[c] = { cliente: c, oficinas: 0, cumplen: 0, pendientes: 0, conATM: 0, conCheques: 0 };
      porCliente[c].oficinas++;
      if (o.cumple) porCliente[c].cumplen++; else porCliente[c].pendientes++;
      if (o.exige.atm) porCliente[c].conATM++;
      if (o.exige.cheques) porCliente[c].conCheques++;
    });
    const clientes = Object.keys(porCliente).sort((a, b) => a.localeCompare(b, 'es')).map(k => {
      const c = porCliente[k]; c.pct = c.oficinas ? Math.round((c.cumplen / c.oficinas) * 100) : 0; return c;
    });

    return { success: true, mes: mes, cliente: cliente || '', clientes: clientes, catalogo: base.catalogo, totales: tot, oficinas: lista };
  } catch (e) {
    return { success: false, message: e.toString(), error: e.toString() };
  }
}

/**
 * TABLA RESUMEN POR REGIONAL Y ZONA (oficinas y ATM), matriz de cumplimiento
 * y datos para el grafico de barras apiladas del reporte de arqueos parciales.
 */
async function obtenerResumenRegional(idUsuario, rol, mesFiltro) {
  return conCacheResultado_('obtenerResumenRegional', idUsuario, rol, [mesFiltro || Utilities.formatDate(new Date(), TZ, 'yyyy-MM')], function () { return obtenerResumenRegionalCalc_(idUsuario, rol, mesFiltro); });
}

async function obtenerResumenRegionalCalc_(idUsuario, rol, mesFiltro) {
  try {
    const mes = mesFiltro || Utilities.formatDate(new Date(), TZ, 'yyyy-MM');
    const base = await calcularEstadoOficinas_(idUsuario, rol, mes);
    const grupos = {};
    const nuevo = (regional, zona) => ({ regional: regional, zona: zona, oficinas: 0, propias: 0, oficinasConArqueo: 0, oficinasPendientes: 0,
      arqueosEjecutados: 0, arqueosPropias: 0, visitas: 0, atmTotal: 0, atmConArqueo: 0, atmSinArqueo: 0,
      chequesTotal: 0, chequesOK: 0, alDia: 0, extemporaneas: 0, faltantes: 0, sobrantes: 0, lideres: {} });

    base.oficinas.forEach(o => {
      const kz = o.regional + '|' + o.zona;
      if (!grupos[kz]) grupos[kz] = nuevo(o.regional, o.zona);
      const g = grupos[kz];
      g.oficinas++;
      if (o.propia) { g.propias++; g.arqueosPropias += o.arqueosValidos; }
      if (o.estadoOficina === 'OK' || (!o.exige.oficina && o.conArqueo)) g.oficinasConArqueo++; else g.oficinasPendientes++;
      g.arqueosEjecutados += o.arqueosValidos;
      g.visitas += o.visitas;
      if (o.exige.atm) { g.atmTotal += o.atmTotal; g.atmConArqueo += o.atmHechos; g.atmSinArqueo += Math.max(o.atmTotal - o.atmHechos, 0); }
      if (o.exige.cheques) { g.chequesTotal++; if (o.estadoCheques === 'OK') g.chequesOK++; }
      if (o.aTiempo) g.alDia++;
      if (o.extemporaneos) g.extemporaneas++;
      g.faltantes += o.faltantes; g.sobrantes += o.sobrantes;
      if (o.idLider) g.lideres[o.idLider] = true;
    });

    const filas = Object.keys(grupos).sort().map(k => {
      const g = grupos[k];
      g.numLideres = Object.keys(g.lideres).length; delete g.lideres;
      g.metaMinima = g.numLideres * META_MENSUAL;
      g.pctMeta = g.metaMinima ? Math.round((g.arqueosEjecutados / g.metaMinima) * 100) : 0;
      g.promedioVisitas = g.oficinas ? +(g.visitas / g.oficinas).toFixed(2) : 0;
      g.pctOficinas = g.oficinas ? Math.round((g.oficinasConArqueo / g.oficinas) * 100) : 0;
      g.pctATM = g.atmTotal ? Math.round((g.atmConArqueo / g.atmTotal) * 100) : 0;
      g.pctCheques = g.chequesTotal ? Math.round((g.chequesOK / g.chequesTotal) * 100) : 0;
      g.pctAlDia = g.oficinas ? Math.round((g.alDia / g.oficinas) * 100) : 0;
      return g;
    });

    // Consolidado por regional (matriz de cumplimiento + barras apiladas)
    const porReg = {};
    filas.forEach(g => {
      if (!porReg[g.regional]) porReg[g.regional] = { regional: g.regional, zonas: 0, oficinas: 0, propias: 0, oficinasConArqueo: 0, oficinasPendientes: 0,
        arqueosEjecutados: 0, arqueosPropias: 0, visitas: 0, atmTotal: 0, atmConArqueo: 0, atmSinArqueo: 0, chequesTotal: 0, chequesOK: 0, alDia: 0, extemporaneas: 0, numLideres: 0, metaMinima: 0 };
      const R = porReg[g.regional];
      ['oficinas', 'propias', 'oficinasConArqueo', 'oficinasPendientes', 'arqueosEjecutados', 'arqueosPropias', 'visitas', 'atmTotal', 'atmConArqueo', 'atmSinArqueo',
        'chequesTotal', 'chequesOK', 'alDia', 'extemporaneas', 'numLideres', 'metaMinima'].forEach(c => R[c] += g[c]);
      R.zonas++;
    });
    const regionales = Object.keys(porReg).sort().map(k => {
      const R = porReg[k];
      R.pctOficinas = R.oficinas ? Math.round((R.oficinasConArqueo / R.oficinas) * 100) : 0;
      R.pctATM = R.atmTotal ? Math.round((R.atmConArqueo / R.atmTotal) * 100) : 0;
      R.pctCheques = R.chequesTotal ? Math.round((R.chequesOK / R.chequesTotal) * 100) : 0;
      R.pctAlDia = R.oficinas ? Math.round((R.alDia / R.oficinas) * 100) : 0;
      R.pctMeta = R.metaMinima ? Math.round((R.arqueosEjecutados / R.metaMinima) * 100) : 0;
      R.promedioVisitas = R.oficinas ? +(R.visitas / R.oficinas).toFixed(2) : 0;
      return R;
    });

    const total = regionales.reduce((t, R) => {
      ['oficinas', 'propias', 'oficinasConArqueo', 'oficinasPendientes', 'arqueosEjecutados', 'arqueosPropias', 'visitas', 'atmTotal', 'atmConArqueo', 'atmSinArqueo',
        'chequesTotal', 'chequesOK', 'alDia', 'extemporaneas', 'numLideres', 'metaMinima'].forEach(c => t[c] = (t[c] || 0) + R[c]);
      return t;
    }, {});
    total.pctOficinas = total.oficinas ? Math.round((total.oficinasConArqueo / total.oficinas) * 100) : 0;
    total.pctATM = total.atmTotal ? Math.round((total.atmConArqueo / total.atmTotal) * 100) : 0;
    total.pctCheques = total.chequesTotal ? Math.round((total.chequesOK / total.chequesTotal) * 100) : 0;
    total.pctAlDia = total.oficinas ? Math.round((total.alDia / total.oficinas) * 100) : 0;
    total.pctMeta = total.metaMinima ? Math.round((total.arqueosEjecutados / total.metaMinima) * 100) : 0;
    total.promedioVisitas = total.oficinas ? +(total.visitas / total.oficinas).toFixed(2) : 0;

    return { success: true, mes: mes, meta: META_MENSUAL, zonas: filas, regionales: regionales, total: total };
  } catch (e) {
    return { success: false, message: e.toString(), error: e.toString() };
  }
}


// ============================================================
// 17. ANALITICA (10 graficos con interpretacion y tabla de datos)
// ============================================================
async function obtenerAnalitica(idUsuario, rol, mesFiltro) {
  return conCacheResultado_('obtenerAnalitica', idUsuario, rol, [mesFiltro || Utilities.formatDate(new Date(), TZ, 'yyyy-MM')], function () { return obtenerAnaliticaCalc_(idUsuario, rol, mesFiltro); });
}

async function obtenerAnaliticaCalc_(idUsuario, rol, mesFiltro) {
  try {
    const mes = mesFiltro || Utilities.formatDate(new Date(), TZ, 'yyyy-MM');
    const base = await calcularEstadoOficinas_(idUsuario, rol, mes);
    const nombreDe = await nombresUsuarios_();
    const regDe = {}; base.oficinas.forEach(o => regDe[norm_(o.oficina)] = o);
    const arqs = base.arqueos;
    const M = UMBRAL_MILLON;
    const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;
    const money = n => '$ ' + Math.round(n).toLocaleString('es-CO');
    const regionalDe = a => (regDe[norm_(a.oficina)] || {}).regional || 'SIN REGIONAL';
    const sumar = (obj, k, campo, val) => { if (!obj[k]) obj[k] = {}; obj[k][campo] = (obj[k][campo] || 0) + val; };
    const claves = obj => Object.keys(obj).sort((a, b) => a.localeCompare(b, 'es'));
    const G = {};

    // 1. Oficinas: sin novedad / con faltantes / con sobrantes
    const conArq = base.oficinas.filter(o => o.conArqueo);
    const oF = conArq.filter(o => o.faltantes > 0).length;
    const oS = conArq.filter(o => o.faltantes === 0 && o.sobrantes > 0).length;
    const oN = conArq.length - oF - oS;
    const sinArq = base.oficinas.length - conArq.length;
    G.oficinasNovedad = {
      tipo: 'pie', titulo: 'Oficinas del mes: sin novedad, con faltantes y con sobrantes',
      labels: ['Sin novedad', 'Con faltantes', 'Con sobrantes'], series: [{ name: 'Oficinas', data: [oN, oF, oS] }],
      tabla: { columnas: ['Estado', 'Oficinas', '% del total con arqueo'],
        filas: [['Sin novedad', oN, pct(oN, conArq.length) + '%'], ['Con faltantes', oF, pct(oF, conArq.length) + '%'], ['Con sobrantes', oS, pct(oS, conArq.length) + '%'], ['Total con arqueo', conArq.length, '100%'], ['Sin arqueo en el mes', sinArq, '—']] },
      interpretacion: conArq.length
        ? 'De ' + conArq.length + ' oficinas con arqueo en el mes, ' + pct(oN, conArq.length) + '% cerró sin novedad, ' + pct(oF, conArq.length) + '% presentó al menos un faltante y ' + pct(oS, conArq.length) + '% presentó sobrantes (sin faltantes). ' +
          (oF > 0 ? 'Las ' + oF + ' oficinas con faltantes deben tener explicación y tipología registradas por el líder. ' : 'No se reportaron faltantes. ') +
          (sinArq > 0 ? sinArq + ' oficina(s) aún no tienen arqueo en el mes y no se incluyen en la distribución.' : 'Todas las oficinas tienen al menos un arqueo.')
        : 'Aún no hay oficinas con arqueo en el mes seleccionado.'
    };

    // 2 y 3. Faltantes / sobrantes por regional (casos y monto)
    const fr = {}, sr = {};
    arqs.forEach(a => {
      const d = parseFloat(a.diferencia) || 0;
      if (a.novedad === 'FALTANTE') { sumar(fr, regionalDe(a), 'casos', 1); sumar(fr, regionalDe(a), 'monto', Math.abs(d)); }
      if (a.novedad === 'SOBRANTE') { sumar(sr, regionalDe(a), 'casos', 1); sumar(sr, regionalDe(a), 'monto', Math.abs(d)); }
    });
    const pieRegional = (obj, nombre, tipoNov) => {
      const ks = claves(obj);
      const totC = ks.reduce((s, k) => s + obj[k].casos, 0), totM = ks.reduce((s, k) => s + obj[k].monto, 0);
      const top = ks.slice().sort((a, b) => obj[b].casos - obj[a].casos)[0];
      return {
        tipo: 'pie', titulo: nombre + ' por regional',
        labels: ks, series: [{ name: 'Casos', data: ks.map(k => obj[k].casos) }],
        tabla: { columnas: ['Regional', 'Casos', '% casos', 'Monto'], filas: ks.map(k => [k, obj[k].casos, pct(obj[k].casos, totC) + '%', money(obj[k].monto)]).concat([['TOTAL', totC, '100%', money(totM)]]) },
        interpretacion: totC
          ? 'Se registraron ' + totC + ' ' + tipoNov + ' por ' + money(totM) + ' en ' + ks.length + ' regional(es). La regional ' + top + ' concentra ' + pct(obj[top].casos, totC) + '% de los casos (' + obj[top].casos + ' por ' + money(obj[top].monto) + '), por lo que debe priorizarse en el seguimiento.'
          : 'No se registraron ' + tipoNov + ' en el mes.'
      };
    };
    G.faltantesRegional = pieRegional(fr, 'Faltantes', 'faltantes');
    G.sobrantesRegional = pieRegional(sr, 'Sobrantes', 'sobrantes');

    // 4 y 5. Sobrantes > $1.000.000 y faltantes < $1.000.000
    const barrasUmbral = (filtro, titulo, descripcion) => {
      const obj = {};
      const lista = arqs.filter(filtro);
      lista.forEach(a => { const d = Math.abs(parseFloat(a.diferencia) || 0); sumar(obj, regionalDe(a), 'casos', 1); sumar(obj, regionalDe(a), 'monto', d); });
      const ks = claves(obj);
      const totC = lista.length, totM = ks.reduce((s, k) => s + obj[k].monto, 0);
      const detalle = lista.slice().sort((x, y) => Math.abs(parseFloat(y.diferencia) || 0) - Math.abs(parseFloat(x.diferencia) || 0)).slice(0, 15)
        .map(a => [regionalDe(a), a.oficina, nombreDe[a.idUsuario] || a.idUsuario, a.fechaReal, money(Math.abs(parseFloat(a.diferencia) || 0)), a.estadoDiferencia || 'Sin gestión']);
      return {
        tipo: 'bar', titulo: titulo,
        labels: ks, series: [{ name: 'Casos', data: ks.map(k => obj[k].casos), eje: 'y' }, { name: 'Monto (millones $)', data: ks.map(k => +(obj[k].monto / 1e6).toFixed(2)), eje: 'y1' }],
        tabla: { columnas: ['Regional', 'Casos', 'Monto', 'Promedio por caso'], filas: ks.map(k => [k, obj[k].casos, money(obj[k].monto), money(obj[k].monto / obj[k].casos)]).concat([['TOTAL', totC, money(totM), totC ? money(totM / totC) : '—']]) },
        detalle: { columnas: ['Regional', 'Oficina', 'Líder', 'Fecha', 'Monto', 'Estado'], filas: detalle },
        interpretacion: totC
          ? descripcion + ': ' + totC + ' caso(s) por ' + money(totM) + '. ' + (ks.length ? 'La mayor concentración está en ' + ks.slice().sort((a, b) => obj[b].monto - obj[a].monto)[0] + '. ' : '') +
            'Cada caso debe quedar con explicación, tipología y estado (recuperado / cruzado) registrados en la gestión de novedades.'
          : descripcion + ': sin casos en el mes.'
      };
    };
    G.sobrantesMayores = barrasUmbral(a => a.novedad === 'SOBRANTE' && Math.abs(parseFloat(a.diferencia) || 0) > M, 'Sobrantes mayores a $1.000.000 por regional', 'Sobrantes superiores a $1.000.000');
    G.faltantesMenores = barrasUmbral(a => a.novedad === 'FALTANTE' && Math.abs(parseFloat(a.diferencia) || 0) < M, 'Faltantes menores a $1.000.000 por regional', 'Faltantes inferiores a $1.000.000');

    // 6 y 7. Recuperado vs no recuperado (faltantes > y < $1.000.000) por regional
    const recuperacion = (filtro, titulo) => {
      const obj = {};
      const lista = arqs.filter(filtro);
      lista.forEach(a => {
        const est = a.estadoDiferencia === DIFE.RECUPERADO ? 'rec' : (a.estadoDiferencia === DIFE.NO_RECUPERADO ? 'norec' : 'pend');
        sumar(obj, regionalDe(a), est, 1); sumar(obj, regionalDe(a), 'm_' + est, Math.abs(parseFloat(a.diferencia) || 0));
      });
      const ks = claves(obj);
      const t = { rec: 0, norec: 0, pend: 0, m_rec: 0, m_norec: 0, m_pend: 0 };
      ks.forEach(k => Object.keys(t).forEach(c => t[c] += obj[k][c] || 0));
      const total = t.rec + t.norec + t.pend;
      return {
        tipo: 'bar', titulo: titulo,
        labels: ks, series: [{ name: 'Recuperado', data: ks.map(k => obj[k].rec || 0) }, { name: 'No recuperado', data: ks.map(k => obj[k].norec || 0) }, { name: 'Sin respuesta', data: ks.map(k => obj[k].pend || 0) }],
        tabla: { columnas: ['Regional', 'Recuperados', 'Monto recuperado', 'No recuperados', 'Monto no recuperado', 'Sin respuesta', 'Monto sin respuesta'],
          filas: ks.map(k => [k, obj[k].rec || 0, money(obj[k].m_rec || 0), obj[k].norec || 0, money(obj[k].m_norec || 0), obj[k].pend || 0, money(obj[k].m_pend || 0)])
            .concat([['TOTAL', t.rec, money(t.m_rec), t.norec, money(t.m_norec), t.pend, money(t.m_pend)]]) },
        interpretacion: total
          ? 'De ' + total + ' faltante(s) en este rango, ' + t.rec + ' (' + pct(t.rec, total) + '%) fueron recuperados por ' + money(t.m_rec) + ', ' + t.norec + ' (' + pct(t.norec, total) + '%) no se recuperaron (' + money(t.m_norec) + ') y ' + t.pend + ' aún no tienen respuesta del líder. ' +
            (t.pend > 0 ? 'Los casos sin respuesta mantienen la alerta persistente activa.' : 'Todos los casos tienen explicación registrada.')
          : 'Sin faltantes en este rango durante el mes.'
      };
    };
    G.recuperadoMayores = recuperacion(a => a.novedad === 'FALTANTE' && Math.abs(parseFloat(a.diferencia) || 0) > M, 'Faltantes mayores a $1.000.000: recuperados vs. no recuperados');
    G.recuperadoMenores = recuperacion(a => a.novedad === 'FALTANTE' && Math.abs(parseFloat(a.diferencia) || 0) < M, 'Faltantes menores a $1.000.000: recuperados vs. no recuperados');

    // 8. Faltantes por lider (casos y monto)
    const fl = {};
    arqs.filter(a => a.novedad === 'FALTANTE').forEach(a => { const k = nombreDe[a.idUsuario] || a.idUsuario; sumar(fl, k, 'casos', 1); sumar(fl, k, 'monto', Math.abs(parseFloat(a.diferencia) || 0)); });
    const kl = Object.keys(fl).sort((a, b) => fl[b].casos - fl[a].casos || fl[b].monto - fl[a].monto);
    const totFL = kl.reduce((s, k) => s + fl[k].casos, 0), totFM = kl.reduce((s, k) => s + fl[k].monto, 0);
    G.faltantesLider = {
      tipo: 'bar', titulo: 'Faltantes del mes por líder',
      labels: kl, series: [{ name: 'Casos', data: kl.map(k => fl[k].casos), eje: 'y' }, { name: 'Monto (millones $)', data: kl.map(k => +(fl[k].monto / 1e6).toFixed(2)), eje: 'y1' }],
      tabla: { columnas: ['Líder', 'Casos', 'Monto', '% de los casos'], filas: kl.map(k => [k, fl[k].casos, money(fl[k].monto), pct(fl[k].casos, totFL) + '%']).concat([['TOTAL', totFL, money(totFM), '100%']]) },
      interpretacion: totFL
        ? kl.length + ' líder(es) reportaron ' + totFL + ' faltante(s) por ' + money(totFM) + '. ' + kl[0] + ' concentra ' + fl[kl[0]].casos + ' caso(s) (' + pct(fl[kl[0]].casos, totFL) + '%) por ' + money(fl[kl[0]].monto) + '. Los líderes con faltantes recurrentes requieren acompañamiento y revisión de controles en sus oficinas.'
        : 'Ningún líder reportó faltantes en el mes.'
    };

    // 9. Cajeros ATM: con arqueo vs sin arqueo
    let atmT = 0, atmH = 0;
    base.oficinas.forEach(o => { if (o.exige.atm) { atmT += o.atmTotal; atmH += o.atmHechos; } });
    const atmPend = base.oficinas.filter(o => o.exige.atm && o.estadoATM !== 'OK').map(o => [o.regional, o.oficina, o.lider, o.atmHechos + ' / ' + o.atmTotal, o.estadoATM]);
    G.atmArqueo = {
      tipo: 'pie', titulo: 'Cajeros ATM: con arqueo vs. sin arqueo en el mes',
      labels: ['Con arqueo', 'Sin arqueo'], series: [{ name: 'Cajeros', data: [atmH, Math.max(atmT - atmH, 0)] }],
      tabla: { columnas: ['Estado', 'Cajeros', '%'], filas: [['Con arqueo (cuenta 1 vez al mes)', atmH, pct(atmH, atmT) + '%'], ['Sin arqueo', Math.max(atmT - atmH, 0), pct(atmT - atmH, atmT) + '%'], ['Total cajeros', atmT, '100%']] },
      detalle: { columnas: ['Regional', 'Oficina', 'Líder', 'Cajeros arqueados', 'Estado'], filas: atmPend.slice(0, 40) },
      interpretacion: atmT
        ? 'La red tiene ' + atmT + ' cajero(s) parametrizado(s); ' + atmH + ' (' + pct(atmH, atmT) + '%) ya tienen su arqueo válido del mes y ' + Math.max(atmT - atmH, 0) + ' están pendientes. Recuerda que cada cajero suma a la meta una sola vez al mes aunque se arquee varias veces.'
        : 'No hay cajeros ATM parametrizados en el Directorio Nacional para las oficinas visibles.'
    };

    // 10. Cumplimiento del mes por regional (columnas agrupadas)
    const cr = {};
    base.oficinas.forEach(o => {
      const k = o.regional;
      if (!cr[k]) cr[k] = { ofi: 0, ofiOK: 0, ch: 0, chOK: 0, atm: 0, atmOK: 0, alDia: 0, cumplen: 0 };
      cr[k].ofi++; if (o.cumple) cr[k].cumplen++; if (o.aTiempo) cr[k].alDia++;
      if (o.exige.cheques) { cr[k].ch++; if (o.estadoCheques === 'OK') cr[k].chOK++; }
      if (o.exige.atm) { cr[k].atm += o.atmTotal; cr[k].atmOK += o.atmHechos; }
      if (o.exige.oficina && o.estadoOficina === 'OK') cr[k].ofiOK++;
    });
    const kr = claves(cr);
    G.cumplimientoRegional = {
      tipo: 'bar', titulo: 'Cumplimiento del mes por regional (%)',
      labels: kr, series: [
        { name: '% Oficinas con arqueo', data: kr.map(k => pct(cr[k].ofiOK, cr[k].ofi)) },
        { name: '% Cheques', data: kr.map(k => cr[k].ch ? pct(cr[k].chOK, cr[k].ch) : 0) },
        { name: '% ATM', data: kr.map(k => cr[k].atm ? pct(cr[k].atmOK, cr[k].atm) : 0) },
        { name: '% Al día (completo y a tiempo)', data: kr.map(k => pct(cr[k].alDia, cr[k].ofi)) }],
      tabla: { columnas: ['Regional', 'Oficinas', 'Con arqueo', '% Oficinas', 'Cheques OK / total', '% Cheques', 'ATM OK / total', '% ATM', 'Al día', '% Al día'],
        filas: kr.map(k => [k, cr[k].ofi, cr[k].ofiOK, pct(cr[k].ofiOK, cr[k].ofi) + '%', cr[k].chOK + ' / ' + cr[k].ch, (cr[k].ch ? pct(cr[k].chOK, cr[k].ch) : 0) + '%', cr[k].atmOK + ' / ' + cr[k].atm, (cr[k].atm ? pct(cr[k].atmOK, cr[k].atm) : 0) + '%', cr[k].alDia, pct(cr[k].alDia, cr[k].ofi) + '%']) },
      interpretacion: kr.length
        ? (function () {
            const mejor = kr.slice().sort((a, b) => pct(cr[b].alDia, cr[b].ofi) - pct(cr[a].alDia, cr[a].ofi))[0];
            const peor = kr.slice().sort((a, b) => pct(cr[a].alDia, cr[a].ofi) - pct(cr[b].alDia, cr[b].ofi))[0];
            return 'La regional con mejor cumplimiento al día es ' + mejor + ' (' + pct(cr[mejor].alDia, cr[mejor].ofi) + '%) y la de menor avance es ' + peor + ' (' + pct(cr[peor].alDia, cr[peor].ofi) + '%). "Al día" exige oficina, cheques y ATM completos y sin extemporáneos; las barras de cheques y ATM muestran dónde está el rezago.';
          })()
        : 'Sin oficinas visibles para calcular el cumplimiento.'
    };

    return { success: true, mes: mes, graficos: G, totales: { oficinas: base.oficinas.length, arqueos: arqs.length } };
  } catch (e) {
    return { success: false, message: e.toString(), error: e.toString() };
  }
}


// ============================================================
// Registro RPC (equivale a google.script.run): POST /api/coiv1/rpc/<nombre>
// Cada llamada corre con su propia "memoria por ejecucion".
// ============================================================
const publicas = {
  // Login
  validarLogin, validarEmbebido,
  // Formulario de arqueo
  getContextoArqueo, getTipologias, listarOficinasLider, verificarVisitaMes,
  procesarArqueoIntegral, procesarArqueo,
  // Lectura / matriz
  obtenerHistorial, obtenerArqueo, obtenerMesesDisponibles, obtenerBitacoraArqueo, obtenerPendientes,
  // Gestion de novedades y normalizaciones
  gestionarArqueo, responderNovedad, solicitarNormalizacion, listarNormalizaciones, decidirNormalizacion,
  // Dashboards y analitica
  obtenerDashboard, obtenerDashboardClientes, obtenerResumenRegional, obtenerAnalitica, obtenerTendencias,
  // Mantenimiento / diagnostico
  enviarRecordatoriosPendientes, limpiarCache, limpiarCacheDirectorio, calcularDiasHabiles,
  diagnosticoSistema, diagnosticoFechaHora, diagnosticoATM, diagnosticoDirectorio, diagnosticoCruceLideres
};

export const functions = Object.fromEntries(Object.entries(publicas).map(([k, fn]) => [k, ejecucion_(fn)]));

/** Solo para pruebas: helpers internos puros. */
export const _internos = { atmCodigos_, requisitosDeOficina_, coincideLider_, construirPerfil_, inferirCliente_, detectarColumnasDirectorio_, aplicarReglaMeta_, estadoGestion_, claveCajero_, calcularAtm_ };
