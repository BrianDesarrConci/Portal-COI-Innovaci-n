/**
 * Reglas del contrato de módulos de COI. Lo que un analista entrega en su .zip:
 *
 *   <id>/module.json                     manifiesto (ver validarManifiesto)
 *   <id>/README.md                       descripción del módulo
 *   <id>/server/index.js                 export default async function registrar({ router, db, config, log, modulo, acceso })
 *   <id>/server/migraciones/NNN_x.sql    migraciones MySQL de las tablas del módulo (todas con su prefijo)
 *   <id>/client/index.jsx                export default function Modulo({ sub, usuario, api })
 *   <id>/client/*.css, *.jsx, ...        resto de la interfaz (clases con el prefijo del módulo)
 *   <id>/test/*.test.js                  pruebas (node:test) que corre `npm test`
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// COI_MODULOS_RAIZ permite operar sobre otra copia del portal (pruebas del importador).
export const RAIZ = path.resolve(process.env.COI_MODULOS_RAIZ || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..'));
export const DIR_SERVER = path.join(RAIZ, 'server', 'src', 'modulos');
export const DIR_CLIENT = path.join(RAIZ, 'client', 'src', 'modulos');
export const DIR_PLANTILLA = path.join(RAIZ, 'modulos', '_plantilla');
export const DIR_EJEMPLO = path.join(RAIZ, 'modulos', '_ejemplo');
export const DIR_RESPALDO = path.join(RAIZ, 'modulos', '.respaldos');

export const RE_ID = /^[a-z][a-z0-9-]{1,30}$/;
export const RE_SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/;
export const RE_MIGRACION = /^(\d{3})_[a-z0-9_]+\.sql$/;
export const RE_VARIABLE_BD = /^DB_[A-Z0-9_]+_URL$/;
export const MOTORES = ['mysql', 'ninguna'];
export { RE_PREFIJO, prefijoSugerido } from '../../server/src/modulos/db.js';

/** Identificadores que no puede usar un módulo (rutas del portal fuera del registro de vistas). */
export const RESERVADOS = ['api', 'm', 'junta', 'login', 'auth', 'sdk', 'modulos', 'plantilla', 'ejemplo', 'admin'];

/** Tablas del portal que ningún módulo puede tocar. */
export const TABLAS_PORTAL = ['coi_migraciones'];

/** Sentencias prohibidas en las migraciones de un módulo: [patrón sobre la sentencia sin comentarios, motivo]. */
export const SQL_PROHIBIDO = [
  [/^(?:CREATE|DROP|ALTER)\s+(?:DATABASE|SCHEMA)\b/i, 'crear, cambiar o borrar bases de datos'],
  [/^USE\s/i, 'cambiar de base (USE)'],
  [/^(?:GRANT|REVOKE)\b/i, 'otorgar o quitar permisos (GRANT/REVOKE)'],
  [/^(?:CREATE|DROP|ALTER|RENAME)\s+USER\b/i, 'crear o cambiar usuarios de MySQL'],
  [/\bSET\s+(?:GLOBAL|PERSIST|PERSIST_ONLY)\b|@@global\./i, 'cambiar variables globales del servidor'],
  [/^CREATE\s+(?:OR\s+REPLACE\s+)?(?:DEFINER\s*=\s*\S+\s+)?(?:AGGREGATE\s+)?(?:TRIGGER|PROCEDURE|FUNCTION|EVENT)\b/i, 'triggers, procedimientos, funciones o eventos (la lógica va en server/)'],
  [/^(?:DROP|ALTER)\s+(?:TRIGGER|PROCEDURE|FUNCTION|EVENT)\b/i, 'triggers, procedimientos, funciones o eventos'],
  [/\bLOAD\s+DATA\b|\bINTO\s+(?:OUT|DUMP)FILE\b/i, 'leer o escribir archivos del servidor'],
  [/^(?:LOCK|UNLOCK)\s+TABLES?\b/i, 'bloquear tablas (LOCK TABLES)'],
  [/^(?:START\s+TRANSACTION|BEGIN|COMMIT|ROLLBACK|SAVEPOINT)\b/i, 'controlar transacciones (el portal aplica cada migración en su transacción)'],
];

/** Sintaxis de PostgreSQL que no funciona en MySQL. */
export const SQL_POSTGRES = /\bTIMESTAMPTZ\b|\b(?:BIG)?SERIAL\b|::\s*[a-z]|\bILIKE\b|\bRETURNING\b|\bJSONB\b/i;

/**
 * Dependencias npm aprobadas para los módulos. Una dependencia que no esté aquí bloquea la importación
 * hasta que se revise y se agregue (y se instale con `npm install -w server|client <paquete>`).
 */
export const DEPENDENCIAS_APROBADAS = {
  server: ['dayjs', 'zod'],
  client: ['dayjs', 'zod'],
};

/** Importaciones permitidas sin declarar. */
export const IMPORTS_CLIENT = ['react', 'react/jsx-runtime', 'react-dom', 'react-router-dom', '@coi/sdk'];
export const IMPORTS_SERVER = ['express'];
export const IMPORTS_TEST = ['#coi/pruebas'];

export const LIMITES = { archivo: 2 * 1024 * 1024, total: 10 * 1024 * 1024, entradas: 500 };

/** Archivos basura de los compresores; se descartan sin error. */
export const BASURA = (ruta) => ruta.startsWith('__MACOSX/') || /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini)$/i.test(ruta);

/** Extensiones permitidas por carpeta del paquete. */
export const EXTENSIONES = {
  server: ['.js', '.mjs', '.json'],
  client: ['.js', '.jsx', '.css', '.json', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.woff2'],
  test: ['.js', '.mjs', '.json'],
};
export const RAIZ_PERMITIDOS = ['module.json', 'README.md', 'CHANGELOG.md'];
export const TEXTO = ['.js', '.mjs', '.jsx', '.json', '.css', '.sql', '.md', '.svg'];

/** Patrones de secretos: bloquean la importación. */
export const SECRETOS = [
  [/-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/, 'llave privada'],
  [/"private_key"\s*:/, 'credencial de cuenta de servicio de Google'],
  [/AIza[0-9A-Za-z_-]{35}/, 'llave de API de Google'],
  [/AKIA[0-9A-Z]{16}/, 'llave de acceso de AWS'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}/, 'token de GitHub'],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/, 'token de Slack'],
  [/\bsk-(?:ant-)?[A-Za-z0-9_-]{20,}/, 'llave de API (sk-…)'],
  [/\b(?:postgres(?:ql)?|mysql|mariadb|mssql|sqlserver):\/\/[^\s:/@'"]+:[^\s@'"]+@/i, 'cadena de conexión con contraseña'],
];

export { varBD as varBDSugerida } from '../../server/src/modulos/db.js';
export const varConfig = (id) => 'MOD_' + id.toUpperCase().replace(/-/g, '_') + '_';

export function compararVersiones(a, b) {
  const pa = RE_SEMVER.exec(a), pb = RE_SEMVER.exec(b);
  if (!pa || !pb) return 0;
  for (let i = 1; i <= 3; i++) { const d = Number(pa[i]) - Number(pb[i]); if (d) return Math.sign(d); }
  return 0;
}
