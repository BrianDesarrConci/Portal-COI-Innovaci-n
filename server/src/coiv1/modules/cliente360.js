/**
 * Cliente 360: consolida por cliente los datos reales de los Sheets de COI V1.
 *
 *  - Directorio Nacional (libro Directorio): oficinas, geografía, horarios, líder de excelencia,
 *    medio de pago, ATM y los códigos de atención de cada cliente en la red (columnas por cliente).
 *  - Granja de usuarios (libro Granja): personas por oficina, backup y usuario en el sistema del cliente.
 *    Se lee con obtenerDirectorioUsuarios() del módulo Granja (mismo filtro y sincronía de BACKUP).
 *  - Control de Arqueos (libro COI V1): estado mensual por oficina con obtenerDashboardClientes()
 *    (rol Analista = red completa) y el historial con obtenerHistorial(); así las cifras coinciden
 *    con el módulo de Control de Arqueos.
 *  - Novedades (bajas de la Granja) y ANS Especializadas (libro COI V1).
 *
 * Funciones públicas:
 *   resumenClientes()                 → portafolio: una fila por cliente real + red habilitada por clave.
 *   cliente360(nombreReal, clave?)    → detalle de un cliente (nombreReal = columna CLIENTE; puede ser null
 *                                       para clientes sin red propia: se usa la clave del registro).
 * Los resultados se guardan en memoria del proceso 60 s.
 */
import { SpreadsheetApp } from '../spreadsheet.js';
import { DIRECTORIO_ID, ID_EXCEL_PRINCIPAL, ID_EXCEL_DIRECTORIO } from '../books.js';
import { functions as ARQ, _internos as ARQ_INT } from '../arqueos/controlArqueos.js';
import { norm_, num_, DIRECTORIO_HOJA } from '../arqueos/lib/base.js';
import { obtenerDirectorioUsuarios } from './granja.js';

const TTL_MS = 60 * 1000;
const ANALISTA = 'Analista';

/**
 * Columnas del Directorio (código del cliente en la oficina) y de la Granja (usuario de la persona
 * en el sistema del cliente) por clave del registro de clientes del portal.
 * AV Villas se omite en el Directorio: su bloque trae terminal de datáfono para todas las oficinas.
 */
export const COLUMNAS_CLIENTE = {
  bbva: { dir: 'BBVA', granja: 'BBVA' },
  bogota: { dir: 'BOGOTA', granja: 'BOGOTA' },
  agrario: { dir: 'AGRARIO', granja: 'AGRARIO' },
  davivienda: { dir: 'DAVIVIENDA (VUS)', granja: 'DAVIVIENDA (VUS)' },
  popular: { dir: 'POPULAR', granja: 'POPULAR' },
  bancolombia: { dir: 'BANCOLOMBIA', granja: 'BANCOLOMBIA' },
  occidente: { dir: 'OCCIDENTE', granja: 'BANCO DE OCCIDENTE' },
  itau: { dir: 'ITAU', granja: 'ITAU' },
  cajasocial: { dir: 'CAJA SOCIAL', granja: 'CAJA SOCIAL' },
  citibank: { dir: 'CITIBANK', granja: 'CITI BANK' },
  avvillas: { dir: null, granja: 'AV VILLAS' },
  union: { dir: 'BANCO UNION', granja: null },
  colfondos: { dir: 'COLFONDOS', granja: null },
  proteccion: { dir: 'PROTECCION', granja: null },
  porvenir: { dir: 'PORVENIR', granja: 'PORVENIR' },
  fincomercio: { dir: 'FINCOMERCIO', granja: 'FINCOMERCIO' },
  coopcentral: { dir: 'COOPCENTRAL', granja: 'OFICINA COOPCETRAL' },
  snr: { dir: null, granja: 'SNR' },
  multival: { dir: null, granja: null }
};

