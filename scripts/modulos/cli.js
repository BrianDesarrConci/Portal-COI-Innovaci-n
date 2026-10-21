#!/usr/bin/env node
/**
 * Herramienta de módulos de COI.
 *   npm run modulo:nuevo -- <id> [--nombre "Nombre"] [--grupo "Operación"] [--motor postgres|mysql|ninguna]
 *   npm run modulo:validar -- <archivo.zip | carpeta | id>
 *   npm run modulo:importar -- <archivo.zip> [--reemplazar]
 *   npm run modulo:empaquetar -- <id> [--salida carpeta]
 *   npm run modulos:sync
 *   npm run modulos:migrar [-- <id>]
 *   npm run modulos:listar
 */
import fs from 'node:fs';
import path from 'node:path';
import { DIR_PLANTILLA, DIR_RESPALDO, DIR_SERVER, RAIZ, RE_ID, varBDSugerida } from './politica.js';
import { eliminarInstalado, empaquetar, instalados, instalarPaquete, leerCarpeta, leerPaquete } from './paquete.js';
import { contextoPortal, huerfanosCliente, validarPaquete } from './validar.js';
import { sincronizar } from './sincronizar.js';

const [, , comando, ...resto] = process.argv;
const banderas = {};
const args = [];
for (let i = 0; i < resto.length; i++) {
  if (resto[i].startsWith('--')) {
    const k = resto[i].slice(2);
    if (resto[i + 1] !== undefined && !resto[i + 1].startsWith('--')) banderas[k] = resto[++i]; else banderas[k] = true;
  } else args.push(resto[i]);
}

const C = process.stdout.isTTY ? { r: '\x1b[31m', v: '\x1b[32m', a: '\x1b[33m', n: '\x1b[1m', x: '\x1b[0m' } : { r: '', v: '', a: '', n: '', x: '' };
const ok = (m) => console.log(`${C.v}✔${C.x} ${m}`);
const aviso = (m) => console.log(`${C.a}!${C.x} ${m}`);
const error = (m) => console.log(`${C.r}✘${C.x} ${m}`);
const rel = (p) => path.relative(RAIZ, p) || '.';
function fallar(m) { error(m); process.exit(1); }

function reporte({ errores, avisos }) {
  avisos.forEach(aviso);
  errores.forEach(error);
  if (!errores.length) ok(`Paquete válido${avisos.length ? ` (${avisos.length} aviso${avisos.length > 1 ? 's' : ''})` : ''}.`);
}

function sync() {
  const r = sincronizar();
  r.errores.forEach((e) => error('Módulo omitido del registro: ' + e));
  huerfanosCliente().forEach((id) => aviso(`client/src/modulos/${id} no tiene parte de servidor; no se registra.`));
  if (!banderas.silencioso || r.cambios.length) ok(`Registro de módulos sincronizado (${r.modulos.length} módulo${r.modulos.length === 1 ? '' : 's'}${r.cambios.length ? ', actualizado' : ', sin cambios'}).`);
  return r;
}

