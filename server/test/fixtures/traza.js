// Solicitudes de prueba para server/test/traza.test.js (no se cargan en el portal).
import { FLOW, OWNERS, emailFor, elapsedHrs } from '../../src/data/traza-seed.js';

const WORK_STATES = ['En análisis', 'En desarrollo', 'En pruebas'];
const DAY = 864e5;
const addDays = (d, n) => new Date(d.getTime() + n * DAY);
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/* [id, título, aplicativo, tipo, prioridad, score, estado, solicitante, área, responsable, días desde radicación, días a fecha objetivo, horas estimadas, horas invertidas, descripción] */
const RAW = [
  ['TRZ-0413', 'Tablero de transacciones por regional con meta diaria', 'Analítica transaccional', 'Nuevo desarrollo', 'Alta', 78, 'Recibida', 'Nubia Parrado', 'Gestión del Negocio', 'hernan', 0, 12, 10, 0, 'Vista por regional con la meta diaria definida por la Dirección Comercial y alerta cuando el día cierre por debajo.'],
  ['TRZ-0412', 'Informe de vivienda robustos', 'Analítica transaccional', 'Nuevo desarrollo', 'Media', 54, 'Recibida', 'Dirección Comercial', 'Comercial', 'hernan', 1, 9, 6, 0, 'Informe mensual de transacciones de vivienda de los clientes robustos, antes enviado por correo.'],
  ['TRZ-0411', 'Campana de notificaciones por rol en COI', 'COI', 'Mejora', 'Media', 61, 'En análisis', 'Gustavo Rojas', 'Formación y Desarrollo', 'brian', 2, 8, 8, 1.5, 'Mensaje emergente al iniciar sesión según el rol con información operativa y estratégica.'],
  ['TRZ-0409', 'Insumo de oficinas SNR y ORIP', 'Analítica transaccional', 'Nuevo desarrollo', 'Alta', 72, 'En análisis', 'Yesica Valencia', 'Apoyo al Negocio', 'hernan', 3, 5, 8, 2, 'Insumo mensual de Bancolombia para las oficinas de SNR y ORIP a partir de este mes.'],
  ['TRZ-0408', 'Migración de Multival Te Escucha a producción de SMART30', 'SMART30', 'Cambio', 'Media', 58, 'En pruebas', 'Mafe Ortiz', 'Formación y Desarrollo', 'brian', 6, 4, 10, 6.5, 'Trasladar el módulo Multival Te Escucha al ambiente de producción de SMART30, proyecto de innovación 2026.'],
  ['TRZ-0406', 'Tablero transaccional de Gina', 'Analítica transaccional', 'Nuevo desarrollo', 'Media', 49, 'En análisis', 'Gina Pardo', 'Banco Agrario', 'hernan', 5, 10, 12, 1, 'Réplica del tablero transaccional con filtros propios para el seguimiento del Banco Agrario.'],
  ['TRZ-0405', 'Error al guardar evaluación de colaborador con multimedia', 'CreSER', 'Corrección de falla', 'Crítica', 92, 'En desarrollo', 'Gustavo Rojas', 'Formación y Desarrollo', 'brian', 4, 1, 4, 3, 'La evaluación con archivos multimedia no se guarda cuando el archivo supera el tamaño permitido.'],
  ['TRZ-0401', 'Metas diarias en tablero Bancolombia', 'Analítica transaccional', 'Mejora', 'Alta', 81, 'En desarrollo', 'Sebastián Arismendy', 'Dirección Comercial', 'hernan', 8, 3, 14, 9, 'Aplicar la meta diaria variable definida para octubre, noviembre y diciembre y reflejarla por oficina.'],
  ['TRZ-0400', 'Descarga del consolidado de arqueos desde COI', 'COI', 'Mejora', 'Alta', 76, 'En desarrollo', 'Jully Ríos', 'Apoyo al Negocio', 'brian', 7, 6, 12, 5, 'Reemplazar el Excel con macros del consolidado de arqueos de BBVA, Fincomercio e Itaú por una descarga directa.'],
  ['TRZ-0398', 'Justificación de aperturas en COI', 'COI', 'Mejora', 'Alta', 74, 'En espera', 'William Castro', 'Operaciones', 'hernan', 12, 7, 18, 16, 'Formulario integrado para que los líderes registren la justificación de aperturas tarde. Pendiente de aprobación de la Gerencia.'],
  ['TRZ-0396', 'Ajuste de directorio de oficinas en granja de usuarios', 'COI', 'Reajuste', 'Media', 52, 'En pruebas', 'Jully Ríos', 'Apoyo al Negocio', 'brian', 9, 2, 3, 2.5, 'Las novedades de granja deben tomar las oficinas del Directorio Nacional actualizado.'],
  ['TRZ-0394', 'Filtro por regional en Gestión de la Demanda', 'Gestión de la Demanda', 'Mejora', 'Baja', 33, 'Recibida', 'Nubia Parrado', 'Gestión del Negocio', 'brian', 10, 15, 4, 0, 'Agregar filtro por regional y por área en el tablero de demanda.'],
  ['TRZ-0392', 'Reporte de cumplimiento de políticas de datos', 'Gobierno de Datos', 'Nuevo desarrollo', 'Media', 47, 'En espera', 'Comité de Datos', 'Gobierno de Datos', 'brian', 14, 11, 8, 2, 'Reporte mensual de cumplimiento por área. En espera de la matriz de políticas aprobada.'],
  ['TRZ-0390', 'Actualización de metas Mi ATM', 'Analítica transaccional', 'Reajuste', 'Media', 45, 'Cerrada', 'John y Tatiana', 'Cajeros automáticos', 'hernan', 15, -10, 3, 3, 'Carga de las metas del mes según el comportamiento transaccional.'],
  ['TRZ-0389', 'Corrección de radicados de control de cambios', 'COI', 'Corrección de falla', 'Alta', 70, 'Cerrada', 'Jully Ríos', 'Apoyo al Negocio', 'brian', 16, -9, 6, 5.5, 'Incidencias reportadas en la granja de usuarios y novedades de arqueos.'],
  ['TRZ-0387', 'Reporte de facturación PTR', 'Analítica transaccional', 'Mejora', 'Baja', 30, 'Cerrada', 'Natalia y Vanessa', 'Facturación', 'hernan', 20, -12, 4, 4, 'Compensaciones, transacciones no monetarias, vivienda, cash in y cash out en el tablero de facturación.'],
  ['TRZ-0385', 'Ajuste de tarifas en contrato tipo', 'LexCore', 'Reajuste', 'Media', 41, 'Cerrada', 'Jurídica', 'Jurídica', 'brian', 22, -14, 3, 2, 'Actualizar las variables de tarifa del contrato tipo de corresponsalía.'],
  ['TRZ-0383', 'Exportación de evaluaciones a Excel', 'CreSER', 'Mejora', 'Media', 44, 'Cerrada', 'Gustavo Rojas', 'Formación y Desarrollo', 'brian', 24, -16, 2, 2, 'Descarga de las evaluaciones con filtros por gerencia.'],
  ['TRZ-0381', 'Pantalla de campañas en MultiLAB', 'MultiLAB', 'Nuevo desarrollo', 'Media', 50, 'Cerrada', 'Mercadeo', 'Mercadeo', 'brian', 27, -18, 10, 11, 'Registro y seguimiento de campañas de contenido con los líderes de zona.'],
  ['TRZ-0379', 'Acceso a módulo de cartera para nuevo usuario', 'Gestión CORE', 'Cambio', 'Baja', 22, 'Rechazada', 'Usuario externo', 'Cartera', 'brian', 25, -20, 0, 0.5, 'Solicitud fuera del alcance del aplicativo; se remite a Tecnología para gestión de accesos corporativos.'],
  ['TRZ-0377', 'Leer equipos de cómputo de toda la organización', 'COI', 'Nuevo desarrollo', 'Baja', 15, 'Rechazada', 'Usuario interno', 'Administrativa', 'brian', 29, -22, 0, 0.5, 'Fuera del alcance de los aplicativos del área.']
];

