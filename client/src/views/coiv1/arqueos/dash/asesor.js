// Asesor COI: mismas reglas y textos de consejosLider / consejosGlobal de V1.
import { cop } from './lib.js';

const fmt = (n) => cop(n).replace('$ ', '$');
/** Decimal con coma (es-CO): 1.3 → 1,3. */
const dc = (v) => String(v).replace('.', ',');

export function consejosLider(L, d) {
  const cs = [], rest = d.habiles.restantes, trans = d.habiles.transcurridos;
  const ritmoActual = trans > 0 ? +(L.validos / trans).toFixed(1) : 0;

  if (L.validos >= d.meta) {
    cs.push({ sev: 'verde', ic: 'star', titulo: '¡Meta cumplida con ' + L.validos + ' arqueos válidos!',
      texto: 'Superaste la meta de ' + d.meta + '. Mantén la disciplina de reporte oportuno: cada arqueo a tiempo protege tu indicador del próximo mes.' });
  } else if (rest === 0 && trans > 0) {
    cs.push({ sev: 'rojo', ic: 'flag', titulo: 'Mes cerrado en ' + L.pctReal + '%',
      texto: 'Cerraste con ' + L.validos + ' de ' + d.meta + '. Si tienes ' + L.extemporaneos + ' extemporáneo(s) con causa justificada, solicita su normalización para recuperar indicador.' });
  } else if (L.semaforo === 'verde') {
    cs.push({ sev: 'verde', ic: 'chart', titulo: 'Vas en ruta: proyectas ' + L.proyeccion + ' arqueos',
      texto: 'Tu ritmo actual es ' + dc(ritmoActual) + '/día hábil. Sostén ' + (L.requeridoPorDia >= 999 ? 'el ritmo' : dc(L.requeridoPorDia) + '/día') + ' durante los ' + rest + ' días restantes y cierras en meta.' });
  } else if (L.semaforo === 'amarillo') {
    cs.push({ sev: 'amarillo', ic: 'alert', titulo: 'Riesgo: proyectas ' + L.proyeccion + ' de ' + d.meta,
      texto: 'Llevas ritmo de ' + dc(ritmoActual) + '/día y necesitas ' + dc(L.requeridoPorDia) + '/día hábil. Te faltan ' + L.faltanParaMeta + ' válidos en ' + rest + ' días: prioriza las oficinas con menos arqueos.' });
  } else {
    cs.push({ sev: 'rojo', ic: 'alert', titulo: 'Crítico: al ritmo actual no llegas',
      texto: 'Proyección de ' + L.proyeccion + ' vs meta de ' + d.meta + '. Requieres ' + (L.requeridoPorDia >= 999 ? 'más días hábiles' : dc(L.requeridoPorDia) + ' arqueos/día hábil') + '. Agenda bloques diarios de arqueo y reporta el mismo día.' });
  }

  if (L.extemporaneos > 0) {
    const potencial = L.validos + L.extemporaneos;
    cs.push({ sev: 'amarillo', ic: 'clock', titulo: L.extemporaneos + ' extemporáneo(s) no están sumando',
      texto: 'Si tienen causa justificada (sin señal, contingencia), solicita normalización en "Mis Arqueos": pasarías de ' + L.validos + ' a hasta ' + potencial + ' válidos.' });
  } else if (trans > 0 && L.total > 0) {
    cs.push({ sev: 'verde', ic: 'clock', titulo: 'Cero extemporáneos: excelente disciplina',
      texto: 'Todos tus arqueos se reportaron dentro de los 2 días hábiles. Este hábito es el que más protege tu cumplimiento.' });
  }

  if (L.faltantes > 0) {
    cs.push({ sev: 'rojo', ic: 'alert', titulo: L.faltantes + ' faltante(s) por ' + fmt(L.montoFaltante),
      texto: 'Verifica doble conteo antes de cerrar, concilia contra el sistema en sitio y documenta la justificación en el formato. Los faltantes recurrentes activan auditoría.' });
  }
  if (L.sobrantes > 0) {
    cs.push({ sev: 'amarillo', ic: 'wallet', titulo: L.sobrantes + ' sobrante(s) por ' + fmt(L.montoSobrante),
      texto: 'Un sobrante también es diferencia operativa: revisa consignaciones sin registrar y transacciones pendientes de aplicar en el sistema.' });
  }
  if (L.faltantes === 0 && L.sobrantes === 0 && L.total > 0) {
    cs.push({ sev: 'verde', ic: 'shield', titulo: 'Cero diferencias operativas',
      texto: 'Todos tus arqueos del mes cuadraron contra sistema. Control de efectivo impecable.' });
  }

  if (L.oficinasATM > 0) {
    cs.push({ sev: 'info', ic: 'building', titulo: L.oficinasATM + ' oficina(s) con cajero automático',
      texto: 'En esas oficinas el sistema exige además el FOR-GOR-099-02 con las tirillas en PDF. Cada ATM suma a tu meta una sola vez al mes, aunque lo arquees varias veces. Las segundas visitas a una oficina sí suman con el arqueo de efectivo.' });
  }
  if ((L.virtuales || 0) > (L.presenciales || 0) && L.total > 0) {
    cs.push({ sev: 'amarillo', ic: 'eye', titulo: 'Predominan los arqueos virtuales (' + L.virtuales + ' de ' + L.total + ')',
      texto: 'La modalidad virtual es válida, pero el control presencial detecta más novedades. Balancea tu programación para sostener la calidad del arqueo.' });
  }
  return cs.slice(0, 6);
}

