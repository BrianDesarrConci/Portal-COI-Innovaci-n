/**
 * Entradas de menú de los módulos de los analistas (datos puros; lo usa lib/nav.js).
 * Un módulo cuyo id es el de una opción en construcción (lib/estados.js) toma su lugar en el menú.
 * Los demás entran en su grupo (ordenados por "orden") o crean un grupo nuevo antes de «Herramientas».
 */
import { MODULOS } from './registro.generado.js';

/** Roles exigidos por cada módulo (id → roles). Lista vacía = cualquier usuario con sesión. */
export const ACCESO_MODULOS = Object.fromEntries(MODULOS.map((m) => [m.id, m.acceso.roles]));

/** Devuelve una copia de NAV con los módulos incorporados. */
export function fusionarMenu(nav) {
  const out = nav.map((g) => [g[0], g[1].slice(), ...g.slice(2)]);
  const orden = [...MODULOS].sort((a, b) => (a.menu.orden - b.menu.orden) || a.menu.etiqueta.localeCompare(b.menu.etiqueta));
  for (const m of orden) {
    const item = [m.id, m.menu.etiqueta, m.menu.icono];
    if (m.menu.insignia !== undefined) item.push(m.menu.insignia);
    const lugar = out.find((g) => g[1].some((it) => it[0] === m.id));
    if (lugar) { lugar[1] = lugar[1].map((it) => (it[0] === m.id ? item : it)); continue; }
    let g = out.find((x) => x[0] === m.menu.grupo);
    if (!g) {
      g = [m.menu.grupo, []];
      const i = out.findIndex((x) => x[0] === 'Herramientas');
      out.splice(i === -1 ? out.length : i, 0, g);
    }
    g[1].push(item);
  }
  return out;
}
