// Modelo y constantes de TRAZA (gestión de solicitudes de los aplicativos del área).
//
// Modelo alineado con la hoja real del equipo (BD_TRAZA_Solicitudes). Los nombres
// cortos son los que usa la interfaz del demo; entre paréntesis, la columna de la hoja:
//
//   Solicitudes                                   Bitácora (camelCase de la hoja)
//   id        (ID)                                idEntrada   (IDEntrada)  BIT-00001…
//   created   (FechaRecepcion, ISO)               idSolicitud (IDSolicitud)
//   req       (Solicitante)                       fecha       (Fecha, ISO)
//   area      (AreaSolicitante)                   tipoEntrada (TipoEntrada: ESTADO | HORAS | CIERRE | NOTA)
//   app       (Aplicativo)                        detalle     (Detalle)
//   type      (Tipo: Mejora, Reajuste, Cambio,    horas       (Horas, solo en HORAS)
//              Corrección de falla = "Corrección  autor       (Autor)
//              de Fallos", Nuevo desarrollo)
//   prio      (Prioridad: Crítica, Alta, Media, Baja)
//   title     (Titulo)          desc     (Descripcion)
//   state     (Estado)          stateAt  (FechaUltimoEstado, ISO)
//   inv       (HorasInvertidas) est      (HorasEstimadas)
//   closedAt  (FechaCierre)     resolution (Resolucion)   totalHrs (TiempoTotalHrs)
//   email     (CorreoSolicitante)         target (FechaObjetivo, ISO)
//   owner     (responsable: brian | hernan; no está en la hoja)
//   score     (puntaje de criticidad 0–100; no está en la hoja)
//
// Las fechas del demo eran relativas a "hoy" (días desde radicación y días a la
// fecha objetivo); aquí se convierten en fechas ISO concretas relativas al momento
// en que se crea la semilla, de modo que la primera vez se ven igual que en el demo.

export const STATES = ['Recibida', 'En análisis', 'En desarrollo', 'En pruebas', 'En espera', 'Cerrada', 'Rechazada'];
export const FLOW = ['Recibida', 'En análisis', 'En desarrollo', 'En pruebas', 'Cerrada'];
export const PRIOS = ['Crítica', 'Alta', 'Media', 'Baja'];
export const TYPES = ['Mejora', 'Cambio', 'Reajuste', 'Corrección de falla', 'Nuevo desarrollo'];
export const OWNERS = { brian: 'Brian Tautiva', hernan: 'Hernán Dimate' };
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
/** Correo del solicitante como lo genera el demo: primer nombre sin tildes + dominio. */
export const emailFor = (name) => name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '') + '@reval.com.co';
/** Horas transcurridas entre dos fechas ISO (TiempoTotalHrs). */
export const elapsedHrs = (from, to) => round((new Date(to) - new Date(from)) / 36e5, 1);

/** Base inicial de TRAZA: vacía. Las solicitudes se radican desde el portal. */
export const emptyDb = () => ({ solicitudes: [], bitacora: [], seqBitacora: 0 });
