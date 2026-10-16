// Pestaña Cumplimiento por líder (renderLideres / tarjetaLider de V1).
import { useMemo, useState } from 'react';
import Icon from '../../../../components/Icon.jsx';
import CountUp from '../../../../components/CountUp.jsx';
import { useMes, useRpc, mesNombre, n0, cop, semColor, ESTADO_ORDEN, sinTildes, C } from './lib.js';
import { Head, Sem, Estado, Pills, Search, Empty, Panel } from './ui.jsx';
import { Ring, StackStrip } from './charts.jsx';

const ORDEN = [['validos', 'Más válidos'], ['proyeccion', 'Mayor proyección'], ['riesgo', 'Más urgentes'], ['faltantes', 'Más faltantes'], ['nombre', 'Nombre']];
const EST = [['META CUMPLIDA', C.green], ['EN RUTA', '#5CC6A0'], ['EN RIESGO', '#E0B520'], ['SIN INICIAR', C.mute2], ['CRÍTICO', C.red], ['NO CUMPLIDA', '#9E2F29']];

export function LideresTab({ user }) {
  const { mes, meses, setMes } = useMes(user);
  const q = useRpc('obtenerDashboard', [user.idUsuario, user.rol, mes]);
  return (
    <div className="aqd">
      <Estado q={q} fn="obtenerDashboard">
        {(d) => <Lideres d={d} mes={mes} meses={meses} setMes={setMes} reload={q.reload} />}
      </Estado>
    </div>
  );
}

function Lideres({ d, mes, meses, setMes, reload }) {
  const [filtro, setFiltro] = useState('todos');
  const [orden, setOrden] = useState('validos');
  const [busca, setBusca] = useState('');
  const cuenta = (e) => d.lideres.filter((l) => l.estado === e).length;
  const lista = useMemo(() => {
    let l = d.lideres.slice();
    if (filtro !== 'todos') l = l.filter((x) => x.estado === filtro);
    if (busca) { const b = sinTildes(busca); l = l.filter((x) => sinTildes(x.nombre).includes(b)); }
    const by = {
      validos: (a, b) => b.validos - a.validos,
      proyeccion: (a, b) => b.proyeccion - a.proyeccion,
      riesgo: (a, b) => (ESTADO_ORDEN[a.estado] ?? 9) - (ESTADO_ORDEN[b.estado] ?? 9) || a.validos - b.validos,
      faltantes: (a, b) => b.montoFaltante - a.montoFaltante || b.faltantes - a.faltantes,
      nombre: (a, b) => sinTildes(a.nombre).localeCompare(sinTildes(b.nombre), 'es')
    };
    return l.sort(by[orden]);
  }, [d.lideres, filtro, orden, busca]);
  const parts = EST.map(([e, color]) => ({ label: e, color, value: cuenta(e) })).filter((p) => p.value);
  const g = d.global;

  return (
    <>
      <Head title={'Cumplimiento por líder · ' + mesNombre(d.mes)}
        sub={<>Detalle individual, proyección y control de diferencias. Meta <b>{d.meta} arqueos válidos</b> · {d.habiles.restantes} días hábiles restantes</>}
        mes={mes} meses={meses} setMes={setMes} />

      {d.lideres.length > 0 && (
        <section className="aqd-band">
          <div className="aqd-band-k">
            <div><span>Líderes</span><b className="num"><CountUp value={String(d.lideres.length)} /></b></div>
            <div><span>En meta</span><b className="num aqd-pos"><CountUp value={String(g.cumplenMeta)} /></b></div>
            <div><span>En riesgo</span><b className="num"><CountUp value={String(g.enRiesgo)} /></b></div>
            <div><span>Críticos</span><b className="num aqd-neg"><CountUp value={String(g.criticos)} /></b></div>
            <div><span>Cumplimiento</span><b className="num"><CountUp value={g.pctGlobal + '%'} /></b></div>
          </div>
          <div className="aqd-band-s">
            <StackStrip label="Líderes por estado" parts={parts} />
            <div className="aqd-band-lg">{parts.map((p) => <span key={p.label}><i style={{ background: p.color }} />{p.label} <b>{p.value}</b></span>)}</div>
          </div>
        </section>
      )}

      <div className="aqd-toolbar">
        <Pills label="Estado" value={filtro} onChange={setFiltro}
          items={[['todos', 'Todos', d.lideres.length], ...EST.map(([e]) => [e, e.charAt(0) + e.slice(1).toLowerCase(), cuenta(e)]).filter((x) => x[2] > 0)]} />
        <div className="aqd-toolbar-r">
          <Search value={busca} onChange={setBusca} placeholder="Buscar líder" />
          <label className="aqd-sel sm"><span className="aqd-vh">Ordenar</span>
            <select value={orden} onChange={(e) => setOrden(e.target.value)} aria-label="Ordenar líderes">{ORDEN.map((o) => <option key={o[0]} value={o[0]}>{o[1]}</option>)}</select>
          </label>
        </div>
      </div>

      {!d.lideres.length
        ? <Panel><Empty icon="users" title="No hay líderes visibles">Revisa que la hoja Usuarios tenga líderes con la llave_arqueos “Lider” y que su nombre cruce con la columna LÍDER DE EXCELENCIA del Directorio Nacional.</Empty></Panel>
        : !lista.length ? <Panel><Empty icon="search" title="Ningún líder coincide con el filtro" /></Panel>
          : <div className="aqd-cards">{lista.map((l) => <TarjetaLider key={l.idLider} l={l} />)}</div>}
    </>
  );
}

