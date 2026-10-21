/**
 * Genera los registros ESTÁTICOS de módulos (sin lecturas de carpeta en tiempo de ejecución, para que
 * Vite y el empaquetador de Vercel incluyan todo):
 *   server/src/modulos/registro.generado.js   manifiestos, función registrar y migraciones de cada módulo
 *   client/src/modulos/registro.generado.js   manifiestos de menú y componente diferido (React.lazy)
 * La salida es determinista (ordenada por id) para que los cambios se vean limpios en git.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DIR_CLIENT, DIR_SERVER, RE_MIGRACION } from './politica.js';
import { instalados } from './paquete.js';
import { validarManifiesto } from './validar.js';

const CABECERA = '// Archivo generado por `npm run modulos:sync` a partir de los módulos instalados. No editar a mano.\n';
const ident = (id) => 'registrar_' + id.replace(/-/g, '_');
const json = (v, sangria) => JSON.stringify(v, null, 2).replace(/\n/g, '\n' + sangria);

export function generarRegistros() {
  const mods = [];
  const errores = [];
  for (const { id, manifiesto } of instalados()) {
    const e = [];
    const man = validarManifiesto(manifiesto, e, []);
    if (man && man.id !== id) e.push(`el id del manifiesto (${man.id}) no coincide con la carpeta`);
    if (!fs.existsSync(path.join(DIR_SERVER, id, 'server', 'index.js'))) e.push('falta server/index.js');
    if (!fs.existsSync(path.join(DIR_CLIENT, id, 'index.jsx'))) e.push(`falta client/src/modulos/${id}/index.jsx`);
    if (e.length) { errores.push(`${id}: ${e.join('; ')}`); continue; }
    const dirMig = path.join(DIR_SERVER, id, 'server', 'migraciones');
    const migraciones = fs.existsSync(dirMig) ? fs.readdirSync(dirMig).filter((n) => RE_MIGRACION.test(n)).sort() : [];
    mods.push({ id, man, migraciones });
  }

  let server = CABECERA;
  for (const m of mods) server += `import ${ident(m.id)} from './${m.id}/server/index.js';\n`;
  server += '\nexport const MODULOS = [\n';
  for (const m of mods) {
    server += '  {\n';
    server += `    manifiesto: ${json(m.man, '    ')},\n`;
    server += `    registrar: ${ident(m.id)},\n`;
    server += '    migraciones: [\n';
    for (const n of m.migraciones) server += `      { nombre: '${n}', url: new URL('./${m.id}/server/migraciones/${n}', import.meta.url) },\n`;
    server += '    ],\n  },\n';
  }
  server += '];\n';

  let client = CABECERA + "import { lazy } from 'react';\n\nexport const MODULOS = [\n";
  for (const m of mods) {
    const { id, nombre, version, descripcion, autor, menu, acceso } = m.man;
    client += `  {\n    ...${json({ id, nombre, version, descripcion, autor, menu, acceso }, '    ')},\n`;
    client += `    Componente: lazy(() => import('./${m.id}/index.jsx')),\n  },\n`;
  }
  client += '];\n';
  return { server, client, modulos: mods.map((m) => m.id), errores };
}

/** Escribe los registros si cambiaron. Devuelve { modulos, errores, cambios }. */
export function sincronizar() {
  const r = generarRegistros();
  const cambios = [];
  for (const [dir, txt] of [[DIR_SERVER, r.server], [DIR_CLIENT, r.client]]) {
    const f = path.join(dir, 'registro.generado.js');
    fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== txt) { fs.writeFileSync(f, txt); cambios.push(f); }
  }
  return { modulos: r.modulos, errores: r.errores, cambios };
}
