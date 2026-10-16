/**
 * SISTEMA REVAL 2026 - ARCHIVO CÓpruebaDIGO.GS (BACKEND)
 * Este archivo contiene toda la lógica del servidor.
 */

// --- CONFIGURACIÓN GLOBAL ---
const API_KEY_GEMINI = "<REDACTADO: rotar esta clave>";
const URL_GEMINI = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=" + API_KEY_GEMINI;

// IDs de tus hojas de cálculo (Verifica que sean los actuales)
const ID_EXCEL_PRINCIPAL = "1dr45Mglxhv-QoljLTNn37BFsrr6gtZVLZlMVCIMhk54"; 
const ID_EXCEL_DIRECTORIO = "1bPDJzCO4SoovpXbxXZfXQg4HkJMlEyf5Jkd7wGfLpmg"; 
const ID_EXCEL_ARQUEOS = "1WF1GJ_MuDtQTm2GRed2z6xuGJ7N2ERspGqOSyBWSBR0"; 

function doGet() {
  var template = HtmlService.createTemplateFromFile('index');
  return template.evaluate()
      .setTitle('Sistema REVAL 2026')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Permite incluir archivos HTML (CSS/JS) en el index
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ==========================================
// --- SEGURIDAD Y LOGIN ---
// ==========================================

function validarCredenciales(user, pass) {

  try {

    const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);

    //==========================
    // HOJA USUARIOS
    //==========================

    const hojaUsuarios = ss.getSheetByName("Usuarios");
    const usuarios = hojaUsuarios.getDataRange().getValues();

    let usuarioEncontrado = null;

    for (let i = 1; i < usuarios.length; i++) {
      if (
        usuarios[i][0].toString() === user &&
        usuarios[i][1].toString() === pass
      ) {
        usuarioEncontrado = {
          success: true,
          nombre: user,
          rol: usuarios[i][2],
          // NUEVO: Capturamos la llave de arqueos desde la columna F (índice 5)
          llave_arqueos: usuarios[i][5] ? usuarios[i][5].toString().trim() : ""
        };
        break;
      }
    }

    if (!usuarioEncontrado) {

      return {
        success: false,
        msg: "Usuario o clave incorrecta"
      };

    }

    //==========================
    // HOJA PERMISOS
    //==========================

    const hojaPermisos = ss.getSheetByName("PERMISOS");
    const permisosData = hojaPermisos.getDataRange().getValues();

    const encabezados = permisosData[0];

    let permisos = {};

    for (let i = 1; i < permisosData.length; i++) {

      if (permisosData[i][0].toString() === user) {

        for (let j = 1; j < encabezados.length; j++) {

          permisos[encabezados[j].toLowerCase()] =
            permisosData[i][j].toString().toUpperCase() === "SI";

        }

        break;

      }

    }

    usuarioEncontrado.permisos = permisos;

    return usuarioEncontrado;

  } catch (e) {

    return {
      success: false,
      msg: e.toString()
    };

  }

}

// ==========================================
// --- GESTIÓN DE REPORTES (Excel 1) ---
// ==========================================

function obtenerDatos() {
  const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
  const hoja = ss.getSheets()[0]; // Primera const idxTel = buscarIdx("TEL") !== -1 ? buscarIdx("TEL") : 19;
  const valores = hoja.getDataRange().getValues();
  return (valores.length > 1) ? valores.slice(1) : [];
}

function guardarEnExcel(datos) {
  const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
  const hoja = ss.getSheets()[0];
  hoja.appendRow([datos.oficina, datos.marca, datos.abril, datos.mayo]);
  return "✅ Registro guardado exitosamente";
}

function editarFila(indice, datos) {
  const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
  const hoja = ss.getSheets()[0];
  // indice + 2 para saltar encabezado y compensar base 0 de JS
  hoja.getRange(indice + 2, 1, 1, 4).setValues([[datos.oficina, datos.marca, datos.abril, datos.mayo]]);
  return "✅ Registro actualizado correctamente";
}

function eliminarFila(indice) {
  const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
  const hoja = ss.getSheets()[0];
  hoja.deleteRow(indice + 2);
  return "✅ Registro eliminado";
}

// ==========================================
// --- DIRECTORIO (Excel 2) ---
// ==========================================