function TarjetaLider({ l }) {
  const col = semColor(l.semaforo);
  const filas = [
    ['Proyección fin de mes', l.proyeccion, true],
    ['Ritmo requerido / día', l.requeridoPorDia >= 999 ? '—' : String(l.requeridoPorDia).replace('.', ',')],
    ['Faltan para la meta', l.faltanParaMeta],
    ['Extemporáneos', l.extemporaneos],
    ['Presencial / virtual', (l.presenciales || 0) + ' / ' + (l.virtuales || 0)],
    ['Oficinas con arqueo', (l.oficinasVisitadas || 0) + ' / ' + l.oficinas]
  ];
  return (
    <article className="aqd-lcard" style={{ '--sc': col }}>
      <header>
        <span className="aqd-av lg" style={{ background: col }}>{String(l.nombre).charAt(0)}</span>
        <div className="aqd-lcard-n"><b>{l.nombre}</b><small>{l.oficinas} oficinas · {l.oficinasATM} con ATM</small></div>
        <Sem s={l.semaforo}>{l.estado}</Sem>
      </header>
      <div className="aqd-lcard-b">
        <Ring pct={l.pct} color={col} size={112} stroke={10} track="#EEF0F6" label={`${l.validos} de ${l.meta} válidos`}>
          <b className="num aqd-ring-sm">{l.validos}</b><span>/{l.meta}</span>
        </Ring>
        <dl>
          {filas.map((f) => <div key={f[0]}><dt>{f[0]}</dt><dd className="num" style={f[2] ? { color: col } : undefined}>{f[1]}</dd></div>)}
        </dl>
      </div>
      <footer>
        <div className={'aqd-fs aqd-fs-f' + (l.faltantes ? ' on' : '')}><span><Icon name="alert" />Faltantes</span><b className="num">{l.faltantes}</b><small className="num">{cop(l.montoFaltante)}</small></div>
        <div className={'aqd-fs aqd-fs-s' + (l.sobrantes ? ' on' : '')}><span><Icon name="wallet" />Sobrantes</span><b className="num">{l.sobrantes}</b><small className="num">{cop(l.montoSobrante)}</small></div>
        {(l.pendientesGestion || 0) > 0 && <div className="aqd-fs aqd-fs-p on"><span><Icon name="bell" />Por responder</span><b className="num">{n0(l.pendientesGestion)}</b><small>novedades</small></div>}
      </footer>
    </article>
  );
}
