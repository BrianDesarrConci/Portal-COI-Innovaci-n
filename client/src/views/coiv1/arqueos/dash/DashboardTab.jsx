// Pestaña Dashboard: "Mi cumplimiento" para el líder y "Dashboard Regional / Global"
// para Regional y Analista (renderDashLider / renderDashGlobal de V1).
import Icon from '../../../../components/Icon.jsx';
import CountUp from '../../../../components/CountUp.jsx';
import { useMes, useRpc, mesNombre, mesHoy, n0, cop, copSigno, copCorto, semColor, ESTADO_ORDEN, C } from './lib.js';
import { Head, Sem, Tile, Panel, Asesor, Estado, SortTable, Meter, Chip, Empty } from './ui.jsx';
import { CumChart, Donut, HBars, Legend, Ring, StackStrip } from './charts.jsx';
import { consejosGlobal, consejosLider, liderVacio, mensajeProyeccion } from './asesor.js';

/** Último día con datos reales del mes (hoy si es el mes en curso). */
export function diaCorte(mes, dias) {
  const hoy = mesHoy();
  if (mes === hoy) return new Date().getDate();
  if (mes > hoy) return 0;
  return dias;
}

export function DashboardTab({ user }) {
  const { mes, meses, setMes } = useMes(user);
  const q = useRpc('obtenerDashboard', [user.idUsuario, user.rol, mes]);
  const lider = user.rol === 'Lider';
  return (
    <div className="aqd">
      <Estado q={q} fn="obtenerDashboard">
        {(d) => lider
          ? <DashLider d={d} user={user} mes={mes} meses={meses} setMes={setMes} reload={q.reload} />
          : <DashGlobal d={d} user={user} mes={mes} meses={meses} setMes={setMes} reload={q.reload} />}
      </Estado>
    </div>
  );
}

/* ====================================================================
   Líder: Mi cumplimiento
   ==================================================================== */