function obtenerDirectorioUsuarios() {
  try {
    const ss = SpreadsheetApp.openById(ID_EXCEL_DIRECTORIO);
    const hoja = ss.getSheetByName("GRANJA_DE_USUARIOS_JULLY");
    const valores = hoja.getDataRange().getValues();
    // Filtramos para evitar filas vacías
    return valores.slice(1).filter(f => f[6] !== "" && f[6] !== undefined);
  } catch (e) { 
    return "Error al cargar directorio: " + e.toString(); 
  }
}

// --- FUNCIÓN DE PRUEBA PARA PERMISOS ---
function probarPermisos() {
  const respuesta = UrlFetchApp.fetch("https://www.google.com");
  Logger.log("Conexión exitosa: " + respuesta.getResponseCode());
}

// ==========================================
// --- MÓDULO NOVEDADES Y BACKUP ---
// ==========================================

// Retorna todos los cajeros del directorio para el selector del usuario
function obtenerListaCajeros() {
  try {
    const ss = SpreadsheetApp.openById(ID_EXCEL_DIRECTORIO);
    const hoja = ss.getSheetByName("GRANJA_DE_USUARIOS_JULLY");
    const valores = hoja.getDataRange().getValues();
    return valores.slice(1).filter(f => f[6] !== "" && f[6] !== undefined);
  } catch(e) {
    return [];
  }
}

function obtenerCajerosBackup() {
  try {
    const ss = SpreadsheetApp.openById(ID_EXCEL_DIRECTORIO);
    const hoja = ss.getSheetByName("GRANJA_DE_USUARIOS_JULLY");
    
    if (!hoja) {
      console.error("Error: No se encontró la pestaña 'Directorio de usuarios'");
      return [];
    }

    const valores = hoja.getDataRange().getValues();
    if (valores.length < 2) return []; 

    const cabecera = valores[0]; 
    
    // --- BUSCADOR AUTOMÁTICO DE ÍNDICES ---
    // Esto asegura que el código encuentre los datos sin importar si mueves las columnas
    const buscarIdx = (texto) => cabecera.findIndex(c => c.toString().toUpperCase().includes(texto.toUpperCase()));

    const idxNombre = buscarIdx("NOMBRE") !== -1 ? buscarIdx("NOMBRE") : 9; // Columna J
    const idxTel = buscarIdx("TEL") !== -1 ? buscarIdx("TEL") : 18;        // Columna T
    const idxCorreo = buscarIdx("CORREO") !== -1 ? buscarIdx("CORREO") : 18; // Columna S
    const idxBackup = buscarIdx("BACKUP");

    const datosSinTitulo = valores.slice(1);
    
    const todosLosDatos = datosSinTitulo.filter(f => {
    const tieneNombre = f[idxNombre] && f[idxNombre].toString().trim() !== "";
    const esBackup = idxBackup !== -1 &&
                      (f[idxBackup] || "").toString().trim().toUpperCase() === "SI";

    return tieneNombre && esBackup;
    });

    console.log("--- AUDITORÍA DE COLUMNAS DETECTADAS ---");
    console.log("Índice Nombre: " + idxNombre);
    console.log("Índice Teléfono: " + idxTel);
    console.log("Índice Correo: " + idxCorreo);
    console.log("Total registros válidos: " + todosLosDatos.length);
    
    return todosLosDatos;

  } catch(e) {
    console.error("Error en obtenerCajerosBackup: " + e.toString());
    return [];
  }
}

// Registra una nueva novedad en la hoja "Novedades" del Excel principal
function registrarNovedad(payload) {
  try {
    const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
    let hoja = ss.getSheetByName("Novedades");

    // Si no existe la hoja, la crea con encabezados expandidos
    if (!hoja) {
      hoja = ss.insertSheet("Novedades");
      hoja.appendRow([
        "ID", "FechaReporte", "CajeroNombre", "Oficina",
        "Descripcion", "ReportadoPor", "BackupAsignado",
        "FechaResolucion", "AdminNombre", "Estado", "FechaInicioAusencia", "DiasAusencia"
      ]);
      hoja.getRange(1, 1, 1, 12).setFontWeight("bold").setBackground("#002e5b").setFontColor("white");
    }

    const id = "NOV-" + new Date().getTime();
    const fechaReporte = new Date().toLocaleString("es-CO");

    hoja.appendRow([
      id,
      fechaReporte,
      payload.cajeroNombre,
      payload.oficina,
      payload.descripcion,
      payload.reportadoPor,
      "", // BackupAsignado
      "", // FechaResolucion
      "", // AdminNombre
      "PENDIENTE",
      payload.fechaInicio,  // Columna K (Índice 10)
      payload.diasAusencia   // Columna L (Índice 11)
    ]);

    return { success: true, msg: "✅ Novedad registrada con sus fechas correspondientes." };
  } catch(e) {
    return { success: false, msg: "❌ Error al registrar: " + e.message };
  }
}

