// Pestaña Analítica (renderAnalitica / pintarAnalitica de V1): los 10 gráficos que calcula
// obtenerAnalitica, cada uno con la interpretación del servidor y su tabla de datos.
// Las series en dos escalas (casos y millones de $) se muestran como dos paneles con su
// propio eje, en lugar de un gráfico de doble eje.
import Icon from '../../../../components/Icon.jsx';
import CountUp from '../../../../components/CountUp.jsx';
import { useMes, useRpc, mesNombre, n0, n2, CAT, C } from './lib.js';
import { Head, Estado, Empty } from './ui.jsx';
import { Donut, GroupBars, HBars, Legend } from './charts.jsx';

export const ORDEN = ['oficinasNovedad', 'faltantesRegional', 'sobrantesRegional', 'sobrantesMayores', 'faltantesMenores', 'recuperadoMayores', 'recuperadoMenores', 'faltantesLider', 'atmArqueo', 'cumplimientoRegional'];
const CORTO = {
  oficinasNovedad: 'Oficinas con novedad', faltantesRegional: 'Faltantes por regional', sobrantesRegional: 'Sobrantes por regional',
  sobrantesMayores: 'Sobrantes > $1 M', faltantesMenores: 'Faltantes < $1 M', recuperadoMayores: 'Recuperación > $1 M',
  recuperadoMenores: 'Recuperación < $1 M', faltantesLider: 'Faltantes por líder', atmArqueo: 'Cajeros ATM', cumplimientoRegional: 'Cumplimiento regional'
};
/** Millones con 2 decimales; un monto real menor a $ 10.000 no se muestra como $ 0 M. */
const mill = (v, casos) => (v > 0 || !casos ? '$ ' + n2(v) + ' M' : '< $ 0,01 M');
const TONO = { sobrantesMayores: C.goldInk, faltantesMenores: C.red, faltantesLider: C.red };

export function AnaliticaTab({ user }) {
  const { mes, meses, setMes } = useMes(user);
  const q = useRpc('obtenerAnalitica', [user.idUsuario, user.rol, mes]);
  return (
    <div className="aqd">
      <Estado q={q} fn="obtenerAnalitica">
        {(d) => <Analitica d={d} mes={mes} meses={meses} setMes={setMes} reload={q.reload} />}
      </Estado>
    </div>
  );
}

