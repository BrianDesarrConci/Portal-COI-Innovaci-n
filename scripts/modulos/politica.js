/**
 * Reglas del contrato de módulos de COI. Lo que un analista entrega en su .zip:
 *
 *   <id>/module.json                     manifiesto (ver validarManifiesto)
 *   <id>/README.md                       descripción del módulo
 *   <id>/server/index.js                 export default async function registrar({ router, db, config, log, modulo, acceso })
 *   <id>/server/migraciones/NNN_x.sql    migraciones versionadas de la BD propia del módulo
 *   <id>/client/index.jsx                export default function Modulo({ sub, usuario, api })
 *   <id>/client/*.css, *.jsx, ...        resto de la interfaz (clases con el prefijo del módulo)
 *   <id>/test/*.test.js                  pruebas (node:test) que corre `npm test`
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DIR_SERVER = path.join(RAIZ, 'server', 'src', 'modulos');
export const DIR_CLIENT = path.join(RAIZ, 'client', 'src', 'modulos');
export const DIR_PLANTILLA = path.join(RAIZ, 'modulos', '_plantilla');
export const DIR_RESPALDO = path.join(RAIZ, 'modulos', '.respaldos');

export const RE_ID = /^[a-z][a-z0-9-]{1,30}$/;
export const RE_SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/;
export const RE_MIGRACION = /^(\d{3})_[a-z0-9_]+\.sql$/;
export const RE_VARIABLE_BD = /^DB_[A-Z0-9_]+_URL$/;
export const MOTORES = ['postgres', 'mysql', 'ninguna'];

/** Identificadores que no puede usar un módulo (rutas del portal fuera del registro de vistas). */
export const RESERVADOS = ['api', 'm', 'junta', 'login', 'auth', 'sdk', 'modulos', 'plantilla'];

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

export const varBDSugerida = (id) => 'DB_' + id.toUpperCase().replace(/-/g, '_') + '_URL';
export const varConfig = (id) => 'MOD_' + id.toUpperCase().replace(/-/g, '_') + '_';

export function compararVersiones(a, b) {
  const pa = RE_SEMVER.exec(a), pb = RE_SEMVER.exec(b);
  if (!pa || !pb) return 0;
  for (let i = 1; i <= 3; i++) { const d = Number(pa[i]) - Number(pb[i]); if (d) return Math.sign(d); }
  return 0;
}