// Retorna las novedades con estado PENDIENTE

// Cierra la novedad y registra el backup asignado
function procesarAsignacionBackup(payload) {
  try {
    const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
    const hoja = ss.getSheetByName("Novedades");
    if (!hoja) return { success: false, msg: "❌ Hoja Novedades no encontrada." };

    const datos = hoja.getDataRange().getValues();
    const fechaResolucion = new Date().toLocaleString("es-CO");

    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0] === payload.novedadId) {
        hoja.getRange(i + 1, 7).setValue(payload.backupNombre);    // BackupAsignado
        hoja.getRange(i + 1, 8).setValue(fechaResolucion);         // FechaResolucion
        hoja.getRange(i + 1, 9).setValue(payload.adminNombre);     // AdminNombre
        hoja.getRange(i + 1, 10).setValue("RESUELTA");             // Estado
        // Color verde para indicar resuelta
        hoja.getRange(i + 1, 1, 1, 10).setBackground("#e8f8f0");
        break;
      }
    }

    return {
      success: true,
msg: `✅ ¡Asignación exitosa! ${payload.backupNombre} cubrirá a ${payload.cajeroEnBaja} en ${payload.oficinaBaja}.`    };
  } catch(e) {
    return { success: false, msg: "❌ Error al asignar: " + e.message };
  }
}

function obtenerNovedadesPendientes(usuario, rol) {

  try {

    const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
    const hoja = ss.getSheetByName("Novedades");

    if (!hoja) return [];

    const datos = hoja.getDataRange().getValues();

    if (datos.length <= 1) return [];

    const usuarioActual = String(usuario || "")
      .trim()
      .toUpperCase();

    const rolActual = String(rol || "")
      .trim()
      .toUpperCase();

    const pendientes = datos.slice(1).filter(f => {

      const id = String(f[0] || "").trim();
      const estado = String(f[9] || "")
        .trim()
        .toUpperCase();

      const creador = String(f[5] || "")
        .trim()
        .toUpperCase();

      if (!id) return false;

      // Solo pendientes
      if (estado !== "PENDIENTE") return false;

      // ADMIN puede gestionar todas
      if (rolActual === "ADMIN") {
        return true;
      }

      // Los demás SOLO las que ellos registraron
      return creador === usuarioActual;

    });

    return pendientes.map(f => {

      return {
        id: f[0] ? f[0].toString() : "",
        fecha: f[1] ? f[1].toString() : "",
        cajero: f[2] ? f[2].toString() : "Sin Nombre",
        oficina: f[3] ? f[3].toString() : "Sin Oficina",
        descripcion: f[4] ? f[4].toString() : "No especificado",
        reportadoPor: f[5] ? f[5].toString() : "",
        estado: f[9] ? f[9].toString() : "PENDIENTE"
      };

    });

  } catch(e) {

    console.error(
      "Error en obtenerNovedadesPendientes: " + e.toString()
    );

    return [];
  }
}

// Función para obtener el historial (Verde)
function obtenerHistorialNovedades() {
  try {
    const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
    const hoja = ss.getSheetByName("Novedades");
    if (!hoja) return [];

    const datos = hoja.getDataRange().getValues();
    if (datos.length <= 1) return [];

return datos.slice(1).filter(f => {
      const estado = f[9] ? f[9].toString().toUpperCase().trim() : "";
      return estado === "RESUELTA";
    });
  } catch(e) {
    console.error("Error en obtenerHistorialNovedades: " + e.toString());
    return [];
  }
}   // ← ESTE } cierra obtenerHistorialNovedades