function DashLider({ d, user, mes, meses, setMes, reload }) {
  const L = d.lideres.find((x) => x.idLider === user.idUsuario) || liderVacio(d.meta);
  const col = semColor(L.semaforo);
  const corte = diaCorte(d.mes, d.serie.length);
  const projPct = d.meta ? Math.min(Math.round((L.proyeccion / d.meta) * 100), 100) : 0;
  const notas = [
    L.normalizados > 0 && <Chip key="n" tone="ok" icon="check">{L.normalizados} normalizado(s) incluidos</Chip>,
    L.complementarios > 0 && <Chip key="c" tone="mute" icon="file">{L.complementarios} de títulos valor (complementarios)</Chip>,
    (L.visitasAdicionales || 0) > 0 && <Chip key="v" tone="info" icon="flow">{L.visitasAdicionales} en visitas adicionales (el efectivo sí suma)</Chip>,
    (L.atmRepetidos || 0) > 0 && <Chip key="a" tone="warn" icon="building">{L.atmRepetidos} ATM repetido(s): el cajero cuenta una vez al mes</Chip>,
    (L.pendientesGestion || 0) > 0 && <Chip key="p" tone="bad" icon="bell">{L.pendientesGestion} novedad(es) pendiente(s) por responder</Chip>
  ].filter(Boolean);
  const visitadas = L.oficinasVisitadas || 0, pendOf = L.oficinasPendientes || 0;
  const modTot = (L.presenciales || 0) + (L.virtuales || 0);

  return (
    <>
      <Head kicker="Tablero · Líder" title={'Mi cumplimiento · ' + mesNombre(d.mes)}
        sub={<>Meta: <b>{d.meta} arqueos válidos</b> · Días hábiles {d.habiles.transcurridos}/{d.habiles.total} · {d.habiles.restantes} restantes</>}
        mes={mes} meses={meses} setMes={setMes} />

      <section className="aqd-hero">
        <div className="aqd-hero-main">
          <Ring pct={L.pct} color={col} size={176} label={`${L.validos} de ${d.meta} arqueos válidos`}>
            <b className="num"><CountUp value={String(L.validos)} /></b><span>de {d.meta} válidos</span>
          </Ring>
          <div className="aqd-hero-id">
            <span className="aqd-hero-k">{user.nombre || 'Mi cumplimiento'}</span>
            <div className="aqd-hero-big num"><CountUp value={L.pctReal + ' %'} /></div>
            <Sem s={L.semaforo} lg>{L.estado}</Sem>
            <p className="aqd-hero-msg">{L.faltanParaMeta > 0 ? <>Te faltan <b>{L.faltanParaMeta}</b> arqueos válidos. </> : <>¡Meta cumplida! </>}{mensajeProyeccion(L, d)}</p>
          </div>
        </div>
        <div className="aqd-hero-stats">
          <div className="aqd-hs"><span>Proyección fin de mes</span><b className="num"><CountUp value={String(L.proyeccion)} /></b><small>arqueos válidos estimados</small></div>
          <div className="aqd-hs"><span>Ritmo requerido</span><b className="num">{L.requeridoPorDia >= 999 ? '—' : <CountUp value={String(L.requeridoPorDia).replace('.', ',')} />}</b><small>arqueos por día hábil</small></div>
          <div className="aqd-hs"><span>Días hábiles restantes</span><b className="num"><CountUp value={String(d.habiles.restantes)} /></b><small>de {d.habiles.total} del mes</small></div>
          <div className="aqd-hs aqd-hs-proj">
            <span>Proyección frente a la meta</span>
            <div className="aqd-proj"><i style={{ width: projPct + '%', background: col }} /><em style={{ left: '100%' }} /></div>
            <small className="num">{L.proyeccion} proyectados · meta {d.meta}</small>
          </div>
        </div>
        {notas.length > 0 && <div className="aqd-hero-notes">{notas}</div>}
      </section>

      <Asesor consejos={consejosLider(L, d)} />

      <div className="aqd-grid4">
        <Tile label="Válidos (cuentan)" value={n0(L.validos)} sub="Incluye normalizados" icon="check" tone="green" />
        <Tile label="Extemporáneos" value={n0(L.extemporaneos)} sub="Normalizables con causa justificada" icon="clock" tone="gold" />
        <Tile label="Faltantes" value={n0(L.faltantes)} sub={cop(L.montoFaltante)} icon="alert" tone="red" />
        <Tile label="Sobrantes" value={n0(L.sobrantes)} sub={cop(L.montoSobrante)} icon="wallet" tone="gold" />
      </div>

      <div className="aqd-grid-main">
        <Panel title="Avance acumulado del mes" icon="chart" sub="Arqueos válidos acumulados por día frente a la meta. Pase el cursor para ver cada día."
          right={<Legend items={[['Acumulado', C.green, 'line'], ['Válidos del día', C.mute], ['Meta', C.navy, 'dash'], ['Proyección', C.cyan, 'dash']]} />}>
          <CumChart serie={d.serie} meta={d.meta} hasta={corte} proyeccion={L.proyeccion} label={`Avance acumulado: ${L.validos} válidos frente a la meta de ${d.meta}`} />
        </Panel>
        <Panel title="Mis oficinas" icon="building" sub="Cobertura del mes">
          <div className="aqd-cover">
            <div className="aqd-cover-n"><b className="num"><CountUp value={String(visitadas)} /></b><span>de {L.oficinas} oficinas con arqueo válido</span></div>
            <StackStrip label="Cobertura de oficinas" parts={[{ label: 'Con arqueo', value: visitadas, color: C.green }, { label: 'Pendientes', value: pendOf, color: '#E3E6EF' }]} />
          </div>
          <ul className="aqd-list">
            <li><span><i style={{ background: C.navy }} />Oficinas a cargo</span><b className="num">{L.oficinas}</b></li>
            <li><span><i style={{ background: C.green }} />Con arqueo este mes</span><b className="num">{visitadas}</b></li>
            <li className={pendOf ? 'hot' : ''}><span><i style={{ background: C.red }} />Pendientes por arquear</span><b className="num">{pendOf}</b></li>
            <li><span><i style={{ background: C.goldInk }} />Con ATM (cuenta 1 vez/mes)</span><b className="num">{L.oficinasATM}</b></li>
          </ul>
          <div className="aqd-split">
            <div className="aqd-split-h"><span>Modalidad</span><small className="num">{modTot} arqueos</small></div>
            <StackStrip label="Presencial frente a virtual" parts={[{ label: 'Presencial', value: L.presenciales || 0, color: C.green }, { label: 'Virtual', value: L.virtuales || 0, color: C.cyan }]} />
            <Legend items={[['Presencial · ' + (L.presenciales || 0), C.green], ['Virtual · ' + (L.virtuales || 0), C.cyan]]} />
          </div>
        </Panel>
      </div>
    </>
  );
}

