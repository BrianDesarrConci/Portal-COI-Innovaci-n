/**
 * COI, Gestión y Monitoreo de Apoyo al Negocio. Versión de demostración.
 * Reval S.A.S. · Multipagas S.A.S. — Gerencia de Gestión del Negocio.
 *
 * Despliegue: Implementar > Nueva implementación > Aplicación web.
 *   Ejecutar como: yo. Acceso: cualquier usuario del dominio.
 *
 * Logos oficiales: cargue los archivos autorizados del manual de marca en Drive
 * (PNG o SVG, versión para fondo oscuro) y pegue sus ID en CONFIG.
 * Si los ID quedan vacíos, COI muestra los nombres de marca en tipografía Ubuntu.
 */
const CONFIG = {
  LOGO_REVAL_ID: '',       // ID del archivo en Drive del logo Reval (versión negativa)
  LOGO_MULTIPAGAS_ID: '',  // ID del archivo en Drive del logo Multipagas (versión negativa)
  TITULO: 'COI · Gestión y Monitoreo de Apoyo al Negocio'
};

function doGet() {
  const t = HtmlService.createTemplateFromFile('Index');
  t.brandJson = JSON.stringify({
    reval: logoDataUri_(CONFIG.LOGO_REVAL_ID),
    multipagas: logoDataUri_(CONFIG.LOGO_MULTIPAGAS_ID)
  });
  return t.evaluate()
    .setTitle(CONFIG.TITULO)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Inserta el contenido de otro archivo HTML del proyecto. */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/** Devuelve el logo como data URI para que funcione dentro del iframe de Apps Script. */
function logoDataUri_(fileId) {
  if (!fileId) return null;
  try {
    const cache = CacheService.getScriptCache();
    const key = 'logo_' + fileId;
    const hit = cache.get(key);
    if (hit) return hit;
    const blob = DriveApp.getFileById(fileId).getBlob();
    const uri = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
    if (uri.length < 95000) cache.put(key, uri, 21600);
    return uri;
  } catch (e) {
    console.warn('No se pudo cargar el logo ' + fileId + ': ' + e.message);
    return null;
  }
}