// ---------- utilidades ----------
const txt = (v) => (v === null || v === undefined ? '' : v instanceof Date ? v.toISOString() : String(v)).trim();
const vacio = (v) => { const s = norm_(v); return !s || s === '#N/A' || s === 'N/A' || s === '#REF!' || s === '0' || s === '-' || s === 'NA'; };
const limpio = (v) => (vacio(v) ? '' : txt(v));
const fechaISO = (v) => {
  if (v instanceof Date && !isNaN(v)) return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
  const s = txt(v); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : '';
};
/** Coordenada del Directorio: se guarda sin punto decimal (7 decimales fijos, p. ej. -753345653 → -75,3345653). */
export function coordenada(v, eje) {
  if (v === '' || v === null || v === undefined) return null;
  let n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  if (!isFinite(n) || n === 0) return null;
  if (Math.abs(n) > 180) n = n / 1e7;
  const ok = eje === 'lat' ? n > -5 && n < 14 : n > -83 && n < -66;
  return ok ? Math.round(n * 1e6) / 1e6 : null;
}
const mesDe = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
function ultimosMeses(n) {
  const out = []; const d = new Date(); d.setDate(1);
  for (let i = 0; i < n; i++) { out.unshift(mesDe(d)); d.setMonth(d.getMonth() - 1); }
  return out;
}
const contar = (lista, f) => {
  const m = {}; lista.forEach((x) => { const k = f(x) || 'SIN DATO'; m[k] = (m[k] || 0) + 1; });
  return Object.keys(m).map((k) => ({ nombre: k, n: m[k] })).sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre, 'es'));
};
const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
const dif = (a) => { const n = parseFloat(a.diferencia); return isFinite(n) ? n : 0; };
const ESTADOS_CERRADOS = ['RESUELTA', 'CERRADA', 'RECHAZADA', 'ANULADA', 'FINALIZADA', 'CANCELADA'];

// ---------- caché en memoria ----------
const CACHE = new Map();
function cached(clave, fn) {
  const hit = CACHE.get(clave);
  if (hit && Date.now() - hit.t < TTL_MS) return hit.v;
  const v = Promise.resolve().then(fn);
  CACHE.set(clave, { t: Date.now(), v });
  v.catch(() => CACHE.delete(clave));
  return v;
}
/** Solo para pruebas. */
export function _limpiarCache() { CACHE.clear(); }

// ---------- lectura base ----------
/** Directorio Nacional, una fila por oficina (mismo criterio de consolidación que Control de Arqueos). */
async function leerDirectorio() {
  const sh = SpreadsheetApp.openById(DIRECTORIO_ID).getSheetByName(DIRECTORIO_HOJA);
  const todo = sh ? await sh.getDataRange().getValues() : [];
  if (todo.length < 2) return { oficinas: [], codigos: {} };
  const h = todo[0].map((x) => norm_(x));
  const col = (name, desde = 0) => h.indexOf(norm_(name), desde);
  const C = {
    red: col('RED'), ptr: col('PTR'), oficina: col('OFICINA'), lv: col('LUNES - VIERNES'), sab: col('SABADOS'), dom: col('DOMINGO'),
    barrio: col('BARRIO'), dir: col('DIRECCION OFICINA'), lon: col('LONGITUD'), lat: col('LATITUD'), mun: col('MUNICIPIO'),
    dep: col('DEPARTAMENTO'), negocio: col('NEGOCIO'), cliente: col('CLIENTE'), estructura: col('ESTRUCTURA'), regional: col('REGIONAL'),
    gerente: col('GERENTE REGIONAL'), zona: col('ZONA'), lider: col('LIDER DE EXCELENCIA'), apertura: col('FECHA APERTURA'),
    cesLV: col('CESANTIAS LUNES A VIERNES'), cesSab: col('CESANTIAS SABADOS')
  };
  // Columnas de código por cliente: están después de la columna "#" del bloque de clientes.
  const bloque = Math.max(h.indexOf('#'), 29);
  const colCod = {};
  Object.keys(COLUMNAS_CLIENTE).forEach((k) => { const n = COLUMNAS_CLIENTE[k].dir; if (n) { const i = col(n, bloque); if (i >= 0) colCod[k] = i; } });
  const { inferirCliente_, requisitosDeOficina_ } = ARQ_INT;
  const g = (r, i) => (i >= 0 ? r[i] : '');
  const out = []; const vistos = {};
  for (let i = 1; i < todo.length; i++) {
    const r = todo[i];
    const oficina = txt(g(r, C.oficina));
    if (!oficina) continue;
    const k = norm_(oficina);
    const codigos = {};
    Object.keys(colCod).forEach((ck) => { const v = limpio(r[colCod[ck]]); if (v) codigos[ck] = v; });
    if (vistos[k] !== undefined) { // consolidar como Control de Arqueos
      const prev = out[vistos[k]];
      Object.keys(codigos).forEach((ck) => { if (!prev.codigos[ck]) prev.codigos[ck] = codigos[ck]; });
      continue;
    }
    vistos[k] = out.length;
    const medio = limpio(r[37]) || limpio(r[39]);
    const atm = limpio(r[53]);
    out.push({
      oficina, clave: k,
      cliente: txt(g(r, C.cliente)) || inferirCliente_(oficina),
      inferido: !txt(g(r, C.cliente)),
      red: limpio(g(r, C.red)), ptr: limpio(g(r, C.ptr)),
      municipio: limpio(g(r, C.mun)), departamento: limpio(g(r, C.dep)),
      regional: limpio(g(r, C.regional)) || 'SIN REGIONAL', zona: limpio(g(r, C.zona)) || 'SIN ZONA',
      gerente: limpio(g(r, C.gerente)), lider: limpio(g(r, C.lider)),
      negocio: limpio(g(r, C.negocio)), estructura: limpio(g(r, C.estructura)).toUpperCase(),
      barrio: limpio(g(r, C.barrio)), direccion: limpio(g(r, C.dir)),
      horario: { lv: limpio(g(r, C.lv)), sab: limpio(g(r, C.sab)), dom: limpio(g(r, C.dom)) },
      cesantias: [limpio(g(r, C.cesLV)), limpio(g(r, C.cesSab))].filter(Boolean).join(' · '),
      apertura: fechaISO(g(r, C.apertura)),
      lat: coordenada(g(r, C.lat), 'lat'), lon: coordenada(g(r, C.lon), 'lon'),
      medioPago: medio, atm, exige: requisitosDeOficina_(medio, atm),
      codigos
    });
  }
  return { oficinas: out };
}