function obtenerHistorialCompletoBackend(usuario, rol) {
  try {
    const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
    const hoja = ss.getSheetByName("Novedades");

    if (!hoja) return [];

    const datos = hoja.getDataRange().getValues();

    if (datos.length <= 1) return [];

    const usuarioActual = String(usuario || "").trim().toUpperCase();
    const rolActual = String(rol || "").trim().toUpperCase();
    console.log("========== HISTORIAL ==========");
console.log("USUARIO RECIBIDO: [" + usuarioActual + "]");
console.log("ROL RECIBIDO: [" + rolActual + "]");

datos.slice(1).forEach(f => {
  console.log(
    "ID: [" + f[0] + "] | CREADOR F: [" + f[5] + "]"
  );
});

    const resultados = datos.slice(1).filter(f => {

      const id = String(f[0] || "").trim();
      const estado = String(f[9] || "").trim().toUpperCase();
      const creador = String(f[5] || "").trim().toUpperCase();

      if (!id) return false;

      // No mostrar pendientes
      if (estado === "PENDIENTE") return false;

      // ADMIN ve todo
      if (rolActual === "ADMIN") return true;

      // Usuario normal: SOLO sus propias novedades
      return creador === usuarioActual;

    });

    return resultados.map(f => ({
      id: String(f[0] || ""),
      fechaReporte: String(f[1] || ""),
      cajero: String(f[2] || "Sin Nombre"),
      oficina: String(f[3] || "Sin Oficina"),
      descripcion: String(f[4] || "Sin Especificar"),
      backup: String(f[6] || "No asignado"),
      estado: String(f[9] || "CUBIERTA").trim().toUpperCase(),

      fechaInicio: f[10]
        ? Utilities.formatDate(
            new Date(f[10]),
            Session.getScriptTimeZone(),
            "dd/MM/yyyy HH:mm"
          )
        : "",

      diasAusencia: String(f[11] || "0")
    })).reverse();

  } catch (e) {
    console.error("Error en obtenerHistorialCompletoBackend: " + e);
    return [];
  }
}

function asignarBackup(idNovedad, nombreBackup, adminNombre) {
  try {
    const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
    const hoja = ss.getSheetByName("Novedades");
    if (!hoja) return { success: false, msg: "No se encontró la hoja Novedades." };

    const datos = hoja.getDataRange().getValues();
    let filaEncontrada = -1;

    // Buscar la fila por ID (Columna A -> índice 0)
    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0].toString().trim() === idNovedad.toString().trim()) {
        filaEncontrada = i + 1; // +1 porque las filas en Sheets son base 1
        break;
      }
    }

    if (filaEncontrada === -1) {
      return { success: false, msg: "No se encontró la novedad con ID: " + idNovedad };
    }

    // Columna 9 (I) -> Nombre del Backup o sustituto
    hoja.getRange(filaEncontrada, 7).setValue(nombreBackup);
    // H = Fecha de asignación
// Cambiar BACKUP SI/NO a NO en el Directorio
const ssDir = SpreadsheetApp.openById(ID_EXCEL_DIRECTORIO);
const hojaDir = ssDir.getSheetByName("DATOS MANUALES");

const datosDir = hojaDir.getDataRange().getValues();
const encabezados = datosDir[0];

const idxNombre = encabezados.findIndex(c => c.toString().toUpperCase().includes("NOMBRE"));
const idxBackup = encabezados.findIndex(c => c.toString().toUpperCase().includes("BACKUP"));

for (let i = 1; i < datosDir.length; i++) {
  const nombre = (datosDir[i][idxNombre] || "").toString().trim().toUpperCase();

  if (nombre === nombreBackup.toString().trim().toUpperCase()) {
    hojaDir.getRange(i + 1, idxBackup + 1).setValue("NO");
    break;
  }
}
    // Columna 10 (J) -> CAMBIAR ESTADO A "CUBIERTA"
    hoja.getRange(filaEncontrada, 10).setValue("CUBIERTA");

    return { success: true, msg: "✅ Caso asignado exitosamente como CUBIERTA." };
  } catch (e) {
    return { success: false, msg: "Error en asignarBackup: " + e.message };
  }
}



function cambiarEstadoNovedad(idNovedad, nuevoEstado) {
  try {
    const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
    const hoja = ss.getSheetByName("Novedades");
    const datos = hoja.getDataRange().getValues();
    let filaEncontrada = -1;

    for (let i = 1; i < datos.length; i++) {
      if (datos[i][0].toString().trim() === idNovedad.toString().trim()) {
        filaEncontrada = i + 1;
        break;
      }
    }

    if (filaEncontrada !== -1) {
      // Modifica la columna 10 (J) con el nuevo estado (RESUELTA o EXTENDIDA)
      hoja.getRange(filaEncontrada, 10).setValue(nuevoEstado.toUpperCase().trim());
      return { success: true, msg: "Estado actualizado a " + nuevoEstado };
    }
    return { success: false, msg: "No se encontró el ID" };
  } catch(e) {
    return { success: false, msg: e.message };
  }
}

