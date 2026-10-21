#!/usr/bin/env node
/**
 * Herramienta de módulos de COI.
 *   npm run modulo:nuevo -- <id> [--nombre "Nombre"] [--grupo "Operación"] [--autor "Nombre"] [--correo x@y] [--prefijo abc_] [--sin-bd]
 *   npm run modulo:validar -- <archivo.zip | carpeta | id>
 *   npm run modulo:importar -- <archivo.zip> [--reemplazar] [--simular]
 *   npm run modulo:empaquetar -- <id | carpeta> [--salida carpeta]
 *   npm run modulos:sync
 *   npm run modulos:migrar [-- <id>]
 *   npm run modulos:bd
 *   npm run modulos:listar
 */
import fs from 'node:fs';
import path from 'node:path';
import { DIR_RESPALDO, DIR_SERVER, RAIZ, RE_ID } from './politica.js';
import { eliminarInstalado, empaquetar, instalados, instalarPaquete, leerPaquete, paqueteDesdePlantilla } from './paquete.js';
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
    if (!id || !RE_ID.test(id)) fallar('Indique un id válido: minúsculas, números y guiones (p. ej. npm run modulo:nuevo -- validacion).');
    const ctx = await contextoPortal();
    const plan = ctx.pendientes[id];
    if ((ctx.vistas.includes(id) && !plan) || ctx.instalados.some((m) => m.id === id)) fallar(`El id "${id}" ya existe en el portal.`);
    if (!plan) aviso(`"${id}" no es un módulo del plan (${Object.keys(ctx.pendientes).join(', ')}); se marca como "nuevo".`);
    const txt = (k) => (typeof banderas[k] === 'string' ? banderas[k] : undefined);
    const paquete = paqueteDesdePlantilla(id, {
      nombre: txt('nombre') || (plan && plan.nombre) || id.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join(' '),
      grupo: txt('grupo') || (plan && plan.grupo), icono: plan && plan.icono,
      autor: txt('autor'), correo: txt('correo'), prefijo: txt('prefijo'),
      motor: banderas['sin-bd'] ? 'ninguna' : 'mysql', nuevo: !plan,
    });
    const r = validarPaquete(paquete, ctx);
    if (r.errores.length) { reporte(r); fallar('No se creó el módulo.'); }
    instalarPaquete(id, paquete);
    sync();
    ok(`Módulo ${id} creado:`);
    console.log(`   ${rel(path.join(DIR_SERVER, id))}/   manifiesto, servidor, migraciones y pruebas`);
    console.log(`   client/src/modulos/${id}/   interfaz\n`);
    console.log(`Siguiente: configure COI_MYSQL_URL en .env, npm run modulos:migrar -- ${id} y npm run dev (http://localhost:4000/${id})`);
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
    if (banderas.simular) {
      ok(`Simulación: ${man.nombre} ${man.version} se instalaría${previo ? ` reemplazando la versión ${previo.manifiesto.version}` : ''} en server/src/modulos/${man.id} y client/src/modulos/${man.id} (${archivos.size} archivos). No se escribió nada.`);
      return;
    }
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
    if (man.db.motor === 'mysql') console.log(`  npm run modulos:migrar -- ${man.id}   (tablas ${man.db.prefijo}* en la base COI_MYSQL_URL${man.db.variable ? ` o ${man.db.variable}` : ''})`);
    console.log('  npm test && npm run build');
    console.log(`  Revise en http://localhost:4000/${man.id} (menú ${man.menu.grupo} → ${man.menu.etiqueta})`);
  },

  async empaquetar() {
    if (!args[0]) fallar('Indique el id del módulo instalado o la carpeta del módulo.');
    const { archivos } = leerPaquete(args[0]);
    const ctx = await contextoPortal();
    let id;
    try { id = JSON.parse(archivos.get('module.json').toString('utf8')).id; } catch { fallar('module.json no se pudo leer.'); }
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
    if (!lista.length) { aviso('No hay módulos instalados.'); return; }
    let fallas = 0;
    for (const id of lista) {
      try {
        const ent = await cargarDesdeCarpeta(path.join(DIR_SERVER, id));
        const { db, migraciones, manifiesto } = await montar({ ...ent, registrar: async () => {} });
        if (!db) aviso(`${id}: sin base de datos.`);
        else if (db.configurada === false) { fallas++; error(`${id}: falta COI_MYSQL_URL; no se migró.`); }
        else ok(`${id}: ${migraciones.aplicadas.length ? 'aplicadas ' + migraciones.aplicadas.join(', ') : 'al día'} (${migraciones.total} en total, tablas ${manifiesto.db.prefijo}*).`);
        if (db) await db.cerrar();
      } catch (e) { fallas++; error(`${id}: ${e.message}`); }
    }
    if (fallas) process.exit(1);
  },

  /** Diagnóstico de la base MySQL: conexión, versión, juego de caracteres y migraciones pendientes por módulo. */
  async bd() {
    await import('../../server/src/env.js');
    const { cargarDesdeCarpeta, normalizar } = await import('../../server/src/modulos/montaje.js');
    const { abrirBD, origenURL } = await import('../../server/src/modulos/db.js');
    const { pendientes } = await import('../../server/src/modulos/migraciones.js');
    const mods = instalados().filter((m) => m.manifiesto.db && m.manifiesto.db.motor === 'mysql');
    if (!process.env.COI_MYSQL_URL && !mods.some((m) => origenURL(normalizar(m.manifiesto)))) {
      fallar('No hay base configurada: defina COI_MYSQL_URL (mysql://usuario:clave@servidor:3306/base) en .env o en Vercel.');
    }
    if (process.env.COI_MYSQL_URL) {
      const db = await abrirBD({ id: 'portal', db: { motor: 'mysql', prefijo: 'coi_' } }, { url: process.env.COI_MYSQL_URL });
      try {
        const { rows: [v] } = await db.query('SELECT VERSION() AS version, DATABASE() AS base, @@character_set_database AS juego, @@session.time_zone AS zona');
        ok(`COI_MYSQL_URL: conectado a ${v.base} (MySQL ${v.version}, ${v.juego}, zona ${v.zona}${process.env.DB_SSL === '1' ? ', SSL' : ''}).`);
        if (v.juego !== 'utf8mb4') aviso(`La base usa ${v.juego}; se recomienda utf8mb4 (ALTER DATABASE … CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci).`);
      } catch (e) { error(`COI_MYSQL_URL: ${e.message}`); process.exitCode = 1; } finally { await db.cerrar(); }
    }
    for (const { id } of mods) {
      const ent = await cargarDesdeCarpeta(path.join(DIR_SERVER, id));
      const man = normalizar(ent.manifiesto);
      const db = await abrirBD(man, { log: { warn() {} } });
      try {
        if (db.configurada === false) { aviso(`${id}: sin base configurada.`); continue; }
        const pend = await pendientes(db, id, ent.migraciones);
        const { rows: [t] } = await db.query("SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE ?", [man.db.prefijo.replace(/_/g, '\\_') + '%']);
        const msg = `${id}: ${origenURL(man)}, ${t.n} tabla(s) ${man.db.prefijo}*, ${pend.length ? 'pendientes ' + pend.join(', ') : 'migraciones al día'}.`;
        if (pend.length) aviso(msg); else ok(msg);
      } catch (e) { error(`${id}: ${e.message}`); process.exitCode = 1; } finally { await db.cerrar(); }
    }
  },

  async listar() {
    const lista = instalados();
    if (!lista.length) { console.log('No hay módulos instalados. Cree uno con npm run modulo:nuevo -- <id>.'); return; }
    for (const { id, manifiesto: m } of lista) {
      const roles = m.acceso && m.acceso.roles && m.acceso.roles.length ? m.acceso.roles.join(', ') : 'todos';
      const bd = m.db && m.db.motor === 'mysql' ? `MySQL, tablas ${m.db.prefijo || '?'}*${m.db.variable ? ` (${m.db.variable})` : ''}` : 'sin BD';
      console.log(`${C.n}${id}${C.x} ${m.version}  ${m.nombre}  ·  ${m.menu.grupo} → ${m.menu.etiqueta}  ·  ${bd}  ·  roles: ${roles}  ·  ${m.autor.nombre}`);
    }
  },
};

if (!comandos[comando]) {
  console.log('Comandos: nuevo, validar, importar, empaquetar, sync, migrar, bd, listar. Vea docs/modulos/GUIA-ANALISTAS.md');
  process.exit(comando ? 1 : 0);
}
comandos[comando]().catch((e) => fallar(e.message));