/** Granja de usuarios (filas del módulo Granja) con su encabezado. */
async function leerGranja() {
  const sh = SpreadsheetApp.openById(ID_EXCEL_DIRECTORIO).getSheetByName('GRANJA_DE_USUARIOS_JULLY');
  const head = sh ? ((await sh.getRange(1, 1, 1, 60).getValues())[0] || []).map((x) => norm_(x)) : [];
  const filas = await obtenerDirectorioUsuarios();
  if (!Array.isArray(filas)) return [];
  const ix = (n) => head.indexOf(norm_(n));
  const C = { ptr: ix('PTR'), oficina: ix('OFICINA'), regional: ix('REGIONAL'), zona: ix('ZONA'), mun: ix('MUNICIPIO'), cliente: ix('CLIENTE'),
    cedula: ix('CEDULA'), nombre: ix('NOMBRE'), backup: ix('BACKUP SI/NO'), nb1: ix('NEGOCIO BACKUP 1'), nb2: ix('NEGOCIO BACKUP 2'), nov: ix('NOVEDADES') };
  const colUsr = {};
  Object.keys(COLUMNAS_CLIENTE).forEach((k) => { const n = COLUMNAS_CLIENTE[k].granja; if (n && ix(n) >= 0) colUsr[k] = ix(n); });
  return filas.map((r) => {
    const usuarios = {};
    Object.keys(colUsr).forEach((k) => { if (limpio(r[colUsr[k]])) usuarios[k] = true; });
    return {
      nombre: txt(r[C.nombre]), cedula: txt(r[C.cedula]), oficina: txt(r[C.oficina]), claveOficina: norm_(r[C.oficina]),
      regional: limpio(r[C.regional]), zona: limpio(r[C.zona]) || 'SIN ZONA', municipio: limpio(r[C.mun]), cliente: txt(r[C.cliente]),
      backup: norm_(r[C.backup]) === 'SI',
      negociosBackup: [limpio(r[C.nb1]), limpio(r[C.nb2])].filter(Boolean),
      novedad: limpio(r[C.nov]), usuarios
    };
  }).filter((p) => p.nombre);
}

async function leerHoja(id, nombre) {
  const sh = SpreadsheetApp.openById(id).getSheetByName(nombre);
  return sh ? await sh.getDataRange().getValues() : [];
}