function procesarAccionNovedad(datos) {
  try {

    const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
    const hoja = ss.getSheetByName("Novedades");

    const valores = hoja.getDataRange().getValues();

    let fila = -1;

    for (let i = 1; i < valores.length; i++) {
      if (String(valores[i][0]).trim() === String(datos.id).trim()) {
        fila = i + 1;
        break;
      }
    }

    if (fila === -1) {
      return { success: false, msg: "No se encontró la novedad." };
    }

    if (datos.accion === "EXTENDER") {

      const diasActuales = Number(hoja.getRange(fila, 12).getValue()) || 0;

      hoja.getRange(fila, 12).setValue(diasActuales + Number(datos.dias));

      return {
        success: true,
        msg: "✅ La novedad fue extendida correctamente."
      };

    }

    if (datos.accion === "CERRAR") {

      const nombreBackup = hoja.getRange(fila, 7).getValue();

      liberarBackup(nombreBackup);

      hoja.getRange(fila, 10).setValue("RESUELTA");

      hoja.getRange(fila, 8).setValue(new Date());
      hoja.getRange(fila, 9).setValue(datos.adminNombre);
      return {
        success: true,
        msg: "✅ La novedad fue cerrada correctamente."
      };

    }

    return {
      success: false,
      msg: "Acción no válida."
    };

  } catch (e) {

    return {
      success: false,
      msg: e.toString()
    };

  }
}

function liberarBackup(nombreBackup) {

  const ssDir = SpreadsheetApp.openById(ID_EXCEL_DIRECTORIO);
  const hojaDir = ssDir.getSheetByName("DATOS MANUALES");

  const datosDir = hojaDir.getDataRange().getValues();
  const encabezados = datosDir[0];

  const idxNombre = encabezados.findIndex(c =>
    c.toString().toUpperCase().includes("NOMBRE")
  );

  const idxBackup = encabezados.findIndex(c =>
    c.toString().toUpperCase().includes("BACKUP")
  );

  for (let i = 1; i < datosDir.length; i++) {

    if (
      (datosDir[i][idxNombre] || "")
        .toString()
        .trim()
        .toUpperCase() ===
      nombreBackup.toString().trim().toUpperCase()
    ) {

      hojaDir.getRange(i + 1, idxBackup + 1).setValue("SI");
      return true;

    }

  }

  return false;
}

function cerrarNovedadesAutomaticamente() {

  const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
  const hoja = ss.getSheetByName("Novedades");

  const datos = hoja.getDataRange().getValues();

  let cerradas = 0;

  for (let i = 1; i < datos.length; i++) {

    const estado = (datos[i][9] || "").toString().trim().toUpperCase();

    if (estado !== "CUBIERTA") continue;

    Logger.log("Fila: " + (i + 1));
    Logger.log("Estado: " + estado);

    const fechaInicio = new Date(datos[i][10]);
    const dias = Number(datos[i][11]) || 0;

    Logger.log("Fecha Inicio: " + fechaInicio);
    Logger.log("Días: " + dias);

    const fechaFin = new Date(fechaInicio);
    fechaFin.setDate(fechaFin.getDate() + dias);

    Logger.log("Fecha Fin: " + fechaFin);
    Logger.log("Hoy: " + new Date());

    if (new Date() >= fechaFin) {

      Logger.log(">>> DEBERÍA CERRARSE <<<");

      const nombreBackup = datos[i][6];

      Logger.log("Backup: " + nombreBackup);

      liberarBackup(nombreBackup);

      hoja.getRange(i + 1, 10).setValue("RESUELTA");
      // Fecha de resolución
hoja.getRange(i + 1, 8).setValue(new Date());

// Quién cerró
hoja.getRange(i + 1, 9).setValue("SISTEMA AUTOMÁTICO");
      hoja.getRange(i + 1, 8).setValue(new Date());
      Logger.log("Estado cambiado a RESUELTA");

      cerradas++;
    }

  }

  return {
    success: true,
    msg: `${cerradas} novedades cerradas automáticamente.`
  };

}

// ============================================================
// ============================================================
// MÓDULO DE INTEGRACIÓN CON ARQUEOS (OTP)
// Añadido para acceso seguro al módulo de Arqueos embebido.
// ============================================================
// ============================================================

