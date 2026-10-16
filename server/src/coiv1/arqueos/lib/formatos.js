// ============================================================
// 8. GENERACION DE PDF — REPLICA DE LOS FORMATOS OFICIALES
// ------------------------------------------------------------
// Plantillas HTML copiadas sin cambios de Código.gs (FOR-GOR-020-09,
// FOR-GOR-048-01 y FOR-GOR-099-02). En Apps Script el HTML se convertia a PDF
// con getAs('application/pdf'); en Node se guarda el HTML (mismo nombre de
// archivo con extension .html) con una barra "Imprimir / Guardar PDF" que se
// oculta al imprimir, y su URL queda en URL_PDF igual que file.getUrl().
// ============================================================
import { DriveFiles, Utilities } from '../../gas.js';
import { FMT, FILAS_MIN_CHEQUES, VISITA, TZ, esc_, num_, money_, norm_, parseFecha_ } from './base.js';

export function cssPdf_() {
  return `
  <style>
    @page { size: A4; margin: 12mm 10mm; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; color:#000; margin:0; }
    table { border-collapse: collapse; width: 100%; }
    td, th { vertical-align: middle; }
    .marco { border:1.2px solid #000; }
    .cab td { border:1px solid #000; padding:3px 5px; }
    .cab .logo { width:22%; text-align:center; font-weight:bold; font-size:12pt; letter-spacing:.5px; }
    .cab .titulo { text-align:center; font-weight:bold; font-size:12pt; }
    .cab .meta { width:24%; font-size:7.5pt; }
    .sec { background:#D9D9D9; border:1px solid #000; padding:3px 6px; font-weight:bold; font-size:9.5pt; }
    .grid td { border:1px solid #000; padding:3px 5px; font-size:8.5pt; }
    .grid th { border:1px solid #000; padding:4px 5px; font-size:8pt; background:#E8E8E8; text-align:center; }
    .num { text-align:right; }
    .ctr { text-align:center; }
    .lbl { font-weight:bold; }
    .linea { border-bottom:1px solid #000; display:inline-block; min-width:120px; }
    .caja { border:1px solid #000; padding:4px 6px; }
    .tot { font-weight:bold; background:#F2F2F2; }
    .nota { font-size:6.8pt; text-align:center; border:1px solid #000; padding:4px; }
    .firma { border-top:1px solid #000; padding-top:3px; font-size:8pt; text-align:center; }
    .mini { font-size:7.5pt; }
    .sello { border:1px solid #000; padding:5px 8px; font-size:7.5pt; background:#F7F7F7; }
    .chk { font-family:'Courier New',monospace; font-weight:bold; }
  </style>`;
}

export function selloTrazabilidad_(comun, formato, id) {
  return `
  <table style="margin-top:8px"><tr><td class="sello">
    <b>TRAZABILIDAD DEL SOPORTE DIGITAL</b> &nbsp;|&nbsp;
    ID Arqueo: <b>${esc_(id)}</b> &nbsp;|&nbsp;
    Sesión: ${esc_(comun.idSesion)} &nbsp;|&nbsp;
    Formato: ${esc_(formato)} &nbsp;|&nbsp;
    Modalidad: <b>${esc_(comun.modalidad)}</b> &nbsp;|&nbsp;
    Visita: <b>${esc_(comun.tipoVisita || VISITA.PRIMERA)}</b>${comun.tipoVisita === VISITA.ADICIONAL && comun.visitaPrevia
      ? ' (primera visita del mes: ' + esc_(comun.visitaPrevia) + ')' : ''} &nbsp;|&nbsp;
    Meta: <b>${comun.cuentaMeta === false ? 'NO SUMA' : 'SUMA'}</b>${comun.nota ? ' (' + esc_(comun.nota) + ')' : ''} &nbsp;|&nbsp;
    Reporte: ${esc_(comun.extemporaneo === 'SÍ' ? 'EXTEMPORÁNEO (' + comun.diasHabiles + ' días hábiles)' : 'OPORTUNO')} &nbsp;|&nbsp;
    Generado por el sistema el ${esc_(comun.generado)} — usuario ${esc_(comun.idUsuario)}
  </td></tr></table>`;
}