/** Base consolidada (una sola lectura de cada fuente por minuto). */
function base() {
  return cached('base', async () => {
    const meses = ultimosMeses(6);
    const [dir, granja, nov, ans, hist, ...dash] = await Promise.all([
      leerDirectorio(), leerGranja(), leerHoja(ID_EXCEL_PRINCIPAL, 'Novedades'), leerHoja(ID_EXCEL_PRINCIPAL, 'ANS Especializadas'),
      ARQ.obtenerHistorial('', ANALISTA, 'TODOS'),
      ...meses.map((m) => ARQ.obtenerDashboardClientes('', ANALISTA, m, ''))
    ]);
    const clienteDeOficina = {};
    dir.oficinas.forEach((o) => { clienteDeOficina[o.clave] = o.cliente; });
    granja.forEach((p) => { if (p.cliente && !clienteDeOficina[p.claveOficina]) clienteDeOficina[p.claveOficina] = p.cliente; });
    const cliOf = (oficina) => clienteDeOficina[norm_(oficina)] || '';

    const estados = {}; // mes -> [oficinas del dashboard]
    meses.forEach((m, i) => { estados[m] = dash[i] && dash[i].success ? dash[i].oficinas : []; });
    const arqueos = (Array.isArray(hist) ? hist : []).map((a) => ({ ...a, cliente: cliOf(a.oficina) }));

    const arqueosPorMes = {};
    arqueos.forEach((a) => { arqueosPorMes[a.mes] = (arqueosPorMes[a.mes] || 0) + 1; });
    const novedades = nov.slice(1).filter((r) => txt(r[0])).map((r) => ({
      id: txt(r[0]), fechaReporte: r[1] instanceof Date ? fechaISO(r[1]) : txt(r[1]), persona: txt(r[2]), oficina: txt(r[3]),
      descripcion: txt(r[4]), reportadoPor: txt(r[5]), backup: txt(r[6]), estado: norm_(r[9]) || 'PENDIENTE',
      inicio: fechaISO(r[10]), dias: num_(r[11]) || null, cliente: cliOf(r[3])
    })).map((n) => ({ ...n, abierta: ESTADOS_CERRADOS.indexOf(n.estado) < 0 }));

    const frac = (v) => { const n = num_(v); return n <= 1 ? Math.round(n * 1000) / 10 : n; };
    const ansRows = ans.slice(1).filter((r) => txt(r[2])).map((r) => ({
      zona: txt(r[0]), cliente: txt(r[1]), oficina: txt(r[2]), arqueo: num_(r[3]), politica: num_(r[4]), ans: num_(r[5]),
      pctPolitica: frac(r[6]), pctAns: frac(r[7])
    }));
    return { meses, mes: meses[meses.length - 1], mesAnterior: meses[meses.length - 2], dir: dir.oficinas, granja, estados, arqueos, arqueosPorMes, novedades, ans: ansRows, generado: new Date().toISOString() };
  });
}

// ---------- cálculos por cliente ----------
function serieArqueos(B, oficinasCliente, nombreReal) {
  const claves = new Set(oficinasCliente.map((o) => o.clave));
  return B.meses.map((m) => {
    const est = (B.estados[m] || []).filter((o) => claves.has(norm_(o.oficina)));
    const arq = B.arqueos.filter((a) => a.mes === m && a.cliente === nombreReal);
    const falt = arq.filter((a) => a.novedad === 'FALTANTE'), sob = arq.filter((a) => a.novedad === 'SOBRANTE');
    return {
      mes: m, conDatos: (B.arqueosPorMes[m] || 0) > 0, oficinas: est.length, cumplen: est.filter((o) => o.cumple).length, conArqueo: est.filter((o) => o.conArqueo).length,
      pct: pct(est.filter((o) => o.cumple).length, est.length), arqueos: arq.length,
      faltantes: falt.length, sobrantes: sob.length,
      montoFaltante: Math.round(falt.reduce((s, a) => s + Math.abs(dif(a)), 0)), montoSobrante: Math.round(sob.reduce((s, a) => s + Math.abs(dif(a)), 0))
    };
  });
}

