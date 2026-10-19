/**
 * COI V1 · Inicio. Función nueva y liviana (no existe en V1, cuyo inicio era estático) que entrega
 * los contadores del tablero de entrada a partir de los mismos libros que usa cada módulo.
 */
import { SpreadsheetApp } from '../spreadsheet.js';
import { ID_EXCEL_PRINCIPAL, ID_EXCEL_DIRECTORIO } from '../books.js';
import { obtenerCajerosBackup, obtenerListaCajeros } from './granja.js';
import { recuperarHoja } from './_v1util.js';
import { obtenerNovedadesPendientes } from './granja.js';
import { obtenerHistorialPQR, TIPIFICACIONES } from './pqr.js';
import { functions as ARQ } from '../arqueos/controlArqueos.js';

const up = (v) => String(v ?? '').trim().toUpperCase();
const filas = async (bookId, hoja) => {
  const h = hoja === 'PQR' ? await recuperarHoja(bookId, hoja) : SpreadsheetApp.openById(bookId).getSheetByName(hoja);
  return h ? h.getDataRange().getValues() : [];
};

export async function resumenInicioV1() {
  const [nov, granja, arq, pqr, usuarios, backups, georef] = await Promise.all([
    filas(ID_EXCEL_PRINCIPAL, 'Novedades'), filas(ID_EXCEL_DIRECTORIO, 'GRANJA_DE_USUARIOS_JULLY'), filas(ID_EXCEL_PRINCIPAL, 'Arqueos'),
    filas(ID_EXCEL_PRINCIPAL, 'PQR'), filas(ID_EXCEL_PRINCIPAL, 'Usuarios'), obtenerCajerosBackup(), obtenerListaCajeros()
  ]);
  const estados = { PENDIENTE: 0, CUBIERTA: 0, RESUELTA: 0 };
  nov.slice(1).filter((f) => String(f[0] || '').trim()).forEach((f) => { const e = up(f[9]); estados[e] = (estados[e] || 0) + 1; });
  const hG = granja[0] || [];
  const iNom = Math.max(0, hG.findIndex((c) => up(c).includes('NOMBRE')));
  const personas = granja.slice(1).filter((f) => String(f[iNom] || '').trim()).length;
  const oficinas = new Set(granja.slice(1).map((f) => String(f[1] || '').trim()).filter(Boolean)).size;
  const arqueos = arq.slice(1).filter((f) => f.some((c) => String(c ?? '').trim() !== '')).length;
  const us = usuarios.slice(1).filter((f) => String(f[0] || '').trim());
  return {
    novedades: { pendientes: estados.PENDIENTE, cubiertas: estados.CUBIERTA, resueltas: estados.RESUELTA, total: nov.slice(1).filter((f) => String(f[0] || '').trim()).length },
    granja: { personas, georreferenciadas: georef.length, oficinas, backupsDisponibles: backups.length },
    arqueos: { registrados: arqueos },
    pqr: { radicadas: pqr.slice(1).filter((f) => String(f[0] || '').trim()).length },
    usuarios: { total: us.length, activos: us.filter((f) => up(f[4]) !== 'INACTIVO').length },
    generado: new Date().toISOString()
  };
}


