/**
 * COI V1 · Seguridad, usuarios y permisos (Código.gs: validarCredenciales, obtenerPermisos,
 * obtenerTablaPermisos, obtenerUsuarios, obtenerUsuario, crearUsuario, actualizarUsuario,
 * guardarPermisos). Lógica portada sin cambios funcionales sobre las hojas Usuarios y PERMISOS.
 */
import { SpreadsheetApp } from '../spreadsheet.js';
import { ID_EXCEL_PRINCIPAL } from '../books.js';

const ss = () => SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);

async function permisosDe(user) {
  const hojaPermisos = ss().getSheetByName('PERMISOS');
  const permisosData = await hojaPermisos.getDataRange().getValues();
  const encabezados = permisosData[0];
  const permisos = {};
  for (let i = 1; i < permisosData.length; i++) {
    if (permisosData[i][0].toString() === user) {
      for (let j = 1; j < encabezados.length; j++) permisos[encabezados[j].toLowerCase()] = permisosData[i][j].toString().toUpperCase() === 'SI';
      break;
    }
  }
  return permisos;
}

export async function validarCredenciales(user, pass) {
  try {
    const usuarios = await ss().getSheetByName('Usuarios').getDataRange().getValues();
    let usuarioEncontrado = null;
    for (let i = 1; i < usuarios.length; i++) {
      // La copia de demostración no trae contraseñas: una contraseña vacía nunca autentica.
      if (usuarios[i][0].toString() === user && usuarios[i][1].toString() !== '' && usuarios[i][1].toString() === pass) {
        usuarioEncontrado = { success: true, nombre: user, rol: usuarios[i][2], llave_arqueos: usuarios[i][5] ? usuarios[i][5].toString().trim() : '' };
        break;
      }
    }
    if (!usuarioEncontrado) return { success: false, msg: 'Usuario o clave incorrecta' };
    usuarioEncontrado.permisos = await permisosDe(user);
    return usuarioEncontrado;
  } catch (e) {
    return { success: false, msg: e.toString() };
  }
}

/**
 * Solo demostración: abre la sesión de un usuario existente sin contraseña (la copia de los
 * Sheets no incluye contraseñas). Devuelve la misma forma que validarCredenciales.
 */
export async function iniciarSesionDemo(user) {
  const usuarios = await ss().getSheetByName('Usuarios').getDataRange().getValues();
  const f = usuarios.slice(1).find((r) => r[0].toString() === user);
  if (!f) return { success: false, msg: 'Usuario no encontrado' };
  if (String(f[4]).toUpperCase() === 'INACTIVO') return { success: false, msg: 'Usuario inactivo' };
  return { success: true, nombre: user, rol: f[2], correo: f[3], llave_arqueos: f[5] ? f[5].toString().trim() : '', permisos: await permisosDe(user) };
}

export async function obtenerPermisos(usuario) {
  const datos = await ss().getSheetByName('PERMISOS').getDataRange().getValues();
  const encabezados = datos[0];
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][0] == usuario) {
      const permisos = {};
      for (let j = 1; j < encabezados.length; j++) permisos[encabezados[j].toLowerCase()] = datos[i][j] == 'SI';
      return permisos;
    }
  }
  return null;
}

export async function obtenerTablaPermisos() {
  return ss().getSheetByName('PERMISOS').getDataRange().getValues();
}

export async function obtenerUsuarios() {
  const datos = await ss().getSheetByName('Usuarios').getDataRange().getValues();
  datos.shift();
  // No se exponen contraseñas al navegador.
  return datos.map((r) => { const c = r.slice(); c[1] = c[1] ? '••••••' : ''; return c; });
}

export async function obtenerUsuario(usuario) {
  const datos = await ss().getSheetByName('Usuarios').getDataRange().getValues();
  for (let i = 1; i < datos.length; i++) {
    if (datos[i][0] == usuario) return { success: true, usuario: datos[i][0], password: '', rol: datos[i][2], correo: datos[i][3], estado: datos[i][4], llave_arqueos: datos[i][5] || '', nombre_usuario: datos[i][6] || '' };
  }
  return { success: false, msg: 'Usuario no encontrado.' };
}

export async function guardarPermisos(permisos) {
  const hoja = ss().getSheetByName('Permisos');
  const datos = await hoja.getDataRange().getValues();
  const encabezados = datos[0];
  for (let i = 1; i < datos.length; i++) {
    const usuario = datos[i][0];
    if (!permisos[usuario]) continue;
    for (let j = 1; j < encabezados.length; j++) datos[i][j] = permisos[usuario][encabezados[j]] ? 'SI' : 'NO';
  }
  await hoja.getRange(1, 1, datos.length, datos[0].length).setValues(datos);
  return true;
}

export async function crearUsuario(datos) {
  try {
    const hojaUsuarios = ss().getSheetByName('Usuarios');
    const hojaPermisos = ss().getSheetByName('Permisos');
    const usuarios = await hojaUsuarios.getDataRange().getValues();
    for (let i = 1; i < usuarios.length; i++) {
      if (usuarios[i][0].toString().trim().toUpperCase() == datos.usuario.trim().toUpperCase()) return { success: false, msg: 'El usuario ya existe.' };
    }
    await hojaUsuarios.appendRow([datos.usuario, datos.password, datos.rol, datos.correo, datos.estado]);
    const encabezados = (await hojaPermisos.getRange(1, 1, 1, await hojaPermisos.getLastColumn()).getValues())[0];
    const nuevaFila = encabezados.map((_c, index) => (index == 0 ? datos.usuario : 'NO'));
    await hojaPermisos.appendRow(nuevaFila);
    return { success: true };
  } catch (e) {
    return { success: false, msg: e.toString() };
  }
}

export async function actualizarUsuario(datos) {
  try {
    const hoja = ss().getSheetByName('Usuarios');
    const usuarios = await hoja.getDataRange().getValues();
    for (let i = 1; i < usuarios.length; i++) {
      if (usuarios[i][0].toString().trim().toUpperCase() == datos.usuario.trim().toUpperCase()) {
        // Si no se escribe una contraseña nueva se conserva la actual.
        if (datos.password) await hoja.getRange(i + 1, 2).setValue(datos.password);
        await hoja.getRange(i + 1, 3).setValue(datos.rol);
        await hoja.getRange(i + 1, 4).setValue(datos.correo);
        await hoja.getRange(i + 1, 5).setValue(datos.estado);
        return { success: true };
      }
    }
    return { success: false, msg: 'No se encontró el usuario.' };
  } catch (e) {
    return { success: false, msg: e.toString() };
  }
}

export const functions = { validarCredenciales, iniciarSesionDemo, obtenerPermisos, obtenerTablaPermisos, obtenerUsuarios, obtenerUsuario, guardarPermisos, crearUsuario, actualizarUsuario };