// Clave secreta compartida entre COI y Arqueos (debe ser IDÉNTICA en ambos proyectos).
const OTP_SECRET_COI = '<REDACTADO>';
const OTP_VIGENCIA_MIN = 5; // minutos de validez del código

/**
 * Busca el correo de un usuario en la hoja "Usuarios" del Excel principal de COI.
 * Estructura de la hoja: A=Usuario, B=Contraseña, C=Rol, D=Correo (nueva columna).
 */
function obtenerCorreoUsuario_(nombreUsuario) {
  const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
  const hoja = ss.getSheetByName('Usuarios');
  const vals = hoja.getDataRange().getValues();
  const objetivo = String(nombreUsuario).trim().toUpperCase();
  for (let i = 1; i < vals.length; i++) {
    if ((vals[i][0] || '').toString().trim().toUpperCase() === objetivo) {
      const correo = (vals[i][3] || '').toString().trim(); // Columna D
      return correo || null;
    }
  }
  return null;
}

/**
 * Genera un OTP de 6 dígitos, lo envía al correo del usuario y devuelve un token
 * firmado (sin exponer el código). El token viaja al iframe de Arqueos.
 * El OTP en claro NUNCA sale del servidor; se guarda hasheado en el token.
 */
function generarOTP_Arqueos(nombreUsuario, rol) {
  try {
    const correo = obtenerCorreoUsuario_(nombreUsuario);
    if (!correo) return { success: false, msg: 'No encontramos un correo registrado para tu usuario en la hoja Usuarios.' };

    const otp = ('' + Math.floor(100000 + Math.random() * 900000)); // 6 dígitos
    const expira = Date.now() + OTP_VIGENCIA_MIN * 60 * 1000;

    // hash del OTP (no guardamos el OTP en claro en el token)
    const otpHash = _hmac_(otp + '|' + nombreUsuario + '|' + expira, OTP_SECRET_COI);
    const cuerpoToken = Utilities.base64EncodeWebSafe(JSON.stringify({
      u: nombreUsuario, r: rol || '', c: correo, exp: expira, h: otpHash
    }));
    const firma = _hmac_(cuerpoToken, OTP_SECRET_COI);
    const token = cuerpoToken + '.' + firma;

    // Enviar correo
    const correoMask = _enmascararCorreo_(correo);
    MailApp.sendEmail({
      to: correo,
      subject: 'Código de acceso — Control de Arqueos Multival',
      htmlBody:
        '<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #eef2f7;border-radius:16px;overflow:hidden">' +
          '<div style="background:#25294F;padding:24px;text-align:center">' +
            '<span style="color:#F6CF46;font-size:22px;font-weight:800">Control de Arqueos</span>' +
          '</div>' +
          '<div style="padding:28px;color:#334155">' +
            '<p style="font-size:14px">Hola <b>' + nombreUsuario + '</b>,</p>' +
            '<p style="font-size:14px">Tu código de acceso de un solo uso para ingresar al módulo de Arqueos es:</p>' +
            '<div style="text-align:center;margin:24px 0">' +
              '<span style="display:inline-block;background:#f1f5f9;border:2px dashed #3D8A44;border-radius:12px;padding:16px 28px;font-size:34px;font-weight:800;letter-spacing:8px;color:#25294F">' + otp + '</span>' +
            '</div>' +
            '<p style="font-size:13px;color:#64748b">Este código vence en ' + OTP_VIGENCIA_MIN + ' minutos. Si no intentaste ingresar, ignora este correo.</p>' +
          '</div>' +
        '</div>'
    });

    return { success: true, token: token, correoMask: correoMask, vigencia: OTP_VIGENCIA_MIN };
  } catch (e) {
    return { success: false, msg: 'Error generando el código: ' + e.toString() };
  }
}