// ------------------------------------------------------------------------------------------
// Tablero gerencial · "Operación en vivo": una sola llamada que agrega, con datos reales de los
// libros (Google Sheets), Control de Arqueos (vista de red con identidad Analista), Granja de
// Usuarios y el libro PQR. Cada bloque se resuelve por separado: si uno falla, trae `error` y
// el resto del tablero sigue mostrándose.
// ------------------------------------------------------------------------------------------
const IDENTIDAD_RED = ['JULLY ANDREA', 'Analista'];
const mesBogota = (d = new Date()) => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit' }).formatToParts(d);
  return p.find((x) => x.type === 'year').value + '-' + p.find((x) => x.type === 'month').value;
};
const diaBogota = () => Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', day: 'numeric' }).format(new Date()));
const NO_CLIENTE = new Set(['ADMIN', 'ADMINISTRACION', 'SUPERNUMERARIO', 'CONCILIACION', '']);
const mesPrevio = (mes) => { const [y, m] = mes.split('-').map(Number); const d = new Date(y, m - 2, 15); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const diasDesde = (iso, hoy) => { const t = Date.parse(iso); return Number.isFinite(t) ? Math.max(0, Math.floor((hoy - t) / 86400000)) : null; };
const fallo = (e) => ({ error: String((e && e.message) || e || 'Error desconocido') });

async function bloqueArqueos(mesPedido) {
  const v = await ARQ.validarEmbebido(...IDENTIDAD_RED);
  const id = v && v.success ? v.idUsuario : IDENTIDAD_RED[0];
  const rol = v && v.success ? v.rol : IDENTIDAD_RED[1];
  const mes = mesPedido || mesBogota();
  const ant = mesPrevio(mes);
  const [d, p, cl] = await Promise.all([ARQ.obtenerDashboard(id, rol, mes), ARQ.obtenerDashboard(id, rol, ant), ARQ.obtenerDashboardClientes(id, rol, mes)]);
  if (!d || d.error) throw new Error((d && d.error) || 'Sin respuesta del tablero de arqueos');
  const g = d.global, L = d.lideres || [];
  const cuenta = (est) => L.filter((l) => l.estado === est).length;
  const hoy = d.habiles.transcurridos;
  const clientes = cl && cl.success ? (cl.clientes || []).filter((c) => !NO_CLIENTE.has(String(c.cliente || '').trim().toUpperCase())) : [];
  const ofiTot = clientes.reduce((s, c) => s + c.oficinas, 0), ofiOk = clientes.reduce((s, c) => s + c.cumplen, 0);
  return {
    mes, mesAnterior: ant, meta: d.meta, habiles: d.habiles,
    validos: g.validos, metaGlobal: g.metaGlobal, pct: g.pctGlobal, totalArqueos: g.totalArqueos, extemporaneos: g.extemporaneos,
    esperadoALaFecha: d.habiles.total ? Math.round(g.metaGlobal * hoy / d.habiles.total) : 0,
    lideres: { total: g.totalLideres, enMeta: g.cumplenMeta, enRuta: cuenta('EN RUTA'), enRiesgo: cuenta('EN RIESGO'), criticos: cuenta('CRÍTICO') + cuenta('NO CUMPLIDA'), sinIniciar: cuenta('SIN INICIAR') },
    novedades: { faltantes: g.faltantes, sobrantes: g.sobrantes, montoFaltante: g.montoFaltante, montoSobrante: g.montoSobrante, montoNeto: g.montoNeto, mayor: (d.novedades || [])[0] || null },
    // Acumulado de válidos por día del mes; en el mes en curso, solo hasta hoy.
    serie: (d.serie || []).slice(0, mes === mesBogota() ? diaBogota() : undefined).map((x) => x.acumulado),
    anterior: p && !p.error ? { validos: p.global.validos, pct: p.global.pctGlobal } : null,
    oficinas: { total: ofiTot, conArqueo: ofiOk, pct: ofiTot ? Math.round(ofiOk / ofiTot * 100) : 0 },
    clientes: clientes.filter((c) => c.oficinas >= 3).map((c) => ({ cliente: c.cliente, oficinas: c.oficinas, cumplen: c.cumplen, pct: c.pct })).sort((a, b) => b.oficinas - a.oficinas).slice(0, 8)
  };
}

async function bloquePersonas(base) {
  const pend = await obtenerNovedadesPendientes(IDENTIDAD_RED[0], 'ADMIN');
  const hoy = Date.now();
  const dias = pend.map((n) => diasDesde(n.fechaInicioISO, hoy)).filter((x) => x !== null);
  const oficinasAfectadas = new Set(pend.map((n) => n.oficina)).size;
  return {
    ...base.novedades, backupsDisponibles: base.granja.backupsDisponibles, personas: base.granja.personas,
    oficinasAfectadas, pendienteMasAntiguaDias: dias.length ? Math.max(...dias) : null,
    coberturaPct: base.novedades.total ? Math.round((base.novedades.cubiertas + base.novedades.resueltas) / base.novedades.total * 100) : 100
  };
}

async function bloquePqr() {
  const h = await obtenerHistorialPQR('', 'ADMIN');
  const porTipo = Object.fromEntries(TIPIFICACIONES.map((t) => [t, 0]));
  h.forEach((r) => { porTipo[r.tipificacion] = (porTipo[r.tipificacion] || 0) + 1; });
  const hace30 = Date.now() - 30 * 86400000;
  return {
    radicadas: h.length, porTipo,
    ultimos30: h.filter((r) => Date.parse(r.fechaRadicacionISO) >= hace30).length,
    quejasReclamos: (porTipo['Queja'] || 0) + (porTipo['Reclamo'] || 0),
    ultima: h[0] ? { id: h[0].id, fecha: h[0].fechaRadicacion, tipificacion: h[0].tipificacion, oficina: h[0].oficina } : null
  };
}

/**
 * Resumen real para el Tablero gerencial. `mes` (yyyy-MM) es opcional: por defecto, el mes en curso (Bogotá).
 * Forma: { generado, mes, arqueos, personas, pqr, red, usuarios } — cada bloque puede ser { error }.
 */
export async function resumenTableroReal(mes) {
  const base = await resumenInicioV1();
  const [arq, per, pqr] = await Promise.allSettled([bloqueArqueos(mes), bloquePersonas(base), bloquePqr()]);
  const val = (r) => (r.status === 'fulfilled' ? r.value : fallo(r.reason));
  return {
    generado: new Date().toISOString(),
    mes: mes || mesBogota(),
    arqueos: val(arq),
    personas: val(per),
    pqr: val(pqr),
    red: { oficinas: base.granja.oficinas, personas: base.granja.personas, georreferenciadas: base.granja.georreferenciadas },
    usuarios: base.usuarios
  };
}

export const functions = { resumenInicioV1, resumenTableroReal };