export function consejosGlobal(d, rol) {
  const g = d.global, cs = [], rest = d.habiles.restantes, trans = d.habiles.transcurridos;
  const criticos = d.lideres.filter((l) => l.semaforo === 'rojo' && l.validos < d.meta);
  const riesgo = d.lideres.filter((l) => l.semaforo === 'amarillo');
  const ambito = rol === 'Regional' ? 'tu regional' : 'la operación';

  if (g.pctGlobal >= 100) {
    cs.push({ sev: 'verde', ic: 'star', titulo: 'Cumplimiento de ' + ambito + ' al ' + g.pctGlobal + '%',
      texto: 'Los ' + g.totalLideres + ' líderes suman ' + g.validos + ' arqueos válidos sobre la meta global de ' + g.metaGlobal + '. Reconoce públicamente a los primeros del ranking.' });
  } else {
    const faltanGlobal = Math.max(g.metaGlobal - g.validos, 0);
    const reqDia = rest > 0 ? Math.ceil(faltanGlobal / rest) : 0;
    cs.push({ sev: g.pctGlobal >= 70 ? 'amarillo' : 'rojo', ic: 'chart', titulo: 'Cumplimiento de ' + ambito + ': ' + g.pctGlobal + '%',
      texto: 'Van ' + g.validos + ' de ' + g.metaGlobal + ' arqueos válidos (' + g.cumplenMeta + '/' + g.totalLideres + ' líderes en meta). ' + (rest > 0 ? 'Se requieren ~' + reqDia + ' arqueos/día hábil entre todos en los ' + rest + ' días restantes.' : 'El mes cerró: analiza causas con los líderes fuera de meta.') });
  }

  if (criticos.length) {
    const nombres = criticos.slice(0, 3).map((l) => l.nombre + ' (' + l.validos + '/' + d.meta + ')').join(', ');
    cs.push({ sev: 'rojo', ic: 'x', titulo: criticos.length + ' líder(es) en estado crítico',
      texto: 'Prioriza seguimiento a: ' + nombres + (criticos.length > 3 ? ' y ' + (criticos.length - 3) + ' más' : '') + '. Agenda llamada esta semana y define plan de choque con ritmo diario.' });
  }
  if (riesgo.length) {
    cs.push({ sev: 'amarillo', ic: 'clock', titulo: riesgo.length + ' líder(es) en riesgo de no cumplir',
      texto: riesgo.slice(0, 3).map((l) => l.nombre + ' proyecta ' + l.proyeccion).join(', ') + '. Un empujón temprano evita cierres críticos: aún hay ' + rest + ' días hábiles.' });
  }
  if (!criticos.length && !riesgo.length && trans > 0 && g.totalLideres > 0) {
    cs.push({ sev: 'verde', ic: 'users', titulo: 'Todos los líderes en verde',
      texto: 'Ningún líder en riesgo ni crítico. Aprovecha para auditar la calidad de los PDF de soporte generados este mes.' });
  }

  if (g.extemporaneos > 0) {
    cs.push({ sev: 'amarillo', ic: 'clock', titulo: g.extemporaneos + ' arqueo(s) extemporáneo(s) sin sumar',
      texto: 'Revisa el módulo de ' + (rol === 'Regional' ? 'Aprobaciones' : 'Normalizaciones') + ': los que tengan causa válida pueden normalizarse y recuperar indicador. ' + (g.normalizados > 0 ? 'Ya se normalizaron ' + g.normalizados + ' este mes.' : '') });
  }

  if (g.faltantes > 0) {
    const topF = d.novedades.filter((nv) => nv.novedad === 'FALTANTE')[0];
    cs.push({ sev: 'rojo', ic: 'alert', titulo: g.faltantes + ' faltante(s) por ' + fmt(g.montoFaltante),
      texto: (topF ? 'El mayor es en ' + topF.oficina + ' por ' + fmt(Math.abs(topF.diferencia)) + ' (' + topF.lider + '). ' : '') + 'Cruza contra el módulo de Tendencias para detectar oficinas reincidentes y activar auditoría focalizada.' });
  }
  if (g.sobrantes > 0) {
    cs.push({ sev: 'amarillo', ic: 'wallet', titulo: g.sobrantes + ' sobrante(s) por ' + fmt(g.montoSobrante),
      texto: 'Impacto neto del mes: ' + (g.montoNeto >= 0 ? '+' : '−') + fmt(Math.abs(g.montoNeto)) + '. Los sobrantes suelen indicar transacciones sin aplicar: verifica cortes de sistema con Operaciones.' });
  }
  if (g.faltantes === 0 && g.sobrantes === 0 && g.totalArqueos > 0) {
    cs.push({ sev: 'verde', ic: 'shield', titulo: 'Cero diferencias operativas en el mes',
      texto: g.totalArqueos + ' arqueos recibidos y todos cuadraron contra sistema. Indicador ejemplar para el comité.' });
  }
  if (g.pendientes > 0) {
    cs.push({ sev: 'info', ic: 'sparkle', titulo: g.pendientes + ' soporte(s) manual(es) pendientes de OCR',
      texto: 'El robot N8N aún no extrae montos de estos documentos. Hasta entonces no reflejan diferencias: monitorea que el flujo procese la cola.' });
  }
  return cs.slice(0, 6);
}