/* ====================================================================
   Regional / Analista: Dashboard Regional / Global
   ==================================================================== */
const ESTADOS = [['META CUMPLIDA', C.green], ['EN RUTA', '#5CC6A0'], ['EN RIESGO', '#E0B520'], ['SIN INICIAR', C.mute2], ['CRÍTICO', C.red], ['NO CUMPLIDA', '#9E2F29']];

function DashGlobal({ d, user, mes, meses, setMes, reload }) {
  const g = d.global;
  const regional = user.rol === 'Regional';
  const titulo = regional ? 'Dashboard Regional' : 'Dashboard Global';
  const consejos = consejosGlobal(d, user.rol);
  const porEstado = ESTADOS.map(([e, color]) => ({ label: e, color, value: d.lideres.filter((l) => l.estado === e).length })).filter((x) => x.value > 0);
  const sin = Math.max(g.validos - g.faltantes - g.sobrantes, 0);
  const lideresOrd = d.lideres.slice().sort((a, b) => b.validos - a.validos);
  const ringCol = g.pctGlobal >= 100 ? '#3FD07A' : C.cyan;

  return (
    <>
      <Head kicker={'Tablero · ' + user.rol} title={titulo + ' · ' + mesNombre(d.mes)}
        sub={<>Control 100% de la operación · {d.habiles.transcurridos}/{d.habiles.total} días hábiles · {d.habiles.restantes} restantes</>}
        mes={mes} meses={meses} setMes={setMes} />

      <section className="aqd-hero">
        <div className="aqd-hero-main">
          <Ring pct={g.pctGlobal} color={ringCol} size={176} label={`Cumplimiento ${g.pctGlobal}%`}>
            <b className="num"><CountUp value={g.pctGlobal + '%'} /></b><span>cumplimiento</span>
          </Ring>
          <div className="aqd-hero-id">
            <span className="aqd-hero-k">Cumplimiento {regional ? 'de mi regional' : 'global'}</span>
            <div className="aqd-hero-big num"><CountUp value={n0(g.validos)} /><small> / {n0(g.metaGlobal)}</small></div>
            <p className="aqd-hero-sub">arqueos válidos frente a la meta ({g.totalLideres} líderes × {d.meta})</p>
            {porEstado.length > 0 && (
              <div className="aqd-hero-dist">
                <StackStrip label="Líderes por estado" parts={porEstado} />
                <div className="aqd-hero-lg">{porEstado.map((p) => <span key={p.label}><i style={{ background: p.color }} />{p.label} <b>{p.value}</b></span>)}</div>
              </div>
            )}
          </div>
        </div>
        <div className="aqd-hero-stats">
          <div className="aqd-hs"><span>Líderes en meta</span><b className="num"><CountUp value={String(g.cumplenMeta)} /><small> / {g.totalLideres}</small></b><small>cumplen los {d.meta}</small></div>
          <div className="aqd-hs"><span>En riesgo</span><b className="num"><CountUp value={String(g.enRiesgo)} /></b><small>requieren atención</small></div>
          <div className="aqd-hs aqd-hs-bad"><span>Críticos</span><b className="num"><CountUp value={String(g.criticos)} /></b><small>no proyectan meta</small></div>
          <div className="aqd-hs"><span>Extemporáneos</span><b className="num"><CountUp value={String(g.extemporaneos)} /></b><small>{g.normalizados} normalizados</small></div>
        </div>
        {consejos[0] && <p className="aqd-hero-read"><Icon name="sparkle" /><span><b>{consejos[0].titulo}.</b> {consejos[0].texto}</span></p>}
      </section>

      <Asesor consejos={consejos.slice(1)} />

      <div className="aqd-grid4">
        <Tile label="Total arqueos" value={n0(g.totalArqueos)} sub={(g.complementarios || 0) + ' complementarios · ' + (g.atmRepetidos || 0) + ' ATM repetidos'} icon="inbox" tone="navy" />
        <Tile label="Faltantes" value={n0(g.faltantes)} sub={cop(g.montoFaltante)} icon="alert" tone="red" />
        <Tile label="Sobrantes" value={n0(g.sobrantes)} sub={cop(g.montoSobrante)} icon="wallet" tone="gold" />
        <Tile label="Diferencia neta" value={copSigno(g.montoNeto)} sub="Sobrantes − faltantes" icon="chart" tone={g.montoNeto < 0 ? 'red' : 'green'} />
      </div>

      <div className="aqd-grid-main">
        <Panel title="Válidos por líder frente a la meta" icon="users" sub={`Barra en color del semáforo: válidos; gris: extemporáneos. Línea: meta de ${d.meta}.`}
          right={<Legend items={[['Válidos', C.green], ['Extemporáneos', C.mute], ['Meta', C.navy, 'dash']]} />}>
          {lideresOrd.length ? (
            <div className="aqd-scroll-y">
              <HBars label="Válidos por líder" labelW={200} refV={d.meta} refLabel={'Meta ' + d.meta}
                max={Math.max(d.meta * 1.15, ...lideresOrd.map((l) => l.validos + l.extemporaneos))}
                rows={lideresOrd.map((l) => ({
                  key: l.idLider, label: l.nombre,
                  segs: [{ v: l.validos, color: semColor(l.semaforo), name: 'Válidos' }, { v: l.extemporaneos, color: C.mute, name: 'Extemporáneos' }],
                  end: l.validos,
                  tip: [[semColor(l.semaforo), 'Válidos', l.validos], [C.mute, 'Extemporáneos', l.extemporaneos], [null, 'Proyección', l.proyeccion], [null, 'Estado', l.estado]]
                }))} />
            </div>
          ) : <Empty icon="users" title="No hay líderes configurados">Verifica la hoja Usuarios (llave_arqueos = Lider).</Empty>}
        </Panel>
        <Panel title="Estado de novedades" icon="shield" sub="Arqueos válidos según su resultado">
          <Donut label="Estado de novedades" centerLabel="arqueos"
            parts={[
              { label: 'Sin novedad', value: sin, color: C.green },
              { label: 'Faltantes', value: g.faltantes, color: C.red },
              { label: 'Sobrantes', value: g.sobrantes, color: C.gold },
              { label: 'Pendientes (OCR)', value: g.pendientes, color: C.mute2 }
            ]} />
          <div className="aqd-net">
            <div><span>Monto faltante</span><b className="num aqd-neg">{copCorto(g.montoFaltante)}</b></div>
            <div><span>Monto sobrante</span><b className="num">{copCorto(g.montoSobrante)}</b></div>
            <div><span>Neto</span><b className={'num ' + (g.montoNeto < 0 ? 'aqd-neg' : 'aqd-pos')}>{(g.montoNeto < 0 ? '−' : '+') + copCorto(g.montoNeto)}</b></div>
          </div>
        </Panel>
      </div>

      <Panel title="Semáforo de líderes" icon="flag" sub="Ordene por cualquier columna" flush>
        <SortTable rowKey={(l) => l.idLider} initial={{ k: 'validos', dir: 'desc' }} limit={15}
          empty="No hay líderes configurados. Verifica la hoja Usuarios (llave_arqueos = Lider)."
          rows={d.lideres}
          cols={[
            { k: 'nombre', h: 'Líder', render: (l) => <div className="aqd-who"><span className="aqd-av" style={{ background: semColor(l.semaforo) }}>{String(l.nombre).charAt(0)}</span><div><b>{l.nombre}</b><small>{l.oficinas} oficinas · {l.oficinasATM} con ATM</small></div></div> },
            { k: 'validos', h: 'Válidos', align: 'r', render: (l) => <span className="num"><b>{l.validos}</b><span className="muted">/{l.meta}</span></span> },
            { k: 'proyeccion', h: 'Proyección', align: 'r', render: (l) => <b className="num">{l.proyeccion}</b> },
            { k: 'pctReal', h: 'Avance', render: (l) => <div className="aqd-adv"><Meter v={l.pct} tone={l.semaforo === 'verde' ? 'ok' : l.semaforo === 'amarillo' ? 'warn' : 'bad'} /><span className="num">{l.pctReal}%</span></div> },
            { k: 'extemporaneos', h: 'Extemp.', align: 'r', render: (l) => <span className="num">{l.extemporaneos}</span> },
            { k: 'estado', h: 'Estado', sort: (l) => ESTADO_ORDEN[l.estado] ?? 9, render: (l) => <Sem s={l.semaforo}>{l.estado}</Sem> }
          ]} />
      </Panel>
    </>
  );
}