function Analitica({ d, mes, meses, setMes, reload }) {
  const G = d.graficos || {};
  const claves = ORDEN.filter((k) => G[k]);
  const ir = (k) => { const el = document.getElementById('aqd-an-' + k); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const of = G.oficinasNovedad ? G.oficinasNovedad.series[0].data : [0, 0, 0];
  const atm = G.atmArqueo ? G.atmArqueo.series[0].data : [0, 0];
  const conArq = of.reduce((a, b) => a + b, 0);
  return (
    <>
      <Head title={'Analítica de arqueos · ' + mesNombre(d.mes)}
        sub={<>{n0(d.totales.oficinas)} oficinas visibles · {n0(d.totales.arqueos)} arqueos en el mes. Cada gráfico incluye su interpretación y su tabla de datos.</>}
        mes={mes} meses={meses} setMes={setMes} />

      <section className="aqd-hero aqd-hero-slim">
        <div className="aqd-hero-quad">
          <div><span>Arqueos del mes</span><b className="num"><CountUp value={n0(d.totales.arqueos)} /></b><small>{n0(d.totales.oficinas)} oficinas visibles</small></div>
          <div><span>Oficinas con arqueo</span><b className="num"><CountUp value={n0(conArq)} /></b><small>{d.totales.oficinas ? Math.round(conArq / d.totales.oficinas * 100) : 0}% de las visibles</small></div>
          <div><span>Sin novedad</span><b className="num"><CountUp value={(conArq ? Math.round(of[0] / conArq * 100) : 0) + '%'} /></b><small>{of[1]} con faltantes · {of[2]} con sobrantes</small></div>
          <div><span>Cajeros con arqueo</span><b className="num"><CountUp value={((atm[0] + atm[1]) ? Math.round(atm[0] / (atm[0] + atm[1]) * 100) : 0) + '%'} /></b><small>{atm[0]} de {atm[0] + atm[1]} cajeros</small></div>
        </div>
      </section>

      <nav className="aqd-index" aria-label="Gráficos de la analítica">
        {claves.map((k, i) => <button type="button" key={k} onClick={() => ir(k)}><b>{i + 1}</b>{CORTO[k]}</button>)}
      </nav>

      <div className="aqd-an-list">
        {claves.map((k, i) => <Grafico key={k} k={k} g={G[k]} i={i + 1} />)}
      </div>
    </>
  );
}

const vacio = (g) => !g.labels.length || !g.series.some((s) => s.data.some((v) => v > 0));

function Grafico({ k, g, i }) {
  const pie = g.tipo === 'pie';
  return (
    <article className="aqd-an" id={'aqd-an-' + k}>
      <header>
        <span className="aqd-an-n">{i}</span>
        <h3>{g.titulo}</h3>
        <span className="aqd-chip aqd-mute"><Icon name={pie ? 'activity' : 'chart'} />{pie ? 'Circular' : g.series.length > 1 ? 'Barras por serie' : 'Barras'}</span>
      </header>
      <div className="aqd-an-b">
        <div className="aqd-an-chart">
          {vacio(g) ? <Empty icon="chart" title="Sin datos para graficar en este mes" /> : pie ? <Torta k={k} g={g} /> : <Barras k={k} g={g} />}
        </div>
        <div className="aqd-an-side">
          <p className="aqd-lbl">Interpretación</p>
          <blockquote className="aqd-interp"><Icon name="sparkle" /><span>{g.interpretacion}</span></blockquote>
          <p className="aqd-lbl">Tabla de datos</p>
          <TablaDatos t={g.tabla} />
          {g.detalle && g.detalle.filas && g.detalle.filas.length > 0 && (
            <details className="aqd-det">
              <summary>Ver detalle ({g.detalle.filas.length})</summary>
              <TablaDatos t={g.detalle} />
            </details>
          )}
        </div>
      </div>
    </article>
  );
}

function coloresTorta(k, labels) {
  if (k === 'oficinasNovedad') return [C.green, C.red, C.gold];
  if (k === 'atmArqueo') return [C.cyan, '#C9CDE3'];
  return labels.map((_, i) => CAT[i % CAT.length]);
}

function Torta({ k, g }) {
  let labels = g.labels.slice(), data = g.series[0].data.slice();
  // Más de 8 categorías: el resto se agrupa en "Otras" (nunca se generan colores nuevos).
  if (labels.length > CAT.length) {
    const idx = labels.map((_, i) => i).sort((a, b) => data[b] - data[a]);
    const top = idx.slice(0, CAT.length - 1).sort((a, b) => a - b);
    const otras = idx.slice(CAT.length - 1).reduce((a, i) => a + data[i], 0);
    labels = top.map((i) => labels[i]).concat('Otras'); data = top.map((i) => data[i]).concat(otras);
  }
  const cols = coloresTorta(k, labels);
  return <Donut label={g.titulo} centerLabel={g.series[0].name.toLowerCase()} parts={labels.map((l, i) => ({ label: l, value: data[i], color: cols[i] }))} />;
}

function Barras({ k, g }) {
  const dual = g.series.some((s) => s.eje === 'y1');
  if (dual) {
    // Dos medidas con escalas distintas: un panel por serie, cada uno con su eje.
    return (
      <div className="aqd-sm">
        {g.series.map((s, si) => {
          const color = si === 0 ? C.navy : (TONO[k] || C.cyan);
          const esMonto = s.eje === 'y1';
          return (
            <div key={s.name} className="aqd-sm-p">
              <p className="aqd-sm-t"><i style={{ background: color }} />{s.name}</p>
              <HBars label={g.titulo + ' · ' + s.name} labelW={k === 'faltantesLider' ? 190 : 160}
                rows={g.labels.map((l, i) => ({ key: l, label: l, segs: [{ v: s.data[i], color, name: s.name }],
                  end: esMonto ? mill(s.data[i], g.series[0].data[i]) : n0(s.data[i]),
                  tip: g.series.map((x, xi) => [xi === 0 ? C.navy : (TONO[k] || C.cyan), x.name, x.eje === 'y1' ? mill(x.data[i], g.series[0].data[i]) : n0(x.data[i])]) }))} />
            </div>
          );
        })}
      </div>
    );
  }
  if (k === 'recuperadoMayores' || k === 'recuperadoMenores') {
    const cols = [C.green, C.red, C.mute2];
    return (
      <>
        <Legend items={g.series.map((s, i) => [s.name, cols[i]])} />
        <HBars label={g.titulo} labelW={130}
          rows={g.labels.map((l, i) => ({ key: l, label: l, segs: g.series.map((s, si) => ({ v: s.data[i], color: cols[si], name: s.name })) }))} />
      </>
    );
  }
  const pctSerie = g.series.every((s) => /^%/.test(s.name));
  const cols = k === 'cumplimientoRegional' ? [C.navy, C.cyan, C.goldInk, C.green] : CAT;
  return (
    <>
      <Legend items={g.series.map((s, i) => [s.name, cols[i % cols.length]])} />
      <GroupBars label={g.titulo} labels={g.labels} series={g.series} colors={g.series.map((_, i) => cols[i % cols.length])} max={pctSerie ? 100 : undefined} unit={pctSerie ? '%' : ''} />
    </>
  );
}

/** tablaDatos de V1: columnas numéricas alineadas a la derecha; la fila TOTAL resaltada. */
function TablaDatos({ t }) {
  if (!t || !t.filas || !t.filas.length) return <p className="small muted">Sin datos para el periodo.</p>;
  const esNum = (v, i) => i > 0 && (typeof v === 'number' || /^[$\d]/.test(String(v)));
  return (
    <div className="aqd-dt">
      <table>
        <thead><tr>{t.columnas.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>
          {t.filas.map((f, ri) => (
            <tr key={ri} className={/^total/i.test(String(f[0])) ? 'tot' : ''}>
              {f.map((v, i) => <td key={i} className={esNum(v, i) ? 'r num' : ''}>{typeof v === 'number' ? n0(v) : v}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
