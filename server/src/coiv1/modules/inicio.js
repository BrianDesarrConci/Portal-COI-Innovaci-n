/**
 * COI V1 · Inicio. Función nueva y liviana (no existe en V1, cuyo inicio era estático) que entrega
 * los contadores del tablero de entrada a partir de los mismos libros que usa cada módulo.
 */
import { SpreadsheetApp } from '../spreadsheet.js';
import { ID_EXCEL_PRINCIPAL, ID_EXCEL_DIRECTORIO } from '../books.js';
import { obtenerCajerosBackup, obtenerListaCajeros } from './granja.js';
import { recuperarHoja } from './_v1util.js';

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

export const functions = { resumenInicioV1 };