export function marcaChk_(activo) { return activo ? '<span class="chk">[ X ]</span>' : '<span class="chk">[&nbsp;&nbsp;&nbsp;]</span>'; }

// ---------- A. FOR-GOR-020-09 ----------
export function htmlFormatoEfectivo_(comun, d) {
  const dif = num_(d.diferencia);
  const tipo = String(d.tipoArqueo || '');
  const elem = String(d.elemento || '');
  const firma = (p, titulo, sub) => `
    <td width="33%" style="padding:0 6px">
      <div style="height:38px"></div>
      <div class="firma">${esc_((p && p.nombre) || '')}</div>
      <div class="mini ctr"><b>${titulo}</b><br>${sub}</div>
      <div class="mini ctr">Cargo: ${esc_((p && p.cargo) || '—')}</div>
      <div class="mini ctr">${(p && p.firmado) ? 'Firmado digitalmente ✔' : 'Sin firma'}</div>
    </td>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${cssPdf_()}</head><body>
  <table class="cab">
    <tr>
      <td class="logo" rowspan="2">MULTIVAL<br><span style="font-size:7pt;font-weight:normal">REVAL S.A.S.</span></td>
      <td class="titulo">REPORTE DE ARQUEO, FALTANTES Y/O SOBRANTES</td>
      <td class="meta">Página: 1 de 1<br>Código: ${esc_(FMT.EFECTIVO)}</td>
    </tr>
    <tr><td class="ctr mini">Gestión Operativa y de Riesgo</td><td class="meta">Versión vigente</td></tr>
  </table>

  <table style="margin-top:8px"><tr><td class="caja">
    Siendo las <b>${esc_(comun.hora)}</b> horas del <b>${esc_(comun.fechaTexto)}</b>
    en la oficina <b>${esc_(comun.oficina)}</b>, se efectuó el arqueo de efectivo en modalidad
    <b>${esc_(comun.modalidad)}</b>, según las siguientes especificaciones:
  </td></tr></table>

  <table style="margin-top:8px"><tr><td class="sec">1. Arqueo</td></tr></table>
  <table class="grid">
    <tr>
      <td width="22%" class="lbl">Elemento de Arqueo</td>
      <td>${marcaChk_(elem === 'Bóveda')} Bóveda &nbsp;&nbsp;
          ${marcaChk_(elem === 'Caja')} Caja No. <span class="linea" style="min-width:50px">${esc_(elem === 'Caja' ? d.numeroElem : '')}</span> &nbsp;&nbsp;
          ${marcaChk_(elem === 'ATM')} Cajero Automático No. <span class="linea" style="min-width:50px">${esc_(elem === 'ATM' ? d.numeroElem : '')}</span></td>
    </tr>
    <tr>
      <td class="lbl">Tipo de Arqueo</td>
      <td>${marcaChk_(tipo === 'Arqueo de Control')} Arqueo de Control &nbsp;&nbsp;
          ${marcaChk_(tipo === 'Arqueo Fin de Mes')} Arqueo Fin de Mes &nbsp;&nbsp;
          ${marcaChk_(tipo === 'Arqueo de Supervisión')} Arqueo de Supervisión</td>
    </tr>
  </table>

  <table class="grid" style="margin-top:6px">
    <tr><td width="60%">Billete</td><td class="num">${money_(d.montoBilletes)}</td></tr>
    <tr><td>Moneda</td><td class="num">${money_(d.montoMonedas)}</td></tr>
    <tr class="tot"><td>Total Efectivo Físico</td><td class="num">${money_(d.totalFisico)}</td></tr>
    <tr><td>Saldo Según Sistema</td><td class="num">${money_(d.saldoSistema)}</td></tr>
    <tr class="tot">
      <td>Diferencia &nbsp;&nbsp; ${marcaChk_(dif < 0)} Faltante &nbsp;&nbsp; ${marcaChk_(dif > 0)} Sobrante</td>
      <td class="num">${money_(dif)}</td>
    </tr>
  </table>

  ${d.usd ? `
  <table style="margin-top:8px"><tr><td class="sec">1.1 Moneda extranjera (USD)</td></tr></table>
  <table class="grid">
    <tr><td width="60%">Dólares físicos (USD)</td><td class="num">USD ${esc_(num_(d.usd.fisico).toFixed(2))}</td></tr>
    <tr><td>Saldo en dólares según sistema (USD)</td><td class="num">USD ${esc_(num_(d.usd.sistema).toFixed(2))}</td></tr>
    <tr class="tot"><td>Diferencia USD &nbsp;&nbsp; ${marcaChk_(num_(d.usd.diferencia) < 0)} Faltante &nbsp;&nbsp; ${marcaChk_(num_(d.usd.diferencia) > 0)} Sobrante</td>
      <td class="num">USD ${esc_(num_(d.usd.diferencia).toFixed(2))}</td></tr>
    ${num_(d.usd.tasa) > 0 ? `<tr><td>Tasa de referencia (COP por USD)</td><td class="num">${money_(d.usd.tasa)}</td></tr>
    <tr><td>Equivalente de la diferencia en pesos</td><td class="num">${money_(num_(d.usd.diferencia) * num_(d.usd.tasa))}</td></tr>` : ''}
    ${d.usd.observaciones ? `<tr><td colspan="2" class="mini">Observación USD: ${esc_(d.usd.observaciones)}</td></tr>` : ''}
  </table>` : ''}

  <table style="margin-top:8px"><tr><td class="sec">2. Observaciones</td></tr></table>
  <table class="grid"><tr><td style="height:60px;vertical-align:top">${esc_(d.observaciones || 'SIN NOVEDAD')}</td></tr>
    <tr><td class="mini">Verificación de Sistemas: <span class="linea" style="min-width:260px">${esc_(d.sistemas || '')}</span></td></tr>
  </table>

  <table style="margin-top:8px"><tr><td class="sec">3. Responsables</td></tr></table>
  <table class="marco" style="padding:6px"><tr>
    ${firma(d.practico,    'QUIEN PRACTICÓ EL ARQUEO', 'Nombre y firma')}
    ${firma(d.acompano,    'QUIEN ACOMPAÑÓ EL ARQUEO', 'Testigo')}
    ${firma(d.practicadoA, 'A QUIEN SE LE PRACTICÓ',   'Responsable del efectivo')}
  </tr></table>

  <table style="margin-top:6px"><tr><td class="mini" style="text-align:right"><b>${esc_(FMT.EFECTIVO)}</b></td></tr></table>
  ${selloTrazabilidad_(comun, FMT.EFECTIVO, d.idArqueo || comun.idSesion)}
  <table style="margin-top:6px"><tr><td class="nota">Nota: Este documento es propiedad intelectual de REVAL, se prohíbe su reproducción total o parcial sin previa autorización escrita de su propietario</td></tr></table>
  </body></html>`;
}

