/**
 * Reglas de acceso por rol, comunes a todo el portal.
 * Usuario de sesión: { id, nombre, correo, iniciales, cargo, roles: string[] }.
 * - 'admin' accede a todo.
 * - Una lista de roles vacía (o ausente) significa "cualquier usuario con sesión".
 * Los nombres de rol se comparan sin mayúsculas ni tildes.
 */
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export const ROL_ADMIN = 'admin';

export function tieneRol(usuario, rol) {
  return !!usuario && Array.isArray(usuario.roles) && usuario.roles.some((r) => norm(r) === norm(rol));
}

export function puedeAcceder(usuario, roles) {
  if (!usuario) return false;
  if (tieneRol(usuario, ROL_ADMIN)) return true;
  if (!roles || !roles.length) return true;
  return roles.some((r) => tieneRol(usuario, r));
}