function filaResumen(B, nombre) {
  const ofs = B.dir.filter((o) => o.cliente === nombre);
  const gente = B.granja.filter((p) => p.cliente === nombre);
  const serie = serieArqueos(B, ofs, nombre);
  const act = serie[serie.length - 1], ant = serie[serie.length - 2];
  const novs = B.novedades.filter((n) => n.cliente === nombre);
  const conGente = new Set(gente.map((p) => p.claveOficina));
  const deps = contar(ofs, (o) => o.departamento);
  return {
    cliente: nombre,
    oficinas: ofs.length,
    regionales: new Set(ofs.map((o) => o.regional)).size,
    zonas: new Set(ofs.map((o) => o.zona)).size,
    municipios: new Set(ofs.map((o) => o.municipio).filter(Boolean)).size,
    departamentos: deps.filter((d) => d.nombre !== 'SIN DATO').length,
    personas: gente.length,
    backups: gente.filter((p) => p.backup).length,
    oficinasSinPersonal: ofs.filter((o) => !conGente.has(o.clave)).length,
    conATM: ofs.filter((o) => o.exige.atm).length,
    arqueosMes: act.arqueos, arqueosMesAnterior: ant.arqueos,
    cumplenMes: act.cumplen, pctMes: act.pct, pctMesAnterior: ant.pct,
    pendientesMes: act.oficinas - act.cumplen,
    faltantesMes: act.faltantes, sobrantesMes: act.sobrantes, montoFaltanteMes: act.montoFaltante, montoSobranteMes: act.montoSobrante,
    novedadesAbiertas: novs.filter((n) => n.abierta).length, novedadesTotal: novs.length,
    ansOficinas: B.ans.filter((a) => a.cliente === nombre).length,
    serie: serie.map((s) => ({ mes: s.mes, pct: s.pct, arqueos: s.arqueos, conDatos: s.conDatos }))
  };
}

function redHabilitada(B, clave) {
  const ofs = B.dir.filter((o) => o.codigos[clave]);
  const personas = B.granja.filter((p) => p.usuarios[clave]).length;
  return { puntos: ofs.length, personasConUsuario: personas, departamentos: new Set(ofs.map((o) => o.departamento).filter(Boolean)).size, municipios: new Set(ofs.map((o) => o.municipio).filter(Boolean)).size };
}

const vistaOficina = (o) => ({
  oficina: o.oficina, ptr: o.ptr, red: o.red, municipio: o.municipio, departamento: o.departamento, regional: o.regional, zona: o.zona,
  gerente: o.gerente, lider: o.lider, negocio: o.negocio, estructura: o.estructura, barrio: o.barrio, direccion: o.direccion,
  horario: o.horario, cesantias: o.cesantias, apertura: o.apertura, lat: o.lat, lon: o.lon, medioPago: o.medioPago, atm: o.atm,
  exigeATM: !!o.exige.atm, exigeCheques: !!o.exige.cheques, cliente: o.cliente
});

// ---------- API ----------
/**
 * Portafolio de clientes con datos reales.
 * { generado, mes, mesAnterior, meses, clientes: [filaResumen], red: { clave: {puntos, personasConUsuario, ...} },
 *   departamentos: [{nombre, n}], puntos: [{lat, lon, cliente}], totales: {...} }
 */
export async function resumenClientes() {
  return cached('resumen', async () => {
    const B = await base();
    // Clientes reales: columna CLIENTE del Directorio o de la Granja (no los nombres inferidos de filas
    // administrativas como SUPERNUMERARIO o ADMIN, que Control de Arqueos deduce del nombre de la oficina).
    const nombres = Array.from(new Set(B.dir.filter((o) => !o.inferido).map((o) => o.cliente).concat(B.granja.map((p) => p.cliente)).filter(Boolean)));
    const clientes = nombres.map((n) => filaResumen(B, n)).filter((r) => r.oficinas > 0 || r.personas > 0)
      .sort((a, b) => b.oficinas - a.oficinas || a.cliente.localeCompare(b.cliente, 'es'));
    const red = {}; Object.keys(COLUMNAS_CLIENTE).forEach((k) => { red[k] = redHabilitada(B, k); });
    const conCliente = B.dir.filter((o) => !o.inferido);
    return {
      generado: B.generado, mes: B.mes, mesAnterior: B.mesAnterior, meses: B.meses, clientes, red,
      departamentos: contar(B.dir.filter((o) => o.departamento), (o) => o.departamento),
      puntos: conCliente.filter((o) => o.lat !== null && o.lon !== null).map((o) => ({ lat: o.lat, lon: o.lon, cliente: o.cliente, oficina: o.oficina })),
      totales: { oficinas: conCliente.length, personas: B.granja.length, novedadesAbiertas: B.novedades.filter((n) => n.abierta).length }
    };
  });
}