// ---------- B. FOR-GOR-048-01  ARQUEO TITULOS VALOR ----------
export function htmlFormatoCheques_(comun, d) {
  const items = d.items || [];
  const filas = [];
  const total = Math.max(items.length, FILAS_MIN_CHEQUES);

  for (let i = 0; i < total; i++) {
    const it = items[i] || {};
    const dif = (it.tipoTitulo || it.cant !== undefined) ? (num_(it.invCont) - num_(it.cant)) : '';
    filas.push(`<tr>
      <td class="ctr">${i + 1}</td>
      <td>${esc_(it.tipoTitulo || '')}</td>
      <td class="ctr">${esc_(it.rangoInicial || '')}</td>
      <td class="ctr">${esc_(it.rangoFinal || '')}</td>
      <td class="num">${it.cant !== undefined && it.cant !== '' ? esc_(it.cant) : ''}</td>
      <td class="num">${it.invCont !== undefined && it.invCont !== '' ? esc_(it.invCont) : ''}</td>
      <td class="num">${items[i] ? dif : ''}</td>
      <td>${esc_(it.observacion || '')}</td>
    </tr>`);
  }

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${cssPdf_()}</head><body>
  <table class="cab">
    <tr>
      <td class="logo" rowspan="2">MULTIVAL<br><span style="font-size:7pt;font-weight:normal">REVAL S.A.S.</span></td>
      <td class="titulo">ARQUEO TITULOS VALOR</td>
      <td class="meta">Codigo: ${esc_(FMT.CHEQUES)}</td>
    </tr>
    <tr><td class="ctr mini">&nbsp;</td><td class="meta">Vigente a partir de:<br>31 de Enero de 2.011</td></tr>
  </table>

  <table class="grid" style="margin-top:10px">
    <tr>
      <td width="12%" class="lbl">OFICINA:</td><td width="38%">${esc_(comun.oficina)}</td>
      <td width="10%" class="lbl">FECHA:</td><td width="20%" class="ctr">${esc_(comun.fechaTexto)} · ${esc_(comun.hora)}</td>
      <td width="10%" class="lbl">ACTA Nº</td><td width="10%" class="ctr">${esc_(d.actaNo || '')}</td>
    </tr>
  </table>

  <table class="grid" style="margin-top:8px">
    <thead><tr>
      <th width="7%">CAJERO</th>
      <th width="26%">TIPO DE TITULO</th>
      <th width="12%">RANGO<br>INICIAL</th>
      <th width="12%">RANGO<br>FINAL</th>
      <th width="8%">CANT</th>
      <th width="10%">INV&nbsp;&nbsp;&nbsp;CONT</th>
      <th width="7%">DIF</th>
      <th width="18%">OBSERVACIÓN</th>
    </tr></thead>
    <tbody>
      ${filas.join('')}
      <tr class="tot">
        <td colspan="4" class="ctr">TOTALES</td>
        <td class="num">${esc_(d.totalCant)}</td>
        <td class="num">${esc_(d.totalInvCont)}</td>
        <td class="num">${esc_(d.diferencia)}</td>
        <td></td>
      </tr>
    </tbody>
  </table>

  <table class="grid" style="margin-top:10px">
    <tr><td class="lbl">Anexos</td></tr>
    <tr><td style="height:42px;vertical-align:top">${esc_(d.anexos || '')}</td></tr>
    <tr><td>Se hace constar que los titulos verificados por los funcionarios que practicaron el arqueo fueron devueltos en su totalidad, a entera satisfacción.</td></tr>
  </table>

  <table style="margin-top:26px"><tr>
    <td width="25%"></td>
    <td width="50%">
      <div class="firma">${esc_((d.quienRealiza && d.quienRealiza.nombre) || '')}</div>
      <div class="mini ctr">QUIEN REALIZA EL ARQUEO (Nombre y firma)</div>
      <div class="mini ctr">Cargo: ${esc_((d.quienRealiza && d.quienRealiza.cargo) || '—')}
        ${(d.quienRealiza && d.quienRealiza.firmado) ? ' · Firmado digitalmente ✔' : ''}</div>
    </td>
    <td width="25%"></td>
  </tr></table>

  ${selloTrazabilidad_(comun, FMT.CHEQUES, d.idArqueo || comun.idSesion)}
  <table style="margin-top:6px"><tr><td class="nota">Nota : Este documento es propiedad intelectual de REVAL,  se prohíbe su reproducción total o parcial sin previa autorización escrita de su propietario</td></tr></table>
  </body></html>`;
}

// ---------- C. FOR-GOR-099-02  REPORTE DE ARQUEO CAJEROS AUTOMATICOS ----------
export function htmlFormatoAtm_(comun, d, calc, urlsTir) {
  const tipo = String(d.tipoArqueo || '');
  const gav = (arr, conEtiqueta) => (arr || []).map((g, i) => `
    <tr>
      <td width="34%">${conEtiqueta ? 'GAVETA ' + (i + 1) : ''}</td>
      <td width="22%" class="ctr">${esc_(g.denominacion || '')}</td>
      <td width="20%" class="ctr">${esc_(g.cantidad === '' || g.cantidad === undefined ? '' : g.cantidad)}</td>
      <td width="24%" class="num">${money_(num_(g.denominacion) * num_(g.cantidad))}</td>
    </tr>`).join('');

  const cabTabla = `<tr><th></th><th>DENOMINACION</th><th>CANTIDAD</th><th>VALOR</th></tr>`;

  const linksTir = (urlsTir || []).length
    ? (urlsTir || []).map((u, i) => `Tirilla ${i + 1}: ${esc_(u)}`).join('<br>')
    : 'Sin tirillas adjuntas';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${cssPdf_()}</head><body>
  <table class="cab">
    <tr>
      <td class="logo" rowspan="3">MULTIPAGAS<br>REVAL</td>
      <td class="titulo">MULTIPAGAS - REVAL</td>
      <td class="meta">Pagina: 1 de 1</td>
    </tr>
    <tr><td class="titulo">REPORTE DE ARQUEO CAJEROS AUTOMATICOS</td><td class="meta">Codigo: ${esc_(FMT.ATM)}</td></tr>
    <tr><td class="ctr mini">&nbsp;</td><td class="meta">Vigencia a partir de: 30 de Octubre 2025</td></tr>
  </table>

  <table class="grid" style="margin-top:8px">
    <tr>
      <td width="9%" class="lbl">FECHA:</td><td width="18%" class="ctr">${esc_(comun.fechaTexto)}</td>
      <td width="18%" class="lbl">DIRECTOR DE SERVICIOS</td><td width="22%">${esc_(d.directorServicios || comun.lider)}</td>
      <td width="10%" class="lbl">CAJERO</td><td width="23%">${esc_(d.nombreCajero || '')}</td>
    </tr>
    <tr>
      <td class="lbl">HORA:</td><td class="ctr">${esc_(comun.hora)}</td>
      <td class="lbl">OFICINA</td><td>${esc_(comun.oficina)}</td>
      <td class="lbl">ZONA</td><td>${esc_(d.zona || '')}</td>
    </tr>
  </table>

  <table style="margin-top:8px"><tr><td class="sec">1. Arqueo</td></tr></table>
  <table class="grid">
    <tr><td width="34%" class="lbl">Cajero Automático No.</td><td>${esc_(d.cajeroNo || '')}</td></tr>
    <tr><td class="lbl">Seleccione el tipo de arqueo</td>
      <td>${marcaChk_(tipo === 'Arqueo de Control')} Arqueo de Control &nbsp;&nbsp;
          ${marcaChk_(tipo === 'Arqueo Fin de Mes')} Arqueo Fin de Mes &nbsp;&nbsp;
          ${marcaChk_(tipo === 'Arqueo de Supervisión')} Arqueo de Supervisión</td></tr>
  </table>

  <table style="margin-top:8px"><tr><td class="sec">GAVETAS DE EFECTIVO</td></tr></table>
  <table class="grid">${cabTabla}${gav(d.gavetasEfectivo, true)}</table>

  <table style="margin-top:8px"><tr><td class="sec">GAVETA DE PURGA</td></tr></table>
  <table class="grid">${cabTabla}${gav(d.gavetaPurga, false)}</table>

  <table style="margin-top:8px"><tr><td class="sec">GAVETAS DISPENSADO</td></tr></table>
  <table class="grid">${cabTabla}${gav(d.gavetasDispensado, true)}</table>

  <table class="grid" style="margin-top:10px">
    <tr class="tot"><td width="60%">TOTAL ARQUEO FISICO</td><td class="num">${money_(calc.totalFisico)}</td></tr>
    <tr class="tot"><td>TOTAL CAJERO AUTOMATICO</td><td class="num">${money_(calc.totalCajero)}</td></tr>
    <tr class="tot"><td>DIFERENCIA</td><td class="num">${money_(calc.diferencia)}</td></tr>
  </table>

  <table class="grid" style="margin-top:8px">
    <tr><td width="34%" class="lbl">Seleccione si hay novedades</td>
      <td>${marcaChk_(calc.diferencia < 0)} Faltante &nbsp;&nbsp;&nbsp; ${marcaChk_(calc.diferencia > 0)} Sobrante</td></tr>
  </table>

  <table class="grid" style="margin-top:8px">
    <tr><td class="mini">Registre si tiene alguna observación, diferencias al respecto tirilla entregada por el ATM</td></tr>
    <tr><td style="height:46px;vertical-align:top">${esc_(d.observaciones || '')}</td></tr>
    <tr><td class="mini">Por favor también registre se puede relacionar cualquier tipo de novedad, como el hallazgo de billetes rotos o presuntamente falsos. En esta casilla también es propio relacionar novedades técnicas de MI ATM, con números de radicado de servicio técnico las cuales no deben ser imputadas a la oficina y de esta manera no se vea afectado el UPTIME.</td></tr>
    <tr><td style="height:46px;vertical-align:top">${esc_(d.novedadesTecnicas || '')}</td></tr>
  </table>

  <table style="margin-top:8px"><tr><td class="sec">2. APROVISIONAMIENTO</td></tr></table>
  <table class="grid">${cabTabla}${gav(d.aprovisionamiento, true)}</table>

  <table style="margin-top:8px"><tr><td class="sec">3. FIRMAS DE RESPONSABLES</td></tr></table>
  <table class="grid">
    <tr>
      <th width="50%">Quien practicó el arqueo</th>
      <th width="50%">A quien se le practicó el arqueo<br><span style="font-weight:normal">(Persona responsable del efectivo)</span></th>
    </tr>
    <tr>
      <td>Nombre (legible): ${esc_((d.practico && d.practico.nombre) || '')}</td>
      <td>Nombre (legible): ${esc_((d.practicadoA && d.practicadoA.nombre) || '')}</td>
    </tr>
    <tr>
      <td>Cargo: ${esc_((d.practico && d.practico.cargo) || '')}</td>
      <td>Cargo: ${esc_((d.practicadoA && d.practicadoA.cargo) || '')}</td>
    </tr>
    <tr>
      <td style="height:34px">Firma: ${(d.practico && d.practico.firmado) ? 'Firmado digitalmente ✔' : ''}</td>
      <td style="height:34px">Firma: ${(d.practicadoA && d.practicadoA.firmado) ? 'Firmado digitalmente ✔' : ''}</td>
    </tr>
  </table>

  <table class="grid" style="margin-top:8px">
    <tr><td class="lbl mini">TIRILLAS ADJUNTAS (PDF)</td></tr>
    <tr><td class="mini">${linksTir}</td></tr>
  </table>

  ${selloTrazabilidad_(comun, FMT.ATM, d.idArqueo || comun.idSesion)}
  </body></html>`;
}