const comandos = {
  async nuevo() {
    const id = args[0];
    if (!id || !RE_ID.test(id)) fallar('Indique un id válido: minúsculas, números y guiones (p. ej. npm run modulo:nuevo -- control-remesas).');
    const ctx = await contextoPortal();
    if (ctx.vistas.includes(id) || ctx.instalados.some((m) => m.id === id)) fallar(`El id "${id}" ya existe en el portal.`);
    const motor = banderas.motor || 'postgres';
    const nombre = typeof banderas.nombre === 'string' ? banderas.nombre : id.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join(' ');
    const reemplazos = {
      __ID__: id, __NOMBRE__: nombre, __GRUPO__: typeof banderas.grupo === 'string' ? banderas.grupo : 'Operación',
      __MOTOR__: motor, __VARIABLE__: varBDSugerida(id), __AUTOR__: typeof banderas.autor === 'string' ? banderas.autor : 'Nombre del analista',
    };
    if (!['postgres', 'mysql', 'ninguna'].includes(motor)) fallar('--motor debe ser postgres, mysql o ninguna.');
    const paquete = new Map();
    // La plantilla es PostgreSQL; variantes/<motor>/ reemplaza los archivos que cambian con otro motor.
    for (const [ruta, buf] of leerCarpeta(DIR_PLANTILLA)) if (!ruta.startsWith('variantes/')) paquete.set(ruta, buf);
    const variante = path.join(DIR_PLANTILLA, 'variantes', motor);
    if (fs.existsSync(variante)) for (const [ruta, buf] of leerCarpeta(variante)) paquete.set(ruta, buf);
    const final = new Map();
    for (const [ruta, buf] of paquete) {
      if (motor === 'ninguna' && ruta.startsWith('server/migraciones/')) continue;
      let txt = buf.toString('utf8');
      if (motor === 'ninguna' && ruta === 'module.json') txt = txt.replace('"__VARIABLE__"', 'null');
      txt = txt.replace(/__[A-Z]+__/g, (k) => (reemplazos[k] !== undefined ? reemplazos[k] : k));
      final.set(ruta, Buffer.from(txt));
    }
    instalarPaquete(id, final);
    sync();
    ok(`Módulo ${id} creado:`);
    console.log(`   ${rel(path.join(DIR_SERVER, id))}/   manifiesto, servidor, migraciones y pruebas`);
    console.log(`   client/src/modulos/${id}/   interfaz\n`);
    console.log(`Siguiente: npm run dev y abra http://localhost:4000/${id}`);
  },

  async validar() {
    if (!args[0]) fallar('Indique el .zip, la carpeta o el id del módulo.');
    const { archivos, descartados } = leerPaquete(args[0]);
    if (descartados) aviso(`${descartados} archivo(s) del sistema descartado(s) (__MACOSX, .DS_Store…).`);
    const ctx = await contextoPortal();
    const instalado = ctx.instalados.some((m) => args[0] === m.id);
    const r = validarPaquete(archivos, instalado ? { ...ctx, instalados: ctx.instalados.filter((m) => m.id !== args[0]) } : ctx, { reemplazar: !!banderas.reemplazar });
    reporte(r);
    if (r.errores.length) process.exit(1);
  },

  async importar() {
    if (!args[0] || !/\.zip$/i.test(args[0])) fallar('Indique el archivo .zip del módulo.');
    console.log(`${C.n}Importando ${args[0]}${C.x}`);
    const { archivos, descartados } = leerPaquete(args[0]);
    if (descartados) aviso(`${descartados} archivo(s) del sistema descartado(s) (__MACOSX, .DS_Store…).`);
    const ctx = await contextoPortal();
    const r = validarPaquete(archivos, ctx, { reemplazar: !!banderas.reemplazar });
    reporte(r);
    if (r.errores.length) fallar('El módulo no se importó. Devuelva los errores al analista.');
    const man = r.manifiesto;
    const previo = ctx.instalados.find((m) => m.id === man.id);
    if (previo) {
      fs.mkdirSync(DIR_RESPALDO, { recursive: true });
      const resp = path.join(DIR_RESPALDO, `${man.id}-${previo.manifiesto.version}-${Date.now()}.zip`);
      fs.writeFileSync(resp, empaquetar(man.id));
      eliminarInstalado(man.id);
      ok(`Versión anterior ${previo.manifiesto.version} respaldada en ${rel(resp)}.`);
    }
    instalarPaquete(man.id, archivos);
    ok(`${man.nombre} ${man.version} instalado (${archivos.size} archivos) en server/src/modulos/${man.id} y client/src/modulos/${man.id}.`);
    sync();
    const deps = Object.entries(man.dependencias).filter(([, d]) => Object.keys(d).length);
    console.log(`\n${C.n}Siguientes pasos${C.x}`);
    deps.forEach(([lado, d]) => console.log(`  npm install -w ${lado} ${Object.entries(d).map(([p, v]) => `${p}@${v}`).join(' ')}`));
    if (man.db.motor !== 'ninguna') console.log(`  Configure ${man.db.variable} (Vercel → Settings → Environment Variables) y ejecute npm run modulos:migrar -- ${man.id}`);
    console.log('  npm test && npm run build');
    console.log(`  Revise en http://localhost:4000/${man.id} (menú ${man.menu.grupo} → ${man.menu.etiqueta})`);
  },

  async empaquetar() {
    const id = args[0];
    if (!id) fallar('Indique el id del módulo.');
    const { archivos } = leerPaquete(id);
    const ctx = await contextoPortal();
    const r = validarPaquete(archivos, { ...ctx, instalados: ctx.instalados.filter((m) => m.id !== id) });
    reporte(r);
    if (r.errores.length) fallar('Corrija los errores antes de empaquetar.');
    const dir = path.resolve(typeof banderas.salida === 'string' ? banderas.salida : RAIZ);
    fs.mkdirSync(dir, { recursive: true });
    const destino = path.join(dir, `${id}-${r.manifiesto.version}.zip`);
    fs.writeFileSync(destino, empaquetar(id, archivos));
    ok(`Paquete listo: ${destino}`);
  },

  async sync() { const r = sync(); if (r.errores.length) process.exit(1); },

  async migrar() {
    await import('../../server/src/env.js');
    const { cargarDesdeCarpeta, montar } = await import('../../server/src/modulos/montaje.js');
    const lista = args.length ? args : instalados().map((m) => m.id);
    let fallas = 0;
    for (const id of lista) {
      try {
        const ent = await cargarDesdeCarpeta(path.join(DIR_SERVER, id));
        const { db, migraciones } = await montar({ ...ent, registrar: async () => {} });
        if (!db) aviso(`${id}: sin base de datos.`);
        else if (db.configurada === false) aviso(`${id}: falta ${ent.manifiesto.db.variable}; no se migró.`);
        else ok(`${id}: ${migraciones.aplicadas.length ? 'aplicadas ' + migraciones.aplicadas.join(', ') : 'al día'} (${migraciones.total} en total${db.embebida ? ', BD embebida PGlite' : ''}).`);
        if (db) await db.cerrar();
      } catch (e) { fallas++; error(`${id}: ${e.message}`); }
    }
    if (fallas) process.exit(1);
  },

  async listar() {
    const lista = instalados();
    if (!lista.length) { console.log('No hay módulos instalados. Cree uno con npm run modulo:nuevo -- <id>.'); return; }
    for (const { id, manifiesto: m } of lista) {
      const roles = m.acceso && m.acceso.roles && m.acceso.roles.length ? m.acceso.roles.join(', ') : 'todos';
      console.log(`${C.n}${id}${C.x} ${m.version}  ${m.nombre}  ·  ${m.menu.grupo} → ${m.menu.etiqueta}  ·  BD ${m.db.motor}${m.db.variable ? ` (${m.db.variable}${process.env[m.db.variable] ? ' configurada' : ''})` : ''}  ·  roles: ${roles}  ·  ${m.autor.nombre}`);
    }
  },
};

if (!comandos[comando]) {
  console.log('Comandos: nuevo, validar, importar, empaquetar, sync, migrar, listar. Vea docs/modulos/GUIA-ANALISTAS.md');
  process.exit(comando ? 1 : 0);
}
comandos[comando]().catch((e) => fallar(e.message));
