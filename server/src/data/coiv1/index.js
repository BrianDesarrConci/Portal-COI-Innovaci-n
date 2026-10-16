// Copia de demostración de los Sheets de COI V1. Cada archivo se referencia con una URL literal
// (new URL('./x.json', import.meta.url)) para que el empaquetador de funciones (Vercel) lo incluya.
import fs from 'node:fs';

const read = (url) => JSON.parse(fs.readFileSync(url, 'utf8'));
export const manifest = read(new URL('./manifest.json', import.meta.url));
const FILES = {
  "coiv1__ANS_Especializadas.json": () => read(new URL('./coiv1__ANS_Especializadas.json', import.meta.url)),
  "coiv1__Alias_Lideres.json": () => read(new URL('./coiv1__Alias_Lideres.json', import.meta.url)),
  "coiv1__Arqueos.json": () => read(new URL('./coiv1__Arqueos.json', import.meta.url)),
  "coiv1__Festivos.json": () => read(new URL('./coiv1__Festivos.json', import.meta.url)),
  "coiv1__Gestion_Novedades.json": () => read(new URL('./coiv1__Gestion_Novedades.json', import.meta.url)),
  "coiv1__Normalizaciones.json": () => read(new URL('./coiv1__Normalizaciones.json', import.meta.url)),
  "coiv1__Novedades.json": () => read(new URL('./coiv1__Novedades.json', import.meta.url)),
  "coiv1__Oficinas.json": () => read(new URL('./coiv1__Oficinas.json', import.meta.url)),
  "coiv1__PERMISOS.json": () => read(new URL('./coiv1__PERMISOS.json', import.meta.url)),
  "coiv1__Sesiones_Arqueo.json": () => read(new URL('./coiv1__Sesiones_Arqueo.json', import.meta.url)),
  "coiv1__Tipologias.json": () => read(new URL('./coiv1__Tipologias.json', import.meta.url)),
  "coiv1__Usuarios.json": () => read(new URL('./coiv1__Usuarios.json', import.meta.url)),
  "directorio__DIRECTORIO_NACIONAL.json": () => read(new URL('./directorio__DIRECTORIO_NACIONAL.json', import.meta.url)),
  "directorio__OFICINAS_CERRADAS.json": () => read(new URL('./directorio__OFICINAS_CERRADAS.json', import.meta.url)),
  "granja__DATOS_MANUALES.json": () => read(new URL('./granja__DATOS_MANUALES.json', import.meta.url)),
  "granja__GRANJA_DE_USUARIOS_JULLY.json": () => read(new URL('./granja__GRANJA_DE_USUARIOS_JULLY.json', import.meta.url)),
  "granja__REPORTE.json": () => read(new URL('./granja__REPORTE.json', import.meta.url)),
};
/** Filas de una hoja de la copia (o null si no existe). */
export const snapshotRows = (file) => (FILES[file] ? FILES[file]() : null);