/** Nombre del soporte: FORMATO_OFICINA_yyyyMMdd_ID.pdf (igual que V1). */
export function nombrePdf_(comun, formato, id) {
  return [formato,
    norm_(comun.oficina).replace(/[^A-Z0-9]+/g, '_'),
    Utilities.formatDate(parseFecha_(comun.fechaTexto) || new Date(), TZ, 'yyyyMMdd'),
    id].join('_') + '.pdf';
}

/** Barra de impresion (no sale en el papel) para guardar el formato como PDF desde el navegador. */
export function conBarraImpresion_(html, titulo) {
  const css = `
  <style>
    .no-print { position:sticky; top:0; z-index:10; display:flex; gap:10px; align-items:center; justify-content:space-between;
      background:#25294F; color:#F6CF46; padding:8px 14px; font-family:Arial,Helvetica,sans-serif; font-size:12px; }
    .no-print button { background:#F6CF46; color:#25294F; border:0; border-radius:6px; padding:6px 14px; font-weight:bold; cursor:pointer; }
    @media print { .no-print { display:none !important; } body { margin:0; } }
    @media screen { body { max-width:210mm; margin:0 auto; background:#fff; } }
  </style>`;
  const barra = `<div class="no-print"><span>${esc_(titulo || 'Soporte de arqueo')}</span>` +
    `<button type="button" onclick="window.print()">Imprimir / Guardar PDF</button></div>`;
  return String(html).replace('</head>', css + '<title>' + esc_(titulo || '') + '</title></head>').replace('<body>', '<body>' + barra);
}

/**
 * Equivale a crearPdf_(carpeta, nombre, html) de V1. `carpeta` es la ruta logica
 * devuelta por getCarpeta_(). Devuelve { url, id }.
 */
export function crearPdf_(carpeta, nombre, html) {
  const nombreHtml = nombre.replace(/\.pdf$/, '.html');
  const file = DriveFiles.save({ folder: carpeta, name: nombreHtml, mimeType: 'text/html',
    data: conBarraImpresion_(html, nombre.replace(/\.pdf$/, '')) });
  return { url: file.url, id: file.id };
}