/**
 * Detalle de un cliente. nombreReal = valor de la columna CLIENTE (o null); clave = clave del registro del portal.
 * {
 *   cliente, clave, generado, mes, mesAnterior, tieneRed,
 *   kpis: filaResumen,
 *   red: { puntos, personasConUsuario, departamentos, municipios, oficinas: [ {oficina, municipio, departamento, regional, zona, codigo} ] },
 *   oficinas: [vistaOficina + {personas, backups, estadoMes, cumpleMes, pendientes, ultimoArqueo}],
 *   distribucion: { regional, zona, departamento, estructura, negocio, medioPago: [{nombre, n}] },
 *   personal: { total, backups, conUsuario, porZona, porOficina, sinPersonal: [oficina], personas: [...] },
 *   arqueos: { serie, totalesMes, oficinasMes, pendientes, listaMes, diferenciasMes },
 *   ans: [...], novedades: [...]
 * }
 */
export async function cliente360(nombreReal, clave) {
  const nombre = txt(nombreReal);
  const k = txt(clave).toLowerCase();
  return cached('c360|' + nombre + '|' + k, async () => {
    const B = await base();
    const ofs = nombre ? B.dir.filter((o) => o.cliente === nombre) : [];
    const gente = nombre ? B.granja.filter((p) => p.cliente === nombre) : [];
    const kpis = nombre ? filaResumen(B, nombre) : null;

    // Red habilitada (código del cliente en oficinas del Directorio)
    let red = null;
    if (k && COLUMNAS_CLIENTE[k]) {
      const hab = B.dir.filter((o) => o.codigos[k]);
      red = { ...redHabilitada(B, k),
        oficinas: hab.map((o) => ({ oficina: o.oficina, municipio: o.municipio, departamento: o.departamento, regional: o.regional, zona: o.zona, codigo: o.codigos[k], cliente: o.cliente, lat: o.lat, lon: o.lon, horario: o.horario, cesantias: o.cesantias })),
        porDepartamento: contar(hab, (o) => o.departamento), porRegional: contar(hab, (o) => o.regional) };
    }

    // Personal por oficina
    const porOfi = {};
    gente.forEach((p) => { (porOfi[p.claveOficina] = porOfi[p.claveOficina] || []).push(p); });
    const estAct = new Map((B.estados[B.mes] || []).map((o) => [norm_(o.oficina), o]));
    const estAnt = new Map((B.estados[B.mesAnterior] || []).map((o) => [norm_(o.oficina), o]));

    const oficinas = ofs.map((o) => {
      const e = estAct.get(o.clave), ea = estAnt.get(o.clave), pp = porOfi[o.clave] || [];
      return { ...vistaOficina(o), personas: pp.length, backups: pp.filter((p) => p.backup).length,
        estadoMes: e ? e.estadoGeneral : 'SIN DATO', cumpleMes: !!(e && e.cumple), pendientes: e ? e.pendientes : [],
        estadoMesAnterior: ea ? ea.estadoGeneral : 'SIN DATO', cumpleMesAnterior: !!(ea && ea.cumple),
        fechaArqueo: e ? e.fechaOficina || '' : '', visitas: e ? e.visitas : 0, liderArqueo: e ? e.lider : '' };
    }).sort((a, b) => a.oficina.localeCompare(b.oficina, 'es'));

    const conUsuario = k ? gente.filter((p) => p.usuarios[k]).length : 0;
    const personal = {
      total: gente.length, backups: gente.filter((p) => p.backup).length, conUsuario,
      porZona: contar(gente, (p) => p.zona), porRegional: contar(gente, (p) => p.regional),
      porOficina: contar(gente, (p) => p.oficina).slice(0, 40),
      sinPersonal: ofs.filter((o) => !porOfi[o.clave]).map((o) => o.oficina),
      personas: gente.map((p) => ({ nombre: p.nombre, cedula: p.cedula, oficina: p.oficina, zona: p.zona, regional: p.regional, municipio: p.municipio,
        backup: p.backup, negociosBackup: p.negociosBackup, novedad: p.novedad, usuarioCliente: k ? !!p.usuarios[k] : false }))
        .sort((a, b) => a.oficina.localeCompare(b.oficina, 'es') || a.nombre.localeCompare(b.nombre, 'es'))
    };

    // Arqueos (consistentes con obtenerDashboardClientes)
    const serie = nombre ? serieArqueos(B, ofs, nombre) : [];
    const delMes = B.arqueos.filter((a) => nombre && a.cliente === nombre && a.mes === B.mes);
    const vistaArq = (a) => ({ id: a.id, fecha: a.fechaReal, oficina: a.oficina, formato: a.formato, tipo: a.tipoArqueo, elemento: a.elemento,
      novedad: a.novedad, diferencia: isFinite(parseFloat(a.diferencia)) ? parseFloat(a.diferencia) : null, lider: a.nombreLider,
      extemporaneo: a.extemporaneo === 'SÍ', estadoRevision: a.estadoRevision, modalidad: a.modalidad });
    const oficinasMes = (B.estados[B.mes] || []).filter((o) => nombre && norm_(o.cliente) === norm_(nombre));
    const t = { oficinas: oficinasMes.length, cumplen: 0, alDia: 0, parciales: 0, sinArqueo: 0, conATM: 0, atmTotal: 0, atmHechos: 0, extemporaneas: 0, faltantes: 0, sobrantes: 0, visitas: 0 };
    oficinasMes.forEach((o) => {
      if (o.cumple) t.cumplen++; if (o.aTiempo) t.alDia++; if (o.estadoGeneral === 'PARCIAL') t.parciales++; if (!o.conArqueo) t.sinArqueo++;
      if (o.exige.atm) { t.conATM++; t.atmTotal += o.atmTotal; t.atmHechos += o.atmHechos; }
      if (o.extemporaneos) t.extemporaneas++; t.faltantes += o.faltantes; t.sobrantes += o.sobrantes; t.visitas += o.visitas;
    });
    t.pctCumplimiento = t.oficinas ? Math.round((t.cumplen / t.oficinas) * 100) : 0;
    t.pctAlDia = t.oficinas ? Math.round((t.alDia / t.oficinas) * 100) : 0;
    t.pctATM = t.atmTotal ? Math.round((t.atmHechos / t.atmTotal) * 100) : null;
    t.arqueos = delMes.length;
    const arqueos = {
      serie, totalesMes: t,
      pendientes: oficinasMes.filter((o) => !o.cumple).map((o) => ({ oficina: o.oficina, zona: o.zona, regional: o.regional, lider: o.lider, estado: o.estadoGeneral, pendientes: o.pendientes })),
      listaMes: delMes.slice(0, 400).map(vistaArq),
      diferenciasMes: delMes.filter((a) => a.novedad === 'FALTANTE' || a.novedad === 'SOBRANTE').map(vistaArq)
    };

    const distribucion = {
      regional: contar(ofs, (o) => o.regional), zona: contar(ofs, (o) => o.zona), departamento: contar(ofs, (o) => o.departamento),
      estructura: contar(ofs, (o) => o.estructura), negocio: contar(ofs, (o) => o.negocio), medioPago: contar(ofs, (o) => o.medioPago || 'SIN PARAMETRIZAR')
    };
    return {
      cliente: nombre || null, clave: k || null, generado: B.generado, mes: B.mes, mesAnterior: B.mesAnterior, meses: B.meses,
      tieneRed: ofs.length > 0, kpis, red, oficinas, distribucion, personal, arqueos,
      ans: nombre ? B.ans.filter((a) => a.cliente === nombre) : [],
      novedades: nombre ? B.novedades.filter((n) => n.cliente === nombre).sort((a, b) => (a.abierta === b.abierta ? (b.inicio || '').localeCompare(a.inicio || '') : a.abierta ? -1 : 1)) : []
    };
  });
}

export const functions = { resumenClientes, cliente360 };
