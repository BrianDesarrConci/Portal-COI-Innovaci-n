// Lógica de cliente de la Granja de Usuarios, portada de js.html (COI V1).

/** Columnas de GRANJA_DE_USUARIOS_JULLY (filas que devuelven obtenerListaCajeros / obtenerCajerosBackup). */
export const COL = { PTR: 0, OFICINA: 1, REGIONAL: 2, ZONA: 3, MUNICIPIO: 4, LON: 5, LAT: 6, CLIENTE: 7, CEDULA: 8, NOMBRE: 9, CORREO: 32, CONTACTO: 33, BACKUP: 34, NEG1: 35, NEG2: 37 };

/** Motivos de la ausencia (granja.html). "OTRO" habilita el texto libre. */
export const MOTIVOS = [
  'Motivos de salud', 'Motivos familiares o personales', 'Motivos académicos o de capacitación', 'Motivos administrativos o empresariales',
  'Motivos disciplinarios o injustificados', 'Fuerza mayor o situaciones extraordinarias', 'Licencias legales y derechos laborales'
];

/** calcularDistanciaKM de js.html (haversine). */
export function calcularDistanciaKM(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Coordenada en grados. La hoja guarda enteros con 7 decimales implícitos (-741150548 = -74.1150548;
 * 45105941 = 4.5105941). V1 (formatearCoordenada) ponía el punto después de 2 dígitos también en la
 * latitud, lo que convertía 4,51° en 45,1° y deformaba las distancias; aquí se usa la escala real.
 */
export function coord(v) {
  if (v === '' || v === null || v === undefined) return null;
  let n = parseFloat(String(v).replace(',', '.'));
  if (isNaN(n)) return null;
  if (Math.abs(n) > 180) n = n / 1e7;
  return n;
}

const up = (v) => String(v ?? '').trim().toUpperCase();

/** Datos de la oficina afectada (prepararAsignacion: primera fila del directorio con esa oficina). */
export function origenDe(lista, oficina) {
  const f = lista.find((r) => r[COL.OFICINA] === oficina);
  if (!f) return null;
  return { ciudad: f[COL.MUNICIPIO], lon: f[COL.LON], lat: f[COL.LAT], negocio: f[COL.CLIENTE], zona: f[COL.ZONA], regional: f[COL.REGIONAL], ptr: f[COL.PTR] };
}

/** Teléfono utilizable: V1 leía la columna 21 (SNR); el contacto real está en CONTACTO. */
export function telefonoDe(row) {
  const t = String(row[COL.CONTACTO] ?? '').replace(/\D/g, '');
  return t.length >= 7 ? t : '';
}

/**
 * aplicarFiltroInteligente de js.html: +100 si el municipio coincide, +50 si el cliente (negocio)
 * coincide, menos la distancia en km. Excluye a la persona en baja. Orden descendente por puntaje.
 */
export function rankBackups(origen, backups, nombrePersonaDeBaja) {
  const latO = coord(origen.lat), lonO = coord(origen.lon);
  const personaABorrar = up(nombrePersonaDeBaja);
  const ciudadOficina = up(origen.ciudad), negocioOficina = up(origen.negocio);
  return backups.map((b) => {
    const nombreCandidato = up(b[COL.NOMBRE]);
    if (nombreCandidato === personaABorrar || nombreCandidato === '') return null;
    let pts = 0;
    const latB = coord(b[COL.LAT]), lonB = coord(b[COL.LON]);
    const dist = calcularDistanciaKM(latO || 0, lonO || 0, latB || 0, lonB || 0);
    const mismaCiudad = up(b[COL.MUNICIPIO]) === ciudadOficina && ciudadOficina !== '';
    const mismoNegocio = up(b[COL.CLIENTE]) === negocioOficina && negocioOficina !== '';
    if (mismaCiudad) pts += 100;
    if (mismoNegocio) pts += 50;
    pts -= dist;
    return {
      nombre: b[COL.NOMBRE], oficina: b[COL.OFICINA], ciudad: b[COL.MUNICIPIO], negocio: b[COL.CLIENTE], zona: b[COL.ZONA], regional: b[COL.REGIONAL],
      telefono: telefonoDe(b), distancia: dist.toFixed(1), dist, puntos: Math.round(pts), mismaCiudad, mismoNegocio, lat: latB, lon: lonB,
      neg1: b[COL.NEG1], neg2: b[COL.NEG2]
    };
  }).filter((c) => c !== null).sort((a, b) => b.puntos - a.puntos);
}

/** Color del puntaje, como construirFilasBackups (> 100 verde, > 50 dorado, resto gris). */
export const scoreTone = (p) => (p > 100 ? 'hi' : p > 50 ? 'mid' : 'lo');

/** Mensaje de WhatsApp de enviarWhatsApp (js.html). */
export function whatsappUrl(nombre, telefono, oficina, negocio) {
  let num = String(telefono || '').replace(/\D/g, '');
  if (!num) return '';
  if (!num.startsWith('57')) num = '57' + num;
  const msg = 'Hola *' + nombre + '*, se requiere tu apoyo en la oficina *' + oficina + '* para el negocio *' + (negocio || 'sin negocio') + '*. Me comunicaré contigo en unos minutos para ampliar la informacion.';
  return 'https://wa.me/' + num + '?text=' + encodeURIComponent(msg);
}

/** Fecha "dd/MM/yyyy HH:mm" o ISO → Date. */
export function parseFecha(s) {
  if (!s) return null;
  if (s instanceof Date) return s;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?)?/i.exec(String(s));
  if (m) {
    let h = +(m[4] || 0);
    const pm = m[7] && /p/i.test(m[7]);
    if (m[7]) { if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
    return new Date(+m[3], +m[2] - 1, +m[1], h, +(m[5] || 0), +(m[6] || 0));
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const fechaCorta = (d) => (d ? d.getDate() + ' ' + MES[d.getMonth()] + ' ' + d.getFullYear() : '');
export const fechaHora = (d) => (d ? fechaCorta(d) + ', ' + ((d.getHours() % 12) || 12) + ':' + String(d.getMinutes()).padStart(2, '0') + (d.getHours() < 12 ? ' a. m.' : ' p. m.') : '');
export const hoyISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