// HMAC-SHA256 en hex
function _hmac_(mensaje, clave) {
  const raw = Utilities.computeHmacSha256Signature(mensaje, clave);
  return raw.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function _enmascararCorreo_(correo) {
  const partes = correo.split('@');
  const u = partes[0], d = partes[1];
  if (!d) return correo;
  const visible = u.slice(0, 2);
  return visible + '***@' + d;
}

// ============================================================
// FUNCIÓN PARA AUTORIZAR EL PERMISO DE CORREO (ejecutar 1 vez)
// Ejecútala manualmente desde el editor de Apps Script:
//   1. Selecciona 'autorizarPermisoCorreo' en el menú de funciones.
//   2. Clic en Ejecutar (▶).
//   3. Google mostrará la pantalla de permisos: acéptala.
//   4. Listo, ya podrás enviar los OTP.
// ============================================================
function autorizarPermisoCorreo() {
  // Envío de prueba a ti mismo (el dueño del script) para gatillar la autorización.
  const miCorreo = Session.getActiveUser().getEmail();
  MailApp.sendEmail({
    to: miCorreo,
    subject: 'Prueba de permiso — Control de Arqueos',
    body: 'Si recibes este correo, el permiso de envío quedó autorizado correctamente. Ya puedes usar el OTP de Arqueos.'
  });
  Logger.log('Correo de prueba enviado a: ' + miCorreo);
  return 'Permiso autorizado. Se envió un correo de prueba a ' + miCorreo;
}


// ============================================================
// VALIDACIÓN DE OTP EN COI (no depende del iframe)
// COI valida el token+OTP que él mismo generó y devuelve un
// "ticket" de acceso firmado que se pasa al iframe por URL.
// ============================================================
function validarOTP_EnCOI(token, otp) {
  try {
    if (!token || !otp) return { success: false, msg: 'Faltan datos de verificación.' };
    const partes = token.split('.');
    if (partes.length !== 2) return { success: false, msg: 'Token inválido.' };
    const cuerpo = partes[0], firma = partes[1];

    if (_hmac_(cuerpo, OTP_SECRET_COI) !== firma) return { success: false, msg: 'Token adulterado.' };
    const datos = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(cuerpo)).getDataAsString());
    if (Date.now() > datos.exp) return { success: false, msg: 'El código venció. Solicita uno nuevo.' };

    const hashEsperado = _hmac_(otp + '|' + datos.u + '|' + datos.exp, OTP_SECRET_COI);
    if (hashEsperado !== datos.h) return { success: false, msg: 'Código incorrecto.' };

    // OTP correcto: generamos un TICKET de acceso de corta duración para Arqueos.
    // El ticket lleva el correo (para que Arqueos resuelva el rol) y vence en 2 minutos.
    const exp = Date.now() + 2 * 60 * 1000;
    const cuerpoTicket = Utilities.base64EncodeWebSafe(JSON.stringify({
      u: datos.u, r: datos.r || '', c: datos.c || '', exp: exp
    }));
    const firmaTicket = _hmac_(cuerpoTicket, OTP_SECRET_COI);
    const ticket = cuerpoTicket + '.' + firmaTicket;

    return { success: true, ticket: ticket };
  } catch (e) {
    return { success: false, msg: 'Error validando OTP: ' + e.toString() };
  }
}

// ============================================================
// DIAGNÓSTICO END-TO-END (ejecutar en COI)
// Imprime la huella de la clave y un ticket de prueba.
// COPIA el ticket que imprime y pégalo en probarTicketDesdeCOI() de Arqueos.
// ============================================================
function diagnosticarCOI() {
  const L = [];
  L.push('===== DIAGNÓSTICO COI =====');
  L.push('OTP_SECRET_COI longitud: ' + (OTP_SECRET_COI || '').length + ' caracteres');
  L.push('Primeros 8 chars: ' + String(OTP_SECRET_COI).slice(0, 8) + '...');
  // huella de la clave (hash) para comparar sin exponerla
  const huella = _hmac_('HUELLA_FIJA', OTP_SECRET_COI);
  L.push('HUELLA de la clave COI: ' + huella);
  L.push('  >>> Esta huella DEBE ser idéntica a la que imprima Arqueos.');

  // Generar un ticket de prueba igual que en validarOTP_EnCOI
  const exp = Date.now() + 30 * 60 * 1000; // 30 min para dar margen a la prueba
  const cuerpo = Utilities.base64EncodeWebSafe(JSON.stringify({
    u: 'lider1', r: 'Lider', c: 'brian.tautiva@reval.com.co', exp: exp
  }));
  const firma = _hmac_(cuerpo, OTP_SECRET_COI);
  const ticket = cuerpo + '.' + firma;
  L.push('');
  L.push('TICKET DE PRUEBA (cópialo completo):');
  L.push(ticket);

  const salida = L.join('\n');
  Logger.log(salida);
  return salida;
}