/**
 * Construye la semilla { solicitudes, bitacora, seqBitacora }. La bitácora se
 * reconstruye con la misma lógica que tzLog del demo: radicación, cambios de
 * estado, horas repartidas entre las etapas de trabajo y la nota de espera.
 */
export function buildSeed(now = new Date()) {
  const solicitudes = [];
  const bitacora = [];
  let seq = 0;
  const log = (idSolicitud, fecha, tipoEntrada, detalle, horas, autor) => {
    bitacora.push({ idEntrada: 'BIT-' + String(++seq).padStart(5, '0'), idSolicitud, fecha: fecha.toISOString(), tipoEntrada, detalle, horas, autor });
  };

  for (const r of RAW) {
    const [id, title, app, type, prio, score, state, req, area, owner, dAgo, dTarget, est, inv, desc] = r;
    const created = addDays(now, -dAgo);
    const author = OWNERS[owner];
    const t = {
      id, title, app, type, prio, score, state, req, area, owner,
      email: emailFor(req), desc, est, inv,
      created: created.toISOString(), target: addDays(now, dTarget).toISOString(),
      stateAt: created.toISOString(), closedAt: null, resolution: '', totalHrs: null
    };
    log(id, created, 'ESTADO', 'Solicitud radicada por ' + req, null, req);

    const steps = state === 'Rechazada' ? ['Rechazada'] : state === 'En espera' ? ['En análisis', 'En desarrollo', 'En espera'] : FLOW.slice(1, FLOW.indexOf(state) + 1);
    const work = steps.filter((s) => WORK_STATES.includes(s));
    const days = Math.max(1, Math.floor((now - created) / DAY));
    let prev = 'Recibida', left = inv;
    steps.forEach((s, i) => {
      const d = addDays(created, Math.min(i + 1, days));
      const closing = s === 'Cerrada' || s === 'Rechazada';
      log(id, d, closing ? 'CIERRE' : 'ESTADO', 'Cambio de estado: ' + prev + ' → ' + s, null, author);
      t.stateAt = d.toISOString();
      if (WORK_STATES.includes(s) && inv) {
        const last = s === work[work.length - 1];
        const h = last ? round(left, 2) : round(inv / work.length, 2);
        left -= h;
        log(id, d, 'HORAS', 'Ejecución de la etapa ' + s.toLowerCase(), h, author);
      }
      if (closing) {
        t.closedAt = d.toISOString();
        t.totalHrs = elapsedHrs(t.created, t.closedAt);
        t.resolution = s === 'Cerrada' ? 'Entregada en producción y aprobada por el solicitante.' : desc;
      }
      prev = s;
    });
    if (state === 'Rechazada' && inv) log(id, created, 'HORAS', 'Análisis de la solicitud', inv, author);
    if (state === 'En espera') log(id, now, 'NOTA', desc.split('. ').slice(-1)[0], null, author);
    solicitudes.push(t);
  }
  return { solicitudes, bitacora, seqBitacora: seq };
}
