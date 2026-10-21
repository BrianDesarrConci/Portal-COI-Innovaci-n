import { createContext, useContext } from 'react';

/**
 * Sesión del portal (llega de /api/auth/me).
 * usuario: { id, nombre, correo, iniciales, cargo, roles: string[] }
 * config:  { proveedor, demo, ... } de /api/auth/config
 * salir(): cierra la sesión en el servidor y vuelve al ingreso.
 */
const AuthContext = createContext({ usuario: null, config: null, salir: () => {} });
export const AuthProvider = AuthContext.Provider;
export const useAuth = () => useContext(AuthContext);

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
/** Misma regla que server/src/auth/roles.js: admin ve todo; sin roles exigidos, cualquier usuario con sesión. */
export function puedeAcceder(usuario, roles) {
  if (!usuario) return false;
  const mios = (usuario.roles || []).map(norm);
  if (mios.includes('admin')) return true;
  if (!roles || !roles.length) return true;
  return roles.some((r) => mios.includes(norm(r)));
}