/** Mensaje de proyección del líder (mensajeProyeccion de V1). */
export function mensajeProyeccion(L, d) {
  if (L.validos >= d.meta) return 'Meta cumplida. Mantén el ritmo y evita extemporáneos.';
  if (d.habiles.restantes === 0 && d.habiles.transcurridos > 0) return 'El mes cerró sin alcanzar la meta con arqueos válidos.';
  if (L.semaforo === 'verde') return `Vas en ruta. Con ${dc(L.requeridoPorDia)} arqueos/día hábil llegas a la meta.`;
  if (L.semaforo === 'amarillo') return `En riesgo. Sube el ritmo a ${dc(L.requeridoPorDia)} arqueos/día hábil en los ${d.habiles.restantes} días restantes.`;
  return `Crítico. Proyectas ${L.proyeccion}. Requieres ${dc(L.requeridoPorDia)}/día hábil; revisa extemporáneos normalizables.`;
}

/** Registro vacío del líder (mismo respaldo de renderDashLider en V1). */
export const liderVacio = (meta) => ({ validos: 0, extemporaneos: 0, normalizados: 0, complementarios: 0, visitasAdicionales: 0, total: 0, faltantes: 0, sobrantes: 0, montoFaltante: 0, montoSobrante: 0, virtuales: 0, presenciales: 0, pct: 0, pctReal: 0, faltanParaMeta: meta, proyeccion: 0, requeridoPorDia: 0, estado: 'CRÍTICO', semaforo: 'rojo', oficinas: 0, oficinasATM: 0 });