function obtenerPermisos(usuario) {

  const hoja = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName("PERMISOS");

  const datos = hoja.getDataRange().getValues();

  const encabezados = datos[0];

  for (let i = 1; i < datos.length; i++) {

    if (datos[i][0] == usuario) {

      let permisos = {};

      for (let j = 1; j < encabezados.length; j++) {

        permisos[encabezados[j].toLowerCase()] =
          datos[i][j] == "SI";

      }

      return permisos;

    }

  }

  return null;

}

function obtenerTablaPermisos() {

  const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
  const hoja = ss.getSheetByName("PERMISOS");

  return hoja.getDataRange().getValues();

}

function obtenerUsuarios(){
  const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
  const hoja = ss.getSheetByName("Usuarios");
  const datos = hoja.getDataRange().getValues();
  datos.shift();
  return datos;
}

function cargarUsuarios(){

    google.script.run
        .withSuccessHandler(renderizarTablaUsuarios)
        .obtenerUsuarios();

}


function guardarPermisos(permisos) {

  const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
  const hoja = ss.getSheetByName("Permisos");

  const datos = hoja.getDataRange().getValues();

  const encabezados = datos[0];

  for (let i = 1; i < datos.length; i++) {

    const usuario = datos[i][0];

    if (!permisos[usuario]) continue;

    for (let j = 1; j < encabezados.length; j++) {

      const modulo = encabezados[j];

      datos[i][j] =
        permisos[usuario][modulo] ? "SI" : "NO";

    }

  }

  hoja.getRange(
    1,
    1,
    datos.length,
    datos[0].length
  ).setValues(datos);

  return true;

}

function crearUsuario(datos) {

  try {

    const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);

    const hojaUsuarios = ss.getSheetByName("Usuarios");
    const hojaPermisos = ss.getSheetByName("Permisos");

    const usuarios = hojaUsuarios.getDataRange().getValues();

    // Validar que no exista el usuario
    for (let i = 1; i < usuarios.length; i++) {

      if (
        usuarios[i][0].toString().trim().toUpperCase() ==
        datos.usuario.trim().toUpperCase()
      ) {

        return {
          success: false,
          msg: "El usuario ya existe."
        };

      }

    }

    // Crear usuario
    hojaUsuarios.appendRow([
      datos.usuario,
      datos.password,
      datos.rol,
      datos.correo,
      datos.estado
    ]);

    // Crear registro de permisos

const encabezados = hojaPermisos
    .getRange(1,1,1,hojaPermisos.getLastColumn())
    .getValues()[0];

let nuevaFila = [];

encabezados.forEach((columna, index)=>{

    if(index==0){

        nuevaFila.push(datos.usuario);

    }else{

        nuevaFila.push("NO");

    }

});

hojaPermisos.appendRow(nuevaFila);

    return {
      success: true
    };

  } catch (e) {

    return {
      success: false,
      msg: e.toString()
    };

  }

}

function obtenerUsuario(usuario){

  const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);
  const hoja = ss.getSheetByName("Usuarios");

  const datos = hoja.getDataRange().getValues();

  for(let i=1;i<datos.length;i++){

    if(datos[i][0] == usuario){

      return{
        success:true,
        usuario:datos[i][0],
        password:datos[i][1],
        rol:datos[i][2],
        correo:datos[i][3],
        estado:datos[i][4]
      };

    }

  }

  return{
    success:false,
    msg:"Usuario no encontrado."
  };

}

function actualizarUsuario(datos){

  try{

    const ss = SpreadsheetApp.openById(ID_EXCEL_PRINCIPAL);

    const hoja = ss.getSheetByName("Usuarios");

    const usuarios = hoja.getDataRange().getValues();

    for(let i=1;i<usuarios.length;i++){

      if(
        usuarios[i][0].toString().trim().toUpperCase() ==
        datos.usuario.trim().toUpperCase()
      ){

        hoja.getRange(i+1,2).setValue(datos.password); // Contraseña
        hoja.getRange(i+1,3).setValue(datos.rol);      // Rol
        hoja.getRange(i+1,4).setValue(datos.correo);   // Correo
        hoja.getRange(i+1,5).setValue(datos.estado);   // Estado

        return{
          success:true
        };

      }

    }

    return{
      success:false,
      msg:"No se encontró el usuario."
    };

  }catch(e){

    return{
      success:false,
      msg:e.toString()
    };

  }

}